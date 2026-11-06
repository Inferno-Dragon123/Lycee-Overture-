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
export function createStrategyEditorSync(editor:()=>ContentEditor|undefined,applied:(doc:StrategyNode)=>void){
  let pending:StrategyNode|undefined,timer:ReturnType<typeof setTimeout>|undefined;
  function apply(){
    const e=editor();if(!e||!pending)return;
    // Stored JSON omits default attributes; compare after schema normalization.
    const next=e.schema.nodeFromJSON(pending);
    if(e.state.doc.eq(next)){pending=undefined;return;}
    if(e.view.composing)return;
    pending=undefined;
    e.commands.setContent(next,{emitUpdate:false});
    applied(e.getJSON());
  }
  return {
    replace(doc:StrategyNode){pending=doc;apply();},
    compositionEnd(){
      if(!pending)return;
      clearTimeout(timer);
      // ProseMirror handles compositionend after our DOM handler and may flush
      // the final DOM mutation in a microtask. Apply only after that has settled.
      timer=setTimeout(apply,0);
    },
    destroy(){clearTimeout(timer);pending=undefined;}
  };
}
