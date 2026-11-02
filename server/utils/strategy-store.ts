import {randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {strategyRefs,validateStrategy,type StrategyBody,type StrategyArticle,type StrategySnapshot,type StrategyGroup,validateGroup} from '../../shared/domain/strategy';
function fail(message:string,statusCode=400):never {throw Object.assign(new Error(message),{statusCode});}
export class StrategyStore {
  constructor(readonly db:DatabaseSync){db.exec(`
    CREATE TABLE IF NOT EXISTS strategy_articles(id TEXT PRIMARY KEY,owner TEXT NOT NULL,revision INTEGER NOT NULL,draft TEXT NOT NULL,published TEXT,updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS strategy_articles_owner ON strategy_articles(owner);
    CREATE TABLE IF NOT EXISTS strategy_media(id TEXT PRIMARY KEY,owner TEXT NOT NULL,image BLOB NOT NULL,created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS strategy_media_owner ON strategy_media(owner);
    CREATE TABLE IF NOT EXISTS strategy_snapshots(id TEXT PRIMARY KEY,owner TEXT NOT NULL,data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS strategy_article_media(article_id TEXT NOT NULL,media_id TEXT NOT NULL,PRIMARY KEY(article_id,media_id));
    CREATE TABLE IF NOT EXISTS player_groups(id TEXT PRIMARY KEY,owner TEXT NOT NULL,revision INTEGER NOT NULL,data TEXT NOT NULL);
  `);}
  transaction<T>(fn:()=>T){this.db.exec('BEGIN IMMEDIATE');try{const r=fn();this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}}
  private row(id:string){return this.db.prepare('SELECT * FROM strategy_articles WHERE id=?').get(id);}
  private owned(id:string,owner:string,revision:number){const r=this.row(id);if(!r||r.owner!==owner)fail('无权修改此攻略',403);if(Number(r.revision)!==revision)fail('攻略已被其他页面修改，请保留本机内容并重新读取云端版本。',409);return r;}
  article(id:string,owner?:string):StrategyArticle|null {
    const row=this.row(id);if(!row)return null;
    const mine=row.owner===owner,raw=mine?row.draft:row.published;
    return raw?{...JSON.parse(String(raw)),id,revision:Number(row.revision),updatedAt:String(row.updated_at),hasPublished:!!row.published,canEdit:mine}:null;
  }
  owner(id:string){return this.row(id)?.owner as string|undefined;}
  list(owner?:string,q='',category='',page=1){
    const rows=this.db.prepare(owner?'SELECT * FROM strategy_articles WHERE owner=?':'SELECT * FROM strategy_articles WHERE published IS NOT NULL').all(...(owner?[owner]:[]));
    const needle=q.normalize('NFKC').toLowerCase();
    const all=rows.map(row=>{const a=JSON.parse(String(owner?row.draft:row.published)) as StrategyArticle;return {...a,id:String(row.id),revision:Number(row.revision),updatedAt:String(row.updated_at),hasPublished:!!row.published,canEdit:!!owner};})
      .filter(a=>(!category||a.category===category)&&[a.title,a.summary,a.author,...a.tags].join(' ').normalize('NFKC').toLowerCase().includes(needle))
      .sort((a,b)=>(owner?b.updatedAt:b.publishedAt||b.updatedAt).localeCompare(owner?a.updatedAt:a.publishedAt||a.updatedAt));
    const pages=Math.max(1,Math.ceil(all.length/12)),current=Math.min(page,pages);
    return {items:all.slice((current-1)*12,current*12).map(({doc,...a})=>a),total:all.length,pages,page:current};
  }
  checkReferences(owner:string,body:StrategyBody){
    const refs=strategyRefs(body.doc);
    for(const src of [...refs.media,...(body.cover?[body.cover]:[])]){
      const id=src.split('/').at(-1)!;if(this.db.prepare('SELECT owner FROM strategy_media WHERE id=?').get(id)?.owner!==owner)fail('图片不存在或不属于当前账号',403);
    }
    for(const id of refs.snapshots)if(this.db.prepare('SELECT owner FROM strategy_snapshots WHERE id=?').get(id)?.owner!==owner)fail('卡组快照不存在或无权引用',403);
  }
  save(owner:string,author:string,id:string,revision:number,raw:unknown){
    const body=validateStrategy(raw);if(!/^a_[a-f0-9-]{36}$/.test(id)||!Number.isSafeInteger(revision)||revision<0)fail('攻略标识或版本无效');
    return this.transaction(()=>{
      const previous=this.row(id);
      if(previous)this.owned(id,owner,revision);else {
        if(revision!==0)fail('攻略不存在',404);
        if(Number(this.db.prepare('SELECT count(*) AS n FROM strategy_articles WHERE owner=?').get(owner)!.n)>=100)fail('最多保留100篇攻略，请先清理草稿');
      }
      this.checkReferences(owner,body);
      const updatedAt=new Date().toISOString();const data={...body,author};
      this.db.prepare('INSERT INTO strategy_articles VALUES(?,?,?,?,NULL,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,draft=excluded.draft,updated_at=excluded.updated_at').run(id,owner,revision+1,JSON.stringify(data),updatedAt);
      return this.article(id,owner)!;
    });
  }
  publish(owner:string,id:string,revision:number){return this.transaction(()=>{
    const row=this.owned(id,owner,revision),draft=JSON.parse(String(row.draft));const body=validateStrategy(draft,true);this.checkReferences(owner,body);
    const now=new Date().toISOString();const published={...body,author:draft.author,publishedAt:now};
    this.db.prepare('UPDATE strategy_articles SET published=?,revision=revision+1,updated_at=? WHERE id=?').run(JSON.stringify(published),now,id);
    this.db.prepare('DELETE FROM strategy_article_media WHERE article_id=?').run(id);
    for(const src of [...new Set([...strategyRefs(body.doc).media,...(body.cover?[body.cover]:[])])])this.db.prepare('INSERT INTO strategy_article_media VALUES(?,?)').run(id,src.split('/').at(-1)!);
    return this.article(id,owner)!;
  });}
  unpublish(owner:string,id:string,revision:number){return this.transaction(()=>{this.owned(id,owner,revision);this.db.prepare('UPDATE strategy_articles SET published=NULL,revision=revision+1 WHERE id=?').run(id);this.db.prepare('DELETE FROM strategy_article_media WHERE article_id=?').run(id);return this.article(id,owner)!;});}
  remove(owner:string,id:string,revision:number){return this.transaction(()=>{this.owned(id,owner,revision);this.db.prepare('DELETE FROM strategy_article_media WHERE article_id=?').run(id);this.db.prepare('DELETE FROM strategy_articles WHERE id=?').run(id);});}
  media(owner:string,image:Buffer){return this.transaction(()=>{
    const usage=this.db.prepare('SELECT count(*) AS n,coalesce(sum(length(image)),0) AS bytes FROM strategy_media WHERE owner=?').get(owner)!;
    if(Number(usage.n)>=200||Number(usage.bytes)+image.length>128*1024*1024)fail('攻略图片额度已满');
    const id=randomUUID();this.db.prepare('INSERT INTO strategy_media VALUES(?,?,?,?)').run(id,owner,image,new Date().toISOString());return {id,url:'/api/strategy/media/'+id};
  });}
  mediaImage(id:string,owner?:string){const row=this.db.prepare('SELECT owner,image FROM strategy_media WHERE id=?').get(id);if(!row)return null;
    if(row.owner!==owner&&!this.db.prepare('SELECT 1 FROM strategy_article_media WHERE media_id=? LIMIT 1').get(id))return null;
    return Buffer.from(row.image as Uint8Array);
  }
  snapshot(owner:string,data:Omit<StrategySnapshot,'id'|'createdAt'>){
    const id='ss_'+randomUUID(),snapshot={...data,id,createdAt:new Date().toISOString()};
    const usage=this.db.prepare('SELECT count(*) AS n FROM strategy_snapshots WHERE owner=?').get(owner)!;if(Number(usage.n)>=1000)fail('卡组引用数量已达上限');
    this.db.prepare('INSERT INTO strategy_snapshots VALUES(?,?,?)').run(id,owner,JSON.stringify(snapshot));return snapshot;
  }
  snapshotData(id:string,owner:string){const row=this.db.prepare('SELECT data FROM strategy_snapshots WHERE id=? AND owner=?').get(id,owner);return row?JSON.parse(String(row.data)) as StrategySnapshot:null;}
  groups(owner?:string){return this.db.prepare(owner?'SELECT * FROM player_groups WHERE owner=?':'SELECT * FROM player_groups').all(...(owner?[owner]:[])).map(r=>({...JSON.parse(String(r.data)),id:String(r.id),revision:Number(r.revision),canEdit:r.owner===owner}) as StrategyGroup).filter(g=>owner||(g.public&&new Date(g.expiresAt).getTime()>Date.now()));}
  saveGroup(owner:string,author:string,id:string|undefined,revision:number,raw:unknown){if((id&&!/^g_[a-f0-9-]{36}$/.test(id))||!Number.isSafeInteger(revision)||revision<0||(!id&&revision!==0))fail('社群标识或版本无效');const body=validateGroup(raw);return this.transaction(()=>{
    if(id){const row=this.db.prepare('SELECT owner,revision FROM player_groups WHERE id=?').get(id);if(row?.owner!==owner)fail('无权修改此社群',403);if(Number(row.revision)!==revision)fail('社群已更新，请重新读取',409);}
    else if(this.groups(owner).length>=10)fail('每个账号最多发布10个社群');
    const key=id||'g_'+randomUUID();this.db.prepare('INSERT INTO player_groups VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,data=excluded.data').run(key,owner,(revision||0)+1,JSON.stringify({...body,author}));return this.groups(owner).find(g=>g.id===key)!;
  });}
  removeGroup(owner:string,id:string,revision:number){const row=this.db.prepare('SELECT owner,revision FROM player_groups WHERE id=?').get(id);if(row?.owner!==owner)fail('无权删除此社群',403);if(Number(row.revision)!==revision)fail('社群已更新',409);this.db.prepare('DELETE FROM player_groups WHERE id=?').run(id);}
}
let cached:StrategyStore|undefined;
export function strategyStore(){return cached??=new StrategyStore(workflowStore().db);}
