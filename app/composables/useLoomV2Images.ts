import type { InjectionKey, Ref } from "vue";
import { createLoomImagePool, type LoomImageStatus } from "~/utils/loom-image-pool";
export interface LoomImages {
  states: Ref<Record<string, LoomImageStatus>>;
  request: (src: string, priority?: number) => void;
}
export const loomImagesKey: InjectionKey<LoomImages> = Symbol("loom-v2-images");
export function useLoomV2Images() {
  const states = ref<Record<string, LoomImageStatus>>({});
  const pool = createLoomImagePool((src, signal) => new Promise<void>((resolve, reject) => {
    const artwork = new Image();
    artwork.decoding = "async";
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); artwork.onload = artwork.onerror = null; };
    const fail = () => { cleanup(); artwork.src = ""; reject(new Error("image unavailable")); };
    const abort = () => fail();
    const timer = setTimeout(fail, 12000);
    signal.addEventListener("abort", abort, { once: true });
    artwork.onerror = fail;
    artwork.onload = () => {
      void artwork.decode().then(() => { cleanup(); resolve(); }, fail);
    };
    artwork.src = src;
  }), (src, state) => { states.value = { ...states.value, [src]: state }; });
  onBeforeUnmount(pool.dispose);
  const images = { states, request: pool.request };
  provide(loomImagesKey, images);
  return images;
}
