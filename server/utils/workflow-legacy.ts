import { fetchOfficialArtwork } from "./artwork-transport";
import { readLegacyPostgres } from './legacy-postgres';
export interface LegacyItem {
  id: string;
  name: string;
  description?: string;
  cards?: Record<string, number>;
  cover_code?: string;
  composition?: { counts: Record<string, number>; attributesKnown: boolean };
  source?: string;
  updated_at?: string;
  created_at?: string;
}
export interface LegacyPage {
  items: LegacyItem[];
  total: number;
  pages: number;
  page: number;
}
const cache = new Map<string, { expires: number; value: Promise<unknown> }>();
async function request(url: URL) {
  const local = useRuntimeConfig().workflowLegacySource === 'postgres';
  const key = (local ? 'postgres:' : 'remote:') + url.href,
    found = cache.get(key);
  if (found && found.expires > Date.now()) return found.value;
  if (cache.size > 160) cache.delete(cache.keys().next().value!);
  const value = (async () => {
    if (local) return readLegacyPostgres(url.searchParams);
    const response = await fetchOfficialArtwork(key, {
      credentials: "omit",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw createError({ statusCode: response.status === 404 ? 404 : 502, message: '旧站公开卡组暂时无法读取，请重试。' });
    return response.json();
  })();
  cache.set(key, { expires: Date.now() + 120000, value });
  value.catch(() => cache.delete(key));
  return value;
}
async function parallel<T, R>(items: T[], map: (v: T) => Promise<R>) {
  const output: R[] = new Array(items.length);
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, items.length) }, async () => {
      while (index < items.length) {
        const i = index++;
        output[i] = await map(items[i]!);
      }
    }),
  );
  return output;
}
export async function loadLegacyWorkflow(query: Record<string, unknown>, hydrate = true): Promise<LegacyPage | LegacyItem> {
  const origin = String(useRuntimeConfig().workflowLegacyOrigin || "https://lycee-toolbox.top"),
    url = new URL("/api/community", origin);
  const allowed = new Set([
    "id",
    "page",
    "source",
    "code",
    "codes",
    "match",
    "deckType",
    "series",
    "attribute",
    ...["雪", "月", "花", "宙", "日", "他"].flatMap((a) => [
      `attr_${a}_min`,
      `attr_${a}_max`,
    ]),
  ]);
  for (const [key, value] of Object.entries(query)) {
    if (["q", "color"].includes(key)) continue;
    if (!allowed.has(key))
      throw createError({ statusCode: 400, message: "未知检索条件" });
    for (const v of Array.isArray(value) ? value : [value])
      url.searchParams.append(key, String(v));
  }
  try {
    if (query.id) return await request(url) as LegacyItem;
    const search = String(query.q || "")
        .normalize("NFKC")
        .toLowerCase(),
      mixed = query.color === "mix",
      requested = Number(query.page || 1);
    if (
      !Number.isSafeInteger(requested) ||
      requested < 1 ||
      search.length > 200
    )
      throw new Error();
    let data: LegacyPage;
    if (search || mixed) {
      url.searchParams.set("page", "1");
      const first = (await request(url)) as LegacyPage;
      if (first.pages > 200)
        throw createError({
          statusCode: 422,
          message: "结果过多，请先缩小系列或卡牌条件。",
        });
      const rest = await parallel(
        Array.from({ length: Math.max(0, first.pages - 1) }, (_, i) => i + 2),
        async (page) => {
          const next = new URL(url);
          next.searchParams.set("page", String(page));
          return request(next) as Promise<LegacyPage>;
        },
      );
      const items = [
        ...new Map(
          [first, ...rest].flatMap((p) => p.items).map((d) => [d.id, d]),
        ).values(),
      ].filter(
        (d) =>
          search
            .split(/\s+/)
            .every((w) =>
              `${d.name} ${d.description || ""}`
                .normalize("NFKC")
                .toLowerCase()
                .includes(w),
            ) &&
          (!mixed ||
            (d.composition?.attributesKnown &&
              Object.values(d.composition.counts).filter((n) => n > 0).length >=
                2)),
      );
      const pages = Math.max(1, Math.ceil(items.length / 20)),
        page = Math.min(requested, pages);
      data = {
        items: items.slice((page - 1) * 20, page * 20),
        total: items.length,
        pages,
        page,
      };
    } else data = (await request(url)) as LegacyPage;
    // The legacy list omits cards. Fetch only the displayed page for exact first-card covers.
    if (hydrate) data.items = await parallel(data.items, async (item) => {
      const detail = new URL("/api/community", origin);
      detail.searchParams.set("id", item.id);
      const d = (await request(detail)) as LegacyItem;
      return { ...item, cover_code: Object.keys(d.cards || {})[0] };
    });
    return data;
  } catch (e) {
    if ([404, 422].includes(Number((e as { statusCode?: number }).statusCode))) throw e;
    throw createError({
      statusCode: 502,
      message: "旧站公开卡组暂时无法读取，请重试。",
    });
  }
}
