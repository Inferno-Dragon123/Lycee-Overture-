import axios from 'axios';
import { setTimeout as delay } from 'node:timers/promises';

// A 20s whole-request limit was shorter than observed successful Tencent downloads.
export function createOfficialFetcher({ get = axios.get, wait = delay, now = Date.now,
    interval = () => 10000, allowed = () => true, log = console.log } = {}) {
    let lastRequest = -Infinity;
    return async function fetchPage(url) {
        const target = new URL(url);
        if (target.origin !== 'https://lycee-tcg.com' || !allowed(url)) throw new Error('URL forbidden by crawler policy');
        for (let attempt = 1; attempt <= 3; attempt++) {
            await wait(Math.max(0, interval() - (now() - lastRequest)));
            lastRequest = now();
            log(`Official request ${target.pathname}${target.search} (${attempt}/3)`);
            try {
                const { data } = await get(url, { timeout: 60000, maxRedirects: 0, maxContentLength: 2000000,
                    responseType: 'text', headers: { 'User-Agent': 'LyceeToolboxDeckSync/1.0' } });
                log(`Official response ${target.pathname}: ${now() - lastRequest}ms`);
                return data;
            } catch (error) {
                const status = error.response?.status;
                const code = typeof error.code === 'string' && /^[A-Z_0-9]+$/.test(error.code) ? error.code : 'NETWORK_ERROR';
                log(`Official request failed ${target.pathname}: ${status || code}`);
                if (attempt === 3 || (status && status < 500 && ![408, 429].includes(status))) throw error;
                const retryAfter = error.response?.headers?.['retry-after'];
                const retryMs = /^\d+$/.test(retryAfter || '') ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - now();
                await wait(Math.min(120000, Math.max(interval() * attempt, retryMs || 0)));
            }
        }
    };
}
