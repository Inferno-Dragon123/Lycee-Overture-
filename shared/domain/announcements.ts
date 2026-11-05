export const announcementRepository = 'https://github.com/Inferno-Dragon123/Lycee-Overture-';
export interface SiteRelease { sha: string; publishedAt: string; url: string }
export interface SiteAnnouncement { sha: string; title: string; body: string; committedAt: string; url: string; state: 'published' | 'pending' | 'unverified' }
export interface AnnouncementFeed { release: SiteRelease | null; items: SiteAnnouncement[]; stale: boolean; unavailable: boolean; repositoryUrl: string }

export function releaseAnnouncement(raw: unknown): SiteRelease | null {
  const value = raw as { githubCommit?: unknown; deployedAt?: unknown } | null;
  if (!value || typeof value.githubCommit !== 'string' || !/^[a-f0-9]{40}$/.test(value.githubCommit)) return null;
  return { sha: value.githubCommit, publishedAt: typeof value.deployedAt === 'string' && Number.isFinite(Date.parse(value.deployedAt)) ? value.deployedAt : '', url: `${announcementRepository}/commit/${value.githubCommit}` };
}

export function commitAnnouncements(raw: unknown, release: SiteRelease | null): SiteAnnouncement[] {
  if (!Array.isArray(raw)) throw new Error('Invalid update response');
  const hidden = new Set<string>();
  const items = raw.slice(0, 20).flatMap((entry: any) => {
    if (!/^[a-f0-9]{40}$/.test(entry?.sha || '') || typeof entry?.commit?.message !== 'string') return [];
    const message: string = entry.commit.message;
    if (message.split(/\r?\n/).some(line => line.trim() === 'Announcement: skip')) hidden.add(entry.sha);
    const [title = '', ...body] = message.split(/\r?\n/);
    const date = entry.commit.committer?.date || entry.commit.author?.date || '';
    return [{ sha: entry.sha as string, title: title.trim().slice(0, 200), body: body.join('\n').trim().slice(0, 2000), committedAt: Number.isFinite(Date.parse(date)) ? String(date) : '', url: `${announcementRepository}/commit/${entry.sha}`, state: 'unverified' as SiteAnnouncement['state'] }];
  });
  const published = release ? items.findIndex(item => item.sha === release.sha) : -1;
  return items.map<SiteAnnouncement>((item, index) => ({ ...item, state: published < 0 ? 'unverified' : index < published ? 'pending' : 'published' })).filter(item => !hidden.has(item.sha));
}
