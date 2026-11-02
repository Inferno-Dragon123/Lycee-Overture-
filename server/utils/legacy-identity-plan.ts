import { createHash } from 'node:crypto';

export interface LegacyIdentity {
  id: string; email: string; name: string; emailVerified: boolean; banned?: boolean;
  banReason?: string | null; banExpires?: string | Date | null; role?: string | null;
  createdAt?: string | Date; updatedAt?: string | Date; image?: string | null;
}
export interface IdentityConflict { kind: 'identity' | 'security'; emails: string[]; ids: string[] }
const emailKey = (email: string) => email.trim().toLowerCase();
const expiry = (date: LegacyIdentity['banExpires']) => date ? new Date(date).toISOString() : null;
export function identityPlan(source: LegacyIdentity[], target: LegacyIdentity[]) {
  const ids = new Set<string>(), emails = new Set<string>();
  for (const user of source) {
    const email = emailKey(user.email);
    if (!user.id || !email || ids.has(user.id) || emails.has(email)) throw new Error('Invalid or duplicate source identity');
    ids.add(user.id); emails.add(email);
  }
  const added: LegacyIdentity[] = [], conflicts: IdentityConflict[] = [];
  let unchanged = 0;
  for (const user of source) {
    const matches = target.filter(row => row.id === user.id || emailKey(row.email) === emailKey(user.email));
    if (!matches.length) { added.push(user); continue; }
    const row = matches[0]!;
    const identity = matches.length !== 1 || row.id !== user.id || emailKey(row.email) !== emailKey(user.email);
    const security = row.emailVerified !== user.emailVerified || Boolean(row.banned) !== Boolean(user.banned)
      || (row.banReason || null) !== (user.banReason || null) || expiry(row.banExpires) !== expiry(user.banExpires)
      || (row.role || null) !== (user.role || null);
    if (identity || security) conflicts.push({ kind: identity ? 'identity' : 'security', emails: [...new Set([user.email, ...matches.map(row => row.email)].map(emailKey))], ids: [...new Set([user.id, ...matches.map(row => row.id)])] });
    else unchanged++;
  }
  return { added, unchanged, conflicts, target: [...target, ...added] };
}
export function identityDecision(plan: ReturnType<typeof identityPlan>, email: string, expectedId?: string) {
  const key = emailKey(email);
  if (plan.conflicts.some(c => c.emails.includes(key) || (expectedId && c.ids.includes(expectedId)))) return 'conflict';
  const matches = plan.target.filter(row => emailKey(row.email) === key);
  if (matches.length !== 1) return matches.length ? 'conflict' : 'register';
  const user = matches[0]!;
  if (expectedId && user.id !== expectedId) return 'conflict';
  if (user.banned && (!user.banExpires || !(new Date(user.banExpires).getTime() <= Date.now()))) return 'banned';
  return 'allowed';
}
export function identityConflictReport(conflicts: IdentityConflict[]) {
  return conflicts.map(c => ({ kind: c.kind, emailHashes: c.emails.map(email => createHash('sha256').update(email).digest('hex')) }));
}
