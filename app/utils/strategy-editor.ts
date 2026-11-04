import {Node,Mark,Extension,mergeAttributes} from '@tiptap/core';
import {VueNodeViewRenderer} from '@tiptap/vue-3';
import InlineCardNodeView from '~/components/concepts/strategy/InlineCardNodeView.vue';
import ImageNodeView from '~/components/concepts/strategy/ImageNodeView.vue';
import Image from '@tiptap/extension-image';
import ReferenceNodeView from '~/components/concepts/strategy/ReferenceNodeView.vue';
import {emptyStrategy,validateStrategy,strategyStyleCss,strategyLayout,strategyTextStyle} from '#shared/domain/strategy';
export const CardMention:Node<{resolveName:(code:string)=>string}>=Node.create<{resolveName:(code:string)=>string}>({
  name:'cardMention',group:'inline',inline:true,atom:true,marks:'bold italic underline strike textStyle',
  addOptions(){return {resolveName:code=>code};},
  addAttributes(){return {code:{default:''},textStyle:{default:{}}};},
  parseHTML(){return [{tag:'span[data-card-code]',getAttrs:element=>{
    const code=(element as HTMLElement).dataset.cardCode;try{return /^LO-\d{4}[A-Za-z0-9-]{0,16}$/.test(code||'')?{code,textStyle:strategyTextStyle(JSON.parse((element as HTMLElement).dataset.strategyTextStyle||'{}'))}:false;}catch{return false;}
  }}];},
  renderHTML({HTMLAttributes}){return ['span',{'data-card-code':HTMLAttributes.code,'data-strategy-text-style':JSON.stringify(HTMLAttributes.textStyle||{}),class:'strategy-mention'},this.options.resolveName(HTMLAttributes.code)+'〔'+HTMLAttributes.code+'〕'];},
  addNodeView(){return VueNodeViewRenderer(InlineCardNodeView,{stopEvent:({event})=>!!(event.target as HTMLElement).closest('a,button,input,summary,textarea')});}
});
export const StrategyReferenceNode:Node=Node.create({
  name:'reference',group:'block',atom:true,draggable:true,
  addAttributes(){return {ref:{default:null},layout:{default:{}},textStyle:{default:{}}};},
  parseHTML(){return [{tag:'div[data-strategy-reference]',getAttrs:element=>{
    try{const raw=JSON.parse((element as HTMLElement).dataset.strategyReference||'');const attrs=raw.kind?{ref:raw}:raw;const checked=validateStrategy({...emptyStrategy(),doc:{type:'doc',content:[{type:'reference',attrs}]}});return checked.doc.content![0]!.attrs!;}catch{return false;}
  }}];},
  renderHTML({node}){return ['div',{'data-strategy-reference':JSON.stringify(node.attrs)},'攻略资料引用'];},
  addNodeView(){return VueNodeViewRenderer(ReferenceNodeView,{stopEvent:({event})=>!(event.target as HTMLElement).closest('[data-drag-handle]')&&!!(event.target as HTMLElement).closest('a,button,input,summary,textarea')});}
});

export const StrategyImage:Node=Image.extend({
  addAttributes(){return {...this.parent?.(),layout:{default:{},parseHTML:element=>{try{return strategyLayout(JSON.parse(element.dataset.strategyLayout||'{}'));}catch{return {};}},renderHTML:attrs=>({'data-strategy-layout':JSON.stringify(attrs.layout||{})})},textStyle:{default:{},parseHTML:element=>{try{return strategyTextStyle(JSON.parse(element.dataset.strategyTextStyle||'{}'));}catch{return {};}},renderHTML:attrs=>({'data-strategy-text-style':JSON.stringify(attrs.textStyle||{})})}};},
  parseHTML(){return [{tag:'img[src^="/api/strategy/media/"]'}];},
  addNodeView(){return VueNodeViewRenderer(ImageNodeView,{stopEvent:({event})=>!(event.target as HTMLElement).closest('[data-drag-handle]')&&!!(event.target as HTMLElement).closest('a,button,input,summary,textarea')});}
}).configure({allowBase64:false});
function parsedColor(element:HTMLElement){const value=element.style.color;if(/^#[0-9a-f]{6}$/i.test(value))return value;const rgb=/^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/.exec(value);return rgb&&rgb.slice(1).every(v=>Number(v)<=255)?'#'+rgb.slice(1).map(v=>Number(v).toString(16).padStart(2,'0')).join(''):null;}
export const StrategyTextStyle=Mark.create({
  name:'textStyle',
  priority:110,
  addAttributes(){return {color:{default:null,parseHTML:parsedColor},fontSize:{default:null,parseHTML:element=>/^\d+(?:\.\d+)?px$/.test(element.style.fontSize)?Math.round(Math.max(10,Math.min(72,Number.parseFloat(element.style.fontSize)))):null},underline:{default:null,parseHTML:element=>element.style.textDecoration==='none'?false:element.style.textDecoration==='underline'?true:null}};},
  parseHTML(){return [{tag:'span[style]'}];},
  renderHTML({HTMLAttributes}){const style=strategyStyleCss(HTMLAttributes);return ['span',{style:Object.entries(style).map(([key,value])=>key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+':'+value).join(';')},0];}
});
function linePaint(raw:string){const probe=document.createElement('span');probe.style.color=raw;return parsedColor(probe);}
export const StrategyLineColors=Extension.create({
  name:'strategyLineColors',
  addGlobalAttributes(){return [
    {types:['underline','strike'],attributes:{color:{default:null,parseHTML:(element:HTMLElement)=>linePaint(element.style.textDecorationColor),renderHTML:(attrs:Record<string,any>)=>attrs.color?{style:`text-decoration-color:${attrs.color}`}:{}}}},
    {types:['horizontalRule'],attributes:{color:{default:null,parseHTML:(element:HTMLElement)=>linePaint(element.style.borderColor),renderHTML:(attrs:Record<string,any>)=>attrs.color?{style:`border-color:${attrs.color}`}:{}}}},
  ];},
});
