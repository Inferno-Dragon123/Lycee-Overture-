"""Ownership coverage for old and current SQLite schemas; no private values logged."""
TABLES = {'personal_data':'owner','personal_history':'owner','publications':'owner','cardbacks':'owner','profiles':'id',
          'strategy_articles':'owner','strategy_media':'owner','strategy_snapshots':'owner','player_groups':'owner'}

def workflow_owners(db):
    present={row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    owners=set()
    for table,column in TABLES.items():
        if table not in present:
            continue
        for row in db.execute(f'SELECT DISTINCT {column} FROM {table}'):
            if not isinstance(row[0],str) or not row[0]:
                raise ValueError('Invalid data owner in '+table)
            owners.add(row[0])
    return owners
