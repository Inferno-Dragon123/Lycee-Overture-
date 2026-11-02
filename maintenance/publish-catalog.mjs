import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { connection } from './database.mjs';
export const sourceFiles=['data/catalog.json','lycee-japanese-database-final.json','lycee-chinese-database-final.json'];
export async function publishCatalog(client,cards,sources){
  if(!Array.isArray(cards)||!cards.length||new Set(cards.map(c=>c.code)).size!==cards.length||cards.some(c=>!/^LO-\d{4}[A-Za-z0-9-]{0,16}$/.test(c.code)||typeof c.name!=='string'||typeof c.textJa!=='string'||typeof c.textZh!=='string'||!/^https:\/\/lycee-tcg\.com\/card\/image\/LO-[\w-]+\.png$/.test(c.img)))throw new Error('Invalid published catalog');
  const version=createHash('sha256').update(JSON.stringify(cards)+'\n').digest('hex');
  await client.query('BEGIN');
  try{
    await client.query('SELECT pg_advisory_xact_lock(191912,4)');
    const old=(await client.query('SELECT code FROM toolbox_catalog_cards')).rows;
    const next=new Set(cards.map(c=>c.code));
    if(old.some(row=>!next.has(row.code)))throw new Error('Refusing to remove existing catalog cards');
    for(let i=0;i<cards.length;i+=200){
      const batch=cards.slice(i,i+200);
      await client.query(`INSERT INTO toolbox_catalog_cards(code,data) SELECT value->>'code',value FROM jsonb_array_elements($1::jsonb) ON CONFLICT(code) DO UPDATE SET data=excluded.data WHERE toolbox_catalog_cards.data IS DISTINCT FROM excluded.data`,[JSON.stringify(batch)]);
    }
    for(const name of sourceFiles){if(typeof sources[name]!=='string')throw new Error('Missing catalog source');JSON.parse(sources[name]);
      await client.query('INSERT INTO toolbox_catalog_sources(name,raw) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET raw=excluded.raw,updated_at=now()',[name,sources[name]]);}
    await client.query('INSERT INTO toolbox_catalog_meta(singleton,version) VALUES(true,$1) ON CONFLICT(singleton) DO UPDATE SET version=excluded.version,updated_at=now()',[version]);
    await client.query('COMMIT');return {cards:cards.length,version};
  }catch(error){await client.query('ROLLBACK');throw error;}
}
export async function publishWorkspace(workspace){
  const client=connection();await client.connect();
  try{return await publishCatalog(client,JSON.parse(await fs.readFile(path.join(workspace,'data/cards.json'),'utf8')),Object.fromEntries(await Promise.all(sourceFiles.map(async name=>[name,await fs.readFile(path.join(workspace,name),'utf8')]))));}
  finally{await client.end();}
}
