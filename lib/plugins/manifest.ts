import type { AppSettings, PluginManifest } from "../types";

export const PLUGIN_MANIFESTS: PluginManifest[] = [
  {
    id: "local-grounded",
    kind: "model",
    name: "Noteb Grounded (local)",
    description:
      "Always-on extractive reasoner. Answers only from your sources with citations. No key, no leak.",
    fields: [],
    builtIn: true,
    alwaysOn: true,
  },
  {
    id: "nvidia-nim",
    kind: "model",
    name: "NVIDIA NIM",
    description:
      "Build.nvidia.com or a self-hosted NIM. OpenAI-compatible. One key drives chat, Studio, and Deep Research.",
    fields: [
      {
        key: "apiKey",
        label: "NVIDIA API key",
        type: "password",
        required: true,
        placeholder: "nvapi-…",
        help: "From https://build.nvidia.com — or leave blank and set NVIDIA_API_KEY in the environment.",
      },
      {
        key: "baseUrl",
        label: "Endpoint",
        type: "url",
        placeholder: "https://integrate.api.nvidia.com/v1",
        help: "Cloud catalog, or your own NIM host ending in /v1.",
      },
      {
        key: "model",
        label: "Model",
        type: "select",
        placeholder: "meta/llama-3.1-70b-instruct",
        options: [
          { value: "meta/llama-3.1-8b-instruct", label: "Llama 3.1 8B Instruct" },
          { value: "meta/llama-3.1-70b-instruct", label: "Llama 3.1 70B Instruct" },
          { value: "meta/llama-3.3-70b-instruct", label: "Llama 3.3 70B Instruct" },
          { value: "nvidia/llama-3.1-nemotron-70b-instruct", label: "Nemotron 70B Instruct" },
          { value: "nvidia/llama-3.3-nemotron-super-49b-v1", label: "Nemotron Super 49B" },
          { value: "mistralai/mistral-large-2-instruct", label: "Mistral Large 2" },
          { value: "google/gemma-2-27b-it", label: "Gemma 2 27B" },
          { value: "microsoft/phi-3.5-moe-instruct", label: "Phi-3.5 MoE" },
        ],
      },
    ],
    builtIn: true,
  },
  {
    id: "openai",
    kind: "model",
    name: "OpenAI",
    description: "GPT-4.1, GPT-4o, o-series — bring your own key.",
    fields: [
      { key: "apiKey", label: "API key", type: "password", required: true, placeholder: "sk-…" },
      {
        key: "model",
        label: "Model",
        type: "text",
        placeholder: "gpt-4o-mini",
        help: "Any chat-completions model id.",
      },
      { key: "baseUrl", label: "Base URL", type: "url", placeholder: "https://api.openai.com/v1" },
    ],
    builtIn: true,
  },
  {
    id: "anthropic",
    kind: "model",
    name: "Anthropic",
    description: "Claude with long context and careful citation following.",
    fields: [
      { key: "apiKey", label: "API key", type: "password", required: true, placeholder: "sk-ant-…" },
      { key: "model", label: "Model", type: "text", placeholder: "claude-sonnet-4-20250514" },
      { key: "baseUrl", label: "Base URL", type: "url", placeholder: "https://api.anthropic.com" },
    ],
    builtIn: true,
  },
  {
    id: "gemini",
    kind: "model",
    name: "Google Gemini",
    description: "Gemini models, including the ones behind Gemini Notebook.",
    fields: [
      { key: "apiKey", label: "API key", type: "password", required: true },
      { key: "model", label: "Model", type: "text", placeholder: "gemini-2.5-flash" },
    ],
    builtIn: true,
  },
  {
    id: "openrouter",
    kind: "model",
    name: "OpenRouter",
    description: "One key, hundreds of models.",
    fields: [
      { key: "apiKey", label: "API key", type: "password", required: true },
      { key: "model", label: "Model", type: "text", placeholder: "anthropic/claude-sonnet-4" },
    ],
    builtIn: true,
  },
  {
    id: "ollama",
    kind: "model",
    name: "Ollama",
    description: "Local models on your machine. Nothing leaves the box.",
    fields: [
      { key: "baseUrl", label: "Host", type: "url", placeholder: "http://127.0.0.1:11434" },
      { key: "model", label: "Model", type: "text", placeholder: "llama3.1" },
    ],
    builtIn: true,
  },
  {
    id: "groq",
    kind: "model",
    name: "Groq",
    description: "Fast open-weight inference.",
    fields: [
      { key: "apiKey", label: "API key", type: "password", required: true },
      { key: "model", label: "Model", type: "text", placeholder: "llama-3.3-70b-versatile" },
    ],
    builtIn: true,
  },
  {
    id: "compatible",
    kind: "model",
    name: "OpenAI-compatible",
    description: "vLLM, LM Studio, Together, Fireworks, Azure, anything with a /chat/completions.",
    fields: [
      { key: "baseUrl", label: "Base URL", type: "url", required: true, placeholder: "https://host/v1" },
      { key: "apiKey", label: "API key", type: "password" },
      { key: "model", label: "Model", type: "text", required: true },
    ],
    builtIn: true,
  },
  {
    id: "local-lexical",
    kind: "embed",
    name: "Lexical BM25",
    description: "On-device retrieval. No vectors, no vendor, surprisingly strong on research prose.",
    fields: [],
    builtIn: true,
    alwaysOn: true,
  },
  {
    id: "nvidia-nim-embed",
    kind: "embed",
    name: "NVIDIA NIM embeddings",
    description: "nv-embedqa and other NIM embedding models. Same key as chat, or its own.",
    fields: [
      { key: "apiKey", label: "API key", type: "password", placeholder: "nvapi-…" },
      { key: "baseUrl", label: "Endpoint", type: "url", placeholder: "https://integrate.api.nvidia.com/v1" },
      {
        key: "model",
        label: "Model",
        type: "text",
        placeholder: "nvidia/nv-embedqa-e5-v5",
      },
    ],
    builtIn: true,
  },
  {
    id: "openai-embed",
    kind: "embed",
    name: "OpenAI embeddings",
    description: "text-embedding-3-large / small.",
    fields: [
      { key: "apiKey", label: "API key", type: "password", required: true },
      { key: "model", label: "Model", type: "text", placeholder: "text-embedding-3-small" },
    ],
    builtIn: true,
  },
  {
    id: "browser-speech",
    kind: "tts",
    name: "Browser speech",
    description: "Two-host Audio Overviews via the Web Speech API. Zero cost.",
    fields: [],
    builtIn: true,
    alwaysOn: true,
  },
  {
    id: "openai-tts",
    kind: "tts",
    name: "OpenAI TTS",
    description: "Alloy / verse / coral studio voices.",
    fields: [
      { key: "apiKey", label: "API key", type: "password", required: true },
      { key: "voiceA", label: "Host A voice", type: "text", placeholder: "alloy" },
      { key: "voiceB", label: "Host B voice", type: "text", placeholder: "verse" },
    ],
    builtIn: true,
  },
  {
    id: "elevenlabs",
    kind: "tts",
    name: "ElevenLabs",
    description: "Cinema-grade podcast hosts.",
    fields: [
      { key: "apiKey", label: "API key", type: "password", required: true },
      { key: "voiceA", label: "Host A voice id", type: "text" },
      { key: "voiceB", label: "Host B voice id", type: "text" },
    ],
    builtIn: true,
  },
  {
    id: "local-fs",
    kind: "storage",
    name: "Local filesystem",
    description: "Notebooks live in ./data/runtime. Yours, portable, grep-able.",
    fields: [],
    builtIn: true,
    alwaysOn: true,
  },
  {
    id: "s3",
    kind: "storage",
    name: "S3 / R2 / MinIO",
    description: "Object storage for sources and artifacts.",
    fields: [
      { key: "endpoint", label: "Endpoint", type: "url" },
      { key: "bucket", label: "Bucket", type: "text", required: true },
      { key: "accessKey", label: "Access key", type: "password", required: true },
      { key: "secretKey", label: "Secret key", type: "password", required: true },
      { key: "region", label: "Region", type: "text", placeholder: "auto" },
    ],
    builtIn: true,
  },
  {
    id: "tavily",
    kind: "research",
    name: "Tavily",
    description: "Web research for Deep Research reports.",
    fields: [{ key: "apiKey", label: "API key", type: "password", required: true }],
    builtIn: true,
  },
  {
    id: "brave",
    kind: "research",
    name: "Brave Search",
    description: "Independent web index for source discovery.",
    fields: [{ key: "apiKey", label: "API key", type: "password", required: true }],
    builtIn: true,
  },
  {
    id: "ingest-core",
    kind: "ingest",
    name: "Core ingest",
    description: "PDF, DOCX, Markdown, HTML, URL, YouTube captions, CSV, JSON, paste.",
    fields: [],
    builtIn: true,
    alwaysOn: true,
  },
];

export function defaultSettings(): AppSettings {
  const plugins: AppSettings["plugins"] = {};
  for (const p of PLUGIN_MANIFESTS) {
    plugins[p.id] = { enabled: Boolean(p.alwaysOn), values: {} };
  }
  return {
    theme: "paper",
    density: "comfortable",
    accent: "#0f6e62",
    defaultModelPlugin: "local-grounded",
    defaultEmbedPlugin: "local-lexical",
    defaultTtsPlugin: "browser-speech",
    defaultResearchPlugin: "",
    storagePlugin: "local-fs",
    plugins,
    displayName: "You",
    language: "en",
    reduceMotion: false,
    showWelcome: true,
  };
}

export function pluginConfigured(id: string, settings: AppSettings): boolean {
  const manifest = PLUGIN_MANIFESTS.find((p) => p.id === id);
  if (!manifest) return false;
  if (manifest.alwaysOn) return true;
  const cfg = settings.plugins[id];
  if (!cfg?.enabled) return false;
  return manifest.fields
    .filter((f) => f.required)
    .every((f) => Boolean(cfg.values[f.key]?.trim()));
}
