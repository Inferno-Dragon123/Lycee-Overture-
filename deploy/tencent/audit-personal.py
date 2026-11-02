"""Check migrated ownership and synthetic cleanup, reporting aggregate counts only."""
import json
import sqlite3
import subprocess
import os
import re
from contextlib import closing
from workflow_owners import workflow_owners

database=os.environ.get('LYCEE_NATIVE_DATABASE')
if not database:
    present=subprocess.run(['runuser','-u','postgres','--','psql','-X','-qAt','-d','postgres','-c',"SELECT 1 FROM pg_database WHERE datname='lycee_v2'"],capture_output=True,text=True,check=True).stdout.strip()
    database='lycee_v2' if present else 'lycee_production'
assert re.fullmatch(r'lycee_(?:production|v2(?:_stage_\d+)?)',database),'Audit target guard failed'
def pg(query):
    return subprocess.run(['runuser', '-u', 'postgres', '--', 'psql', '-X', '-qAt', '-d', database, '-c', 'BEGIN READ ONLY; '+query+'; ROLLBACK;'], capture_output=True, text=True, check=True).stdout.strip()

accounts = set(pg('SELECT id FROM toolbox_auth_users').splitlines())
synthetic = int(pg("SELECT count(*) FROM toolbox_auth_users WHERE email LIKE 'codex-v2-%@example.invalid'"))
assert synthetic == 0, 'Synthetic auth identity still exists'
with closing(sqlite3.connect('file:/var/lib/lycee-v2/workflow.sqlite?mode=ro',uri=True)) as db:
    db.execute('PRAGMA query_only=ON')
    owners = workflow_owners(db)
    assert not owners - accounts, 'Business records have no authenticated owner'
    for raw, in db.execute('SELECT data FROM personal_data'):
        data = json.loads(raw)
        assert data['schema'] == 1
        assert all(sum(deck['quantities'].values()) == 60 for deck in data['library']['saved'])
    report = {'accounts': len(accounts), 'profiles': db.execute('SELECT count(*) FROM profiles').fetchone()[0],
              'publications': db.execute('SELECT count(*) FROM publications').fetchone()[0],
              'personalOwners': db.execute('SELECT count(*) FROM personal_data').fetchone()[0],
              'missingOwners': 0, 'syntheticAccounts': synthetic}
print(json.dumps(report))
