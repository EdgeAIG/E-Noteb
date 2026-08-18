export type SourceKind =
  | "pdf"
  | "docx"
  | "markdown"
  | "text"
  | "html"
  | "url"
  | "youtube"
  | "audio"
  | "image"
  | "epub"
  | "csv"
  | "json"
  | "note"
  | "paste";

export type ArtifactKind =
  | "audio-overview"
  | "video-overview"
  | "slide-deck"
  | "infographic"
  | "mind-map"
  | "report"
  | "flashcards"
  | "quiz"
  | "data-table"
  | "briefing"
  | "study-guide"
  | "faq"
  | "timeline"
  | "outline";

export type ChatGoal = "default" | "learning-guide" | "custom";
export type ResponseLength = "default" | "longer" | "shorter";
export type ThemeId = "paper" | "ink" | "parchment" | "gemini" | "high-contrast";

export interface NotebookCover {
  palette: string[];
  motif: "folio" | "constellation" | "ripple" | "atlas" | "ledger" | "orchard";
  emoji?: string;
}

export interface Notebook {
  id: string;
  title: string;
  description: string;
  emoji: string;
  cover: NotebookCover;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  archived: boolean;
  sourceCount: number;
  noteCount: number;
  artifactCount: number;
  lastOpenedAt: string;
  goal: ChatGoal;
  customGoal: string;
  responseLength: ResponseLength;
  chatModelPlugin: string;
  tags: string[];
}

export interface Source {
  id: string;
  notebookId: string;
  kind: SourceKind;
  title: string;
  origin: string;
  createdAt: string;
  updatedAt: string;
  enabled: boolean;
  summary: string;
  wordCount: number;
  charCount: number;
  topics: string[];
  suggestedQuestions: string[];
  status: "ready" | "processing" | "error";
  error?: string;
  mime?: string;
}

export interface SourceText {
  sourceId: string;
  text: string;
}

export interface Chunk {
  id: string;
  sourceId: string;
  notebookId: string;
  index: number;
  text: string;
  start: number;
  end: number;
}

export interface Citation {
  n: number;
  sourceId: string;
  sourceTitle: string;
  chunkId: string;
  quote: string;
  start: number;
  end: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  citations?: Citation[];
  savedAsNoteId?: string;
}

export interface ChatSession {
  id: string;
  notebookId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface Note {
  id: string;
  notebookId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  sourceIds: string[];
  fromChatMessageId?: string;
}

export interface StudioArtifact {
  id: string;
  notebookId: string;
  kind: ArtifactKind;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: "ready" | "generating" | "error";
  spec: Record<string, unknown>;
  payload: Record<string, unknown>;
}

export interface PluginField {
  key: string;
  label: string;
  type: "text" | "password" | "select" | "url" | "number" | "textarea" | "toggle";
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
}

export type PluginKind =
  | "model"
  | "embed"
  | "tts"
  | "stt"
  | "ingest"
  | "storage"
  | "vector"
  | "research"
  | "studio";

export interface PluginManifest {
  id: string;
  kind: PluginKind;
  name: string;
  description: string;
  fields: PluginField[];
  builtIn: boolean;
  alwaysOn?: boolean;
}

export interface PluginConfig {
  enabled: boolean;
  values: Record<string, string>;
}

export interface AppSettings {
  theme: ThemeId;
  density: "comfortable" | "compact";
  accent: string;
  defaultModelPlugin: string;
  defaultEmbedPlugin: string;
  defaultTtsPlugin: string;
  defaultResearchPlugin: string;
  storagePlugin: string;
  plugins: Record<string, PluginConfig>;
  displayName: string;
  language: string;
  reduceMotion: boolean;
  showWelcome: boolean;
}

export interface RetrieveHit {
  chunk: Chunk;
  score: number;
  source: Source;
}

export interface ChatRequestBody {
  notebookId: string;
  sessionId?: string;
  message: string;
  sourceIds?: string[];
  goal?: ChatGoal;
  customGoal?: string;
  responseLength?: ResponseLength;
  modelPlugin?: string;
}

export interface StudioRequestBody {
  notebookId: string;
  kind: ArtifactKind;
  sourceIds?: string[];
  instructions?: string;
  spec?: Record<string, unknown>;
}

export interface IngestRequestBody {
  notebookId: string;
  kind?: SourceKind;
  title?: string;
  origin?: string;
  text?: string;
  url?: string;
}

export interface ProgressPiece {
  icon: string;
  name: string;
  detail: string;
  status: "queued" | "building" | "critic" | "pass" | "fail";
}

export interface ProgressState {
  wave: string;
  percent: number;
  now: string;
  live: string;
  updated: string;
  pieces: ProgressPiece[];
  log: { t: string; m: string }[];
}
