import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

let db;

const schema = `
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  version TEXT NOT NULL,
  text TEXT NOT NULL,
  summary TEXT,
  assumptions_json TEXT,
  missing_info_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  FOREIGN KEY(document_id) REFERENCES documents(id)
);

CREATE TABLE IF NOT EXISTS backlog_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  external_id TEXT NOT NULL,
  type TEXT NOT NULL,
  parent_id INTEGER,
  epic_key TEXT,
  title TEXT NOT NULL,
  description TEXT,
  description_history_json TEXT,
  area TEXT,
  priority TEXT,
  blocked_reason TEXT,
  info_complete INTEGER DEFAULT 0,
  story_points REAL,
  estimate_hours REAL,
  status TEXT,
  acceptance_criteria_json TEXT,
  dependencies_json TEXT,
  risks_json TEXT,
  labels_json TEXT,
  clarification_questions_json TEXT,
  source_chunk_id TEXT,
  source_snippet TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  from_version TEXT,
  to_version TEXT,
  change_type TEXT NOT NULL,
  summary TEXT,
  affected_items_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS project_memory (
  project_id INTEGER PRIMARY KEY,
  memory TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS project_chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  thread_id INTEGER,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS project_chat_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS plan_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  result_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS suggested_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  source_item_id INTEGER,
  items_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);
`;

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function tableExists(database, tableName) {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);
  return Boolean(row?.name);
}

function ensureMigrations(database) {
  const projectColumns = database.prepare("PRAGMA table_info(projects)").all();
  const projectColumnNames = projectColumns.map((col) => col.name);
  if (!projectColumnNames.includes("description")) {
    database.prepare("ALTER TABLE projects ADD COLUMN description TEXT").run();
  }

  const documentColumns = database.prepare("PRAGMA table_info(documents)").all();
  const documentColumnNames = documentColumns.map((col) => col.name);
  if (!documentColumnNames.includes("summary")) {
    database.prepare("ALTER TABLE documents ADD COLUMN summary TEXT").run();
  }
  if (!documentColumnNames.includes("assumptions_json")) {
    database.prepare("ALTER TABLE documents ADD COLUMN assumptions_json TEXT").run();
  }
  if (!documentColumnNames.includes("missing_info_json")) {
    database.prepare("ALTER TABLE documents ADD COLUMN missing_info_json TEXT").run();
  }

  const columns = database.prepare("PRAGMA table_info(backlog_items)").all();
  const names = columns.map((col) => col.name);
  if (!names.includes("clarification_questions_json")) {
    database
      .prepare("ALTER TABLE backlog_items ADD COLUMN clarification_questions_json TEXT")
      .run();
  }
  if (!names.includes("blocked_reason")) {
    database.prepare("ALTER TABLE backlog_items ADD COLUMN blocked_reason TEXT").run();
  }
  if (!names.includes("description_history_json")) {
    database.prepare("ALTER TABLE backlog_items ADD COLUMN description_history_json TEXT").run();
  }
  if (!names.includes("info_complete")) {
    database
      .prepare("ALTER TABLE backlog_items ADD COLUMN info_complete INTEGER DEFAULT 0")
      .run();
  }

  if (!tableExists(database, "project_memory")) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS project_memory (
        project_id INTEGER PRIMARY KEY,
        memory TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id)
      );
    `);
  }

  if (!tableExists(database, "project_chat_messages")) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS project_chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        thread_id INTEGER,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id)
      );
    `);
  }

  const chatMsgColumns = database.prepare("PRAGMA table_info(project_chat_messages)").all();
  const chatMsgNames = chatMsgColumns.map((col) => col.name);
  if (!chatMsgNames.includes("thread_id")) {
    database.prepare("ALTER TABLE project_chat_messages ADD COLUMN thread_id INTEGER").run();
  }

  if (!tableExists(database, "project_chat_threads")) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS project_chat_threads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id)
      );
    `);
  }

  database.exec(
    "CREATE INDEX IF NOT EXISTS idx_project_chat_threads_project_updated ON project_chat_threads(project_id, updated_at);",
  );
  database.exec(
    "CREATE INDEX IF NOT EXISTS idx_project_chat_messages_thread_created ON project_chat_messages(thread_id, created_at);",
  );

  if (!tableExists(database, "plan_jobs")) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS plan_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        result_json TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id)
      );
    `);
  }

  database.exec(
    "CREATE INDEX IF NOT EXISTS idx_plan_jobs_status_created ON plan_jobs(status, created_at);",
  );

  if (!tableExists(database, "suggested_items")) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS suggested_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        source_item_id INTEGER,
        items_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id)
      );
    `);
  }
}

export function getDb() {
  const dbPath = process.env.SQLITE_PATH || path.join(process.cwd(), "data", "req2backlog.db");
  ensureDir(dbPath);
  if (!db) {
    db = new Database(dbPath);
    db.exec(schema);
  }
  ensureMigrations(db);
  return db;
}

export function getDefaultProject() {
  const database = getDb();
  const existing = database.prepare("SELECT * FROM projects ORDER BY id ASC LIMIT 1").get();
  if (existing) {
    return existing;
  }
  const now = new Date().toISOString();
  const info = database
    .prepare("INSERT INTO projects (name, created_at) VALUES (?, ?)")
    .run("Proyecto principal", now);
  return database.prepare("SELECT * FROM projects WHERE id = ?").get(info.lastInsertRowid);
}

export function getProjectById(projectId) {
  const database = getDb();
  return database.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
}

export function createProject(name) {
  const database = getDb();
  const now = new Date().toISOString();
  const info = database
    .prepare("INSERT INTO projects (name, created_at) VALUES (?, ?)")
    .run(name, now);
  return database.prepare("SELECT * FROM projects WHERE id = ?").get(info.lastInsertRowid);
}

export function insertDocument(projectId, version, text) {
  const database = getDb();
  const now = new Date().toISOString();
  const info = database
    .prepare("INSERT INTO documents (project_id, version, text, created_at) VALUES (?, ?, ?, ?)")
    .run(projectId, version, text, now);
  return info.lastInsertRowid;
}

export function insertChunks(documentId, chunks) {
  const database = getDb();
  const insert = database.prepare(
    "INSERT INTO chunks (document_id, chunk_index, title, content) VALUES (?, ?, ?, ?)",
  );
  const tx = database.transaction((items) => {
    items.forEach((chunk) => {
      insert.run(documentId, chunk.chunk_index, chunk.title || null, chunk.content);
    });
  });
  tx(chunks);
}

export function listChunksByDocument(documentId) {
  const database = getDb();
  return database
    .prepare("SELECT * FROM chunks WHERE document_id = ? ORDER BY chunk_index ASC")
    .all(documentId);
}

export function getLatestDocument(projectId) {
  const database = getDb();
  return database
    .prepare("SELECT * FROM documents WHERE project_id = ? ORDER BY id DESC LIMIT 1")
    .get(projectId);
}

export function listBacklogItems(projectId) {
  const database = getDb();
  return database
    .prepare("SELECT * FROM backlog_items WHERE project_id = ? ORDER BY id ASC")
    .all(projectId);
}

export function getNextExternalId(projectId) {
  const database = getDb();
  const rows = database
    .prepare("SELECT external_id FROM backlog_items WHERE project_id = ?")
    .all(projectId);
  let max = 0;
  rows.forEach((row) => {
    const match = String(row.external_id || "").match(/T-(\d+)/i);
    if (match) {
      const value = Number(match[1]);
      if (!Number.isNaN(value)) {
        max = Math.max(max, value);
      }
    }
  });
  return `T-${String(max + 1).padStart(3, "0")}`;
}

export function insertBacklogItems(projectId, items) {
  const database = getDb();
  const insert = database.prepare(`
    INSERT INTO backlog_items (
      project_id, external_id, type, parent_id, epic_key, title, description, area, priority,
      description_history_json, info_complete, story_points, estimate_hours, status,
      acceptance_criteria_json, dependencies_json, risks_json, labels_json, clarification_questions_json,
      source_chunk_id, source_snippet, updated_at
    ) VALUES (
      @project_id, @external_id, @type, @parent_id, @epic_key, @title, @description, @area,
      @priority, @description_history_json, @info_complete, @story_points, @estimate_hours, @status,
      @acceptance_criteria_json, @dependencies_json, @risks_json, @labels_json, @clarification_questions_json,
      @source_chunk_id, @source_snippet, @updated_at
    )
  `);

  const now = new Date().toISOString();
  const tx = database.transaction((rows) => {
    rows.forEach((row) => {
      const descriptionText = row.description || row.title || "";
      const history = Array.isArray(row.description_history)
        ? row.description_history
        : [{ source: "create", text: descriptionText, at: now }];
      insert.run({
        project_id: projectId,
        external_id: row.external_id,
        type: row.type,
        parent_id: row.parent_id || null,
        epic_key: row.epic_key || null,
        title: row.title,
        description: descriptionText,
        area: row.area || "other",
        priority: row.priority || "Medium",
        description_history_json: JSON.stringify(history),
        info_complete: row.info_complete ? 1 : 0,
        story_points: row.story_points ?? null,
        estimate_hours: row.estimate_hours ?? null,
        status: row.status || "todo",
        acceptance_criteria_json: JSON.stringify(row.acceptance_criteria || []),
        dependencies_json: JSON.stringify(row.dependencies || []),
        risks_json: JSON.stringify(row.risks || []),
        labels_json: JSON.stringify(row.labels || []),
        clarification_questions_json: JSON.stringify(row.clarification_questions || []),
        source_chunk_id: row.source_chunk_id || null,
        source_snippet: row.source_snippet || null,
        updated_at: now,
      });
    });
  });
  tx(items);
}

export function updateBacklogItem(id, updates) {
  const database = getDb();
  const fields = [];
  const values = [];
  Object.entries(updates).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value);
  });
  fields.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(id);
  database.prepare(`UPDATE backlog_items SET ${fields.join(", ")} WHERE id = ?`).run(values);
}

export function findBacklogItemByExternalId(projectId, externalId) {
  const database = getDb();
  return database
    .prepare("SELECT * FROM backlog_items WHERE project_id = ? AND external_id = ? LIMIT 1")
    .get(projectId, externalId);
}

export function insertChange(projectId, payload) {
  const database = getDb();
  const now = new Date().toISOString();
  database
    .prepare(
      "INSERT INTO changes (project_id, from_version, to_version, change_type, summary, affected_items_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      projectId,
      payload.from_version || null,
      payload.to_version || null,
      payload.change_type,
      payload.summary || null,
      payload.affected_items_json || null,
      now,
    );
}

export function createPlanJob({ projectId, payload }) {
  const database = getDb();
  const now = new Date().toISOString();
  const info = database
    .prepare(
      "INSERT INTO plan_jobs (project_id, status, payload_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(projectId, "queued", JSON.stringify(payload || {}), now, now);
  return database.prepare("SELECT * FROM plan_jobs WHERE id = ?").get(info.lastInsertRowid);
}

export function getPlanJob(jobId) {
  const database = getDb();
  return database.prepare("SELECT * FROM plan_jobs WHERE id = ?").get(jobId);
}

export function updatePlanJob(jobId, updates) {
  const database = getDb();
  const fields = [];
  const values = [];
  Object.entries(updates || {}).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value);
  });
  fields.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(jobId);
  database.prepare(`UPDATE plan_jobs SET ${fields.join(", ")} WHERE id = ?`).run(values);
  return getPlanJob(jobId);
}
