export type StrategyNode = { type: string; text?: string; attrs?: Record<string, any>; marks?: { type: string; attrs?: Record<string, any> }[]; content?: StrategyNode[] };
export interface StrategyBody { title: string; summary: string; category: string; tags: string[]; cover: string; doc: StrategyNode }
export interface StrategyArticle extends StrategyBody { id: string; revision: number; author: string; updatedAt: string; publishedAt?: string; hasPublished?: boolean; canEdit?: boolean }
export interface StrategySnapshot { id: string; source: 'personal'|'community'|'legacy'; sourceId: string; name: string; author: string; quantities: Record<string,number>; sourceUrl: string; createdAt: string; unavailable?: boolean }
export interface StrategyGroup { id: string; revision: number; name: string; region: string; platform: string; description: string; contact: string; url: string; expiresAt: string; author: string; public: boolean; canEdit?: boolean }
export const strategyCategories = ['构筑攻略','单卡分析','对局心得','入门教学','环境讨论'];
export interface StrategyTextStyle { color?: string; fontSize?: number; bold?: boolean; italic?: boolean; underline?: boolean }
export interface StrategyLayout { width?: number; align?: 'left'|'center'|'right'; wrap?: boolean; columns?: number; offset?: number }
export function strategyTextStyle(raw:unknown):StrategyTextStyle {
  if(raw===undefined||raw===null)return {};
  if(typeof raw!=='object'||Array.isArray(raw))throw new Error('文字样式无效');
  const r=raw as Record<string,unknown>,out:StrategyTextStyle={};
  if(r.color!==undefined&&r.color!==null&&r.color!==''){if(typeof r.color!=='string'||!/^#[0-9a-f]{6}$/i.test(r.color))throw new Error('文字颜色无效');out.color=r.color.toLowerCase();}
  if(r.fontSize!==undefined&&r.fontSize!==null&&r.fontSize!==''){const n=Number(r.fontSize);if(!Number.isInteger(n)||n<10||n>72)throw new Error('字号须为10～72');out.fontSize=n;}
  for(const key of ['bold','italic','underline'] as const)if(r[key]!==undefined&&r[key]!==null){if(typeof r[key]!=='boolean')throw new Error('文字样式无效');out[key]=r[key];}
  return out;
}
export function strategyLayout(raw:unknown):StrategyLayout {
  if(raw===undefined||raw===null)return {};
  if(typeof raw!=='object'||Array.isArray(raw))throw new Error('图片布局无效');
  const r=raw as Record<string,unknown>,out:StrategyLayout={};
  if(r.width!==undefined){if(!Number.isFinite(r.width)||Number(r.width)<15||Number(r.width)>100)throw new Error('图片宽度须为15～100%');out.width=Math.round(Number(r.width));}
  if(r.align!==undefined){if(!['left','center','right'].includes(String(r.align)))throw new Error('对齐方式无效');out.align=r.align as StrategyLayout['align'];}
  if(r.wrap!==undefined){if(typeof r.wrap!=='boolean')throw new Error('文字环绕无效');out.wrap=r.wrap;}
  if(r.offset!==undefined){if(!Number.isFinite(r.offset)||Number(r.offset)<0||Number(r.offset)>100)throw new Error('水平位置须为0～100%');out.offset=Math.round(Number(r.offset));}
  if(r.columns!==undefined){if(!Number.isInteger(r.columns)||Number(r.columns)<1||Number(r.columns)>6)throw new Error('卡片组列数无效');out.columns=Number(r.columns);}
  return out;
}
export function strategyStyleCss(raw:unknown):Record<string,string>{
  const s=strategyTextStyle(raw);return {...(s.color?{color:s.color}:{}),...(s.fontSize?{fontSize:s.fontSize+'px'}:{}),...(s.bold!==undefined?{fontWeight:s.bold?'700':'400'}:{}),...(s.italic!==undefined?{fontStyle:s.italic?'italic':'normal'}:{}),...(s.underline!==undefined?{textDecoration:s.underline?'underline':'none'}:{})};
}
export function strategyInlineStyle(node:StrategyNode):Record<string,string>{
  const marks=node.marks||[],style={...strategyTextStyle(marks.find(m=>m.type==='textStyle')?.attrs),...(marks.some(m=>m.type==='bold')?{bold:true}:{}),...(marks.some(m=>m.type==='italic')?{italic:true}:{}),...(marks.some(m=>m.type==='underline')?{underline:true}:{}),...strategyTextStyle(node.attrs?.textStyle)};
  return strategyStyleCss(style);
}
export function strategyLayoutCss(raw:unknown,defaultWidth=100):Record<string,string>{
  const l=strategyLayout(raw),width=l.width??defaultWidth,gap=l.wrap&&l.align!=='center'?Math.min(3,Math.max(0,100-width)):0;return {'--media-width':(l.width??defaultWidth)+'%',...(l.columns?{'--gallery-columns':String(l.columns)}:{}),...(l.align==='center'?{marginLeft:'auto',marginRight:'auto'}:l.align==='right'?{marginLeft:'auto',marginRight:'0'}:{marginLeft:'0',marginRight:'auto'}),...(l.wrap&&l.align!=='center'?{float:l.align==='right'?'right':'left',marginLeft:l.align==='right'?gap+'%':'0',marginRight:l.align==='right'?'0':gap+'%'}:{}),...(l.offset!==undefined?{marginLeft:((100-width-gap)*l.offset/100)+'%',marginRight:gap+'%'}:{})};
}
export function snapStrategyAlignment(center:number,width:number):'left'|'center'|'right'{return center<width/3?'left':center>width*2/3?'right':'center';}
export function splitStrategyGallery(node:StrategyNode):StrategyNode[]{
  const r=node.attrs?.ref;if(r?.kind!=='gallery')return [node];
  const layout=strategyLayout(node.attrs?.layout),columns=layout.columns??4;
  return r.codes.map((code:string)=>({type:'reference',attrs:{ref:{kind:'card',code,mode:'artwork'},layout:{...layout,width:Math.max(15,Math.round((layout.width??100)/Math.min(r.codes.length,columns))),align:'left',wrap:true},textStyle:node.attrs?.textStyle||{}}}));
}
export function emptyStrategy(): StrategyBody { return {title:'',summary:'',category:'构筑攻略',tags:[],cover:'',doc:{type:'doc',content:[{type:'paragraph'}]}}; }
export function safeStrategyUrl(raw: unknown) {
  if(typeof raw!=='string'||raw.length>2000) throw new Error('链接格式无效');
  const url=new URL(raw.trim());
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password) throw new Error('链接仅支持 HTTP 或 HTTPS');
  return url.href;
}
export function strategyRefs(doc: StrategyNode) {
  const codes=new Set<string>(),snapshots=new Set<string>(),media=new Set<string>(),links=new Set<string>();
  function visit(n:StrategyNode){
    if(n.type==='cardMention')codes.add(n.attrs?.code);
    if(n.type==='reference'){
      const r=n.attrs?.ref;
      if(r?.kind==='card')codes.add(r.code);
      if(r?.kind==='gallery')r.codes.forEach((code:string)=>codes.add(code));
      if(r?.kind==='deck')snapshots.add(r.snapshotId);
      if(r?.kind==='external')links.add(r.url);
    }
    if(n.type==='image')media.add(n.attrs?.src);
    n.marks?.forEach(m=>{if(m.type==='link')links.add(m.attrs?.href);});
    n.content?.forEach(visit);
  }
  visit(doc);return {codes:[...codes],snapshots:[...snapshots],media:[...media],links:[...links]};
}
export function strategyText(doc:StrategyNode):string {return [doc.text||'',...(doc.content||[]).map(strategyText)].join(' ');}
export function strategyNeedsLayoutEditor(doc:StrategyNode):boolean {
  return !!(Object.keys(doc.attrs?.layout||{}).length||Object.keys(doc.attrs?.textStyle||{}).length||doc.marks?.some(m=>m.type==='textStyle')||doc.content?.some(strategyNeedsLayoutEditor));
}
export function validateStrategy(raw:unknown,publishing=false):StrategyBody {
  if(!raw||typeof raw!=='object'||JSON.stringify(raw).length>700000)throw new Error('攻略内容过大或格式无效');
  const r=raw as StrategyBody;
  const str=(value:unknown,max:number)=>{if(typeof value!=='string'||value.length>max)throw new Error('文字内容过长或格式无效');return value;};
  const title=str(r.title,100),summary=str(r.summary,400),cover=str(r.cover,100);
  if(!strategyCategories.includes(r.category)||!Array.isArray(r.tags)||r.tags.length>8)throw new Error('分类或标签无效');
  const tags=[...new Set(r.tags.map(t=>str(t,24).trim()).filter(Boolean))];
  const code=(v:unknown)=>{if(typeof v!=='string'||!/^LO-\d{4}[A-Za-z0-9-]{0,16}$/.test(v))throw new Error('卡牌编号无效');return v;};
  const media=(v:unknown)=>{if(typeof v!=='string'||!/^\/api\/strategy\/media\/[a-f0-9-]{36}$/.test(v))throw new Error('请使用已上传完成的图片');return v;};
  const types=new Set(['doc','paragraph','heading','text','bulletList','orderedList','listItem','blockquote','horizontalRule','hardBreak','codeBlock','cardMention','reference','image']);
  let count=0,characters=0;
  function node(n:StrategyNode,depth=0):StrategyNode {
    if(!n||!types.has(n.type)||++count>5000||depth>16)throw new Error('正文结构无效或层级过深');
    const out:StrategyNode={type:n.type};
    if(n.type==='text'){out.text=str(n.text,100000);characters+=out.text.length;}
    if(n.marks){if(!Array.isArray(n.marks)||n.marks.length>8)throw new Error('格式无效');out.marks=n.marks.map(m=>{
      if(!['bold','italic','strike','code','underline','link','textStyle'].includes(m.type))throw new Error('不支持的文字格式');
      if(m.type==='textStyle')return {type:'textStyle',attrs:strategyTextStyle(m.attrs)};
      return m.type==='link'?{type:'link',attrs:{href:safeStrategyUrl(m.attrs?.href),target:'_blank',rel:'noopener noreferrer'}}:{type:m.type};
    });}
    if(n.type==='heading')out.attrs={level:Math.max(2,Math.min(4,Number(n.attrs?.level)||2))};
    if(n.type==='orderedList')out.attrs={start:Math.max(1,Math.min(999,Number(n.attrs?.start)||1))};
    if(n.type==='image')out.attrs={src:media(n.attrs?.src),alt:str(n.attrs?.alt||'',200),title:str(n.attrs?.title||'',200),layout:strategyLayout(n.attrs?.layout),textStyle:strategyTextStyle(n.attrs?.textStyle)};
    if(n.type==='cardMention')out.attrs={code:code(n.attrs?.code),textStyle:strategyTextStyle(n.attrs?.textStyle)};
    if(n.type==='reference'){
      const a=n.attrs?.ref;let ref:Record<string,any>;
      if(a?.kind==='card') {if(!['artwork','summary'].includes(a.mode))throw new Error('卡牌展示方式无效');ref={kind:'card',code:code(a.code),mode:'artwork'};}
      else if(a?.kind==='gallery'){if(!Array.isArray(a.codes)||!a.codes.length||a.codes.length>40)throw new Error('请选择1～40种卡牌');ref={kind:'gallery',codes:[...new Set(a.codes.map(code))]};}
      else if(a?.kind==='deck'){if(typeof a.snapshotId!=='string'||!/^ss_[a-f0-9-]{36}$/.test(a.snapshotId))throw new Error('卡组快照无效');ref={kind:'deck',snapshotId:a.snapshotId};}
      else if(a?.kind==='external')ref={kind:'external',url:safeStrategyUrl(a.url),title:str(a.title,160),description:str(a.description||'',400)};
      else throw new Error('引用类型无效');
      out.attrs={ref,layout:strategyLayout(n.attrs?.layout),textStyle:strategyTextStyle(n.attrs?.textStyle)};
    }
    if(n.content){if(!Array.isArray(n.content))throw new Error('正文结构无效');out.content=n.content.map(c=>node(c,depth+1));}
    return out;
  }
  if(r.doc?.type!=='doc')throw new Error('正文格式无效');
  const doc=node(r.doc),refs=strategyRefs(doc);
  if(characters>100000||refs.snapshots.length>30||refs.media.length>60||refs.codes.length>300)throw new Error('正文或引用数量超出限制');
  if(cover)media(cover);
  if(publishing&&(!title.trim()||(!strategyText(doc).trim()&&!refs.codes.length&&!refs.snapshots.length&&!refs.media.length&&!refs.links.length)))throw new Error('请填写标题和正文');
  return {title,summary,category:r.category,tags,cover,doc};
}
export function rememberReference<T extends {key:string}>(recent:T[],item:T):T[]{return [item,...recent.filter(r=>r.key!==item.key)].slice(0,24);}
export function validateGroup(raw:any):Omit<StrategyGroup,'id'|'revision'|'author'|'canEdit'> {
  const field=(v:unknown,max:number,required=true)=>{if(typeof v!=='string'||v.trim().length>max||(required&&!v.trim()))throw new Error('请完整填写社群资料');return v.trim();};
  const name=field(raw.name,60),region=field(raw.region,40),platform=field(raw.platform,30),description=field(raw.description,1000),contact=field(raw.contact,300),url=raw.url?safeStrategyUrl(raw.url):'';
  const expiry=new Date(raw.expiresAt);if(!Number.isFinite(expiry.getTime())||expiry.getTime()<=Date.now()||expiry.getTime()>Date.now()+366*86400000)throw new Error('有效期须在未来一年内');
  if(raw.consent!==true)throw new Error('请确认加入方式随社群名片公开');
  return {name,region,platform,description,contact,url,expiresAt:expiry.toISOString(),public:raw.public!==false};
}
