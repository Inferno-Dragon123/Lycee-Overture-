import { deployedAnnouncement, readAnnouncements } from '../utils/announcements';
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'public, max-age=30');
  return readAnnouncements(await deployedAnnouncement());
});
