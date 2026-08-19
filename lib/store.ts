import fs from "fs";
import path from "path";
import type {
  AppSettings,
  ChatSession,
  Chunk,
  Notebook,
  Note,
  Source,
  SourceText,
  StudioArtifact,
} from "./types";
import { nowIso, uid } from "./id";
import { defaultSettings } from "./plugins/manifest";

const ROOT = path.join(process.cwd(), "data", "runtime");

function file(...parts: string[]) {
  return path.join(ROOT, ...parts);
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function readJson<T>(p: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(p: string, value: unknown) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(value, null, 2));
}

export function bootStore() {
  ensureDir(ROOT);
  ensureDir(file("notebooks"));
  if (!fs.existsSync(file("settings.json"))) {
    writeJson(file("settings.json"), defaultSettings());
  }
  if (!fs.existsSync(file("index.json"))) {
    writeJson(file("index.json"), { notebooks: [] as Notebook[] });
  }
}

export function getSettings(): AppSettings {
  bootStore();
  const defaults = defaultSettings();
  const saved = readJson<Partial<AppSettings>>(file("settings.json"), {});
  const plugins = { ...defaults.plugins, ...(saved.plugins || {}) };
  for (const id of Object.keys(defaults.plugins)) {
    plugins[id] = {
      enabled: plugins[id]?.enabled ?? defaults.plugins[id].enabled,
      values: { ...(defaults.plugins[id].values || {}), ...(plugins[id]?.values || {}) },
    };
  }
  return applyEnv({ ...defaults, ...saved, plugins });
}

function applyEnv(settings: AppSettings): AppSettings {
  const next = { ...settings, plugins: { ...settings.plugins } };
  const nimKey = process.env.NVIDIA_API_KEY || process.env.NIM_API_KEY;
  if (nimKey) {
    const cur = next.plugins["nvidia-nim"] || { enabled: false, values: {} };
    next.plugins["nvidia-nim"] = {
      enabled: true,
      values: {
        baseUrl: cur.values.baseUrl || process.env.NIM_BASE_URL || "https://integrate.api.nvidia.com/v1",
        model: cur.values.model || process.env.NIM_MODEL || "meta/llama-3.1-70b-instruct",
        apiKey: cur.values.apiKey || nimKey,
      },
    };
    if (!next.defaultModelPlugin || next.defaultModelPlugin === "local-grounded") {
      next.defaultModelPlugin = "nvidia-nim";
    }
  }
  const openai = process.env.OPENAI_API_KEY;
  if (openai) {
    const cur = next.plugins.openai || { enabled: false, values: {} };
    if (!cur.values.apiKey) {
      next.plugins.openai = { enabled: true, values: { ...cur.values, apiKey: openai } };
    }
  }
  return next;
}

export function saveSettings(next: AppSettings): AppSettings {
  writeJson(file("settings.json"), next);
  return next;
}

export function listNotebooks(): Notebook[] {
  bootStore();
  const idx = readJson<{ notebooks: Notebook[] }>(file("index.json"), { notebooks: [] });
  return idx.notebooks
    .filter((n) => !n.archived)
    .sort((a, b) => +new Date(b.lastOpenedAt) - +new Date(a.lastOpenedAt));
}

export function listAllNotebooks(): Notebook[] {
  bootStore();
  return readJson<{ notebooks: Notebook[] }>(file("index.json"), { notebooks: [] }).notebooks;
}

function saveIndex(notebooks: Notebook[]) {
  writeJson(file("index.json"), { notebooks });
}

export function getNotebook(id: string): Notebook | null {
  return listAllNotebooks().find((n) => n.id === id) ?? null;
}

export function upsertNotebook(notebook: Notebook): Notebook {
  const all = listAllNotebooks();
  const i = all.findIndex((n) => n.id === notebook.id);
  if (i >= 0) all[i] = notebook;
  else all.unshift(notebook);
  saveIndex(all);
  ensureDir(file("notebooks", notebook.id, "sources"));
  ensureDir(file("notebooks", notebook.id, "chats"));
  ensureDir(file("notebooks", notebook.id, "notes"));
  ensureDir(file("notebooks", notebook.id, "artifacts"));
  return notebook;
}

export function createNotebook(partial?: Partial<Notebook>): Notebook {
  const t = nowIso();
  const notebook: Notebook = {
    id: uid("nb"),
    title: partial?.title || "Untitled notebook",
    description: partial?.description || "",
    emoji: partial?.emoji || "📓",
    cover: partial?.cover || randomCover(),
    createdAt: t,
    updatedAt: t,
    pinned: false,
    archived: false,
    sourceCount: 0,
    noteCount: 0,
    artifactCount: 0,
    lastOpenedAt: t,
    goal: "default",
    customGoal: "",
    responseLength: "default",
    chatModelPlugin: "",
    tags: partial?.tags || [],
    ...omitUndefined(partial || {}),
  };
  return upsertNotebook(notebook);
}

export function touchNotebook(id: string, patch: Partial<Notebook> = {}) {
  const nb = getNotebook(id);
  if (!nb) return null;
  const next = { ...nb, ...patch, updatedAt: nowIso() };
  return upsertNotebook(next);
}

export function deleteNotebook(id: string) {
  saveIndex(listAllNotebooks().filter((n) => n.id !== id));
  fs.rmSync(file("notebooks", id), { recursive: true, force: true });
}

export function listSources(notebookId: string): Source[] {
  const dir = file("notebooks", notebookId, "sources");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".meta.json"))
    .map((f) => readJson<Source>(path.join(dir, f), {} as Source))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export function getSource(notebookId: string, sourceId: string): Source | null {
  return readJson<Source | null>(
    file("notebooks", notebookId, "sources", `${sourceId}.meta.json`),
    null,
  );
}

export function getSourceText(notebookId: string, sourceId: string): string {
  const p = file("notebooks", notebookId, "sources", `${sourceId}.txt`);
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

export function saveSource(source: Source, text: string): Source {
  const dir = file("notebooks", source.notebookId, "sources");
  ensureDir(dir);
  writeJson(path.join(dir, `${source.id}.meta.json`), source);
  fs.writeFileSync(path.join(dir, `${source.id}.txt`), text);
  recount(source.notebookId);
  return source;
}

export function deleteSource(notebookId: string, sourceId: string) {
  const dir = file("notebooks", notebookId, "sources");
  for (const ext of [".meta.json", ".txt", ".chunks.json"]) {
    fs.rmSync(path.join(dir, `${sourceId}${ext}`), { force: true });
  }
  recount(notebookId);
}

export function saveChunks(notebookId: string, sourceId: string, chunks: Chunk[]) {
  writeJson(file("notebooks", notebookId, "sources", `${sourceId}.chunks.json`), chunks);
}

export function listChunks(notebookId: string, sourceIds?: string[]): Chunk[] {
  const sources = listSources(notebookId).filter((s) => !sourceIds || sourceIds.includes(s.id));
  const out: Chunk[] = [];
  for (const s of sources) {
    const chunks = readJson<Chunk[]>(
      file("notebooks", notebookId, "sources", `${s.id}.chunks.json`),
      [],
    );
    out.push(...chunks);
  }
  return out;
}

export function listSessions(notebookId: string): ChatSession[] {
  const dir = file("notebooks", notebookId, "chats");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson<ChatSession>(path.join(dir, f), {} as ChatSession))
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export function getSession(notebookId: string, sessionId: string): ChatSession | null {
  return readJson<ChatSession | null>(
    file("notebooks", notebookId, "chats", `${sessionId}.json`),
    null,
  );
}

export function saveSession(session: ChatSession): ChatSession {
  writeJson(file("notebooks", session.notebookId, "chats", `${session.id}.json`), session);
  return session;
}

export function createSession(notebookId: string): ChatSession {
  const t = nowIso();
  return saveSession({
    id: uid("chat"),
    notebookId,
    title: "New chat",
    createdAt: t,
    updatedAt: t,
    messages: [],
  });
}

export function listNotes(notebookId: string): Note[] {
  const dir = file("notebooks", notebookId, "notes");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson<Note>(path.join(dir, f), {} as Note))
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export function saveNote(note: Note): Note {
  writeJson(file("notebooks", note.notebookId, "notes", `${note.id}.json`), note);
  recount(note.notebookId);
  return note;
}

export function deleteNote(notebookId: string, noteId: string) {
  fs.rmSync(file("notebooks", notebookId, "notes", `${noteId}.json`), { force: true });
  recount(notebookId);
}

export function listArtifacts(notebookId: string): StudioArtifact[] {
  const dir = file("notebooks", notebookId, "artifacts");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson<StudioArtifact>(path.join(dir, f), {} as StudioArtifact))
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export function saveArtifact(a: StudioArtifact): StudioArtifact {
  writeJson(file("notebooks", a.notebookId, "artifacts", `${a.id}.json`), a);
  recount(a.notebookId);
  return a;
}

export function deleteArtifact(notebookId: string, id: string) {
  fs.rmSync(file("notebooks", notebookId, "artifacts", `${id}.json`), { force: true });
  recount(notebookId);
}

export function getNotebookBundle(id: string) {
  const notebook = getNotebook(id);
  if (!notebook) return null;
  return {
    notebook,
    sources: listSources(id),
    notes: listNotes(id),
    artifacts: listArtifacts(id),
    sessions: listSessions(id),
  };
}

function recount(notebookId: string) {
  const nb = getNotebook(notebookId);
  if (!nb) return;
  upsertNotebook({
    ...nb,
    sourceCount: listSources(notebookId).length,
    noteCount: listNotes(notebookId).length,
    artifactCount: listArtifacts(notebookId).length,
    updatedAt: nowIso(),
  });
}

function omitUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

const MOTIFS: Notebook["cover"]["motif"][] = [
  "folio",
  "constellation",
  "ripple",
  "atlas",
  "ledger",
  "orchard",
];

const PALETTES = [
  ["#d9ece6", "#7eb8a8", "#1f4d45"],
  ["#f3e3c8", "#e0b26b", "#8a5a1b"],
  ["#e7e0f4", "#b5a3d6", "#4c3d73"],
  ["#f6d9d2", "#d98978", "#7a3328"],
  ["#dce7f5", "#8aa8d4", "#2a4066"],
  ["#e7f0d4", "#a3c46b", "#3d5420"],
];

export function randomCover(): Notebook["cover"] {
  return {
    palette: PALETTES[Math.floor(Math.random() * PALETTES.length)],
    motif: MOTIFS[Math.floor(Math.random() * MOTIFS.length)],
  };
}

export type { SourceText };
