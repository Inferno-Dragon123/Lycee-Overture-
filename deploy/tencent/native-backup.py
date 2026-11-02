"""Back up V2 SQLite first, then local PostgreSQL; restore-test and encrypt both.

Root only. Plain staging files are private and removed after verification.
The source Neon connection is never used. Retain fourteen encrypted bundles.
"""
import datetime as dt,fcntl,hashlib,importlib.util,json,os,pathlib,re,shutil,sqlite3,subprocess,tarfile,tempfile
from contextlib import closing
from workflow_owners import workflow_owners

if os.geteuid()!=0:raise SystemExit('Run as root')
os.umask(0o077)
database=os.environ.get('LYCEE_NATIVE_DATABASE','lycee_v2')
if not re.fullmatch(r'lycee_v2(?:_stage_\d+)?',database):raise SystemExit('Backup database guard failed')
root=pathlib.Path('/var/backups/lycee-v2-native');root.mkdir(mode=0o700,exist_ok=True)
lock=(root/'backup.lock').open('a');fcntl.flock(lock,fcntl.LOCK_EX)
release=pathlib.Path('/opt/lycee-v2/current')
stamp=dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+str(os.getpid())
directory=root/stamp;directory.mkdir(mode=0o700)
def run(args,**kwargs):return subprocess.run(args,check=True,**kwargs)
def pg(sql,db='postgres'):
    return run(['runuser','-u','postgres','--','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-d',db],input=sql,text=True,capture_output=True).stdout.strip().splitlines()
with tempfile.TemporaryDirectory(prefix='plain-',dir=directory) as raw:
    temporary=pathlib.Path(raw);sqlite=temporary/'workflow.sqlite';dump=temporary/'postgres.dump'
    # An account is committed before its personal data. Taking SQLite first avoids
    # restoring personal rows whose newly-created account is absent from the PG dump.
    with closing(sqlite3.connect('file:/var/lib/lycee-v2/workflow.sqlite?mode=ro',uri=True)) as source:
        with closing(sqlite3.connect(sqlite)) as snapshot:
            source.backup(snapshot)
            snapshot.execute('PRAGMA journal_mode=DELETE')
            assert snapshot.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
    with dump.open('wb') as out:run(['runuser','-u','postgres','--','pg_dump','--format=custom','--no-owner','--no-acl','-d',database],stdout=out)
    verify='lycee_v2_verify_'+str(os.getpid())
    pg('CREATE DATABASE '+verify+';')
    try:
        with dump.open('rb') as stream:run(['runuser','-u','postgres','--','pg_restore','--exit-on-error','--single-transaction','--no-owner','--no-acl','-d',verify],stdin=stream,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
        identities=set(pg('BEGIN READ ONLY; SELECT id FROM toolbox_auth_users; ROLLBACK;',verify))
        with closing(sqlite3.connect(f'file:{sqlite}?mode=ro&immutable=1',uri=True)) as snapshot:
            owners=workflow_owners(snapshot)
            assert not owners-identities,'Restored ownership mismatch'
            local_posts=snapshot.execute('SELECT count(*) FROM publications').fetchone()[0]
        counts=pg('BEGIN READ ONLY; SELECT count(*) FROM toolbox_publications; SELECT count(*) FROM toolbox_catalog_cards; ROLLBACK;',verify)
        report={'utc':stamp,'database':database,'stageOnly':database!='lycee_v2','restored':True,'accounts':len(identities),'legacyPublications':int(counts[0]),'cards':int(counts[1]),'nativePublications':local_posts}
    finally:
        # Only this process's disposable verification DB can be removed.
        assert re.fullmatch(r'lycee_v2_verify_\d+',verify)
        pg('DROP DATABASE '+verify+';')
    (temporary/'verification.json').write_text(json.dumps(report))
    archive=directory/'backup.tar.age'
    with tempfile.TemporaryFile() as plain:
        with tarfile.open(fileobj=plain,mode='w') as bundle:
            for filename in ['workflow.sqlite','postgres.dump','verification.json']:bundle.add(temporary/filename,arcname=filename)
            bundle.add(release/'release-manifest.json',arcname='release-manifest.json')
            for name in ['runtime.env','auth.env','maintenance.env','native.env','native-config.json']:
                file=pathlib.Path('/etc/lycee-v2')/name
                assert file.is_file() and file.stat().st_uid==0 and not file.stat().st_mode&0o077,'Private config permissions required'
                bundle.add(file,arcname='private/'+name)
            for file in [pathlib.Path('/etc/lycee/dnspod.json'),pathlib.Path('/etc/lycee/cos-backup.json')]:
                bundle.add(file,arcname='private/common/'+file.name)
        plain.seek(0)
        run(['age','--encrypt','--recipients-file','/etc/lycee/backup-recipient.txt','--output',str(archive)],stdin=plain)
    with archive.open('rb') as stream:checksum=hashlib.file_digest(stream,'sha256').hexdigest()
    spec=importlib.util.spec_from_file_location('cos','/usr/local/lib/lycee/cos-backup.py');cos=importlib.util.module_from_spec(spec);spec.loader.exec_module(cos)
    remote=cos.upload_backup(archive,stamp,checksum,cos.load_credentials('/etc/lycee/cos-backup.json'));cos.save_report(directory,remote)
    report.update({'encrypted':True,'encryptedSha256':checksum,'offsiteVerified':remote['offsiteVerified']})
    (directory/'verification.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
for old in sorted(p for p in root.iterdir() if p.is_dir() and re.fullmatch(r'\d{8}T\d{6}Z-\d+',p.name))[:-14]:
    assert old.resolve().is_relative_to(root.resolve()) and not old.is_symlink()
    shutil.rmtree(old)
