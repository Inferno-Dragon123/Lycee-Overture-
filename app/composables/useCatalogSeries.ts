import { demoSeries } from './useShowcase';
import type { CatalogSeries } from '#shared/domain/catalog-series';
let pending: Promise<void>|undefined;
export function useCatalogSeries(){
  const ready=useState('catalog-series-ready',()=>false);
  async function load(){
    if(!import.meta.client||ready.value)return;
    if(pending)return pending;
    pending=(async()=>{try{
      const rows=await $fetch<CatalogSeries[]>('/api/catalog/series');
      if(!Array.isArray(rows)||!rows.length||!rows.every(s=>typeof s.code==='string'&&typeof s.name==='string'&&Number.isInteger(s.count)&&Array.isArray(s.versions)))throw new Error('Invalid series');
      demoSeries.splice(0,demoSeries.length,...rows);ready.value=true;
    }catch{/* Keep known series until a successful catalog refresh. */}finally{pending=undefined;}})();
    return pending;
  }
  return {load};
}
