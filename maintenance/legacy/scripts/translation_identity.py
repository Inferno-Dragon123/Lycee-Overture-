"""One translation identity for every numeric Lycee card number.

Printing suffixes and provenance do not create additional translation jobs. A
family's chosen source text supplies the revision used to invalidate its cache.
"""
from collections import defaultdict
import hashlib
import json
import re


IDENTITY_VERSION = 'numeric-family-v1'
CARD_CODE = re.compile(r'LO-(\d+)(?:-?[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*)?')
LINE_BREAK = re.compile(r'\r\n|\r|\n')
PROVENANCE = re.compile(
    r'(?:(?:\r?\n[ \t]*)+|^)[ \t]*'
    r'(?:初出|出处|出處|首次收录|首次收錄|初次收录|初次收錄|出典)'
    r'[ \t]*[:：][^\r\n]*(?:\r?\n[ \t]*)*\Z'
)


def numeric_code(code):
    """Return the full numeric identity for either hyphenated suffix style."""
    match = CARD_CODE.fullmatch(code) if isinstance(code, str) else None
    if match is None:
        raise ValueError('Unexpected card code: ' + str(code))
    return 'LO-' + match[1]


def split_provenance(text):
    """Return effect and final release note without changing either substring."""
    text = '' if text is None else text
    if not isinstance(text, str):
        raise ValueError('Card text must be a string')
    match = PROVENANCE.search(text)
    if match is None:
        return text, ''
    return text[:match.start()], text[match.start():]


def canonical_groups(cards, text_field='japaneseText'):
    """Group by numeric identity and put a stable source representative first.

    The unsuffixed printing has priority. Text disagreement remains inside the
    family so the caller still starts at most one translation request per family.
    Returned lists reference the original records without mutating their order.
    """
    grouped = defaultdict(list)
    for card in cards:
        base = numeric_code(card.get('code'))
        if card.get(text_field) is not None and not isinstance(card[text_field], str):
            raise ValueError('Card text must be a string')
        grouped[base].append(card)

    result = {}
    for base in sorted(grouped, key=lambda code: (int(code[3:]), code)):
        result[base] = sorted(grouped[base], key=lambda card: (
            card['code'] != base,
            card['code'],
            str(card.get('cid') or ''),
            card.get(text_field) or '',
            json.dumps(card, ensure_ascii=False, sort_keys=True, separators=(',', ':')),
        ))
    return result


def align_translation_body(original, translated):
    """Use source line boundaries to strip even a differently named old footer.

    A translated release label may be 出处, 初出, or another wording. Source
    alignment removes that wording from reuse without interpreting its meaning.
    """
    body, suffix = split_provenance(original)
    if not isinstance(translated, str):
        raise ValueError('Translation must be a string')
    if not suffix:
        return translated
    source_breaks = list(LINE_BREAK.finditer(original or ''))
    target_breaks = list(LINE_BREAK.finditer(translated))
    if len(source_breaks) != len(target_breaks):
        raise ValueError('Cannot align printing provenance with its translation')
    if not body:
        return ''
    boundary = len(LINE_BREAK.findall(body))
    return translated[:target_breaks[boundary].start()]


def _cache_source(text):
    body, _ = split_provenance(text)
    # Layout indentation and empty lines do not change an effect revision.
    # Internal spaces and all source punctuation remain significant.
    return '\n'.join(line.strip() for line in body.splitlines() if line.strip())


def family_key(card, prompt_version, model, source_text=None):
    """Hash a family revision using its chosen canonical source.

    Callers should pass the same representative source_text for every printing
    in a group. A changed representative effect invalidates that family's cache.
    """
    source = card.get('japaneseText', '') if source_text is None else source_text
    payload = {
        'rule': IDENTITY_VERSION,
        'code': numeric_code(card.get('code')),
        'source': _cache_source(source),
        'prompt': prompt_version,
        'model': model,
    }
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True,
                                     separators=(',', ':')).encode('utf-8')).hexdigest()
