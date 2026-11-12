"""Independent source-only suggestions for previously unreviewed spans.

Suggestions never approve themselves. The complete source inventory accompanies
each report, so a reviewer can confirm new contexts without silently losing one.
"""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from translation_protection import review_digest
from update_japanese_database import atomic_write

KINDS = {'name', 'literal', 'term', 'effect', 'pending'}
PROMPTS = (
    '独立审查日文卡牌原文的全部括号片段。根据完整语境区分名称、固定匹配字符串、游戏术语、效果句。'
    'name是角色/作品/卡牌名称；literal是费用/编号/固定标识；term是游戏术语；effect是可译效果/条件/代价句；不确定用pending。'
    '术语与名字同形时必须依据引用对象和语法判断。不要输出翻译。返回JSON对象，items包含每个输入id且各一次，每项只有id、kind、reason。',
    '请从日文原文独立检查每个括号片段的实际指代。优先查找角色引用、卡名子串匹配、机制标签与嵌套效果之间的混淆。'
    '为每个id选择name/literal/term/effect/pending并解释依据。不能确定时选pending。'
    '不要翻译正文。仅返回JSON对象，items数组每个输入id恰好一次，每项只有id、kind、reason。',
)


def validate_response(value, inventory):
    items = value.get('items') if isinstance(value, dict) else None
    expected = {item['id'] for item in inventory}
    if not isinstance(items, list) or len(items) != len(expected):
        raise ValueError('Reviewer omitted source spans')
    if {item.get('id') for item in items} != expected:
        raise ValueError('Reviewer changed or duplicated span identifiers')
    for item in items:
        if item.get('kind') not in KINDS or not isinstance(item.get('reason'), str) or not item['reason'].strip():
            raise ValueError('Reviewer returned an invalid classification')
    return sorted(items, key=lambda item: item['id'])


def request_review(prompt, source, inventory, api_key):
    spans = [{key: item[key] for key in ('id', 'start', 'end', 'family', 'source')} for item in inventory]
    payload = {
        'model': os.environ.get('DEEPSEEK_CLASSIFIER_MODEL', os.environ.get('DEEPSEEK_MODEL', 'deepseek-chat')),
        'messages': [{'role': 'system', 'content': prompt},
                     {'role': 'user', 'content': json.dumps({'original': source, 'spans': spans}, ensure_ascii=False)}],
        'response_format': {'type': 'json_object'}, 'temperature': 0,
        'thinking': {'type': 'disabled'}, 'max_tokens': 4096,
    }
    request = Request('https://api.deepseek.com/v1/chat/completions',
                      data=json.dumps(payload, ensure_ascii=False).encode(),
                      headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + api_key})
    with urlopen(request, timeout=90) as response:
        choice = json.load(response)['choices'][0]
    if choice.get('finish_reason') != 'stop':
        raise ValueError('Incomplete source review')
    return validate_response(json.loads(choice['message']['content']), inventory)


def review_pending(source, inventory, api_key, report_file):
    report_file = Path(report_file)
    source_hash = hashlib.sha256(source.encode()).hexdigest()
    registry_hash = review_digest()
    if report_file.exists():
        cached = json.loads(report_file.read_text(encoding='utf-8'))
        if (cached.get('sourceHash') == source_hash and cached.get('registryHash') == registry_hash
                and (not api_key or len(cached.get('reviews', [])) == 2)):
            return cached
    report = {'sourceHash': source_hash, 'registryHash': registry_hash, 'original': source,
              'inventory': inventory, 'approved': False, 'reviews': [], 'recommendations': [],
              'createdAt': datetime.now(timezone.utc).isoformat()}
    if api_key:
        for prompt in PROMPTS:
            try:
                report['reviews'].append(request_review(prompt, source, inventory, api_key))
            except Exception as error:
                diagnostic = {'type': type(error).__name__}
                if isinstance(error, HTTPError):
                    diagnostic['status'] = error.code
                    error.close()
                report.setdefault('failures', []).append(diagnostic)
        if len(report['reviews']) == 2:
            first, second = report['reviews']
            for left, right in zip(first, second):
                report['recommendations'].append({'id': left['id'],
                    'kind': left['kind'] if left['kind'] == right['kind'] else 'pending',
                    'agreed': left['kind'] == right['kind']})
    report_file.parent.mkdir(parents=True, exist_ok=True)
    atomic_write(report_file, (json.dumps(report, ensure_ascii=False, indent=2) + '\n').encode())
    return report
