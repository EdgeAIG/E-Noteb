import type {
  ChatGoal,
  ChatMessage,
  Citation,
  Chunk,
  ResponseLength,
  RetrieveHit,
  Source,
} from "./types";
import { listChunks, listSources } from "./store";
import { uid } from "./id";

const STOP = new Set(
  "a an the and or but if then else when of to in on for with as by at from into over after before about against between through during without within along following across behind beyond plus except up down out off again further once here there all any both each few more most other some such no nor not only own same so than too very can will just don should now is are was were be been being it this that these those you your we they i he she them our their what which who whom how why where".split(
    " ",
  ),
);

function stem(t: string): string {
  if (t.length <= 4) return t;
  return t.replace(/(ing|ed|es|s)$/g, "");
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map(stem)
    .filter((t) => t && !STOP.has(t) && t.length > 1);
}

function idf(df: number, n: number) {
  return Math.log(1 + (n - df + 0.5) / (df + 0.5));
}

export function retrieve(
  notebookId: string,
  query: string,
  sourceIds?: string[],
  k = 8,
): RetrieveHit[] {
  const sources = listSources(notebookId).filter(
    (s) => s.enabled && s.status === "ready" && (!sourceIds || sourceIds.includes(s.id)),
  );
  const sourceMap = new Map(sources.map((s) => [s.id, s]));
  const chunks = listChunks(
    notebookId,
    sources.map((s) => s.id),
  );
  if (!chunks.length) return [];

  const qTokens = tokenize(expandQuery(query));
  if (!qTokens.length) {
    return chunks.slice(0, k).map((chunk) => ({
      chunk,
      score: 0.1,
      source: sourceMap.get(chunk.sourceId)!,
    }));
  }

  const df = new Map<string, number>();
  const tfs: Map<string, number>[] = [];
  for (const c of chunks) {
    const tf = new Map<string, number>();
    for (const t of tokenize(c.text)) tf.set(t, (tf.get(t) || 0) + 1);
    tfs.push(tf);
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  }

  const avgdl = chunks.reduce((s, c) => s + tokenize(c.text).length, 0) / chunks.length || 1;
  const k1 = 1.4;
  const b = 0.75;
  const scored = chunks.map((chunk, i) => {
    const tf = tfs[i];
    const dl = [...tf.values()].reduce((a, n) => a + n, 0) || 1;
    let score = 0;
    for (const t of qTokens) {
      const f = tf.get(t) || 0;
      if (!f) continue;
      const w = idf(df.get(t) || 0, chunks.length);
      score += (w * f * (k1 + 1)) / (f + k1 * (1 - b + b * (dl / avgdl)));
    }
    const titleBoost = sourceMap.get(chunk.sourceId)?.title.toLowerCase() || "";
    if (qTokens.some((t) => titleBoost.includes(t))) score *= 1.08;
    const covered = qTokens.filter((t) => (tf.get(t) || 0) > 0).length;
    score *= 1 + covered / Math.max(qTokens.length, 1);
    if (!isBodySentence(chunk.text.slice(0, 180)) && chunk.text.length < 200) score *= 0.55;
    return { chunk, score, source: sourceMap.get(chunk.sourceId)! };
  });

  return scored
    .filter((s) => s.score > 0 && s.source)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export function chunkText(notebookId: string, sourceId: string, text: string): Chunk[] {
  const clean = text.replace(/\r/g, "").trim();
  const parts: { text: string; start: number }[] = [];
  const paras = clean.split(/\n{2,}/);
  let cursor = 0;
  let buf = "";
  let bufStart = 0;

  const flush = () => {
    const t = buf.trim();
    if (t.length > 20) parts.push({ text: t, start: bufStart });
    buf = "";
  };

  for (const p of paras) {
    const idx = clean.indexOf(p, cursor);
    const start = idx >= 0 ? idx : cursor;
    cursor = start + p.length;
    if ((buf + "\n\n" + p).length > 1200) {
      flush();
      buf = p;
      bufStart = start;
    } else {
      if (!buf) bufStart = start;
      buf = buf ? buf + "\n\n" + p : p;
    }
  }
  flush();

  if (!parts.length && clean) parts.push({ text: clean.slice(0, 1800), start: 0 });

  return parts.map((p, index) => ({
    id: uid("chk"),
    sourceId,
    notebookId,
    index,
    text: p.text,
    start: p.start,
    end: p.start + p.text.length,
  }));
}

export function summarizeLocal(text: string, title: string): string {
  const sentences = splitSentences(text).slice(0, 16);
  if (!sentences.length) return `Notes on ${title}.`;
  const scored = sentences.map((s) => ({
    s,
    n: tokenize(s).length + (s.length > 80 && s.length < 240 ? 4 : 0),
  }));
  scored.sort((a, b) => b.n - a.n);
  return scored
    .slice(0, 3)
    .map((x) => x.s)
    .join(" ");
}

export function topicsLocal(text: string): string[] {
  const counts = new Map<string, number>();
  for (const t of tokenize(text)) counts.set(t, (counts.get(t) || 0) + 1);
  return [...counts.entries()]
    .filter(([t, n]) => n > 1 && t.length > 4)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t]) => t);
}

export function suggestQuestions(title: string, text: string, topics: string[]): string[] {
  const t = topics[0] || title;
  const t2 = topics[1] || "this material";
  return [
    `What is the central claim of ${title}?`,
    `Explain ${t} in plain language, with citations.`,
    `Where do the sources disagree about ${t2}?`,
    `Give me a briefing I could hand to a colleague.`,
  ];
}

function isBodySentence(s: string): boolean {
  const t = s.trim();
  if (t.length < 24 || t.length > 480) return false;
  if (/^#/.test(t)) return false;
  if (!/[.!?]"?$/.test(t)) return false;
  if ((t.match(/[a-z]/g) || []).length < 12) return false;
  return true;
}

function splitSentences(text: string): string[] {
  const lines = text.split(/\n+/).map((l) =>
    l.replace(/^#{1,6}\s+/, "").replace(/^[-*•]\s+/, "").trim(),
  );
  const out: string[] = [];
  for (const line of lines) {
    if (!line) continue;
    for (const s of line.split(/(?<=[.!?])\s+/)) {
      if (isBodySentence(s)) out.push(s.trim());
    }
  }
  return out;
}

function fuzzyHas(toks: string[], needle: string): boolean {
  return toks.some((t) => t === needle || t.startsWith(needle) || needle.startsWith(t));
}

function sentenceScore(sentence: string, query: string): number {
  const qToks = tokenize(query);
  const expToks = tokenize(expandQuery(query)).filter((t) => !qToks.includes(t));
  const toks = tokenize(sentence);
  if (!toks.length) return 0;
  let score = 0;
  for (const t of qToks) if (fuzzyHas(toks, t)) score += 1;
  for (const t of expToks) if (fuzzyHas(toks, t)) score += 1.7;
  const low = sentence.toLowerCase();
  if (/prevent|bottleneck|because|expensive|cannot|instead|so you|path length/.test(low)) score += 1.4;
  if (/^\s*(this note|the paper by|welcome)/i.test(sentence)) score -= 2;
  return score + Math.min(toks.length / 28, 0.8);
}

function expandQuery(query: string): string {
  const extra: string[] = [];
  const q = query.toLowerCase();
  if (/problem|solving|why/.test(q)) extra.push("bottleneck parallel sequential recurrence expensive path");
  if (/transformer|attention/.test(q)) extra.push("self-attention encoder decoder");
  if (/compare|disagree/.test(q)) extra.push("however but critique claim");
  return query + " " + extra.join(" ");
}

function goalPreamble(goal: ChatGoal, custom: string, length: ResponseLength) {
  const g =
    goal === "learning-guide"
      ? "Teach. After answering, ask one sharp follow-up that checks understanding."
      : goal === "custom" && custom
        ? `Role: ${custom}`
        : "Be a precise research partner.";
  const l =
    length === "shorter"
      ? "Keep it tight — a short briefing."
      : length === "longer"
        ? "Write fully. Use headings and walk through the evidence."
        : "Match the question's natural length.";
  return `${g} ${l}`;
}

export function groundedAnswer(opts: {
  question: string;
  hits: RetrieveHit[];
  sources: Source[];
  goal: ChatGoal;
  customGoal: string;
  responseLength: ResponseLength;
  history: ChatMessage[];
}): { content: string; citations: Citation[] } {
  const { question, hits, sources, goal, customGoal, responseLength } = opts;
  if (!sources.length) {
    return {
      content:
        "Add a source first. I only answer from what you put in this notebook — nothing from the open web unless you ask Deep Research to go looking.",
      citations: [],
    };
  }
  if (!hits.length) {
    return {
      content: `I don't find that in the ${sources.length} source${sources.length === 1 ? "" : "s"} you have selected. Try enabling more sources, or ask about a topic they actually cover — ${sources
        .slice(0, 3)
        .map((s) => s.title)
        .join(", ")}.`,
      citations: [],
    };
  }

  const usedHits = hits.slice(0, responseLength === "longer" ? 8 : 6);
  const citations: Citation[] = usedHits.map((h, i) => ({
    n: i + 1,
    sourceId: h.source.id,
    sourceTitle: h.source.title,
    chunkId: h.chunk.id,
    quote: excerpt(h.chunk.text, question),
    start: h.chunk.start,
    end: h.chunk.end,
  }));

  const evidence = usedHits
    .map((h, i) => ({
      n: i + 1,
      title: h.source.title,
      sentence: bestSentence(h.chunk.text, question) || excerpt(h.chunk.text, question, 240),
    }))
    .filter((p) => isBodySentence(p.sentence) || p.sentence.length > 40);

  const q = question.toLowerCase();
  const wantsList = /list|bullet|key points|takeaways|outline|must know/.test(q);
  const wantsCompare = /compare|versus|vs\.|differ|disagree|contrast/.test(q);
  const wantsBrief = /brief|briefing|summary|summarize|overview|eli5/.test(q);
  const wantsGuide = /study guide|exam|quiz me/.test(q);

  void goalPreamble(goal, customGoal, responseLength);

  let body = "";
  if (wantsCompare && evidence.length >= 2) {
    const bySource = new Map<string, typeof evidence>();
    for (const e of evidence) {
      const arr = bySource.get(e.title) || [];
      arr.push(e);
      bySource.set(e.title, arr);
    }
    body =
      `The sources do not say the same thing, and that is the point.\n\n` +
      [...bySource.entries()]
        .map(([title, items]) => `**${title}.** ${items[0].sentence} [${items[0].n}]`)
        .join("\n\n") +
      `\n\nTreat the overlap as shared vocabulary and the rest as disagreement — not as a single flattened claim.`;
  } else if (wantsList || wantsGuide) {
    body = `From the selected sources:\n\n` + evidence.map((p) => `- ${p.sentence} [${p.n}]`).join("\n");
  } else if (wantsBrief) {
    body = writeBrief(question, evidence, responseLength);
  } else {
    body = writeAnswer(question, evidence, responseLength);
  }

  if (goal === "learning-guide") {
    const topic = hits[0]?.source.topics?.[0] || "this";
    body += `\n\nYour turn — without looking back, what would you say is doing the real work in ${topic}?`;
  } else if (goal === "custom" && customGoal) {
    body += `\n\n_Reading this in the role you set: ${customGoal.slice(0, 160)}_`;
  }

  return { content: body.trim(), citations };
}

function writeAnswer(
  question: string,
  evidence: { n: number; title: string; sentence: string; score?: number }[],
  length: ResponseLength,
): string {
  if (!evidence.length) return "I found related passages, but nothing I would stand on as an answer.";
  const lead = evidence[0];
  const scored = (e: { score?: number }) => e.score || 0;
  const same = evidence
    .filter((e) => e.title === lead.title && e.sentence !== lead.sentence && scored(e) >= Math.max(2.2, scored(lead) * 0.75))
    .slice(0, length === "longer" ? 3 : 1);
  const other = evidence
    .filter((e) => e.title !== lead.title && scored(e) >= 2.4)
    .slice(0, length === "longer" ? 3 : length === "shorter" ? 0 : 1);
  const open = `${lead.sentence} [${lead.n}] ${same.map((p) => `${p.sentence} [${p.n}]`).join(" ")}`.trim();
  if (!other.length) return open;
  return `${open}\n\n${other.map((p) => `${p.sentence} [${p.n}]`).join(" ")}`;
}

function writeBrief(
  _question: string,
  evidence: { n: number; title: string; sentence: string }[],
  length: ResponseLength,
): string {
  const take = evidence.slice(0, length === "longer" ? 6 : 4);
  return (
    take.map((p, i) => (i === 0 ? `${p.sentence} [${p.n}]` : p.sentence + ` [${p.n}]`)).join(" ") +
    (length === "longer" ? "\n\nIf you only keep one line: the sources reward precision over folklore." : "")
  );
}

function bestSentence(text: string, query: string): string {
  let best = "";
  let bestN = -1;
  for (const s of splitSentences(text)) {
    const n = sentenceScore(s, query);
    if (n > bestN) {
      bestN = n;
      best = s;
    }
  }
  return best;
}

export function excerpt(text: string, query: string, max = 280): string {
  const s = bestSentence(text, query) || text;
  if (s.length <= max) return s.trim();
  return s.slice(0, max - 1).trim() + "…";
}

export async function completeWithPlugin(opts: {
  pluginId: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  system: string;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
}): Promise<string | null> {
  const { pluginId, apiKey, baseUrl, model, system, messages } = opts;
  try {
    if (pluginId === "openai" || pluginId === "openrouter" || pluginId === "groq" || pluginId === "compatible") {
      const url =
        (baseUrl ||
          (pluginId === "openrouter"
            ? "https://openrouter.ai/api/v1"
            : pluginId === "groq"
              ? "https://api.groq.com/openai/v1"
              : "https://api.openai.com/v1")) + "/chat/completions";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          ...(pluginId === "openrouter" ? { "HTTP-Referer": "http://localhost:3000" } : {}),
        },
        body: JSON.stringify({
          model: model || "gpt-4o-mini",
          temperature: 0.3,
          messages: [{ role: "system", content: system }, ...messages],
        }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.choices?.[0]?.message?.content ?? null;
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
          max_tokens: 1800,
          system,
          messages: messages.filter((m) => m.role !== "system"),
        }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.content?.map((c: { text?: string }) => c.text || "").join("") || null;
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
      if (!res.ok) return null;
      const json = await res.json();
      return json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || null;
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
      if (!res.ok) return null;
      const json = await res.json();
      return json.message?.content ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

export function citationSystemPrompt(hits: RetrieveHit[]): string {
  const ctx = hits
    .map(
      (h, i) =>
        `[${i + 1}] ${h.source.title}\n${h.chunk.text.slice(0, 1400)}`,
    )
    .join("\n\n");
  return `You are Noteb, a source-grounded research partner. Answer ONLY from the passages below. Cite with [n] immediately after the claim. If the passages do not contain the answer, say so. Never invent a source.\n\n${ctx}`;
}
