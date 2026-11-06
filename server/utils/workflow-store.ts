import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { isCustomDeckCover, type LibraryDeck } from "../../shared/domain/deck-library";
import { emptyPersonal, validatePersonal, type PersonalSnapshot } from '../../shared/domain/personal';
export function resolveWorkflowDatabasePath(value: unknown) {
  if (value === undefined || value === null) return ".data/workflow.sqlite";
  if (typeof value !== "string" || !value.trim() || ["undefined", "null"].includes(value.trim()))
    throw new Error("无效的工作流程数据库路径");
  return value.trim();
}
export interface Publication extends LibraryDeck {
  owner: string;
  author: string;
  status: "public" | "private";
  version: number;
  updatedAt: string;
  sourceDeckId?: string;
  hasPublished?: boolean;
}
export class WorkflowStore {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      `PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS publications(id TEXT PRIMARY KEY,owner TEXT NOT NULL,data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS cardbacks(id TEXT PRIMARY KEY,owner TEXT NOT NULL,image BLOB NOT NULL,created TEXT NOT NULL); CREATE TABLE IF NOT EXISTS profiles(id TEXT PRIMARY KEY,name TEXT NOT NULL); CREATE INDEX IF NOT EXISTS cardbacks_owner ON cardbacks(owner); CREATE INDEX IF NOT EXISTS publications_owner ON publications(owner);`,
    );
    this.db.exec(`CREATE TABLE IF NOT EXISTS personal_data(owner TEXT PRIMARY KEY, revision INTEGER NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS personal_history(owner TEXT NOT NULL, revision INTEGER NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(owner,revision));`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS deck_publications(id TEXT PRIMARY KEY,owner TEXT NOT NULL,source_deck_id TEXT NOT NULL,revision INTEGER NOT NULL,draft TEXT NOT NULL,published TEXT,updated_at TEXT NOT NULL,UNIQUE(owner,source_deck_id));
      CREATE TABLE IF NOT EXISTS deck_covers(id TEXT PRIMARY KEY,owner TEXT NOT NULL,image BLOB NOT NULL,created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS deck_covers_owner ON deck_covers(owner);`);
  }
  personal(owner: string): PersonalSnapshot {
    const row = this.db.prepare('SELECT revision,data,updated_at FROM personal_data WHERE owner=?').get(owner);
    return row ? { revision: Number(row.revision), data: validatePersonal(JSON.parse(String(row.data))), updatedAt: String(row.updated_at) }
      : { revision: 0, data: emptyPersonal(), updatedAt: null };
  }
  savePersonal(owner: string, revision: number, raw: unknown): PersonalSnapshot {
    const data = validatePersonal(raw);
    if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('个人数据版本无效');
    return this.transaction(() => {
      const previous = this.personal(owner);
      if (previous.revision !== revision) throw new Error('PERSONAL_CONFLICT');
      for (const deck of [...data.library.saved, ...(data.library.draft ? [data.library.draft] : [])]) this.checkDeckCover(owner, deck);
      // Removing a private original also removes its public snapshot, atomically.
      const retained = new Set(data.library.saved.map(deck => deck.id));
      for (const deck of previous.data.library.saved) if (!retained.has(deck.id))
        this.db.prepare('DELETE FROM deck_publications WHERE owner=? AND source_deck_id=?').run(owner, deck.id);
      for (const deck of data.library.saved) {
        const row = this.db.prepare('SELECT draft FROM deck_publications WHERE owner=? AND source_deck_id=?').get(owner, deck.id);
        if (!row) continue;
        const draft = JSON.parse(String(row.draft));
        const next = { ...draft, name: deck.name, description: deck.description || '', cover: deck.cover, quantities: deck.quantities };
        if (JSON.stringify(next) !== JSON.stringify(draft))
          this.db.prepare('UPDATE deck_publications SET draft=?,revision=revision+1,updated_at=? WHERE owner=? AND source_deck_id=?')
            .run(JSON.stringify(next), new Date().toISOString(), owner, deck.id);
      }
      if (previous.revision) this.db.prepare('INSERT INTO personal_history VALUES(?,?,?,?)').run(owner, revision, JSON.stringify(previous.data), previous.updatedAt!);
      const updatedAt = new Date().toISOString();
      this.db.prepare('INSERT INTO personal_data VALUES(?,?,?,?) ON CONFLICT(owner) DO UPDATE SET revision=excluded.revision,data=excluded.data,updated_at=excluded.updated_at')
        .run(owner, revision + 1, JSON.stringify(data), updatedAt);
      this.db.prepare('DELETE FROM personal_history WHERE owner=? AND revision < ?').run(owner, revision - 19);
      return { revision: revision + 1, data, updatedAt };
    });
  }
  transaction<T>(fn: () => T) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      this.db.exec("COMMIT");
      return value;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  list(owner?: string) {
    const current = this.db.prepare(owner ? 'SELECT * FROM deck_publications WHERE owner=?' : 'SELECT * FROM deck_publications WHERE published IS NOT NULL')
      .all(...(owner ? [owner] : [])).map(row => this.publicationRow(row, !!owner)!);
    // Old publications remain recoverable by their owner, but never public again.
    const legacy = owner ? this.db.prepare('SELECT data FROM publications WHERE owner=?').all(owner)
      .map(row => ({ ...JSON.parse(String(row.data)), status: 'private', hasPublished: false } as Publication)) : [];
    return [...current, ...legacy]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  get(id: string, owner?: string) {
    const row = this.db.prepare('SELECT * FROM deck_publications WHERE id=?').get(id);
    if (row) return this.publicationRow(row, row.owner === owner);
    const old = this.db.prepare('SELECT data FROM publications WHERE id=? AND owner=?').get(id, owner || '');
    return old ? { ...JSON.parse(String(old.data)), status: 'private', hasPublished: false } as Publication : null;
  }
  private publicationRow(row: Record<string, unknown>, mine: boolean): Publication | null {
    const raw = mine ? row.draft : row.published;
    if (!raw) return null;
    return { ...JSON.parse(String(raw)), id: String(row.id), owner: String(row.owner), sourceDeckId: String(row.source_deck_id),
      version: Number(row.revision), status: row.published ? 'public' : 'private', hasPublished: !!row.published, updatedAt: String(row.updated_at) };
  }
  publicationForDeck(owner: string, sourceDeckId: string) {
    const row = this.db.prepare('SELECT * FROM deck_publications WHERE owner=? AND source_deck_id=?').get(owner, sourceDeckId);
    return row ? this.publicationRow(row, true) : null;
  }
  checkDeckCover(owner: string, deck: Pick<LibraryDeck, 'cover'>) {
    if (!isCustomDeckCover(deck.cover)) return;
    const id = deck.cover.split('/').at(-1)!;
    if (this.db.prepare('SELECT owner FROM deck_covers WHERE id=?').get(id)?.owner !== owner)
      throw new Error('封面不存在或不属于当前账号，请重新上传');
  }
  legacyPublicationIds() {
    const ids = new Set(this.db.prepare("SELECT id FROM publications WHERE id LIKE 'legacy-%'").all().map(row => String(row.id).slice(7)));
    if (this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migration_imports'").get())
      for (const row of this.db.prepare("SELECT source FROM migration_imports WHERE source LIKE 'legacy-publication:%'").all())
        ids.add(String(row.source).slice('legacy-publication:'.length));
    return [...ids];
  }
  publish(owner: string, author: string, deck: LibraryDeck, sourceDeckId: string) {
    return this.transaction(() => {
      const original = this.personal(owner).data.library.saved.find(d => d.id === sourceDeckId);
      if (!original) throw new Error('私人卡组不存在或不属于当前账号，请先同步我的卡组');
      this.checkDeckCover(owner, deck);
      deck = original;
      if (this.publicationForDeck(owner, sourceDeckId)) throw new Error('该卡组已有发布记录，请更新现有发布');
      if (Number(this.db.prepare('SELECT count(*) AS n FROM deck_publications WHERE owner=?').get(owner)!.n) >= 200)
        throw new Error("最多保留 200 个发布记录");
      const d: Publication = {
        ...deck,
        id: `p_${randomUUID()}`,
        owner,
        author,
        status: "public",
        version: 1,
        updatedAt: new Date().toISOString(),
        sourceDeckId,
        hasPublished: true,
      };
      this.db
        .prepare('INSERT INTO deck_publications VALUES(?,?,?,?,?,?,?)')
        .run(d.id, owner, sourceDeckId, 1, JSON.stringify(d), JSON.stringify(d), d.updatedAt);
      return d;
    });
  }
  update(
    owner: string,
    id: string,
    version: number,
    action: string,
    deck?: LibraryDeck,
  ) {
    return this.transaction(() => {
      const d = this.get(id, owner);
      if (!d || d.owner !== owner) throw new Error("无权修改此卡组");
      if (d.version !== version) throw new Error("卡组已被更新，请刷新后重试");
      if (action === "delete") {
        if (d.sourceDeckId) throw new Error('请从我的卡组删除私人原件，关联发布会一并删除');
        this.db
          .prepare("DELETE FROM deck_publications WHERE id=? AND owner=?")
          .run(id, owner);
        this.db.prepare('DELETE FROM publications WHERE id=? AND owner=?').run(id, owner);
        return null;
      }
      if (!d.sourceDeckId) throw new Error('旧发布已下架，请先添加到我的卡组后重新发布');
      if (!this.personal(owner).data.library.saved.some(deck => deck.id === d.sourceDeckId)) throw new Error('私人卡组已删除，请刷新后重试');
      if (action === 'edit') throw new Error('请先在我的卡组保存私人原件，再更新公开版本');
      if (!["publish", "unpublish"].includes(action))
        throw new Error("无效操作");
      if (deck) this.checkDeckCover(owner, deck);
      const next = {
        ...d,
        id,
        owner,
        status:
          action === "publish"
            ? "public"
            : action === "unpublish"
              ? "private"
              : d.status,
        version: d.version + 1,
        updatedAt: new Date().toISOString(),
      };
      this.db
        .prepare('UPDATE deck_publications SET draft=?,published=CASE WHEN ?=\'publish\' THEN ? WHEN ?=\'unpublish\' THEN NULL ELSE published END,revision=?,updated_at=? WHERE id=? AND owner=?')
        .run(JSON.stringify(next), action, JSON.stringify(next), action, next.version, next.updatedAt, id, owner);
      return this.get(id, owner)!;
    });
  }
  uploadDeckCover(owner: string, image: Buffer) {
    return this.transaction(() => {
      const usage = this.db.prepare('SELECT count(*) AS n,coalesce(sum(length(image)),0) AS bytes FROM deck_covers WHERE owner=?').get(owner)!;
      if (Number(usage.n) >= 200 || Number(usage.bytes) + image.length > 128 * 1024 * 1024) throw new Error('封面图片额度已满，请使用已有封面');
      const id = randomUUID();
      this.db.prepare('INSERT INTO deck_covers VALUES(?,?,?,?)').run(id, owner, image, new Date().toISOString());
      return { id, url: '/api/workflow/deck-covers/' + id };
    });
  }
  deckCoverImage(id: string, owner?: string) {
    const row = this.db.prepare('SELECT owner,image FROM deck_covers WHERE id=?').get(id);
    if (!row) return null;
    const url = '/api/workflow/deck-covers/' + id;
    if (row.owner !== owner && !this.list().some(deck => deck.cover === url)) return null;
    return Buffer.from(row.image as Uint8Array);
  }
  backs(owner: string) {
    return this.db
      .prepare(
        "SELECT id,created FROM cardbacks WHERE owner=? ORDER BY created",
      )
      .all(owner)
      .map((r) => ({ id: String(r.id), created: String(r.created) }));
  }
  upload(owner: string, image: Buffer) {
    return this.transaction(() => {
      if (this.backs(owner).length >= 3)
        throw new Error("每个账号最多上传 3 张卡背，请先删除一张");
      const id = randomUUID();
      this.db
        .prepare("INSERT INTO cardbacks VALUES(?,?,?,?)")
        .run(id, owner, image, new Date().toISOString());
      return id;
    });
  }
  image(id: string) {
    const row = this.db
      .prepare("SELECT image FROM cardbacks WHERE id=?")
      .get(id);
    return row ? Buffer.from(row.image as Uint8Array) : null;
  }
  removeBack(owner: string, id: string) {
    const row = this.db
      .prepare("SELECT owner FROM cardbacks WHERE id=?")
      .get(id);
    if (!row || row.owner !== owner) throw new Error("无权删除此卡背");
    this.db
      .prepare("DELETE FROM cardbacks WHERE id=? AND owner=?")
      .run(id, owner);
  }
  profile(id: string) {
    const row = this.db.prepare("SELECT name FROM profiles WHERE id=?").get(id);
    return row ? String(row.name) : null;
  }
  setProfile(id: string, name: string) {
    if (
      typeof name !== "string" ||
      !name.trim() ||
      [...name.trim()].length > 24 ||
      /[\p{Cc}\p{Cf}]/u.test(name)
    )
      throw new Error("昵称须为 1～24 个字符");
    this.db
      .prepare(
        "INSERT INTO profiles VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name",
      )
      .run(id, name.trim());
    return name.trim();
  }
  close() {
    this.db.close();
  }
}
let store: WorkflowStore | undefined;
export function workflowStore() {
  return (store ??= new WorkflowStore(
    resolveWorkflowDatabasePath(useRuntimeConfig().workflowDatabasePath),
  ));
}
