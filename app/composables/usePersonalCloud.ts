import { emptyPersonal, validatePersonal, personalKey, type PersonalData, type PersonalSnapshot } from '#shared/domain/personal';
import { parseLibrary } from '#shared/domain/deck-library';
import { parseDisplayBag, migrateDisplayBag } from '~/demo/display-bag';

type Cache = PersonalSnapshot & { dirty: boolean };
let running: Promise<boolean> | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;
export function usePersonalCloud() {
  const scope = usePersonalScope(), account = useWorkflowAccount();
  const status = useState('personal-cloud-status', () => 'guest');
  const error = useState('personal-cloud-error', () => '');
  const revision = useState('personal-cloud-revision', () => 0);
  const updatedAt = useState<string | null>('personal-cloud-updated', () => null);
  const dirty = useState('personal-cloud-dirty', () => false);
  const cacheKey = () => scope.key('cloud-cache');
  const headers = () => ({ 'x-lycee-owner': scope.owner.value! });
  function read(owner = scope.owner.value): PersonalData {
    const key = (k: string) => personalKey(k, owner), data = emptyPersonal();
    const library = localStorage.getItem(key('lycee-deck-library-v2'));
    const legacy = !owner && localStorage.getItem('lycee-practice-decks-v1');
    if (library) data.library = parseLibrary(library);
    else if (legacy) data.library = parseLibrary(JSON.stringify({ version: 2, saved: JSON.parse(legacy), draft: null }));
    const bag = localStorage.getItem(key('lycee-display-bag-v2'));
    const oldBag = !owner && localStorage.getItem('lycee-demo-wallet-v1');
    if (bag || oldBag) {
      const parsed = bag ? parseDisplayBag(JSON.parse(bag)) : migrateDisplayBag(JSON.parse(oldBag as string));
      if (!parsed) throw new Error('展示背包数据无法读取，原记录已保留。');
      data.bag = parsed.codes;
    }
    const range = localStorage.getItem(key('lycee-display-range-v2'));
    if (range) {
      const values = JSON.parse(range);
      if (!Array.isArray(values)) throw new Error('展示范围格式无效');
      data.display = values.filter(c => data.bag.includes(c));
    }
    const preferences = localStorage.getItem(key('lycee-display-preferences'));
    if (preferences) data.preferences = JSON.parse(preferences);
    return validatePersonal(data);
  }
  function write(data: PersonalData) {
    localStorage.setItem(scope.key('lycee-deck-library-v2'), JSON.stringify(data.library));
    localStorage.setItem(scope.key('lycee-display-bag-v2'), JSON.stringify({ version: 2, codes: data.bag, revision: 0 }));
    localStorage.setItem(scope.key('lycee-display-range-v2'), JSON.stringify(data.display));
    localStorage.setItem(scope.key('lycee-display-preferences'), JSON.stringify(data.preferences));
  }
  function cache(data: PersonalData, pending: boolean) {
    localStorage.setItem(cacheKey(), JSON.stringify({ revision: revision.value, updatedAt: updatedAt.value, data, dirty: pending }));
    dirty.value = pending;
  }
  function checked(raw: PersonalSnapshot): PersonalSnapshot {
    if (!Number.isSafeInteger(raw.revision) || raw.revision < 0) throw new Error('云端版本无效');
    return { ...raw, data: validatePersonal(raw.data) };
  }
  function message(e: unknown) {
    return (e as { data?: { message?: string }; message?: string }).data?.message || (e as Error).message || '同步失败，本机修改已保留。';
  }
  function schedule() {
    if (!scope.owner.value || status.value === 'loading') return;
    try {
      const data = read();
      const previous = localStorage.getItem(cacheKey());
      if (previous && JSON.stringify(JSON.parse(previous).data) === JSON.stringify(data)) return;
      cache(data, true); generation++;
      if (status.value === 'conflict') return;
      status.value = 'pending';
      clearTimeout(timer); timer = setTimeout(() => void flush(), 700);
    } catch (e) { status.value = 'error'; error.value = message(e); }
  }
  async function flush(): Promise<boolean> {
    if (!scope.owner.value || !dirty.value) return true;
    if (status.value === 'conflict') return false;
    if (running) return running;
    const epoch = generation;
    running = (async () => {
      try {
        status.value = 'syncing';
        const data = read();
        const result = checked(await $fetch<PersonalSnapshot>('/api/workflow/personal', { method: 'PUT', headers: headers(), body: { revision: revision.value, data } }));
        revision.value = result.revision; updatedAt.value = result.updatedAt;
        cache(read(), generation !== epoch);
        status.value = dirty.value ? 'pending' : 'saved'; error.value = '';
        return !dirty.value;
      } catch (e) {
        status.value = (e as { statusCode?: number }).statusCode === 409 ? 'conflict' : 'error';
        error.value = message(e); return false;
      } finally {
        running = null;
        if (dirty.value && status.value === 'pending') timer = setTimeout(() => void flush(), 100);
      }
    })();
    return running;
  }
  async function initialize() {
    await account.refresh();
    scope.owner.value = account.user.value?.id || null;
    if (!scope.owner.value) return;
    status.value = 'loading';
    error.value = '';
    // SSR may carry the guest's construction cookie. Never auto-upload it to an account.
    useState<Record<string, number>>('showcase-quantities').value = {};
    useState<string>('showcase-deck-name').value = '我的构筑';
    let local: Cache | null = null;
    try {
      const raw = localStorage.getItem(cacheKey());
      if (raw) local = { ...checked(JSON.parse(raw)), dirty: JSON.parse(raw).dirty === true };
      const disk = read();
      if (local && JSON.stringify(disk) !== JSON.stringify(local.data)) local = { ...local, data: disk, dirty: true };
      if (!local && JSON.stringify(disk) !== JSON.stringify(emptyPersonal())) local = { revision: 0, updatedAt: null, data: disk, dirty: true };
      const remote = checked(await $fetch<PersonalSnapshot>('/api/workflow/personal', { headers: headers() }));
      const chosen = local?.dirty ? local : { ...remote, dirty: false };
      revision.value = chosen.revision; updatedAt.value = chosen.updatedAt;
      cache(chosen.data, chosen.dirty); write(chosen.data);
      status.value = chosen.dirty ? (remote.revision !== chosen.revision ? 'conflict' : 'pending') : 'saved';
      if (status.value === 'conflict') error.value = '其他设备已更新云端，本机未同步修改已保留。';
    } catch (e) {
      if (local) { revision.value = local.revision; updatedAt.value = local.updatedAt; dirty.value = local.dirty; write(local.data); }
      else { useState<boolean>('practice-decks-read-error').value = true; useState<string>('practice-decks-error').value = '云端数据尚未读取，暂不覆盖，请重新连接。'; }
      status.value = 'error'; error.value = message(e);
    }
    window.addEventListener('lycee-personal-change', schedule);
    window.addEventListener('online', () => { if (status.value !== 'conflict') void flush(); });
    window.addEventListener('beforeunload', e => { if (dirty.value) { e.preventDefault(); e.returnValue = ''; } });
    if (status.value === 'pending') timer = setTimeout(() => void flush(), 1000);
  }
  async function useRemote() {
    if (!scope.owner.value || !confirm('将先保留本机恢复副本，再读取云端版本。继续吗？')) return;
    try {
      localStorage.setItem(scope.key(`recovery-${Date.now()}`), JSON.stringify(read()));
      const remote = checked(await $fetch<PersonalSnapshot>('/api/workflow/personal', { headers: headers() }));
      revision.value = remote.revision; updatedAt.value = remote.updatedAt;
      cache(remote.data, false); write(remote.data); location.reload();
    } catch (e) { error.value = message(e); }
  }
  return { status, error, revision, updatedAt, dirty, initialize, flush, useRemote };
}
