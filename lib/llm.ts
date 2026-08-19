import type { AppSettings, RetrieveHit } from "./types";
import { getSettings } from "./store";
import { PLUGIN_MANIFESTS, pluginConfigured } from "./plugins/manifest";

export interface ModelHandle {
  pluginId: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface CompleteResult {
  ok: boolean;
  text: string;
  error?: string;
  pluginId: string;
}

const OPENAI_STYLE = new Set([
  "openai",
  "openrouter",
  "groq",
  "compatible",
  "nvidia-nim",
]);

export function resolveModel(settings?: AppSettings, preferred?: string): ModelHandle | null {
  const s = settings || getSettings();
  const id = preferred || s.defaultModelPlugin;
  if (!id || id === "local-grounded") return null;
  if (!pluginConfigured(id, s) && !(id === "nvidia-nim" && (process.env.NVIDIA_API_KEY || s.plugins[id]?.values?.apiKey))) {
    return null;
  }
  const values = s.plugins[id]?.values || {};
  return {
    pluginId: id,
    apiKey: values.apiKey,
    baseUrl: values.baseUrl,
    model: values.model,
  };
}

export function connectionStatus(settings?: AppSettings) {
  const s = settings || getSettings();
  const model = resolveModel(s);
  const research = s.defaultResearchPlugin && pluginConfigured(s.defaultResearchPlugin, s);
  const tts = s.defaultTtsPlugin && pluginConfigured(s.defaultTtsPlugin, s);
  return {
    model: model
      ? { id: model.pluginId, name: PLUGIN_MANIFESTS.find((p) => p.id === model.pluginId)?.name || model.pluginId, model: model.model || "" }
      : { id: "local-grounded", name: "Noteb Grounded (local)", model: "" },
    research: research ? s.defaultResearchPlugin : "",
    tts: tts ? s.defaultTtsPlugin : "browser-speech",
    nimReady: Boolean(s.plugins["nvidia-nim"]?.enabled && (s.plugins["nvidia-nim"]?.values?.apiKey || process.env.NVIDIA_API_KEY)),
  };
}

export async function complete(opts: {
  handle?: ModelHandle | null;
  system: string;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  maxTokens?: number;
}): Promise<CompleteResult> {
  const handle = opts.handle === undefined ? resolveModel() : opts.handle;
  if (!handle) return { ok: false, text: "", error: "No remote model configured.", pluginId: "local-grounded" };
  try {
    const text = await dispatch(handle, opts.system, opts.messages, opts.maxTokens || 1800);
    if (!text) return { ok: false, text: "", error: "Empty response from the model.", pluginId: handle.pluginId };
    return { ok: true, text, pluginId: handle.pluginId };
  } catch (e) {
    return { ok: false, text: "", error: (e as Error).message, pluginId: handle.pluginId };
  }
}

async function dispatch(
  handle: ModelHandle,
  system: string,
  messages: { role: "user" | "assistant" | "system"; content: string }[],
  maxTokens: number,
): Promise<string> {
  const { pluginId, apiKey, baseUrl, model } = handle;
  if (OPENAI_STYLE.has(pluginId)) {
    const root =
      (baseUrl ||
        (pluginId === "nvidia-nim"
          ? "https://integrate.api.nvidia.com/v1"
          : pluginId === "openrouter"
            ? "https://openrouter.ai/api/v1"
            : pluginId === "groq"
              ? "https://api.groq.com/openai/v1"
              : "https://api.openai.com/v1")
      ).replace(/\/$/, "");
    const res = await fetch(root + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...(pluginId === "openrouter" ? { "HTTP-Referer": "http://localhost:3000", "X-Title": "Noteb" } : {}),
      },
      body: JSON.stringify({
        model:
          model ||
          (pluginId === "nvidia-nim"
            ? "meta/llama-3.1-70b-instruct"
            : pluginId === "groq"
              ? "llama-3.3-70b-versatile"
              : "gpt-4o-mini"),
        temperature: 0.3,
        max_tokens: maxTokens,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error?.message || json.detail || `HTTP ${res.status} from ${pluginId}`);
    }
    return json.choices?.[0]?.message?.content || "";
  }
  if (pluginId === "anthropic") {
    const res = await fetch((baseUrl || "https://api.anthropic.com") + "/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        system,
        messages: messages.filter((m) => m.role !== "system"),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error?.message || `HTTP ${res.status} from Anthropic`);
    return (json.content || []).map((c: { text?: string }) => c.text || "").join("");
  }
  if (pluginId === "gemini") {
    const m = model || "gemini-2.5-flash";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map((msg) => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
          })),
        }),
      },
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error?.message || `HTTP ${res.status} from Gemini`);
    return (json.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || "").join("");
  }
  if (pluginId === "ollama") {
    const res = await fetch((baseUrl || "http://127.0.0.1:11434") + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "llama3.1",
        stream: false,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status} from Ollama`);
    return json.message?.content || "";
  }
  throw new Error(`Unknown model plugin: ${pluginId}`);
}

export async function testModel(handle: ModelHandle): Promise<CompleteResult> {
  return complete({
    handle,
    system: "Reply with the single word pong.",
    messages: [{ role: "user", content: "ping" }],
    maxTokens: 16,
  });
}

export function citationSystemPrompt(hits: RetrieveHit[]): string {
  const ctx = hits
    .map((h, i) => `[${i + 1}] ${h.source.title}\n${h.chunk.text.slice(0, 1400)}`)
    .join("\n\n");
  return `You are Noteb, a source-grounded research partner. Answer ONLY from the passages below. Cite with [n] immediately after the claim. If the passages do not contain the answer, say so. Never invent a source.\n\n${ctx}`;
}

export function parseJsonObject(raw: string): Record<string, unknown> | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = (fenced?.[1] || raw).trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
