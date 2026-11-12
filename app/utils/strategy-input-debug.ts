import type {Editor} from '@tiptap/core';
import type {Transaction} from '@tiptap/pm/state';

export interface InputDebugStatus {recording:boolean;count:number;limitReached:boolean}

const ENTRY_LIMIT=1500,BYTE_LIMIT=3*1024*1024,TAIL_RESERVE=48*1024,EXPORT_RESERVE=16*1024;
const TEXT_LIMIT=512;
const EXCLUDED='input,textarea,select,button,script,style,[contenteditable="false"],[data-node-view-wrapper],.strategy-node,.strategy-inline-node';
const NATIVE_EVENTS=['keydown','keyup','compositionstart','compositionupdate','compositionend','beforeinput','input','focus','blur','focusin','focusout'];
const PRIVATE_KEYS=/^(?:attrs?|attributes|html|innerHTML|outerHTML|url|href|src|cookie|authorization|password|secret|token|account|user|doc|document|json|content)$/i;
type JsonValue=null|boolean|number|string|JsonValue[]|{[key:string]:JsonValue};
type Entry={seq:number;timeMs:number;kind:string;detail:Record<string,JsonValue>;state:Record<string,unknown>};

function clip(value:string,limit=TEXT_LIMIT){return value.slice(0,limit);}
function finite(value:unknown){return typeof value==='number'&&Number.isFinite(value)?value:null;}
function scalar(value:unknown):JsonValue|undefined{
  if(value===null||typeof value==='boolean')return value;
  if(typeof value==='number')return finite(value);
  if(typeof value==='string')return clip(value);
}
// Public trace callers can supply small summaries, never complete documents or attributes.
function safeValue(value:unknown,depth=0,budget={characters:4096,fields:192}):JsonValue|undefined{
  if(budget.fields--<=0)return undefined;
  const primitive=scalar(value);
  if(primitive!==undefined){if(typeof primitive!=='string')return primitive;const result=primitive.slice(0,Math.max(0,budget.characters));budget.characters-=result.length;return result;}
  if(depth>=4)return undefined;
  if(Array.isArray(value))return value.slice(0,24).map(item=>safeValue(item,depth+1,budget)??null);
  if(value&&typeof value==='object'){
    const result:Record<string,JsonValue>={};
    for(const [key,item] of Object.entries(value).slice(0,32)){
      if(PRIVATE_KEYS.test(key))continue;
      const safe=safeValue(item,depth+1,budget);if(safe!==undefined)result[clip(key,64)]=safe;
    }
    return result;
  }
}
function safeDetail(value:Record<string,unknown>={}){return (safeValue(value)||{}) as Record<string,JsonValue>;}
function textSummary(parts:Iterable<string>){
  let length=0,head='',tail='';
  for(const part of parts){length+=part.length;if(head.length<TEXT_LIMIT/2)head+=part.slice(0,TEXT_LIMIT/2-head.length);tail=(tail+part.slice(-TEXT_LIMIT/2)).slice(-TEXT_LIMIT/2);}
  return {length,snippet:length<=TEXT_LIMIT/2?head:head+tail.slice(Math.max(0,TEXT_LIMIT-length)),truncated:length>TEXT_LIMIT};
}
function blocked(node:Node,root:HTMLElement){
  let element=node.nodeType===1?node as Element:node.parentElement;
  while(element&&element!==root){if(element.matches(EXCLUDED))return true;element=element.parentElement;}
  return false;
}
function inside(node:Node|null,root:HTMLElement){return !!node&&(node===root||root.contains(node))&&!blocked(node,root);}
function path(node:Node|null,root:HTMLElement){
  if(!inside(node,root))return null;
  const result:number[]=[];let current=node;
  while(current&&current!==root&&result.length<24){const parent=current.parentNode;if(!parent)return null;result.unshift(Array.prototype.indexOf.call(parent.childNodes,current));current=parent;}
  return current===root?result:null;
}
function targetRanges(event:InputEvent,root:HTMLElement){
  try{
    if(typeof event.getTargetRanges!=='function')return undefined;
    return [...event.getTargetRanges()].slice(0,4).flatMap(range=>{
      const startPath=path(range.startContainer,root),endPath=path(range.endContainer,root);
      return startPath&&endPath?[{startPath,startOffset:range.startOffset,endPath,endOffset:range.endOffset}]:[];
    });
  }catch{return undefined;}
}
function* domText(root:HTMLElement):Generator<string>{
  const stack:Node[]=[root];
  while(stack.length){const node=stack.pop()!;if(node!==root&&node.nodeType===1&&(node as Element).matches(EXCLUDED))continue;if(node.nodeType===3){yield node.nodeValue||'';continue;}for(let i=node.childNodes.length-1;i>=0;i--)stack.push(node.childNodes[i]!);}
}
function snapshot(editor:Editor|undefined,root:HTMLElement|undefined):Record<string,unknown>{
  if(!editor||!root)return {unavailable:true};
  try{
    const selection=editor.state.selection,domSelection=root.ownerDocument.getSelection(),doc=editor.state.doc;
    const from=Math.max(0,selection.from-100),to=Math.min(doc.content.size,selection.to+100,from+TEXT_LIMIT);
    const point=(node:Node|null,offset:number)=>{
      const value=path(node,root);if(!value)return null;
      const text=node?.nodeType===3?node.nodeValue||'':null,start=Math.max(0,offset-100),end=text===null?0:Math.min(text.length,offset+100);
      return {path:value,offset,context:text===null?null:{from:start,to:end,length:text.length,text:clip(text.slice(start,end))}};
    };
    return {
      composing:!!editor.view.composing,focused:!!editor.isFocused,editable:!!editor.isEditable,
      pm:{text:textSummary([doc.textContent]),docSize:doc.content.size,cursor:{from,to,text:clip(doc.textBetween(from,to,'\n','')),truncated:selection.to+100>to&&to<doc.content.size},selection:{type:clip(selection.constructor.name,64),from:selection.from,to:selection.to,anchor:selection.anchor,head:selection.head,empty:selection.empty}},
      dom:{text:textSummary(domText(root)),connected:root.isConnected,focused:inside(root.ownerDocument.activeElement,root),selection:domSelection?{anchor:point(domSelection.anchorNode,domSelection.anchorOffset),focus:point(domSelection.focusNode,domSelection.focusOffset),collapsed:domSelection.isCollapsed,rangeCount:domSelection.rangeCount}:null}
    };
  }catch{return {unavailable:true};}
}
function transactionDetail(transaction:Transaction){
  return {
    docChanged:transaction.docChanged,selectionSet:transaction.selectionSet,stepCount:transaction.steps.length,
    steps:transaction.steps.slice(0,12).map(step=>{
      const value=step as unknown as {from?:number;to?:number;slice?:{content:{size:number;textBetween:(from:number,to:number,separator:string,leafText:string)=>string}}};
      const content=value.slice?.content;
      return {type:clip(step.constructor.name,64),from:finite(value.from),to:finite(value.to),insertedText:content?clip(content.textBetween(0,Math.min(content.size,TEXT_LIMIT),'\n','')):''};
    }),
    meta:{composition:scalar(transaction.getMeta('composition')),uiEvent:scalar(transaction.getMeta('uiEvent')),addToHistory:scalar(transaction.getMeta('addToHistory'))}
  };
}
function browserInfo(root:HTMLElement){
  const win=root.ownerDocument.defaultView,nav=win?.navigator;
  return {userAgent:clip(nav?.userAgent||''),platform:clip(nav?.platform||'',128),language:clip(nav?.language||'',64),languages:[...(nav?.languages||[])].slice(0,8).map(value=>clip(value,64)),viewport:{width:finite(win?.innerWidth),height:finite(win?.innerHeight),pixelRatio:finite(win?.devicePixelRatio)}};
}

/** Opt-in, in-memory diagnostics. Observation never changes the editor or its events. */
export function createStrategyInputDebug(getEditor:()=>Editor|undefined,onStatus?:(status:InputDebugStatus)=>void){
  let recording=false,limitReached=false,destroyed=false,sequence=0,bytes=0,started=0;
  let entries:Entry[]=[],editor:Editor|undefined,root:HTMLElement|undefined;
  let session:Record<string,unknown>|null=null,timer:ReturnType<typeof setTimeout>|undefined;
  const cleanups:Array<()=>void>=[];
  const now=()=>globalThis.performance?.now()??Date.now();
  const status=():InputDebugStatus=>({recording,count:entries.length,limitReached});
  function notify(immediate=false){
    if(!onStatus)return;
    if(immediate){clearTimeout(timer);timer=undefined;try{onStatus(status());}catch{}return;}
    if(timer===undefined)timer=setTimeout(()=>{timer=undefined;try{onStatus(status());}catch{}},500);
  }
  function detach(){
    clearTimeout(timer);timer=undefined;
    for(const cleanup of cleanups.splice(0)){try{cleanup();}catch{}}
  }
  function makeEntry(kind:string,detail:Record<string,unknown>):Entry{
    return {seq:sequence+1,timeMs:Math.max(0,Math.round((now()-started)*1000)/1000),kind:clip(kind,96),detail:safeDetail(detail),state:snapshot(editor,root)};
  }
  const size=(entry:Entry)=>JSON.stringify(entry).length*3;
  function append(entry:Entry){entries.push(entry);sequence=entry.seq;bytes+=size(entry);}
  function finish(kind:string,detail:Record<string,unknown>={}){
    const entry=makeEntry(kind,detail),entryBytes=size(entry);
    while(entries.length&&(entries.length>=ENTRY_LIMIT||bytes+entryBytes>BYTE_LIMIT-EXPORT_RESERVE))bytes-=size(entries.pop()!);
    append(entry);recording=false;detach();notify(true);
  }
  function record(kind:string,detail:Record<string,unknown>={}){
    if(!recording||destroyed)return;
    try{
      const entry=makeEntry(kind,detail);
      if(entries.length>=ENTRY_LIMIT-1||bytes+size(entry)>BYTE_LIMIT-TAIL_RESERVE-EXPORT_RESERVE){limitReached=true;finish('recording.limit',{reason:entries.length>=ENTRY_LIMIT-1?'entries':'bytes'});return;}
      append(entry);notify();
    }catch{/* Diagnostic failures must never interrupt native input. */}
  }
  function listen(target:EventTarget,type:string,listener:EventListener,capture=false){target.addEventListener(type,listener,capture);cleanups.push(()=>target.removeEventListener(type,listener,capture));}
  function attach(boundEditor:Editor,boundRoot:HTMLElement){
    for(const type of NATIVE_EVENTS)for(const capture of [true,false]){
      listen(boundRoot,type,event=>{
        try{
          if(!inside(event.target as Node|null,boundRoot))return;
          const input=event as InputEvent,keyboard=event as KeyboardEvent;
          record('native.'+type,{listenerPhase:capture?'capture':'bubble',eventPhase:event.eventPhase,timeStamp:finite(event.timeStamp),data:input.data===null?null:typeof input.data==='string'?clip(input.data):undefined,inputType:input.inputType,isComposing:input.isComposing,key:keyboard.key,code:keyboard.code,keyCode:finite(keyboard.keyCode),repeat:keyboard.repeat,ctrlKey:keyboard.ctrlKey,altKey:keyboard.altKey,shiftKey:keyboard.shiftKey,metaKey:keyboard.metaKey,isTrusted:event.isTrusted,cancelable:event.cancelable,defaultPrevented:event.defaultPrevented,targetPath:path(event.target as Node|null,boundRoot),targetRanges:type==='beforeinput'?targetRanges(input,boundRoot):undefined});
        }catch{}
      },capture);
    }
    listen(boundRoot.ownerDocument,'selectionchange',()=>{
      try{const selection=boundRoot.ownerDocument.getSelection();if(inside(boundRoot.ownerDocument.activeElement,boundRoot)&&selection&&(inside(selection.anchorNode,boundRoot)||inside(selection.focusNode,boundRoot)))record('native.selectionchange');}catch{}
    });
    const transaction=({transaction:tr}:{transaction:Transaction})=>{try{record('pm.transaction',transactionDetail(tr));}catch{}};
    const update=()=>record('pm.update'),selection=()=>record('pm.selectionUpdate');
    boundEditor.on('transaction',transaction);cleanups.push(()=>boundEditor.off('transaction',transaction));
    boundEditor.on('update',update);cleanups.push(()=>boundEditor.off('update',update));
    boundEditor.on('selectionUpdate',selection);cleanups.push(()=>boundEditor.off('selectionUpdate',selection));
    const Observer=boundRoot.ownerDocument.defaultView?.MutationObserver??globalThis.MutationObserver;
    if(Observer){
      const observer=new Observer(mutations=>{
        try{
          const relevant=mutations.filter(mutation=>inside(mutation.target,boundRoot));
          if(!relevant.length)return;
          record('dom.mutation',{count:relevant.length,mutations:relevant.slice(0,12).map(mutation=>({type:mutation.type,targetPath:path(mutation.target,boundRoot),added:mutation.addedNodes.length,removed:mutation.removedNodes.length,oldText:mutation.type==='characterData'?clip(mutation.oldValue||''):undefined,newText:mutation.type==='characterData'?clip(mutation.target.nodeValue||''):undefined}))});
        }catch{}
      });
      observer.observe(boundRoot,{subtree:true,childList:true,characterData:true,characterDataOldValue:true});cleanups.push(()=>observer.disconnect());
    }
  }
  function newSession(){
    started=now();session={id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10),startedAt:new Date().toISOString(),browser:root?browserInfo(root):null};
  }
  return {
    start(){
      if(destroyed||limitReached)return false;if(recording)return true;
      try{
        editor=getEditor();if(!editor||editor.isDestroyed)return false;root=editor.view.dom;
        if(!session)newSession();attach(editor,root);recording=true;
        record(entries.length?'recording.resume':'recording.start');notify(true);return true;
      }catch{recording=false;detach();return false;}
    },
    stop(){if(recording){try{finish('recording.stop');}catch{recording=false;detach();notify(true);}}},
    clear(){
      recording=false;detach();
      entries=[];sequence=0;bytes=0;limitReached=false;session=null;
      editor=undefined;root=undefined;notify(true);
    },
    destroy(){
      if(destroyed)return;
      if(recording){try{finish('recording.destroy');}catch{recording=false;}}
      destroyed=true;detach();editor=undefined;root=undefined;
    },
    record,
    exportLog(notes=''){
      return JSON.stringify({version:1,session,notes:clip(notes,2000),status:status(),limits:{entries:ENTRY_LIMIT,bytes:BYTE_LIMIT,text:TEXT_LIMIT},entries});
    }
  };
}
