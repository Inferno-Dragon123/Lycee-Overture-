"""Bind the existing Tencent instance to a reviewed deployment-only Git snapshot.

Root only. Does not change the current application, credentials, databases, DNS,
or existing service configuration. Installs only the new Git polling service.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import pwd
import subprocess
import tarfile

REPOSITORY='https://github.com/Inferno-Dragon123/Lycee-Overture-.git'
STATE=Path('/var/lib/lycee-v2-deploy')
PRIVILEGED=['deploy/tencent/'+name for name in ['github-auto-deploy.py','install-github-deploy.py','native-backup.py','workflow_owners.py','audit-personal.py','backup.py']]
def sha(data):return hashlib.sha256(data.replace(b'\r\n',b'\n')).hexdigest()


def main():
    if os.geteuid()!=0:raise SystemExit('Run as root')
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('bundle',type=Path);parser.add_argument('--expected-release',required=True);args=parser.parse_args()
    base=Path('/opt/lycee-v2');current=(base/'current').resolve()
    if current.parent!=base/'releases' or current.name!=args.expected_release:raise ValueError('Live release changed; inspect before binding')
    files={}
    with tarfile.open(args.bundle) as archive:
        for item in archive:
            if item.isdir():continue
            p=PurePosixPath(item.name)
            if not item.isfile() or p.is_absolute() or '..' in p.parts or '\\' in item.name:raise ValueError('Unsafe deployment bundle')
            files[item.name]=archive.extractfile(item).read()
    source=json.loads(files['deployment-source.json'])
    if source.get('repository')!=REPOSITORY or not source.get('buildReady'):raise ValueError('Deployment bundle is not finalized')
    for name,digest in source['files'].items():
        if name not in files or hashlib.sha256(files[name]).hexdigest()!=digest:raise ValueError('Deployment bundle changed: '+name)
    for name in PRIVILEGED:
        if name not in files:raise ValueError('Missing trusted operation')
        existing=current/name
        if existing.exists() and sha(existing.read_bytes())!=sha(files[name]):raise ValueError('Existing privileged operation differs; review first')
    STATE.mkdir(mode=0o755,parents=True,exist_ok=True)
    try:account=pwd.getpwnam('lycee-v2-deploy')
    except KeyError:
        subprocess.run(['useradd','--system','--create-home','--home-dir',str(STATE/'home'),'--shell','/usr/sbin/nologin','--user-group','lycee-v2-deploy'],check=True)
        account=pwd.getpwnam('lycee-v2-deploy')
    if account.pw_uid==0 or account.pw_dir!=str(STATE/'home'):raise ValueError('Unexpected build account')
    private=Path('/etc/lycee-v2/git-deploy.json')
    config={'schema':1,'repository':REPOSITORY,'branch':'main','initialRelease':current.name,
            'trustedOperations':{name:sha(files[name]) for name in PRIVILEGED},
            'cssBaseB64':base64.b64encode(files['app/assets/css/orbit.css']).decode(),
            'cssOverlayB64':base64.b64encode((current/'app/assets/css/orbit.css').read_bytes()).decode()}
    if private.exists():
        old=json.loads(private.read_text())
        if old['repository']!=REPOSITORY or old['branch']!='main' or old['trustedOperations']!=config['trustedOperations']:raise ValueError('Binding exists with different trusted configuration')
        config=old
    else:
        with private.open('x') as output:os.fchmod(output.fileno(),0o600);json.dump(config,output,indent=2)
    installed=Path('/usr/local/lib/lycee-v2');installed.mkdir(mode=0o755,parents=True,exist_ok=True)
    target=installed/'github-auto-deploy.py';target.write_bytes(files['deploy/tencent/github-auto-deploy.py']);target.chmod(0o755)
    for name in ['lycee-v2-github-deploy.service','lycee-v2-github-deploy.timer']:
        target=Path('/etc/systemd/system')/name;target.write_bytes(files['deploy/tencent/'+name]);target.chmod(0o644)
    subprocess.run(['systemd-analyze','verify','/etc/systemd/system/lycee-v2-github-deploy.service','/etc/systemd/system/lycee-v2-github-deploy.timer'],check=True)
    subprocess.run(['systemctl','daemon-reload'],check=True)
    subprocess.run(['systemctl','enable','--now','lycee-v2-github-deploy.timer'],check=True)
    print(json.dumps({'repository':REPOSITORY,'branch':'main','automatic':True,'initialRelease':current.name,'cssOverlayPreserved':True,'databaseModified':False,'mainDomainBound':False}))


if __name__=='__main__':main()
