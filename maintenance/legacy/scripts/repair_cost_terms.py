"""Offline, source-aligned COST corrections; audit by default, --apply to write.

Only text fields change. An unresolved mapping prevents the entire write.
Original JSON bytes are backed up before atomic replacement; no API or Git calls.
"""
import argparse
from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile

from translation_terms import normalize_cost_terms

RULE = 'cost-context-v1'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def serialize(data, original):
    text = original.decode('utf-8')
    indentation = re.search(r'\n([ \t]+)\S', text)
    options = {'indent': indentation[1]} if indentation else {'separators': (',', ':')}
    result = json.dumps(data, ensure_ascii=False, **options)
    if '\r\n' in text:
        result = result.replace('\n', '\r\n')
    if text.endswith('\n'):
        result += '\r\n' if '\r\n' in text else '\n'
    return result.encode('utf-8')


def plan_catalog(cards):
    repaired, changes, issues = [], [], []
    for card in cards:
        text, edits, unresolved = normalize_cost_terms(card['textJa'], card['textZh'])
        repaired.append(dict(card, textZh=text))
        if edits:
            changes.append({'code': card['code'], 'occurrences': len(edits), 'before': card['textZh'], 'after': text})
        if unresolved:
            issues.append({'code': card['code'], 'issues': unresolved})
    return repaired, changes, issues


def plan_sources(japanese, chinese):
    original = {(c['code'], c.get('cid')): c for c in japanese['cards']}
    by_code = {}
    for card in japanese['cards']:
        by_code.setdefault(card['code'], []).append(card)
    result, changes, issues = deepcopy(chinese), [], []
    for card in result['cards']:
        source = original.get((card['code'], card.get('cid')))
        if source is None:
            candidates = by_code.get(card['code'], [])
            if len({c.get('japaneseText', '') for c in candidates}) == 1:
                source = candidates[0]
        if source is None:
            if 'COST能力' in card.get('japaneseText', ''):
                issues.append({'code': card['code'], 'issues': ['缺少唯一日文原文']})
            continue
        before = card.get('japaneseText', '')
        after, edits, unresolved = normalize_cost_terms(source.get('japaneseText', ''), before)
        card['japaneseText'] = after
        if edits:
            changes.append({'code': card['code'], 'cid': card.get('cid'), 'occurrences': len(edits), 'before': before, 'after': after})
        if unresolved:
            issues.append({'code': card['code'], 'issues': unresolved})
    return result, changes, issues


def write_changes(writes, backup_dir):
    # Validate every compare-and-swap condition before touching any source.
    if any(path.read_bytes() != before for path, before, _ in writes):
        raise ValueError('JSON changed during correction planning; rerun')
    for path, before, _ in writes:
        target = backup_dir / (path.name + '.' + digest(before) + '.bak')
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            if target.read_bytes() != before:
                raise ValueError('Backup collision')
        else:
            with target.open('xb') as output:
                output.write(before)
    completed = []
    try:
        for path, before, after in writes:
            if path.read_bytes() != before:
                raise ValueError('JSON changed during correction; rerun')
            atomic_write(path, after)
            completed.append((path, before, after))
    except Exception:
        for path, before, after in reversed(completed):
            if path.read_bytes() == after:
                atomic_write(path, before)
        raise


def atomic_write(path, data):
    descriptor, name = tempfile.mkstemp(prefix=path.name + '.', dir=path.parent)
    try:
        os.chmod(name, path.stat().st_mode & 0o777)
        with os.fdopen(descriptor, 'wb') as output:
            output.write(data)
            output.flush()
            os.fsync(output.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--catalog', type=Path)
    source.add_argument('--source-root', type=Path)
    parser.add_argument('--manifest', type=Path)
    parser.add_argument('--backup-dir', type=Path)
    parser.add_argument('--report', type=Path)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args(argv)
    writes = []
    if args.catalog:
        before = args.catalog.read_bytes()
        original = json.loads(before)
        repaired, changes, issues = plan_catalog(original)
        if changes:
            after = serialize(repaired, before)
            writes.append((args.catalog, before, after))
            if args.manifest:
                manifest_before = args.manifest.read_bytes()
                manifest = json.loads(manifest_before)
                if manifest['catalogVersion'] != digest(before) or manifest['cardCount'] != len(original):
                    raise ValueError('Catalog manifest does not match input')
                manifest['catalogVersion'] = digest(after)
                manifest.setdefault('translationCorrections', {})[RULE] = {
                    'sourceCatalogVersion': digest(before), 'correctedCards': len(changes),
                    'correctedOccurrences': sum(c['occurrences'] for c in changes)}
                writes.append((args.manifest, manifest_before, serialize(manifest, manifest_before)))
        root = args.catalog.parent
    else:
        if args.manifest:
            parser.error('--manifest requires --catalog')
        root = args.source_root
        japanese = json.loads((root / 'lycee-japanese-database-final.json').read_bytes())
        target = root / 'lycee-chinese-database-final.json'
        before = target.read_bytes()
        repaired, changes, issues = plan_sources(japanese, json.loads(before))
        if changes:
            writes.append((target, before, serialize(repaired, before)))
    report = {'rule': RULE, 'applied': bool(args.apply and not issues), 'changedRecords': len(changes),
              'changedCodes': len({c['code'] for c in changes}),
              'occurrences': sum(c['occurrences'] for c in changes), 'issues': issues, 'changes': changes}
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if args.apply and not issues:
        write_changes(writes, args.backup_dir or root / '.cost-corrections')
    print(json.dumps({k: v for k, v in report.items() if k != 'changes'}, ensure_ascii=False))
    return 1 if issues else 0


if __name__ == '__main__':
    raise SystemExit(main())
