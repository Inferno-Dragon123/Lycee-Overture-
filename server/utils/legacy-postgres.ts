import { createError } from 'h3';
import { tencentDatabase } from './tencent-database';
type Database = { query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, any>[] }> };
const fields = `p.id,d.name,COALESCE(profile.nickname,p.author_name) AS author_name,p.description,p.source,p.source_url,
p.status,p.moderated,p.version,p.created_at,p.updated_at,p.synced_at,
CASE WHEN composition.publication_id IS NULL THEN NULL ELSE jsonb_build_object('type',composition.deck_type,'series',composition.series,
'counts',composition.attribute_counts,'attributesKnown',composition.attributes_complete) END AS composition`;
const joins = `FROM toolbox_publications p JOIN toolbox_decks d ON d.id=p.snapshot_id
LEFT JOIN toolbox_profiles profile ON profile.user_id=p.owner_id
LEFT JOIN toolbox_publication_compositions composition ON composition.publication_id=p.id`;
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
export async function readLegacyPostgres(query: URLSearchParams, db: Database = tencentDatabase()) {
  if (query.has('id')) {
    const id = query.get('id')!;
    if (!/^p_[A-Za-z0-9_-]{1,100}$/.test(id)) throw createError({ statusCode: 400, message: '无效卡组编号' });
    const row = (await db.query(`SELECT ${fields},d.cards ${joins} WHERE p.id=$1 AND p.status='public' AND p.source <> 'community' AND NOT p.moderated`, [id])).rows[0];
    if (!row) throw createError({ statusCode: 404, message: '卡组不存在或已下架' });
    return json({ ...row, schemaVersion: 1, canEdit: false });
  }
  const values: unknown[] = [], where = ["p.status='public'", "p.source <> 'community'", 'NOT p.moderated'];
  const add = (value: unknown) => { values.push(value); return '$'+values.length; };
  const source = query.get('source');
  if (source) {
    if (!['community','official','official_user','official_tournament'].includes(source)) throw createError({statusCode:400,message:'无效卡组来源'});
    where.push(`p.source=ANY(${add(['official','official_user'].includes(source)?['official','official_user']:[source])}::text[])`);
  }
  const types = query.getAll('deckType');
  if (types.length) {
    if (types.some(type=>!['single','mix'].includes(type)))throw createError({statusCode:400,message:'无效卡组类型'});
    where.push(`composition.deck_type=ANY(${add(types)}::text[])`);
  }
  const series=query.getAll('series');
  if(series.length){if(series.some(value=>!/^\S{1,80}$/.test(value)))throw createError({statusCode:400,message:'无效系列'});where.push("composition.deck_type='single'",`composition.series && ${add(series)}::text[]`);}
  const attrs=['雪','月','花','宙','日','他'];
  const selected=query.getAll('attribute');
  if(selected.some(a=>!attrs.includes(a)))throw createError({statusCode:400,message:'无效属性'});
  if(selected.length)where.push('composition.attributes_complete','('+selected.map(a=>`(composition.attribute_counts->>'${a}')::int>0`).join(' OR ')+')');
  for(const a of attrs){
    let min:number|undefined,max:number|undefined;
    for(const side of ['min','max']){
      const raw=query.get(`attr_${a}_${side}`);if(raw===null||raw==='')continue;
      if(!/^\d+$/.test(raw)||Number(raw)>200)throw createError({statusCode:400,message:'无效属性数量'});
      const n=Number(raw);if(side==='min')min=n;else max=n;
      where.push('composition.attributes_complete',`(composition.attribute_counts->>'${a}')::int${side==='min'?'>=':'<='}${add(n)}`);
    }
    if(min!==undefined&&max!==undefined&&min>max)throw createError({statusCode:400,message:'属性范围无效'});
  }
  const codes=[...new Set([...query.getAll('code'),...(query.get('codes')||'').split(',')].filter(Boolean))];
  const match=query.get('match')||'all';
  if(codes.length>10||codes.some(c=>!/^LO-\d{4}$/.test(c))||!['all','any'].includes(match))throw createError({statusCode:400,message:'无效卡牌检索条件'});
  if(codes.length)where.push(`p.id IN (SELECT publication_id FROM toolbox_publication_cards WHERE base_code=ANY(${add(codes)}::text[]) ${match==='all'?`GROUP BY publication_id HAVING count(*)=${add(codes.length)}`:''})`);
  const page=Number(query.get('page')||1);if(!Number.isSafeInteger(page)||page<1)throw createError({statusCode:400,message:'页码无效'});
  const pageParam=add(page);
  const rows=(await db.query(`WITH matched AS MATERIALIZED (SELECT ${fields} ${joins} WHERE ${where.join(' AND ')}),
counted AS (SELECT count(*)::int AS total FROM matched), pagination AS (SELECT total,ceil(total/20.0)::int AS pages,
LEAST(${pageParam}::int,GREATEST(1,ceil(total/20.0)::int)) AS page FROM counted)
SELECT paged.*,pagination.total AS result_total,pagination.pages AS result_pages,pagination.page AS result_page
FROM pagination LEFT JOIN LATERAL (SELECT * FROM matched ORDER BY updated_at DESC,id LIMIT 20 OFFSET (pagination.page-1)*20) paged ON true`,values)).rows;
  const first=rows[0]!;
  return json({items:rows.filter(row=>row.id).map(({result_total,result_pages,result_page,...row})=>row),total:first.result_total,pages:first.result_pages,page:first.result_page,hasMore:first.result_page<first.result_pages});
}
