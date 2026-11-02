import type { Card } from './catalog';
export interface CatalogSeries { code: string; name: string; description: string; count: number; versions: string[]; image: string }
export function catalogSeries(cards: Card[], labels: (Pick<CatalogSeries,'code'|'name'>&Partial<Pick<CatalogSeries,'description'>>)[]): CatalogSeries[] {
  const names=new Map(labels.map(s=>[s.code,s])), groups=new Map<string,Card[]>();
  for(const card of cards)if(card.brand && card.brand!=='-'){const group=groups.get(card.brand)||[];group.push(card);groups.set(card.brand,group);}
  return [...groups].map(([code,rows])=>({code,name:names.get(code)?.name||code,description:names.get(code)?.description||'',count:rows.length,
    versions:[...new Set(rows.map(card=>card.version))].sort((a,b)=>a.localeCompare(b,'ja')),
    image:rows.map(c=>c.code).sort((a,b)=>b.localeCompare(a,'en',{numeric:true}))[0]!}));
}
