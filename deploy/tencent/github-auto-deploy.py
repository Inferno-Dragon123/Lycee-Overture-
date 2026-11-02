"""Fixed-repository, root-orchestrated deployment; build code as an unprivileged user.

Private config, databases and custom CSS stay outside Git. This installed runner
is not replaced by repo updates. Only an administrator can change trust pins.
"""
import argparse
import base64
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import shlex
import shutil
import signal
import sqlite3
import subprocess
import tarfile
import tempfile
import time
import urllib.request
try:
    import fcntl
    import pwd
except ImportError:  # Pure validation helpers remain testable on Windows.
    fcntl=pwd=None

REPOSITORY='https://github.com/Inferno-Dragon123/Lycee-Overture-.git'
BRANCH='main'
BASE=Path('/opt/lycee-v2')
STATE=Path('/var/lib/lycee-v2-deploy')
BUILD_USER='lycee-v2-deploy'
CSS='app/assets/css/orbit.css'


def sha(data):return hashlib.sha256(data).hexdigest()
def normal(data):return data.replace(b'\r\n',b'\n')
def utc():return dt.datetime.now(dt.timezone.utc).isoformat()
def active(unit):return subprocess.run(['systemctl','is-active','--quiet',unit]).returncode==0
def run(args,**kwargs):return subprocess.run(args,check=True,**kwargs)
def build(args,**kwargs):return run(['runuser','-u',BUILD_USER,'--',*args],**kwargs)


def github_commit():
    request=urllib.request.Request('https://api.github.com/repos/Inferno-Dragon123/Lycee-Overture-/commits/main',headers={'User-Agent':'Lycee-V2-Deploy','Accept':'application/vnd.github+json'})
    with urllib.request.urlopen(request,timeout=20) as response:commit=json.load(response)['sha']
    if len(commit)!=40 or any(c not in '0123456789abcdef' for c in commit):raise ValueError('Invalid Git commit')
    return commit


def github_snapshot(commit):
    if len(commit)!=40 or any(c not in '0123456789abcdef' for c in commit):raise ValueError('Invalid Git commit')
    request=urllib.request.Request('https://codeload.github.com/Inferno-Dragon123/Lycee-Overture-/tar.gz/'+commit,headers={'User-Agent':'Lycee-V2-Deploy'})
    with urllib.request.urlopen(request,timeout=120) as response:archive=response.read(100*1024*1024+1)
    if len(archive)>100*1024*1024:raise ValueError('Repository archive exceeds deployment limit')
    return unwrap_github_archive(archive,commit)


def unwrap_github_archive(archive,commit):
    prefix='Lycee-Overture--'+commit+'/'
    output=io.BytesIO()
    with tarfile.open(fileobj=io.BytesIO(archive),mode='r:gz') as bundle,tarfile.open(fileobj=output,mode='w') as result:
        for item in bundle:
            if item.isdir():continue
            if not item.isfile() or not item.name.startswith(prefix):raise ValueError('Unexpected GitHub archive member')
            name=item.name[len(prefix):]
            if not safe_member(name):raise ValueError('Unsafe repository member')
            info=tarfile.TarInfo(name);info.size=item.size;result.addfile(info,bundle.extractfile(item))
    return output.getvalue()


def safe_candidate_cleanup(path,current,release_root):
    return (path.parent.resolve()==release_root.resolve() and path.name.startswith('github-candidate-')
            and not path.is_symlink() and path.resolve()!=current.resolve())


def safe_member(name):
    p=PurePosixPath(name)
    return bool(name) and not p.is_absolute() and '..' not in p.parts and '\\' not in name and ':' not in name and not any(ord(c)<32 for c in name) and not any(part in {'.git','node_modules','.data','.output','.nuxt','__pycache__'} for part in p.parts) and not (p.name.startswith('.env') and name!='.env.example') and p.suffix.lower() not in {'.pem','.key','.sqlite','.db','.log','.bak'}


def merge_css(incoming,base,overlay):
    if normal(incoming)==normal(base):return overlay
    if normal(overlay)==normal(base):return incoming
    with tempfile.TemporaryDirectory() as folder:
        paths=[]
        for name,data in [('incoming',incoming),('base',base),('overlay',overlay)]:
            p=Path(folder)/name;p.write_bytes(normal(data));paths.append(str(p))
        result=subprocess.run(['git','merge-file','-p',*paths],capture_output=True)
        if result.returncode!=0:raise ValueError('orbit.css has an unresolved server-overlay merge conflict')
        return result.stdout


def read_env(path):
    result={}
    if path.exists():
        for line in path.read_text().splitlines():
            if not line or line.startswith('#') or '=' not in line:continue
            key,value=line.split('=',1);values=shlex.split(value,comments=False)
            if len(values)==1:result[key]=values[0]
            elif not values:result[key]=''
    return result


def extract_snapshot(archive,target,config):
    with tarfile.open(fileobj=io.BytesIO(archive)) as bundle:
        files={}
        for item in bundle:
            if item.isdir():continue
            if not item.isfile() or not safe_member(item.name):raise ValueError('Unsafe repository member')
            files[item.name]=bundle.extractfile(item).read()
    source=json.loads(files.get('deployment-source.json',b'{}'))
    if source.get('repository')!=REPOSITORY or not source.get('buildReady'):raise ValueError('Missing finalized deployment source inventory')
    # Git's fetched commit authenticates current source. The export inventory is
    # baseline provenance; ordinary later pushes need not regenerate it.
    source['files']={name:sha(data) for name,data in files.items() if name!='deployment-source.json'}
    for name,digest in config['trustedOperations'].items():
        if name not in files or sha(normal(files[name]))!=digest:raise ValueError('Administrator review required for trusted operation: '+name)
    allowed_python={name for name in config['trustedOperations'] if name.endswith('.py')}
    if any(name.startswith('deploy/tencent/') and name.endswith('.py') and name not in allowed_python for name in files):raise ValueError('Unapproved privileged operation')
    base=base64.b64decode(config['cssBaseB64'],validate=True) if 'cssBaseB64' in config else Path(config['cssBase']).read_bytes()
    overlay=base64.b64decode(config['cssOverlayB64'],validate=True) if 'cssOverlayB64' in config else Path(config['cssOverlay']).read_bytes()
    css=merge_css(files[CSS],base,overlay)
    for name,data in files.items():
        p=target/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(css if name==CSS else data)
    return source,sha(css)


def freeze(target):
    # Seal parent directories before checking build output; never follow a link
    # outside the release. The build account cannot edit the release afterward.
    for directory,dirs,files in os.walk(target,followlinks=False):
        path=Path(directory);os.chown(path,0,0);os.chmod(path,0o755)
        for name in [*dirs,*files]:
            p=path/name
            if p.is_symlink():
                if not p.resolve().is_relative_to(target.resolve()):raise ValueError('Build output link leaves release')
                os.chown(p,0,0,follow_symlinks=False)
            elif p.is_file():
                mode=p.stat().st_mode;os.chown(p,0,0);os.chmod(p,mode&0o755)


def verify_built(target,source,css_hash,config):
    for name,digest in source['files'].items():
        expected=css_hash if name==CSS else digest
        if sha((target/name).read_bytes())!=expected:raise ValueError('Build changed tracked source: '+name)
    for name,digest in config['trustedOperations'].items():
        if sha(normal((target/name).read_bytes()))!=digest:raise ValueError('Build changed privileged operation')


def health(origin,configured):
    def get(path):
        with urllib.request.urlopen(origin+path,timeout=30) as response:
            if response.status!=200:raise ValueError('Unhealthy deployment response')
            return response.read()
    session=json.loads(get('/api/workflow/session'))
    if session['configured'] is not configured or session['user'] is not None:raise ValueError('Unexpected account configuration')
    data=json.loads(get('/api/cards/search?q=LO-0001'))
    if not any(card['code']=='LO-0001' for card in data['cards']):raise ValueError('Card catalog unavailable')
    for page in ['/concepts/orbit','/concepts/orbit/cards','/concepts/orbit/learn','/concepts/orbit/account']:
        if b'<!DOCTYPE html>' not in get(page) and b'<!doctype html>' not in get(page):raise ValueError('Page unavailable')


def stage(target,sha_id):
    folder=STATE/'stage'/sha_id;folder.mkdir(parents=True,exist_ok=True)
    account=pwd.getpwnam('lycee-v2');os.chown(folder,account.pw_uid,account.pw_gid);folder.chmod(0o700)
    database=folder/'workflow.sqlite'
    with sqlite3.connect('file:/var/lib/lycee-v2/workflow.sqlite?mode=ro',uri=True) as source:
        with sqlite3.connect(database) as snapshot:source.backup(snapshot)
    os.chown(database,account.pw_uid,account.pw_gid);database.chmod(0o600)
    env={**os.environ,**read_env(Path('/etc/lycee-v2/runtime.env')),**read_env(Path('/etc/lycee-v2/native.env')),
         'HOST':'127.0.0.1','PORT':'3201','NUXT_WORKFLOW_DATABASE_PATH':str(database),'NUXT_WORKFLOW_AUTH_ORIGIN':'',
         'NUXT_WORKFLOW_AUTH_PUBLIC_ORIGIN':'','NUXT_WORKFLOW_AUTH_MODE':'local','NUXT_WORKFLOW_PUBLIC_ORIGIN':'http://127.0.0.1:3201'}
    with (folder/'app.log').open('wb') as log:
        process=subprocess.Popen(['runuser','-u','lycee-v2','--','/usr/local/bin/node','.output/server/index.mjs'],cwd=target,env=env,stdout=log,stderr=log,start_new_session=True)
        try:
            for i in range(45):
                try:health('http://127.0.0.1:3201',False);return
                except Exception:
                    if process.poll() is not None or i==44:raise RuntimeError('Isolated deployment health check failed') from None
                    time.sleep(1)
        finally:
            if process.poll() is None:
                os.killpg(process.pid,signal.SIGTERM)
                try:process.wait(timeout=8)
                except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL);process.wait()
            if folder.resolve().is_relative_to((STATE/'stage').resolve()) and not folder.is_symlink():shutil.rmtree(folder)


def switch(target):
    link=BASE/'current.github.next'
    if link.exists() or link.is_symlink():raise ValueError('Pending deployment pointer exists')
    link.symlink_to(target);link.replace(BASE/'current')


def auth_fingerprint(path):
    return sha(b''.join(p.relative_to(path).as_posix().encode()+p.read_bytes() for p in sorted((path/'services/auth').glob('*')) if p.is_file()))


def promote(target,commit,source,css_hash,config):
    previous=(BASE/'current').resolve();timer=active('lycee-v2-maintenance.timer')
    with Path('/var/lib/lycee/images/.v2-maintenance.lock').open('a') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:raise RuntimeError('Maintenance is running; deployment deferred') from None
        try:
            if timer:run(['systemctl','stop','lycee-v2-maintenance.timer'])
            run(['systemctl','start','lycee-v2-cos.service'])
            if subprocess.check_output(['systemctl','show','lycee-v2-cos.service','-p','Result','--value'],text=True).strip()!='success':raise ValueError('Pre-deployment backup failed')
            manifest={'githubRepository':REPOSITORY,'githubBranch':BRANCH,'githubCommit':commit,'sourceCommit':source['sourceCommit'],
                'previousRelease':previous.name,'userCssOverlay':True,'orbitCssSha256':css_hash,'nativeAuth':True,'mainDomainBound':False,'deployedAt':utc()}
            (target/'release-manifest.json').write_text(json.dumps(manifest,indent=2))
            destination=BASE/'releases'/('github-'+commit[:12]+'-'+css_hash[:8])
            if destination.exists():raise ValueError('Release already exists; administrator check required')
            target.rename(destination)
            changed_auth=auth_fingerprint(destination)!=auth_fingerprint(previous)
            switch(destination)
            try:
                if changed_auth:run(['systemctl','restart','lycee-v2-auth.service'])
                run(['systemctl','restart','lycee-v2.service'])
                for i in range(45):
                    try:health('http://127.0.0.1:3200',True);break
                    except Exception:
                        if i==44:raise RuntimeError('Live deployment health check failed') from None
                        time.sleep(1)
            except Exception:
                switch(previous)
                if changed_auth:run(['systemctl','restart','lycee-v2-auth.service'])
                run(['systemctl','restart','lycee-v2.service']);raise
            return destination
        finally:
            if timer:run(['systemctl','start','lycee-v2-maintenance.timer'])


def write_status(value):
    value['checkedAt']=utc();temporary=STATE/'status.next.json';temporary.write_text(json.dumps(value,indent=2));temporary.chmod(0o644);temporary.replace(STATE/'status.json')


def main():
    if os.geteuid()!=0:raise SystemExit('Run the installed deployment service as root')
    parser=argparse.ArgumentParser();parser.add_argument('--force',action='store_true');args=parser.parse_args()
    config=json.loads(Path('/etc/lycee-v2/git-deploy.json').read_text())
    if config.get('repository')!=REPOSITORY or config.get('branch')!=BRANCH:raise ValueError('Repository binding guard failed')
    STATE.mkdir(parents=True,exist_ok=True)
    with (STATE/'deploy.lock').open('a') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:return
        try:commit=github_commit()
        except Exception as error:
            write_status({'state':'connection-failed','repository':REPOSITORY,'error':str(error)[:300]});return
        current=json.loads((BASE/'current/release-manifest.json').read_text())
        if current.get('githubCommit')==commit:
            write_status({'state':'current','repository':REPOSITORY,'commit':commit,'release':str((BASE/'current').resolve())});return
        previous_status=json.loads((STATE/'status.json').read_text()) if (STATE/'status.json').exists() else {}
        if not args.force and previous_status.get('state')=='failed' and previous_status.get('commit')==commit and time.time()-previous_status.get('failedAt',0)<300:return
        target=BASE/'releases'/('github-candidate-'+commit[:12]+'-'+str(os.getpid()))
        try:
            write_status({'state':'building','repository':REPOSITORY,'commit':commit})
            archive=github_snapshot(commit)
            target.mkdir();source,css_hash=extract_snapshot(archive,target,config)
            account=pwd.getpwnam(BUILD_USER)
            for directory,dirs,files in os.walk(target):
                os.chown(directory,account.pw_uid,account.pw_gid)
                for name in files:os.chown(Path(directory)/name,account.pw_uid,account.pw_gid)
            with (STATE/'build.log').open('wb') as log:
                for command in [['npm','ci','--no-audit','--no-fund'],['npm','run','typecheck'],['npm','run','build'],['npm','--prefix','services/auth','ci','--omit=dev','--no-audit','--no-fund']]:
                    build(command,cwd=target,stdout=log,stderr=subprocess.STDOUT,timeout=1200)
            freeze(target);verify_built(target,source,css_hash,config);stage(target,commit)
            destination=promote(target,commit,source,css_hash,config)
            write_status({'state':'deployed','repository':REPOSITORY,'commit':commit,'release':str(destination),'cssSha256':css_hash})
            print(json.dumps({'state':'deployed','commit':commit,'release':str(destination)}))
        except Exception as error:
            if target.exists() and safe_candidate_cleanup(target,BASE/'current',BASE/'releases'):shutil.rmtree(target)
            write_status({'state':'failed','repository':REPOSITORY,'commit':commit,'failedAt':time.time(),'error':str(error)[:500]})
            print('Deployment failed; current application and databases retained. See status.json and build.log.')
            raise SystemExit(1) from None


if __name__=='__main__':main()
