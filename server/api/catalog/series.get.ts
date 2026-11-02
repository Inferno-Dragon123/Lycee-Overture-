import fixtures from '../../../app/demo/fixtures.json';
import { catalogSeries } from '../../../shared/domain/catalog-series';
export default defineEventHandler(async event=>{
  setHeader(event,'Cache-Control','public, max-age=60');
  return catalogSeries((await getCatalog()).cards,fixtures.series);
});
