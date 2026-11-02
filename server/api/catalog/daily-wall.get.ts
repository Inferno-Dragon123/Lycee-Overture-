import { chinaDay, dailyWallCodes } from '../../../shared/domain/presentation';
let cached: { day: string; codes: string[] } | undefined;
export default defineEventHandler(async event => {
  const time = Date.now(), day = chinaDay(time);
  if (cached?.day !== day) cached = { day, codes: dailyWallCodes((await getCatalog()).cards.map(card => card.code), day) };
  const midnight = Date.parse(`${day}T00:00:00+08:00`) + 86400000;
  setHeader(event, 'Cache-Control', `public, max-age=${Math.max(0, Math.floor((midnight - time) / 1000))}`);
  return cached;
});
