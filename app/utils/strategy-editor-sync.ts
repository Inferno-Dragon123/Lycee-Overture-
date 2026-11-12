import type {Editor} from '@tiptap/core';
import type {Node,Schema} from '@tiptap/pm/model';
import type {StrategyNode} from '#shared/domain/strategy';

interface ContentEditor {
  schema:Schema;
  state:{doc:Node};
  view:{composing:boolean};
  commands:Pick<Editor['commands'],'setContent'>;
  getJSON:()=>StrategyNode;
}

// Only explicit draft replacements come in here. Local transactions flow out
// through onUpdate and must never replace the DOM that owns an IME session.
export function createStrategyEditorSync(editor:()=>ContentEditor|undefined,applied:(doc:StrategyNode)=>void,trace?:(kind:string,detail?:Record<string,unknown>)=>void){
  let pending:StrategyNode|undefined,timer:ReturnType<typeof setTimeout>|undefined;
  // Diagnostics must not change input behavior, including if logging fails.
  function log(kind:string,detail?:Record<string,unknown>){try{trace?.('sync:'+kind,detail);}catch{}}
  function apply(){
    const e=editor();if(!e||!pending)return;
    // Stored JSON omits default attributes; compare after schema normalization.
    const next=e.schema.nodeFromJSON(pending);
    if(e.state.doc.eq(next)){pending=undefined;log('equivalent');return;}
    if(e.view.composing){log('deferred-composition');return;}
    pending=undefined;
    if(trace)log('setContent:before',{incomingText:next.textContent.slice(0,2000),incomingSize:next.content.size});
    e.commands.setContent(next,{emitUpdate:false});
    applied(e.getJSON());
    log('setContent:after');
  }
  return {
    replace(doc:StrategyNode){pending=doc;log('replace-request');apply();},
    compositionEnd(){
      log('composition-end',{pending:!!pending});
      if(!pending)return;
      clearTimeout(timer);
      // ProseMirror handles compositionend after our DOM handler and may flush
      // the final DOM mutation in a microtask. Apply only after that has settled.
      timer=setTimeout(apply,0);
    },
    destroy(){clearTimeout(timer);pending=undefined;}
  };
}
