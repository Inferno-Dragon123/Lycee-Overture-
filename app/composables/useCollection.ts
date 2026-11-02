import { demoCards } from "./useShowcase";
import { chooseDisplay } from "~/demo/collection";
import { normalizeCollection } from "~/demo/collection";
import {
  parseDisplayBag,
  migrateDisplayBag,
  type DisplayBag,
} from "~/demo/display-bag";
export function useCollection() {
  const scope = usePersonalScope();
  const { catalog, load } = useDisplayCatalog();
  const legacyCollection = useCookie<Record<string, number>>(
    "lycee-demo-collection",
    {
      default: () =>
        Object.fromEntries(demoCards.slice(0, 6).map((c) => [c.code, 1])),
      sameSite: "lax",
    },
  );
  const wallet = useState<DisplayBag>("lycee-display-bag", () => ({
    version: 2,
    codes: scope.owner.value ? [] : Object.keys(normalizeCollection(legacyCollection.value)),
    revision: 0,
  }));
  const initialized = useState("lycee-display-bag-ready", () => false);
  const storageError = useState("lycee-display-bag-error", () => "");
  const key = scope.key("lycee-display-bag-v2");
  function read() {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const bag = parseDisplayBag(JSON.parse(raw));
      if (!bag) throw new Error("invalid bag");
      return bag;
    }
    const old = scope.owner.value ? null : localStorage.getItem("lycee-demo-wallet-v1");
    if (old !== null) {
      const bag = migrateDisplayBag(JSON.parse(old));
      if (!bag) throw new Error("invalid legacy bag");
      return bag;
    }
    return wallet.value;
  }
  function sync() {
    try {
      wallet.value = read();
      const raw = localStorage.getItem(scope.key("lycee-display-range-v2"));
      if (raw !== null) {
        const codes = JSON.parse(raw);
        if (!Array.isArray(codes) || !codes.every((c) => typeof c === "string"))
          throw new Error("invalid range");
        display.value = codes;
      }
      storageError.value = "";
    } catch {
      storageError.value = "背包记录无法读取，原记录已保留；请检查浏览器存储。";
    }
  }
  function onStorage(e: StorageEvent) {
    if (e.key === key || e.key === scope.key("lycee-display-range-v2") || e.key === null)
      sync();
  }
  onMounted(() => {
    if (!initialized.value) {
      sync();
      initialized.value = true;
    }
    void load();
    window.addEventListener("storage", onStorage);
  });
  onBeforeUnmount(() => {
    if (import.meta.client) window.removeEventListener("storage", onStorage);
  });
  async function update(code: string, remove = false) {
    const execute = () => {
      try {
        const latest = read();
        if (!Number.isSafeInteger(latest.revision + 1))
          throw new Error("revision overflow");
        if (!catalog.value.some((c) => c.code === code))
          throw new Error("unknown");
        const codes = remove
          ? latest.codes.filter((c) => c !== code)
          : [...new Set([...latest.codes, code])];
        const next: DisplayBag = {
          version: 2,
          codes,
          revision: latest.revision + 1,
        };
        localStorage.setItem(key, JSON.stringify(next));
        wallet.value = next;
        storageError.value = "";
        personalChanged();
        return true;
      } catch {
        storageError.value = "背包未能保存，本次操作未生效，原记录已保留。";
        return false;
      }
    };
    try {
      return navigator.locks
        ? await navigator.locks.request(key, execute)
        : execute();
    } catch {
      storageError.value = "背包当前不可写，本次操作未生效。";
      return false;
    }
  }
  const legacyDisplay = useCookie<string[]>("lycee-display-cards", {
    default: () => demoCards.slice(0, 3).map((c) => c.code),
    sameSite: "lax",
  });
  const display = useState<string[]>("lycee-display-range", () =>
    !scope.owner.value && Array.isArray(legacyDisplay.value) ? legacyDisplay.value : [],
  );
  const series = useCookie<string>(scope.key("lycee-display-series").replaceAll(':', '_'), {
    default: () => "",
    sameSite: "lax",
  });
  const rarity = useCookie<string>(scope.key("lycee-display-rarity").replaceAll(':', '_'), {
    default: () => "",
    sameSite: "lax",
  });
  onMounted(() => {
    try {
      const raw = localStorage.getItem(scope.key('lycee-display-preferences'));
      if (raw) { const p = JSON.parse(raw); series.value = p.series || ''; rarity.value = p.rarity || ''; }
    } catch { storageError.value = '展示条件无法读取，原记录已保留。'; }
  });
  watch([series, rarity], () => {
    try {
      localStorage.setItem(scope.key('lycee-display-preferences'), JSON.stringify({ series: series.value, rarity: rarity.value }));
      personalChanged();
    } catch { storageError.value = '展示条件未能保存。'; }
  });
  const owned = computed(() =>
    Object.fromEntries(wallet.value.codes.map((code) => [code, 1])),
  );
  const candidates = computed(() =>
    catalog.value.filter(
      (c) =>
        owned.value[c.code] &&
        (!series.value || c.brand === series.value) &&
        (!rarity.value || c.rarity === rarity.value),
    ),
  );
  const displayCards = computed(() =>
    (Array.isArray(display.value) ? display.value : []).flatMap((code) => {
      const card = catalog.value.find(
        (c) => c.code === code && owned.value[code],
      );
      return card ? [card] : [];
    }),
  );
  const totalOwned = computed(() => wallet.value.codes.length);
  function randomize() {
    const next = chooseDisplay(candidates.value);
    return next.length > 0 && setDisplay(next);
  }
  function setDisplay(codes: string[]) {
    try {
      const next = [...new Set(codes)].filter((code) => owned.value[code]);
      localStorage.setItem(scope.key("lycee-display-range-v2"), JSON.stringify(next));
      display.value = next;
      personalChanged();
      return true;
    } catch {
      storageError.value = "展示范围未能保存，请检查浏览器存储。";
      return false;
    }
  }
  return {
    owned,
    candidates,
    displayCards,
    series,
    rarity,
    totalOwned,
    randomize,
    setDisplay,
    wallet,
    storageError,
    add: (code: string) => update(code),
    remove: (code: string) => update(code, true),
  };
}
