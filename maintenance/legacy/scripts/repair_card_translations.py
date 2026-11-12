"""Audit and repair reviewed translations, reusing one body per numeric family.

The existing Chinese effect sentence supplies each family's translation. This
command makes no network requests. Each printing retains its original release
note, record identity, timestamps and metadata. Use --apply to write backups and
corrections, and --allow-pending to apply reviewed families while retaining the
families which still require review.
"""
import argparse
from collections import defaultdict
from copy import deepcopy
import json
from pathlib import Path

from repair_cost_terms import digest, serialize, write_changes
from translation_identity import (
    IDENTITY_VERSION, align_translation_body, canonical_groups, numeric_code,
    split_provenance,
)
from translation_protection import VERSION as PROTECTION_VERSION
from update_and_translate import validate_translation


RULE = 'protected-spans-and-variant-reuse-v1'


def _choose_body(base, sources, targets):
    standard = sources[0]
    standard_body, _ = split_provenance(standard.get('japaneseText'))
    if not standard_body.strip():
        return '', standard['code'], []
    attempts = []
    for target, source in targets:
        before = target.get('translation')
        if not isinstance(before, str) or not before.strip():
            continue
        try:
            old_body = align_translation_body(source.get('japaneseText'), before)
            body = validate_translation(standard_body, old_body)
            return body, source['code'], []
        except ValueError as error:
            attempt = {'code': source['code'], 'cid': target.get('cid'),
                       'error': str(error), 'errorType': type(error).__name__}
            if hasattr(error, 'pending'):
                attempt['pendingSpans'] = error.pending
            attempts.append(attempt)
    issue = {'base': base, 'canonicalCode': standard['code'],
             'issues': ['同数字卡号没有通过原文校验的已有中文效果'], 'attempts': attempts}
    return None, None, [issue]


def _plan_groups(sources, targets, field):
    """Plan targets in their input order using the complete Japanese sources."""
    groups = canonical_groups(sources)
    by_identity, by_code = defaultdict(list), defaultdict(list)
    source_rank = {}
    for group in groups.values():
        for rank, source in enumerate(group):
            by_identity[(source['code'], source.get('cid'))].append(source)
            by_code[source['code']].append(source)
            source_rank[id(source)] = rank
    grouped_targets = defaultdict(list)
    issues, invalid_groups = [], set()
    for index, target in enumerate(targets):
        base = numeric_code(target['code'])
        candidates = by_identity.get((target['code'], target.get('cid')))
        if not candidates:
            candidates = by_code.get(target['code'], [])
        texts = {source.get('japaneseText') or '' for source in candidates}
        if len(texts) != 1:
            issues.append({'base': base, 'code': target['code'], 'cid': target.get('cid'),
                           'issues': ['缺少唯一对应的日文原文']})
            invalid_groups.add(base)
            continue
        source = candidates[0]
        grouped_targets[base].append((index, target, source))
    result, changes = deepcopy(targets), []
    for base, members in grouped_targets.items():
        if base in invalid_groups:
            continue
        ordered = sorted(members, key=lambda member: (source_rank[id(member[2])], member[0]))
        candidates = [({**target, 'translation': target.get(field)}, source)
                      for _, target, source in ordered]
        body, chosen_code, unresolved = _choose_body(base, groups[base], candidates)
        if unresolved:
            issues.extend(unresolved)
            continue
        for index, target, source in members:
            _, suffix = split_provenance(source.get('japaneseText'))
            before = target.get(field)
            after = body + suffix
            if before != after:
                result[index][field] = after
                change = {'base': base, 'code': target['code'], 'chosenCode': chosen_code,
                          'before': before, 'after': after}
                if 'cid' in target:
                    change['cid'] = target['cid']
                changes.append(change)
    changes.sort(key=lambda change: (int(change['base'][3:]), change['code'],
                                    str(change.get('cid') or '')))
    return result, changes, issues


def plan_catalog(cards):
    sources = [{**card, 'japaneseText': card.get('textJa') or ''} for card in cards]
    return _plan_groups(sources, cards, 'textZh')


def plan_sources(japanese, chinese):
    cards, changes, issues = _plan_groups(japanese['cards'], chinese['cards'], 'japaneseText')
    return {**deepcopy(chinese), 'cards': cards}, changes, issues


def _group_statistics(sources, targets, changes, issues):
    source_groups = set(canonical_groups(sources))
    target_groups = {numeric_code(card['code']) for card in targets}
    pending = {issue['base'] for issue in issues}
    changed = {change['base'] for change in changes}
    return {'sourceGroups': len(source_groups), 'targetGroups': len(target_groups),
            'validated': len(target_groups - pending), 'pending': len(pending),
            'changed': len(changed), 'unchanged': len(target_groups - pending - changed),
            'withoutTargetRecords': len(source_groups - target_groups)}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    inputs = parser.add_mutually_exclusive_group(required=True)
    inputs.add_argument('--catalog', type=Path)
    inputs.add_argument('--source-root', type=Path)
    parser.add_argument('--manifest', type=Path)
    parser.add_argument('--backup-dir', type=Path)
    parser.add_argument('--report', type=Path)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--allow-pending', action='store_true')
    args = parser.parse_args(argv)
    writes, source_reads = [], []
    if args.catalog:
        root = args.catalog.parent
        before = args.catalog.read_bytes()
        original = json.loads(before)
        sources = [{**card, 'japaneseText': card.get('textJa') or ''} for card in original]
        targets = original
        repaired, changes, issues = plan_catalog(original)
        after = serialize(repaired, before) if changes else before
        if changes:
            writes.append((args.catalog, before, after))
        if args.manifest:
            manifest_before = args.manifest.read_bytes()
            manifest = json.loads(manifest_before)
            if manifest['catalogVersion'] != digest(before) or manifest['cardCount'] != len(original):
                raise ValueError('Catalog manifest does not match input')
            if changes:
                manifest['catalogVersion'] = digest(after)
                manifest.setdefault('translationCorrections', {})[RULE] = {
                    'sourceCatalogVersion': digest(before), 'correctedCards': len(changes),
                    'correctedGroups': len({change['base'] for change in changes}),
                    'pendingGroups': len({issue['base'] for issue in issues}),
                    'protectionVersion': PROTECTION_VERSION, 'identityVersion': IDENTITY_VERSION,
                }
                writes.append((args.manifest, manifest_before, serialize(manifest, manifest_before)))
    else:
        if args.manifest:
            parser.error('--manifest requires --catalog')
        root = args.source_root
        japanese_path = root / 'lycee-japanese-database-final.json'
        japanese_before = japanese_path.read_bytes()
        source_reads.append((japanese_path, japanese_before))
        japanese = json.loads(japanese_before)
        target = root / 'lycee-chinese-database-final.json'
        before = target.read_bytes()
        chinese = json.loads(before)
        sources, targets = japanese['cards'], chinese['cards']
        repaired, changes, issues = plan_sources(japanese, chinese)
        if changes:
            writes.append((target, before, serialize(repaired, before)))
    can_apply = not issues or args.allow_pending
    report = {'rule': RULE, 'protectionVersion': PROTECTION_VERSION,
              'identityVersion': IDENTITY_VERSION,
              'applied': bool(args.apply and can_apply and writes),
              'partial': bool(args.apply and can_apply and writes and issues),
              'changedRecords': len(changes),
              'changedCodes': len({change['code'] for change in changes}),
              'groups': _group_statistics(sources, targets, changes, issues),
              'issues': issues, 'changes': changes}
    if args.apply and can_apply:
        if any(path.read_bytes() != original for path, original in source_reads):
            raise ValueError('Japanese source changed during correction planning; rerun')
        write_changes(writes, args.backup_dir or root / '.translation-corrections')
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({key: value for key, value in report.items() if key not in ('changes', 'issues')}, ensure_ascii=False))
    return 0 if can_apply else 1


if __name__ == '__main__':
    raise SystemExit(main())
