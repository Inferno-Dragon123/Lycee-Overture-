<script setup lang="ts">
import type {Editor} from '@tiptap/core';
import {createStrategyInputDebug,type InputDebugStatus} from '~/utils/strategy-input-debug';
import OrbitButton from '../OrbitButton.vue';

const props=defineProps<{editor:Editor}>();
const status=shallowRef<InputDebugStatus>({recording:false,count:0,limitReached:false});
const notes=ref(''),output=ref(''),message=ref('');
const statusText=computed(()=>{
  if(status.value.limitReached)return '已达到记录上限并自动停止，请先导出日志。';
  if(status.value.recording)return '正在记录。可收起此面板继续输入。';
  if(message.value)return message.value;
  return status.value.count?`记录已停止 · ${status.value.count} 条。可以继续记录或导出日志。`:'尚未开启。下载、复制或查看日志时会停止记录。';
});
const recorder=createStrategyInputDebug(()=>props.editor,value=>{status.value=value;});
function start(){
  output.value='';message.value='';
  if(!recorder.start())message.value='暂时无法开始记录，请等待正文加载，或清空已有日志后重试。';
}
function clear(){recorder.clear();output.value='';message.value='日志已清空。';}
function serialize(){recorder.stop();return recorder.exportLog(notes.value);}
function show(){output.value=serialize();message.value='已停止记录，可以检查或手动复制下方日志。';}
async function copy(){
  const text=serialize();
  try{await navigator.clipboard.writeText(text);message.value='日志已复制，可以发回给开发者。';}
  catch{output.value=text;message.value='浏览器未允许复制，请长按下方日志复制，或下载日志文件。';}
}
function download(){
  const text=serialize();
  try{
    const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'}));
    const link=document.createElement('a');
    link.href=url;link.download=`lycee-ime-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    message.value='日志已导出。请把 JSON 文件发回来，并说明重复拼音出现在哪一步。';
  }catch{output.value=text;message.value='下载未完成，可复制下方日志。';}
}
defineExpose({record:(kind:string,detail?:Record<string,unknown>)=>recorder.record(kind,detail)});
onBeforeUnmount(()=>recorder.destroy());
</script>

<template>
  <details class="strategy-input-debug">
    <summary>输入法调试<span v-if="status.recording" class="input-debug-recording">记录中 · {{ status.count }} 条</span><span v-else-if="status.count">已记录 {{ status.count }} 条</span></summary>
    <div class="input-debug-body">
      <p>开启后回到正文，用平时的中文输入法复现问题，再停止并导出日志。可先输入“中文输入测试”，再试修改、退格和连续输入。</p>
      <p class="input-debug-note">默认关闭，仅记录攻略正文的输入文字和光标变化。日志暂存在本机内存，刷新或离开后清除，不会自动上传。请用测试文字；原有草稿仍按正常方式自动保存。</p>
      <label>测试备注（设备、输入法和复现步骤，可选）<textarea v-model="notes" rows="2" maxlength="500" /></label>
      <div class="input-debug-actions" role="group" aria-label="输入法调试操作">
        <OrbitButton v-if="!status.recording" size="sm" :disabled="status.limitReached" @click="start">{{ status.count?'继续记录':'开始记录' }}</OrbitButton>
        <OrbitButton v-else size="sm" variant="outline" tone="neutral" @click="recorder.stop()">停止记录</OrbitButton>
        <OrbitButton size="sm" variant="outline" tone="neutral" :disabled="!status.count" @click="download">下载日志</OrbitButton>
        <OrbitButton size="sm" variant="outline" tone="neutral" :disabled="!status.count" @click="copy">复制日志</OrbitButton>
        <OrbitButton size="sm" variant="ghost" tone="neutral" :disabled="!status.count" @click="show">查看日志</OrbitButton>
        <OrbitButton size="sm" variant="ghost" tone="neutral" :disabled="!status.count" @click="clear">清空日志</OrbitButton>
      </div>
      <p class="input-debug-status" role="status">{{ statusText }}</p>
      <label v-if="output">输入调试日志<textarea class="input-debug-output" :value="output" rows="8" readonly spellcheck="false" /></label>
    </div>
  </details>
</template>

<style scoped>
.strategy-input-debug{margin:12px 0 20px;border-bottom:1px solid var(--line);color:var(--ink);font-size:14px}
summary{display:list-item;cursor:pointer;padding:12px 0;min-height:44px;list-style-position:inside}
summary:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
summary span{margin-left:14px;color:var(--muted)}
summary .input-debug-recording{color:var(--accent)}
.input-debug-body{display:grid;gap:14px;max-width:850px;padding:4px 0 20px}
p{margin:0;line-height:1.75;overflow-wrap:anywhere}
.input-debug-note,.input-debug-status{color:var(--muted);font-size:13px}
label{display:grid;gap:8px;line-height:1.6}
textarea{width:100%;min-width:0;box-sizing:border-box;resize:vertical;border:1px solid var(--line);border-radius:6px;padding:10px 12px;background:var(--surface);color:var(--ink);font:inherit}
textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.input-debug-output{font-family:monospace;font-size:12px;line-height:1.6}
.input-debug-actions{display:flex;flex-wrap:wrap;gap:8px}
.input-debug-actions :deep(button){min-height:44px}
</style>
