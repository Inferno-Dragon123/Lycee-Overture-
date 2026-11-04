import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { announcementRepository, commitAnnouncements, releaseAnnouncement, type AnnouncementFeed, type SiteRelease } from '../../shared/domain/announcements';

const endpoint = 'https://api.github.com/repos/Inferno-Dragon123/Lycee-Overture-/commits?sha=main&per_page=20';
export function createAnnouncementReader({ request = fetch, now = Date.now } = {}) {
  let cached: unknown[] | undefined, etag = '', expires = 0, stale = false;
  let pending: Promise<void> | undefined;
  return async (release: SiteRelease | null): Promise<AnnouncementFeed> => {
    if (now() >= expires) {
      pending ??= (async () => {
        try {
          const response = await request(endpoint, { headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'LyceeToolbox-Announcements', ...(etag ? { 'If-None-Match': etag } : {}) }, redirect: 'error', signal: AbortSignal.timeout(10000) });
          if (response.status !== 304 || !cached) {
            if (!response.ok) throw new Error('GitHub updates unavailable');
            const data: unknown = await response.json();
            if (!Array.isArray(data)) throw new Error('Invalid GitHub updates');
            cached = data.slice(0, 20); etag = response.headers.get('etag') || '';
          }
          stale = false; expires = now() + 300000;
        } catch { stale = true; expires = now() + 60000; }
      })().finally(() => { pending = undefined; });
      await pending;
    }
    return { release, items: commitAnnouncements(cached || [], release), stale, unavailable: !cached, repositoryUrl: announcementRepository };
  };
}

export async function deployedAnnouncement() {
  try { return releaseAnnouncement(JSON.parse(await readFile(join(process.cwd(), 'release-manifest.json'), 'utf8'))); }
  catch { return null; }
}
export const readAnnouncements = createAnnouncementReader();
