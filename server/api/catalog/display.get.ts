import fixtures from '../../../app/demo/fixtures.json';
export default defineEventHandler(async event=>{
  setHeader(event,'Cache-Control','public, max-age=60');
  const local=new Map(fixtures.cards.map(c=>[c.code,c]));
  return (await getCatalog()).cards.map(c=>local.get(c.code)||({code:c.code,name:c.name,img:c.img,category:c.category,rarity:c.rarity,
    attribute:c.attribute,brand:c.brand,version:c.version,ex:c.ex??0,ap:c.ap??0,dp:c.dp??0,sp:c.sp??0,textJa:'',textZh:''}));
});
