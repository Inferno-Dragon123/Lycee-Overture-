<script setup lang="ts">
import {strategyRequest} from '~/utils/strategy-api';

import {Editor,EditorContent} from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {TextSelection,type SelectionBookmark} from '@tiptap/pm/state';
import {CardMention,StrategyReferenceNode,StrategyImage,StrategyTextStyle} from '~/utils/strategy-editor';
import {strategyRefs,rememberReference,safeStrategyUrl,strategyCategories,validateStrategy,type StrategySnapshot} from '#shared/domain/strategy';
import {printStrategy,type ArticlePrintOptions} from '~/utils/strategy-print';
import ReferenceWorkspace from './ReferenceWorkspace.vue';
import StrategyContent from './StrategyContent.vue';
import TextFormatControls from './TextFormatControls.vue';
import SelectionTextToolbar from './SelectionTextToolbar.vue';
import EditorLinkTools from './EditorLinkTools.vue';
import ChoiceListbox from '../ChoiceListbox.vue';
import WorkflowDialog from '../WorkflowDialog.vue';
const props=defineProps<{id:string}>();
const draft=useStrategyDraft(props.id),catalog=useOrbitCatalog(),state=useShowcase(),scope=usePersonalScope();
const editor=shallowRef<Editor>(),workspace=ref<InstanceType<typeof ReferenceWorkspace>>(),workspaceOpen=ref(true),narrow=ref(false),preview=ref(false),publishPanel=ref(false),pdfPanel=ref(false),linkPanel=ref(false),captionPanel=ref(false),uploading=ref(0),busy=ref(false),error=ref('');
const pageRoot=ref<HTMLElement>(),actionHeader=ref<HTMLElement>();
let resizeObserver:ResizeObserver|undefined;
const coverImages=computed(()=>strategyRefs(draft.body.value.doc).media);
const imageInput=ref<HTMLInputElement>(),recent=ref<any[]>([]),selectedCodes=ref<string[]>([]),galleryTarget=shallowRef<(()=>number|undefined)|null>(null);
const cards=computed(()=>Object.fromEntries(catalog.byCode.value));
const formatLevel=computed({get:()=>String(editor.value?.getAttributes('heading').level||0),set:(value:string)=>{const level=Number(value) as 2|3|4;if(level)editor.value?.chain().focus().toggleHeading({level}).run();else editor.value?.chain().focus().setParagraph().run();}});
const metadataTags=computed({get:()=>draft.body.value.tags.join('，'),set:(text:string)=>draft.body.value.tags=text.split(/[,，]/).map(t=>t.trim()).filter(Boolean).slice(0,8)});
const link=reactive({url:'',text:''}),caption=reactive({alt:'',title:''});
const printOptions=reactive<ArticlePrintOptions>({paper:'a4',cover:false,pageNumbers:true,links:true});
let bookmark:SelectionBookmark|undefined,oldOverflow='',replaceImage=false,selectionLocked=false;
function chooseImage(replace=false){replaceImage=replace;imageInput.value?.click();}
function restoreSelection(){selectionLocked=false;const e=editor.value;if(!e)return;try{if(bookmark)e.view.dispatch(e.state.tr.setSelection(bookmark.resolve(e.state.doc)));}catch{e.commands.focus('end');}}
function closeWorkspace(){workspaceOpen.value=false;nextTick(()=>{restoreSelection();editor.value?.commands.focus();});}
function openWorkspace(search=false){selectionLocked=true;workspaceOpen.value=true;if(search)nextTick(()=>workspace.value?.searchCards());}
function remember(r:any){recent.value=rememberReference(recent.value,r);try{localStorage.setItem(scope.key('strategy-recent-v1'),JSON.stringify(recent.value));}catch{error.value='最近引用未能保存，正文不受影响。';}}
function insert(node:any,r:any){
  const e=editor.value;if(!e||!draft.ready.value||busy.value||!e.isEditable)return;
  restoreSelection();if(e.chain().focus().insertContent(node).run()){remember(r);galleryTarget.value=null;if(narrow.value)closeWorkspace();}
}
function batch(codes:string[]){
  const e=editor.value;if(!e||!codes.length||busy.value||!e.isEditable)return;
  const unique=[...new Set(codes)].slice(0,40),pos=galleryTarget.value?.();
  let inserted=false;
  if(typeof pos==='number'&&e.state.doc.nodeAt(pos)?.type.name==='reference')inserted=e.chain().focus().setNodeSelection(pos).updateAttributes('reference',{ref:{kind:'gallery',codes:unique}}).run();
  else {restoreSelection();inserted=e.chain().focus().insertContent({type:'reference',attrs:{ref:{kind:'gallery',codes:unique}}}).run();}
  if(!inserted)return;
  remember({key:'gallery:'+unique.join(','),label:unique.length+'种卡牌组合',kind:'gallery',codes:unique});selectedCodes.value=[];galleryTarget.value=null;if(narrow.value)closeWorkspace();
}
function canMove(getPos:()=>number|undefined,delta:number){const e=editor.value,pos=getPos();if(!e||typeof pos!=='number')return false;const resolved=e.state.doc.resolve(pos),to=resolved.index()+delta;return to>=0&&to<resolved.parent.childCount;}
function moveObject(getPos:()=>number|undefined,delta:number){const e=editor.value,pos=getPos();if(!e||!e.isEditable||typeof pos!=='number'||!canMove(getPos,delta))return;const resolved=e.state.doc.resolve(pos),node=e.state.doc.nodeAt(pos)!,sibling=resolved.parent.child(resolved.index()+delta),from=delta<0?pos-sibling.nodeSize:pos,to=from+node.nodeSize+sibling.nodeSize;e.chain().focus().insertContentAt({from,to},(delta<0?[node,sibling]:[sibling,node]).map(n=>n.toJSON())).run();}
function focusObject(getPos:()=>number|undefined){const pos=getPos();if(typeof pos==='number'){editor.value?.commands.setNodeSelection(pos);bookmark=editor.value?.state.selection.getBookmark();}}
function editLinkRange(range:{from:number;to:number}){editor.value?.commands.setTextSelection(range);bookmark=editor.value?.state.selection.getBookmark();editLink();}
provide('strategy-editor-context',{canMove,moveObject,mobile:narrow,caption:(getPos:()=>number|undefined)=>{focusObject(getPos);imageCaption();},replaceImage:(getPos:()=>number|undefined)=>{focusObject(getPos);chooseImage(true);},cards,snapshots:draft.snapshots,card:(code:string)=>{const card=catalog.byCode.value.get(code);if(card)state.selected.value=card;},editGallery:(getPos:()=>number|undefined,codes:string[])=>{galleryTarget.value=getPos;selectedCodes.value=[...codes];openWorkspace(true);}});
async function upload(file:File){
  if(!draft.account.user.value){error.value='请先登录后上传图片。文字草稿已保留在本机。';state.utility.value='account';return;}
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>6*1024*1024){error.value='请选择6MB以内的PNG、JPEG或WebP图片。';return;}
  uploading.value++;error.value='';
  try{const result=await strategyRequest<{url:string}>('/api/strategy/media',{method:'POST',body:file,headers:{'content-type':file.type}});restoreSelection();const attrs={src:result.url,alt:file.name.replace(/\.[^.]+$/,'')};if(replaceImage&&editor.value?.isActive('image'))editor.value.chain().focus().updateAttributes('image',attrs).run();else {const e=editor.value;if(e){const at=e.state.selection.to;e.chain().focus().setTextSelection(at).setImage(attrs).run();}}}
  catch(e){error.value=(e as {data?:{message?:string}}).data?.message||'图片上传失败，正文未改变，可重试。';}finally{uploading.value--;replaceImage=false;}
}
function files(event:Event){const input=event.target as HTMLInputElement;if(input.files?.[0])void upload(input.files[0]);input.value='';}
function init(){
  if(!import.meta.client||!draft.ready.value)return;
  if(editor.value){if(JSON.stringify(editor.value.getJSON())!==JSON.stringify(draft.body.value.doc))editor.value.commands.setContent(draft.body.value.doc,{emitUpdate:false});return;}
  editor.value=new Editor({
    content:draft.body.value.doc,extensions:[StarterKit.configure({heading:{levels:[2,3,4]},link:{openOnClick:false,protocols:['http','https']}}),StrategyImage,StrategyTextStyle,Placeholder.configure({placeholder:'写下你的思路。输入 @ 搜索卡牌，或打开资料工作台。'}),CardMention.configure({resolveName:code=>catalog.byCode.value.get(code)?.name||code}),StrategyReferenceNode],
    editorProps:{handleClick:(_view,_pos,event)=>{const anchor=(event.target as Element).closest<HTMLAnchorElement>('a[href]');if(!anchor||anchor.closest('.strategy-node,.strategy-inline-node'))return false;try{const url=safeStrategyUrl(anchor.href);event.preventDefault();window.open(url,'_blank','noopener,noreferrer');return true;}catch{return false;}},attributes:{'aria-label':'攻略正文',role:'textbox','aria-multiline':'true'},handleKeyDown:(_view,event)=>{if(event.key==='@'&&!event.ctrlKey&&!event.metaKey){event.preventDefault();bookmark=editor.value?.state.selection.getBookmark();selectionLocked=true;openWorkspace(true);return true;}return false;},
      handlePaste:(_view,event)=>{const file=event.clipboardData?.files[0];if(file){event.preventDefault();void upload(file);return true;}return false;},
      handleDrop:(view,event)=>{const file=event.dataTransfer?.files[0];if(file){event.preventDefault();const pos=view.posAtCoords({left:event.clientX,top:event.clientY})?.pos;if(pos!==undefined)bookmark=TextSelection.create(view.state.doc,pos).getBookmark();void upload(file);return true;}return false;}},
    onTransaction:({transaction})=>{if(bookmark&&transaction.docChanged)bookmark=bookmark.map(transaction.mapping);},
    onFocus:()=>{selectionLocked=false;},onBlur:()=>{selectionLocked=true;},
    onSelectionUpdate:({editor:e})=>{if(!selectionLocked&&e.isFocused)bookmark=e.state.selection.getBookmark();},
    onUpdate:({editor:e})=>{const doc=e.getJSON();if(JSON.stringify(draft.body.value.doc)!==JSON.stringify(doc))draft.body.value.doc=doc;bookmark=e.state.selection.getBookmark();}
  });
  bookmark=editor.value.state.selection.getBookmark();
}
watch(draft.ready,init);watch(()=>draft.body.value.doc,init,{deep:true});
function editLink(){restoreSelection();link.url=editor.value?.getAttributes('link').href||'';link.text=editor.value?.state.doc.textBetween(editor.value.state.selection.from,editor.value.state.selection.to)||'';linkPanel.value=true;}
function applyLink(){try{const url=safeStrategyUrl(link.url);restoreSelection();const e=editor.value;if(!e)return;if(e.state.selection.empty)e.chain().focus().insertContent({type:'text',text:link.text||url,marks:[{type:'link',attrs:{href:url}}]}).run();else {const selected=e.state.doc.textBetween(e.state.selection.from,e.state.selection.to);if(link.text&&link.text!==selected){const marks=(e.state.doc.nodeAt(e.state.selection.from)?.marks||[]).filter(m=>m.type.name!=='link').map(m=>m.toJSON());e.chain().focus().insertContent({type:'text',text:link.text,marks:[...marks,{type:'link',attrs:{href:url,target:'_blank',rel:'noopener noreferrer'}}]}).run();}else e.chain().focus().setLink({href:url}).run();}linkPanel.value=false;}catch{error.value='请输入完整的HTTP或HTTPS链接';}}
function imageCaption(){const attrs=editor.value?.getAttributes('image');caption.alt=attrs?.alt||'';caption.title=attrs?.title||'';captionPanel.value=true;}
async function publish(){busy.value=true;error.value='';editor.value?.setEditable(false,false);try{if(uploading.value)throw new Error('请等待图片上传完成');const published=await draft.publish();if(published){publishPanel.value=false;await navigateTo('/concepts/orbit/learn/'+props.id);}}catch(e){error.value=(e as Error).message;}finally{busy.value=false;editor.value?.setEditable(true,false);}}
async function pdf(){busy.value=true;error.value='';try{if(uploading.value)throw new Error('请等待图片上传完成');validateStrategy(draft.body.value);await printStrategy(draft.body.value,cards.value,draft.snapshots.value,printOptions);pdfPanel.value=false;}catch(e){error.value=(e as Error).message||'导出失败，请重试';}finally{busy.value=false;}}
function measure(){const globalHeight=document.querySelector('.p-header')?.getBoundingClientRect().height||82;pageRoot.value?.style.setProperty('--strategy-global-height',globalHeight+'px');pageRoot.value?.style.setProperty('--strategy-action-height',(actionHeader.value?.getBoundingClientRect().height||54)+'px');const value=window.innerWidth<1050;if(value&&!narrow.value)workspaceOpen.value=false;narrow.value=value;}
function trap(event:KeyboardEvent){if(!narrow.value||event.key!=='Tab')return;const nodes=[...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button:not(:disabled),input,select,textarea,a[href]')].filter(el=>el.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
watch([workspaceOpen,narrow],([open,mobile])=>{if(!import.meta.client)return;if(open&&mobile){oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';nextTick(()=>workspace.value?.$el.querySelector('button')?.focus());}else if(document.body.style.overflow==='hidden')document.body.style.overflow=oldOverflow;});
onMounted(async()=>{measure();resizeObserver=new ResizeObserver(measure);if(actionHeader.value)resizeObserver.observe(actionHeader.value);const globalHeader=document.querySelector('.p-header');if(globalHeader)resizeObserver.observe(globalHeader);window.addEventListener('resize',measure);try{const raw=JSON.parse(localStorage.getItem(scope.key('strategy-recent-v1'))||'[]');if(Array.isArray(raw))recent.value=raw.slice(0,24);}catch{}await catalog.load();init();});
onBeforeUnmount(()=>{resizeObserver?.disconnect();editor.value?.destroy();window.removeEventListener('resize',measure);if(narrow.value&&workspaceOpen.value)document.body.style.overflow=oldOverflow;});
</script>
<template>
  <section ref="pageRoot" class="strategy-editor-page">
    <header ref="actionHeader" class="strategy-editor-header"><NuxtLink to="/concepts/orbit/learn?tab=mine">← 返回攻略</NuxtLink><span aria-live="polite">{{ draft.status.value }}</span><div><button :disabled="!draft.ready.value||busy" @click="draft.flush">立即保存</button><button :disabled="!draft.ready.value" @click="preview=true">预览</button><button :disabled="!draft.ready.value||busy||uploading>0" @click="pdfPanel=true">导出PDF</button><button class="p-button" :disabled="!draft.ready.value||busy||uploading>0" @click="publishPanel=true">{{ draft.published.value?'更新发布':'发布攻略' }}</button></div></header>
    <p v-if="error||draft.error.value" role="alert" class="strategy-error">{{ error||draft.error.value }} <button @click="draft.flush">重试同步</button></p>
    <div v-if="draft.conflict.value||!draft.ready.value&&draft.error.value" class="strategy-conflict"><button @click="draft.fork">把本机修改另存为新攻略</button><button @click="draft.readCloud">保留恢复副本并读取云端</button></div>
    <p v-if="!draft.account.user.value" class="reading-note">未登录：草稿仅保存在当前浏览器。登录后可在“我的攻略”主动导入游客草稿。<button @click="state.utility.value='account'">登录</button></p>
    <div class="strategy-editor-layout" :class="{'workspace-closed':!workspaceOpen}">
      <main class="strategy-writing-surface"><label class="sr-only" for="strategy-title">攻略标题</label><input id="strategy-title" v-model="draft.body.value.title" class="strategy-title-input" maxlength="100" placeholder="给攻略起个标题" :disabled="!draft.ready.value||busy" />
        <div v-if="editor" class="strategy-toolbar" role="toolbar" aria-label="正文格式工具栏"><ChoiceListbox v-model="formatLevel" label="标题层级" hide-label :options="[{value:'0',label:'正文'},{value:'2',label:'二级标题'},{value:'3',label:'三级标题'},{value:'4',label:'四级标题'}]" /><TextFormatControls :editor="editor" :prepare="restoreSelection" /><button @click="editLink">链接</button><button @click="chooseImage()">图片</button><button aria-controls="strategy-workspace" :aria-expanded="workspaceOpen" @click="workspaceOpen=!workspaceOpen">资料</button><details><summary>更多</summary><div><button @click="editor.chain().focus().toggleStrike().run()">删除线</button><button @click="editor.chain().focus().setHorizontalRule().run()">分隔线</button><button :disabled="!editor.isActive('image')" @click="imageCaption">图片说明</button><button :disabled="!editor.isActive('image')" @click="chooseImage(true)">替换图片</button></div></details><button :disabled="!editor.can().undo()" @click="editor.chain().focus().undo().run()">撤销</button><button :disabled="!editor.can().redo()" @click="editor.chain().focus().redo().run()">重做</button></div>
        <template v-if="editor&&!preview&&!pdfPanel&&!publishPanel&&!linkPanel&&!captionPanel"><SelectionTextToolbar :editor="editor" /><EditorLinkTools :editor="editor" @edit="editLinkRange" /></template><p v-if="uploading" role="status">正在上传 {{ uploading }} 张图片…</p><EditorContent v-if="editor" :editor="editor" class="strategy-richtext" /><p v-else role="status">正在恢复正文…</p>
        <input ref="imageInput" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" aria-label="上传正文图片" @change="files" />
        <button v-if="!workspaceOpen" class="strategy-open-workspace p-button" @click="openWorkspace()">打开资料工作台</button>
      </main>
      <button v-if="narrow&&workspaceOpen" class="strategy-workspace-backdrop" aria-label="收起资料工作台" @click="closeWorkspace" />
      <div id="strategy-workspace" v-show="workspaceOpen" class="strategy-workspace-shell" :role="narrow?'dialog':undefined" :aria-modal="narrow?true:undefined" :aria-label="narrow?'资料工作台':undefined" @keydown.esc="closeWorkspace" @keydown="trap"><ReferenceWorkspace ref="workspace" :selected-codes="selectedCodes" :recent="recent" @insert="insert" @batch="batch" @snapshot="s=>draft.snapshots.value[s.id]=s" @close="closeWorkspace" /></div>
    </div>
    <WorkflowDialog v-model:open="preview" title="攻略预览" wide><h2>{{ draft.body.value.title||'未命名攻略' }}</h2><p>{{ draft.body.value.summary }}</p><StrategyContent :doc="draft.body.value.doc" :cards="cards" :snapshots="draft.snapshots.value" @card="code=>{const c=catalog.byCode.value.get(code);if(c)state.selected.value=c;}" /></WorkflowDialog>
    <WorkflowDialog v-model:open="publishPanel" title="发布攻略" description="发布后正文、图片与已确认的私人构筑快照可被其他访客查看。"><form class="workflow-form" @submit.prevent="publish"><fieldset class="strategy-publish-fields" :disabled="busy"><label>标题<input v-model="draft.body.value.title" maxlength="100" required /></label><label>简介<textarea v-model="draft.body.value.summary" rows="3" maxlength="400" /></label><ChoiceListbox v-model="draft.body.value.category" label="分类" :options="strategyCategories.map(c=>({value:c,label:c}))" /><label>标签（逗号分隔，最多8个）<input v-model="metadataTags" maxlength="200" /></label><fieldset class="strategy-cover-options"><legend>封面图片</legend><label><input v-model="draft.body.value.cover" type="radio" value="" />无封面</label><label v-for="(src,index) in coverImages" :key="src"><input v-model="draft.body.value.cover" type="radio" :value="src" :aria-label="'正文图片 '+(index+1)" /><img :src="src" :alt="'正文图片 '+(index+1)" /></label></fieldset><p v-if="draft.error.value||error" role="alert">{{ draft.error.value||error }}</p><button class="p-button" :disabled="busy||uploading>0||draft.conflict.value" type="submit">确认发布</button></fieldset></form></WorkflowDialog>
    <WorkflowDialog v-model:open="pdfPanel" title="导出PDF" description="准备完整文章与卡图后打开打印窗口，请选择“另存为PDF”。"><form class="workflow-form" @submit.prevent="pdf"><ChoiceListbox :model-value="printOptions.paper" label="纸张" :options="[{value:'a4',label:'A4'},{value:'letter',label:'Letter'}]" @update:model-value="printOptions.paper=$event==='letter'?'letter':'a4'" /><label class="strategy-consent"><input v-model="printOptions.cover" type="checkbox" />包含封面页</label><label class="strategy-consent"><input v-model="printOptions.pageNumbers" type="checkbox" />显示页码</label><label class="strategy-consent"><input v-model="printOptions.links" type="checkbox" />附外部资料链接列表</label><p v-if="error" role="alert">{{ error }}</p><button class="p-button" :disabled="busy" type="submit">{{ busy?'正在准备图片…':'准备PDF并打开打印' }}</button></form></WorkflowDialog>
    <WorkflowDialog v-model:open="linkPanel" title="插入链接"><form class="workflow-form" @submit.prevent="applyLink"><label>网址<input v-model="link.url" type="url" required /></label><label>显示文字<input v-model="link.text" maxlength="200" /></label><button class="p-button" type="submit">应用链接</button></form></WorkflowDialog>
    <WorkflowDialog v-model:open="captionPanel" title="图片说明"><form class="workflow-form" @submit.prevent="restoreSelection();editor?.chain().focus().updateAttributes('image',{alt:caption.alt,title:caption.title}).run();captionPanel=false"><label>替代文字<input v-model="caption.alt" maxlength="200" /></label><label>图注<input v-model="caption.title" maxlength="200" /></label><button class="p-button" type="submit">保存说明</button></form></WorkflowDialog>
  </section>
</template>
