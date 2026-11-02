import { personalKey } from '#shared/domain/personal';
export function usePersonalScope() {
  const owner = useState<string | null>('personal-owner', () => null);
  return { owner, key: (key: string) => personalKey(key, owner.value) };
}
export function personalChanged() {
  if (import.meta.client) window.dispatchEvent(new Event('lycee-personal-change'));
}
