"""Reviewed source spans, exact punctuation, and translatable effect parameters."""
from dataclasses import dataclass, field
from functools import lru_cache
import hashlib
import json
from pathlib import Path
import re
import unicodedata

VERSION = 'reviewed-spans-v2'
PAIRS = {'[': ']', '［': '］', '『': '』', '「': '」', '<': '>', '＜': '＞'}
FAMILIES = {'[': 'square', '［': 'square', '『': 'doubleQuote', '「': 'singleQuote',
            '<': 'angle', '＜': 'angle'}
TARGET_ALIASES = {'《': ('》', 'doubleQuote'), '“': ('”', 'singleQuote'),
                  '〈': ('〉', 'angle')}
TERMS = {
    'ステップ': '移动', 'サイドステップ': '横向侧移', 'オーダーステップ': '纵向移动',
    'オーダーチェンジ': '位置交换', 'ジャンプ': '跳跃', 'ペナルティ': '离场惩罚',
    'アグレッシブ': '进取心', 'アシスト': '辅助', 'エンゲージ': '结合',
    'リカバリー': '补正', 'ガッツ': '斗志', 'リーダー': '领导',
    'サポーター': '支援者', 'ボーナス': '奖励', 'チャージ': '充能',
    'ターンリカバリー': '回合补正', 'プリンシパル': '主演', 'サプライズ': '突袭',
    'コスト': 'COST能力', 'エリア': '场地', 'コンバート': '换装',
    '宣言': '宣言', '誘発': '诱发', '常時': '常时', '手札宣言': '手牌宣言',
    'ゴミ箱宣言': '弃牌堆宣言', '切札': '切札',
    'チーム': '团队', '装備制限': '装备限制', '非シングル': '非シングル',
}
SYMBOL = re.compile(r'(?:[A-Z][A-Z0-9]*|[0-9０-９]+|[雪月花宙日無]+)\Z')


class PendingReview(ValueError):
    def __init__(self, inventory):
        self.inventory = inventory
        self.pending = [item for item in inventory if item['kind'] == 'pending']
        super().__init__(f'{len(self.pending)} source spans require review')


@dataclass
class Span:
    start: int
    end: int
    family: str
    closed: bool = True
    children: list = field(default_factory=list)
    id: int = -1

    def content(self, text):
        return text[self.start + 1:self.end - 1] if self.closed else text[self.start:self.end]


def parse_spans(text, target=False):
    pairs, families = dict(PAIRS), dict(FAMILIES)
    if target:
        for opening, (closing, family) in TARGET_ALIASES.items():
            pairs[opening], families[opening] = closing, family
    closers = {closing: families[opening] for opening, closing in pairs.items()}

    def read(start):
        opening, cursor, children = text[start], start + 1, []
        while cursor < len(text):
            ch = text[cursor]
            if ch == pairs[opening]:
                return Span(start, cursor + 1, families[opening], children=children)
            if ch == '\n' and families[opening] == 'square':
                break
            if ch in pairs:
                child = read(cursor)
                children.append(child)
                cursor = child.end
            elif ch in closers:
                children.append(Span(cursor, cursor + 1, closers[ch], closed=False))
                cursor += 1
            else:
                cursor += 1
        return Span(start, start + 1, families[opening], closed=False)

    roots, cursor = [], 0
    while cursor < len(text):
        ch = text[cursor]
        if ch in pairs:
            node = read(cursor)
            roots.append(node)
            cursor = node.end
        elif ch in closers:
            roots.append(Span(cursor, cursor + 1, closers[ch], closed=False))
            cursor += 1
        else:
            cursor += 1
    for index, node in enumerate(flatten(roots)):
        node.id = index
    return roots


def flatten(nodes):
    for node in nodes:
        yield node
        yield from flatten(node.children)


@lru_cache(maxsize=1)
def read_review():
    review = json.loads(Path(__file__).with_name('translation_review.json').read_text(encoding='utf-8'))
    if review.get('version') != 1 or not isinstance(review.get('phrases'), dict):
        raise ValueError('Invalid translation review registry')
    for phrase, entry in review['phrases'].items():
        if not isinstance(phrase, str) or not isinstance(entry, dict):
            raise ValueError('Invalid reviewed phrase')
        for decision in [entry, *entry.get('contexts', {}).values()]:
            if decision.get('kind') not in ('name', 'literal', 'term', 'effect'):
                raise ValueError('Unconfirmed classification in the review registry')
            if 'translation' in decision and not isinstance(decision['translation'], str):
                raise ValueError('Invalid reviewed terminology')
            if decision.get('afterPattern'):
                re.compile(decision['afterPattern'])
    if any(not re.fullmatch('[0-9a-f]{64}', value) for value in review.get('sourceHashes', {})):
        raise ValueError('Invalid reviewed source hash')
    return review


@lru_cache(maxsize=1)
def review_digest():
    return hashlib.sha256(Path(__file__).with_name('translation_review.json').read_bytes()).hexdigest()


def _review_entry(review, text, node):
    phrase = node.content(text)
    entry = review.get('phrases', {}).get(phrase)
    if entry is None:
        return None
    if entry.get('contexts') and node.family not in entry['contexts']:
        return None
    entry = {**entry, **entry.get('contexts', {}).get(node.family, {})}
    allowed = entry.get('families')
    if allowed and node.family not in allowed:
        return None
    if entry.get('scope') == 'zoneLabel' and not re.search(
            entry.get('afterPattern', r'^\s*置き場'), text[node.end:]):
        return entry.get('otherwise', {'kind': 'literal', 'evidence': 'Original named identifier'})
    return entry


def _name_reference(text, node):
    before, after = text[max(0, node.start - 60):node.start], text[node.end:node.end + 30]
    named_context = re.search(r'(?:キャラ名|カード名|サブネーム|名前|名称)', before)
    return bool(re.search(r'(?:キャラ名|カード名|サブネーム|名前|名称)(?:が|は|に|を|と|[:：])?\s*$', before)
                or re.match(r'\s*(?:という名前|という名称|というキャラ|というカード)', after)
                or (named_context and re.match(r'\s*(?:を含む|を含んだ)', after)))


def _ability_position(text, node):
    before = text[text.rfind('\n', 0, node.start) + 1:node.start]
    residue = before
    for previous in reversed(parse_spans(before)):
        residue = residue[:previous.start] + residue[previous.end:]
    if not residue.strip():
        return True
    after = text[node.end:node.end + 40]
    return bool(re.match(r'\s*(?:を(?:得|失|持|使用)|が(?:失|有効)|という能力|の(?:基本能力|効果))', after)
                or re.search(r'(?:基本能力|能力)\s*$', before))


def classify_spans(text, review=None):
    review = review if review is not None else read_review()
    roots = parse_spans(text)
    inventory = []
    source_approved = hashlib.sha256(text.encode()).hexdigest() in review.get('sourceHashes', {})

    def visit(node, inherited=False):
        content = node.content(text)
        decision = None
        heading = re.split('[:：]', content, maxsplit=1)[0]
        normalized = unicodedata.normalize('NFKC', heading).strip()
        team = re.fullmatch(r'チーム\([0-9]+\)', normalized)
        if inherited:
            decision = {'kind': 'name', 'evidence': 'Inside an opaque source identifier'}
        elif not node.closed:
            decision = {'kind': 'literal' if source_approved else 'pending',
                        'evidence': 'Reviewed unmatched source delimiter' if source_approved
                        else 'Unreviewed unmatched delimiter may hide an identifier'}
        elif node.family in ('doubleQuote', 'angle'):
            decision = {'kind': 'name', 'evidence': 'Owner-confirmed opaque delimiter'}
        elif _name_reference(text, node):
            decision = {'kind': 'name', 'evidence': 'Explicit card or character name matching context'}
        elif node.family == 'square' and SYMBOL.fullmatch(content):
            decision = {'kind': 'literal', 'evidence': 'Cost, statistic, or series symbol'}
        elif node.family == 'square' and (normalized in TERMS or team):
            phrase_entry = review.get('phrases', {}).get(heading.strip(), {})
            if not source_approved and (phrase_entry.get('kind') == 'name' or not _ability_position(text, node)):
                decision = {'kind': 'pending', 'evidence': 'Ambiguous ability or name in an unreviewed source'}
            else:
                value = '团队' + re.search(r'[（(].*[）)]', heading)[0] if team else TERMS[normalized]
                decision = {'kind': 'term', 'translation': value,
                            'heading': heading, 'evidence': 'Basic ability or action heading'}
        else:
            decision = _review_entry(review, text, node)
            if decision and decision['kind'] in ('effect', 'term') and not source_approved:
                decision = {'kind': 'pending', 'evidence': 'Translatable phrase appears in a new, unreviewed source context'}
        if not decision:
            decision = {'kind': 'pending', 'evidence': 'No confirmed classification'}
        item = {**decision, 'id': node.id, 'start': node.start, 'end': node.end,
                'family': node.family, 'source': text[node.start:node.end], 'content': content,
                'closed': node.closed}
        inventory.append(item)
        opaque = inherited or decision['kind'] in ('name', 'literal')
        for child in node.children:
            visit(child, opaque)
    for root in roots:
        visit(root)
    return roots, inventory


def punctuation(text):
    return ''.join(ch for ch in text if ch in ''.join(PAIRS.keys()) + ''.join(PAIRS.values()))


class ProtectedTranslation:
    def __init__(self, original, review=None):
        self.original = original
        self.review = review if review is not None else read_review()
        self.roots, self.inventory = classify_spans(original, self.review)
        if any(item['kind'] == 'pending' for item in self.inventory):
            raise PendingReview(self.inventory)
        self.decisions = {item['id']: item for item in self.inventory}
        self.prefix = '__LO_' + hashlib.sha256(original.encode()).hexdigest()[:8] + '_'
        while self.prefix in original:
            self.prefix += 'X'
        self.fixed = {}
        self.encoded = self._encode()

    def _token(self, value):
        token = self.prefix + str(len(self.fixed)) + '__'
        self.fixed[token] = value
        return token

    def _encode(self):
        def render(node):
            decision = self.decisions[node.id]
            raw = self.original[node.start:node.end]
            kind = decision['kind']
            if kind in ('name', 'literal'):
                return self._token(raw)
            if (node.family != 'square' and kind == 'term') or (
                    kind == 'effect' and decision.get('translation') and not node.children):
                return self._token(raw[0] + decision['translation'] + raw[-1])
            opening = self._token(raw[0])
            start = node.start + 1
            prefix = ''
            if kind == 'term':
                heading = decision.get('heading', node.content(self.original))
                prefix = self._token(decision['translation'])
                start += len(heading)
            pieces, position = [opening, prefix], start
            for child in node.children:
                pieces.extend((self.original[position:child.start], render(child)))
                position = child.end
            pieces.extend((self.original[position:node.end - 1], self._token(raw[-1])))
            return ''.join(pieces)
        pieces, position = [], 0
        for root in self.roots:
            pieces.extend((self.original[position:root.start], render(root)))
            position = root.end
        pieces.append(self.original[position:])
        return ''.join(pieces)

    def restore(self, translated):
        found = re.findall(re.escape(self.prefix) + r'\d+__', translated)
        if found != list(self.fixed):
            raise ValueError('Protected source markers were omitted, duplicated, or reordered')
        for token, value in self.fixed.items():
            translated = translated.replace(token, value)
        if punctuation(translated) != punctuation(self.original):
            raise ValueError('Translation changed original delimiters')
        return translated

    def repair(self, translated):
        """Source-aligned repairs preserve translated effect sentences."""
        before = translated
        target_lines = translated.split('\n')
        for alignment in self.review.get('alignments', []):
            for index, source_line in enumerate(self.original.split('\n')):
                if (source_line == alignment['source'] and index < len(target_lines)
                        and target_lines[index] == alignment['before']):
                    target_lines[index] = alignment['after']
        translated = '\n'.join(target_lines)
        target_roots = parse_spans(translated, target=True)
        edits = []

        def pair(source_nodes, target_nodes):
            if len(source_nodes) != len(target_nodes):
                raise ValueError('Source and translation bracket structures differ')
            output = []
            for source, target in zip(source_nodes, target_nodes):
                if source.family != target.family or source.closed != target.closed:
                    raise ValueError('Source and translation bracket families differ')
                decision = self.decisions[source.id]
                source_raw = self.original[source.start:source.end]
                target_raw = translated[target.start:target.end]
                if not source.closed or decision['kind'] in ('name', 'literal'):
                    replacement = source_raw
                elif (decision['kind'] == 'term' and source.family != 'square') or (
                        decision['kind'] == 'effect' and decision.get('translation') and not source.children):
                    replacement = source_raw[0] + decision['translation'] + source_raw[-1]
                else:
                    child_changes = pair(source.children, target.children)
                    interior = translated[target.start + 1:target.end - 1]
                    for child_start, child_end, child_text in reversed(child_changes):
                        a, b = child_start - target.start - 1, child_end - target.start - 1
                        interior = interior[:a] + child_text + interior[b:]
                    if decision['kind'] == 'term':
                        source_heading = decision.get('heading', source.content(self.original))
                        if ':' in source.content(self.original) or '：' in source.content(self.original):
                            match = re.match(r'[^:：]*([:：])', interior)
                            if not match:
                                raise ValueError('Translated ability heading has no parameter separator')
                            interior = decision['translation'] + interior[match.end() - 1:]
                        else:
                            interior = decision['translation']
                    replacement = source_raw[0] + interior + source_raw[-1]
                if target_raw != replacement:
                    edits.append({'id': source.id, 'before': target_raw, 'after': replacement,
                                  'kind': decision['kind']})
                output.append((target.start, target.end, replacement))
            return output

        replacements = pair(self.roots, target_roots)
        for start, end, replacement in reversed(replacements):
            translated = translated[:start] + replacement + translated[end:]
        if punctuation(self.original) != punctuation(translated):
            raise ValueError('Corrected delimiters differ from the source')
        return translated, edits if translated != before else []

    def mask_names(self, translated):
        """Mask identifiers for legacy prose terminology checks, preserving rows."""
        target_roots = parse_spans(translated)
        source_edits, target_edits, hidden = [], [], {}
        def visit(sources, targets):
            if len(sources) != len(targets):
                raise ValueError('Cannot align protected identifiers')
            for source, target in zip(sources, targets):
                decision = self.decisions[source.id]
                if decision['kind'] in ('name', 'literal'):
                    token = self.prefix + f'MASK_{len(hidden)}__'
                    hidden[token] = translated[target.start:target.end]
                    source_edits.append((source.start, source.end, token))
                    target_edits.append((target.start, target.end, token))
                else:
                    visit(source.children, target.children)
        visit(self.roots, target_roots)
        def apply(text, edits):
            for start, end, value in reversed(edits):
                text = text[:start] + value + text[end:]
            return text
        return apply(self.original, source_edits), apply(translated, target_edits), hidden
