import {
  validateLibraryDeck,
  deckComposition,
  matchesDeck,
  emptyDeckSearch,
  type DeckSearch,
} from "#shared/domain/deck-library";
import { communityFeed } from '../../utils/community-feed';
export default defineEventHandler(async (event) => {
  setHeader(event, "Cache-Control", "no-store");
  const store = workflowStore(),
    query = getQuery(event),
    user = await workflowUser(
      event,
      event.method !== "GET" || query.mine === "1" || !!query.sourceDeckId,
    );
  const exposed = (d: ReturnType<typeof store.list>[number]) => ({ ...publicPublication(d), canEdit: !!user && d.owner === user.id && !!d.sourceDeckId });
  if (event.method === "GET") {
    if (query.sourceDeckId) {
      const d = store.publicationForDeck(user!.id, String(query.sourceDeckId));
      return d ? exposed(d) : null;
    }
    if (query.id) {
      const d = store.get(String(query.id), user?.id);
      if (!d)
        throw createError({ statusCode: 404, message: "卡组不存在或未公开" });
      return exposed(d);
    }
    const catalog = await getCatalog();
    let f: DeckSearch;
    try {
      f = query.filters ? JSON.parse(String(query.filters)) : emptyDeckSearch();
      if (
        !f ||
        typeof f.q !== "string" ||
        f.q.length > 200 ||
        !["", "single", "mix"].includes(f.type) ||
        typeof f.series !== "string" ||
        !["", "mix", "雪", "月", "花", "宙", "日", "他"].includes(f.color) ||
        !f.ranges
      )
        throw new Error();
      for (const r of Object.values(f.ranges)) {
        if (
          !r ||
          [r.min, r.max].some(
            (n) => n !== null && (!Number.isSafeInteger(n) || n < 0 || n > 200),
          ) ||
          (r.min !== null && r.max !== null && r.min > r.max)
        )
          throw new Error();
      }
    } catch {
      throw createError({ statusCode: 400, message: "卡组筛选条件无效" });
    }
    const codes = String(query.codes || "")
      .split(",")
      .filter(Boolean);
    if (
      codes.length > 10 ||
      codes.some((c) => !/^LO-\d{4}$/.test(c)) ||
      (query.match && !["all", "any"].includes(String(query.match)))
    )
      throw createError({ statusCode: 400, message: "无效的卡牌检索条件" });
    const source = String(query.source || 'local');
    if (!['local', 'all', 'community', 'official_tournament', 'official_user'].includes(source)) throw createError({ statusCode: 400, message: '卡组来源无效' });
    if (source !== 'local' && query.mine !== '1') {
      const requested = Number(query.page || 1);
      if (!Number.isSafeInteger(requested) || requested < 1) throw createError({ statusCode: 400, message: '页码无效' });
      return communityFeed({ source, page: requested, filters: f, codes, match: String(query.match || 'all'), catalog: catalog.byCode,
        local: store.list().map(exposed), suppressed: store.legacyPublicationIds() });
    }
    const all = store
      .list(query.mine === "1" ? user!.id : undefined)
      .filter(
        (d) =>
          matchesDeck(d, f, deckComposition(d.quantities, catalog.byCode)) &&
          (!codes.length ||
            (query.match === "any"
              ? codes.some((code) =>
                  Object.keys(d.quantities).some((c) => c.slice(0, 7) === code),
                )
              : codes.every((code) =>
                  Object.keys(d.quantities).some((c) => c.slice(0, 7) === code),
                ))),
      );
    const pages = Math.max(1, Math.ceil(all.length / 20)),
      requested = Number(query.page || 1);
    if (!Number.isSafeInteger(requested) || requested < 1)
      throw createError({ statusCode: 400, message: "页码无效" });
    const page = Math.min(requested, pages);
    return {
      items: all.slice((page - 1) * 20, page * 20).map(exposed),
      total: all.length,
      page,
      pages,
    };
  }
  if (!["POST", "PATCH", "DELETE"].includes(event.method))
    throw createError({ statusCode: 405 });
  workflowOriginCheck(event);
  await assertWorkflowBodySize(event, 32768);
  const body = await readBody(event);
  try {
    let deck;
    if (body.action === 'edit') throw new Error('请先在我的卡组保存私人原件，再更新公开版本');
    if (event.method === "POST" || body.action === 'publish') {
      const original = event.method === 'POST'
        ? store.personal(user!.id).data.library.saved.find(deck => deck.id === body.sourceDeckId)
        : store.get(body.id, user!.id);
      if (!original) throw new Error('私人卡组不存在或不属于当前账号，请先同步我的卡组');
      deck = validateLibraryDeck(original, true);
      const catalog = await getCatalog();
      if (
        Object.keys(deck.quantities).some((code) => !catalog.byCode.has(code))
      )
        throw new Error("卡组含未收录卡牌");
    }
    if (event.method === "POST")
      return exposed(store.publish(user!.id, user!.name, deck!, body.sourceDeckId));
    const updated = store.update(
      user!.id,
      body.id,
      body.version,
      event.method === "DELETE" ? "delete" : body.action,
      deck,
    );
    return updated ? exposed(updated) : { deleted: true };
  } catch (e) {
    throw createError({ statusCode: 400, message: (e as Error).message });
  }
});
