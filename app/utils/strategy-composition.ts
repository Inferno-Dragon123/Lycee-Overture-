import {Extension} from '@tiptap/core';

interface StrategyCompositionOptions {
  onSkip?: () => void;
}

export const StrategyCompositionGuard = Extension.create<StrategyCompositionOptions>({
  name: 'strategyCompositionGuard',

  addOptions() {
    return {onSkip: undefined};
  },

  dispatchTransaction({transaction, next}) {
    // Failed Backspace commands still dispatch empty transactions in Tiptap.
    // During an IME deletion, applying one redraws the old document over the
    // browser's pending text change before the DOM observer can commit it.
    if (
      this.editor.view.composing &&
      transaction.steps.length === 0 &&
      !transaction.selectionSet &&
      !transaction.storedMarksSet &&
      transaction.isGeneric &&
      !transaction.scrolledIntoView
    ) {
      try {
        this.options.onSkip?.();
      } catch {
        // Recording must not interrupt composition.
      }
      return;
    }

    next(transaction);
  },
});
