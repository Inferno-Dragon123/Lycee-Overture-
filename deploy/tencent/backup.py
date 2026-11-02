"""Consistent SQLite snapshot; independent of the old site's COS job."""
import os
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

os.umask(0o077)
source = Path('/var/lib/lycee-v2/workflow.sqlite')
destination = Path('/var/backups/lycee-v2')
destination.mkdir(mode=0o700, parents=True, exist_ok=True)
if not source.is_file():
    raise SystemExit('Database has not been initialized; no snapshot created.')
stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
temporary = destination / f'{stamp}.partial'
with closing(sqlite3.connect(f'file:{source}?mode=ro', uri=True)) as origin:
    with closing(sqlite3.connect(temporary)) as snapshot:
        origin.backup(snapshot)
        snapshot.execute('PRAGMA journal_mode=DELETE')
        if snapshot.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('Snapshot integrity check failed')
temporary.rename(destination / f'{stamp}.sqlite')
for expired in sorted(destination.glob('*.sqlite'))[:-14]:
    expired.unlink()
print('Verified snapshot created; retained up to 14 snapshots.')
