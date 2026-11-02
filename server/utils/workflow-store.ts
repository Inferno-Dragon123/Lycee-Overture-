import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { LibraryDeck } from "../../shared/domain/deck-library";
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
    return this.db
      .prepare(
        owner
          ? "SELECT data FROM publications WHERE owner=?"
          : "SELECT data FROM publications",
      )
      .all(...(owner ? [owner] : []))
      .map((r) => JSON.parse(String(r.data)) as Publication)
      .filter((d) => owner || d.status === "public")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  get(id: string, owner?: string) {
    const row = this.db
      .prepare("SELECT data FROM publications WHERE id=?")
      .get(id);
    if (!row) return null;
    const d = JSON.parse(String(row.data)) as Publication;
    return d.status === "public" || d.owner === owner ? d : null;
  }
  legacyPublicationIds() {
    const ids = new Set(this.db.prepare("SELECT id FROM publications WHERE id LIKE 'legacy-%'").all().map(row => String(row.id).slice(7)));
    if (this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migration_imports'").get())
      for (const row of this.db.prepare("SELECT source FROM migration_imports WHERE source LIKE 'legacy-publication:%'").all())
        ids.add(String(row.source).slice('legacy-publication:'.length));
    return [...ids];
  }
  publish(owner: string, author: string, deck: LibraryDeck) {
    return this.transaction(() => {
      if (this.list(owner).length >= 200)
        throw new Error("最多保留 200 个发布记录");
      const d: Publication = {
        ...deck,
        id: `p_${randomUUID()}`,
        owner,
        author,
        status: "public",
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      this.db
        .prepare("INSERT INTO publications VALUES(?,?,?)")
        .run(d.id, owner, JSON.stringify(d));
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
        this.db
          .prepare("DELETE FROM publications WHERE id=? AND owner=?")
          .run(id, owner);
        return null;
      }
      if (!["edit", "publish", "unpublish"].includes(action))
        throw new Error("无效操作");
      const next = {
        ...d,
        ...(action === "edit" ? deck : {}),
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
        .prepare("UPDATE publications SET data=? WHERE id=? AND owner=?")
        .run(JSON.stringify(next), id, owner);
      return next as Publication;
    });
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
