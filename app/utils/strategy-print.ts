import {createApp} from 'vue';
import StrategyContent from '~/components/concepts/strategy/StrategyContent.vue';
import {strategyRefs,type StrategyBody,type StrategySnapshot} from '#shared/domain/strategy';
import type {Card} from '#shared/domain/catalog';
export interface ArticlePrintOptions {paper:'a4'|'letter';cover:boolean;pageNumbers:boolean;links:boolean}
export async function printStrategy(body:StrategyBody,cards:Record<string,Card>,snapshots:Record<string,StrategySnapshot>,options:ArticlePrintOptions){
  const frame=document.createElement('iframe');frame.title='攻略打印预览';frame.className='strategy-print-frame';document.body.append(frame);
  const doc=frame.contentDocument!,win=frame.contentWindow!;
  const base=doc.createElement('base');base.href=location.origin+'/';doc.head.append(base);
  const style=doc.createElement('style');style.textContent=`@page{size:${options.paper==='letter'?'Letter':'A4'};margin:17mm;${options.pageNumbers?'@bottom-center{content:counter(page) " / " counter(pages);font-size:9pt;color:#667;}':''}}
body{background:#fff;color:#172923;font:11pt/1.7 "Microsoft YaHei","Noto Sans CJK SC",sans-serif;margin:0}h1,h2,h3,h4{color:#194c3b;break-after:avoid}h1{font-size:25pt}a{color:#205d46;overflow-wrap:anywhere}img{max-width:100%;height:auto;object-fit:contain}figure{margin:10pt 0;break-inside:avoid}small{display:block;font-size:9pt}p{orphans:3;widows:3}blockquote{border-left:3pt solid #7eae96;padding-left:12pt}pre{white-space:pre-wrap;overflow-wrap:anywhere}details summary{list-style:none}.strategy-card{display:flex;gap:14pt}.strategy-card img{max-height:90mm;max-width:58mm}.strategy-card.artwork{display:block}.strategy-media{display:flow-root;width:var(--media-width,100%);max-width:100%;box-sizing:border-box;margin-block:12pt}.strategy-media img,.strategy-card.artwork img{width:100%;height:auto;max-height:none;max-width:100%}.strategy-prose{display:flow-root}.strategy-reference .strategy-external{font-synthesis:style}.strategy-image a{display:block}.strategy-prose em{font-style:italic;font-synthesis:style}.strategy-card-gallery,.strategy-deck-grid{display:grid;grid-template-columns:repeat(var(--gallery-columns,4),minmax(0,1fr));gap:9pt}.strategy-card-gallery figure,.strategy-deck-grid figure{min-width:0;font-size:9pt}.strategy-card-gallery img,.strategy-deck-grid img{width:100%;height:auto}.strategy-deck{margin:15pt 0}.strategy-deck summary span,.strategy-external span,.strategy-external small{display:block}.strategy-external{display:block;border-left:2pt solid #7eae96;padding:8pt}.strategy-image{max-width:100%}.strategy-image img{max-height:220mm}.strategy-cover{min-height:220mm;break-after:page;overflow-wrap:anywhere}.strategy-cover img{max-height:105mm}.strategy-cover p{font-size:10pt}.strategy-reference{margin:12pt 0}.strategy-links{break-before:page;font-size:9pt}.strategy-image img{width:auto;max-width:100%;max-height:230mm;object-fit:contain}.artwork-failed{border:1px solid #ddd;display:block;padding:12pt}`;
  doc.head.append(style);doc.title=body.title||'未命名攻略';
  if(options.cover){const cover=doc.createElement('section');cover.className='strategy-cover';const title=doc.createElement('h1');title.textContent=body.title;cover.append(title);if(body.cover){const im=doc.createElement('img');im.src=body.cover;cover.append(im);}const summary=doc.createElement('p');summary.textContent=body.summary;cover.append(summary);doc.body.append(cover);}
  const title=doc.createElement('h1');title.textContent=body.title||'未命名攻略';doc.body.append(title);
  const root=doc.createElement('main');doc.body.append(root);
  const app=createApp(StrategyContent,{doc:body.doc,cards,snapshots,printing:true,origin:location.origin});app.mount(root);
  if(options.links){const links=strategyRefs(body.doc).links;if(links.length){const section=doc.createElement('section');section.className='strategy-links';const h=doc.createElement('h2');h.textContent='外部资料';section.append(h);for(const url of links){const p=doc.createElement('p'),a=doc.createElement('a');a.href=url;a.textContent=url;p.append(a);section.append(p);}doc.body.append(section);}}
  const cleanup=()=>{app.unmount();frame.remove();};
  try{
    await new Promise(resolve=>setTimeout(resolve,100));
    await Promise.all([...doc.images].map(im=>im.complete?(im.naturalWidth?Promise.resolve():Promise.reject(new Error('图片尚未加载完成'))):new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('卡图加载超时，请重试')),30000);im.onload=()=>{clearTimeout(timeout);resolve();};im.onerror=()=>{clearTimeout(timeout);reject(new Error('有图片加载失败，请恢复后再导出'));};})));
    if(doc.querySelector('.artwork-failed'))throw new Error('有卡图加载失败，请重试后导出');
    await doc.fonts.ready;win.addEventListener('afterprint',cleanup,{once:true});win.focus();win.print();
    return frame;
  }catch(e){cleanup();throw e;}
}
