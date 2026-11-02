import type { Card } from "../../shared/domain/catalog";
import { createSearchEngine, getFacets } from "../../shared/domain/search";
import { tencentDatabase } from './tencent-database';

let catalogPromise: ReturnType<typeof load> | undefined;
let checkedAt=0,version='';
async function load() {
  const local = useRuntimeConfig().catalogSource === 'postgres';
  const cards = local ? (await tencentDatabase().query('SELECT data FROM toolbox_catalog_cards ORDER BY code')).rows.map(row=>row.data as Card)
    : await useStorage("assets:catalog").getItem<Card[]>("cards.json");
  if (!cards?.length)
    throw createError({
      statusCode: 503,
      statusMessage: "Catalog unavailable",
    });
  return {
    cards,
    byCode: new Map(cards.map((card) => [card.code, card])),
    search: createSearchEngine(cards),
    facets: getFacets(cards),
  };
}
let refreshing: Promise<Awaited<ReturnType<typeof load>>> | undefined;
export async function getCatalog() {
  if (useRuntimeConfig().catalogSource === 'postgres' && Date.now()-checkedAt>30000) {
    if(refreshing)return refreshing;
    refreshing=(async()=>{
      const next=String((await tencentDatabase().query('SELECT version FROM toolbox_catalog_meta WHERE singleton=true')).rows[0]?.version||'');
      if(!next)throw new Error('Catalog version unavailable');
      if(!catalogPromise || next!==version){const loaded=await load();catalogPromise=Promise.resolve(loaded);version=next;}
      checkedAt=Date.now();return catalogPromise!;
    })().finally(()=>{refreshing=undefined;});
    return refreshing;
  }
  catalogPromise ??= load().catch((error) => {
    catalogPromise = undefined;
    throw error;
  });
  return catalogPromise;
}
