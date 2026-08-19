import type { ArtifactKind, RetrieveHit, Source, StudioArtifact } from "./types";
import { nowIso, uid } from "./id";
import { excerpt, retrieve } from "./rag";
import { getSourceText, listSources } from "./store";

export async function generateArtifact(opts: {
  notebookId: string;
  kind: ArtifactKind;
  sourceIds?: string[];
  instructions?: string;
  spec?: Record<string, unknown>;
}): Promise<StudioArtifact> {
  const sources = listSources(opts.notebookId).filter(
    (s) => s.enabled && (!opts.sourceIds || opts.sourceIds.includes(s.id)),
  );
  const query =
    opts.instructions ||
    sources
      .flatMap((s) => s.topics)
      .slice(0, 8)
      .join(" ") ||
    sources.map((s) => s.title).join(" ");
  const hits = retrieve(opts.notebookId, query, opts.sourceIds, 12);
  const payload = build(opts.kind, sources, hits, opts.instructions || "", opts.spec || {});
  const artifact: StudioArtifact = {
    id: uid("art"),
    notebookId: opts.notebookId,
    kind: opts.kind,
    title: payload.title as string,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    status: "ready",
    spec: { instructions: opts.instructions || "", ...(opts.spec || {}) },
    payload,
  };

  const { complete, parseJsonObject, resolveModel } = await import("./llm");
  const handle = resolveModel();
  if (!handle || !sources.length) return artifact;

  const facts = uniqueFacts(hits, 12)
    .map((f) => `- [${f.cite}] ${f.source}: ${f.text}`)
    .join("\n");
  const result = await complete({
    handle,
    maxTokens: 2200,
    system:
      "You write NotebookLM-quality Studio artifacts. Return ONLY a JSON object. No markdown fences, no preamble. Stay grounded in the provided passages. Do not invent facts.",
    messages: [
      {
        role: "user",
        content: studioPrompt(opts.kind, sources[0]?.title || "Untitled", facts, opts.instructions || "", opts.spec || {}),
      },
    ],
  });
  if (!result.ok) {
    artifact.spec = { ...artifact.spec, model: handle.pluginId, modelError: result.error };
    return artifact;
  }
  const parsed = parseJsonObject(result.text);
  if (!parsed) {
    artifact.spec = { ...artifact.spec, model: handle.pluginId, modelError: "Model did not return JSON." };
    return artifact;
  }
  artifact.payload = { ...artifact.payload, ...parsed };
  if (typeof parsed.title === "string") artifact.title = parsed.title;
  artifact.spec = { ...artifact.spec, model: handle.pluginId };
  return artifact;
}

function studioPrompt(
  kind: ArtifactKind,
  title: string,
  facts: string,
  instructions: string,
  spec: Record<string, unknown>,
): string {
  const focus = instructions ? `Focus: ${instructions}\n` : "";
  const shapes: Record<string, string> = {
    "audio-overview": `{"title":"...","format":"${spec.format || "deep-dive"}","hosts":["Avery","Jules"],"durationEstimate":"8 min","turns":[{"speaker":"Avery","text":"..."}],"focus":"..."} — 10-16 spoken turns, natural two-host podcast.`,
    "video-overview": `{"title":"...","scenes":[{"kind":"title|beat|close","heading":"...","body":"..."}]} — 7 scenes.`,
    "mind-map": `{"title":"...","root":{"id":"root","label":"...","children":[{"id":"...","label":"...","children":[{"id":"...","label":"...","children":[]}]}]}}`,
    flashcards: `{"title":"...","cards":[{"id":"c0","front":"...","back":"..."}]} — 8-12 cards.`,
    quiz: `{"title":"...","questions":[{"id":"q0","prompt":"...","options":["...","...","...","..."],"answer":"...","explain":"..."}]}`,
    "data-table": `{"title":"...","columns":["source","kind","words","topics","claim"],"rows":[{"source":"...","kind":"...","words":0,"topics":"...","claim":"..."}]}`,
    "slide-deck": `{"title":"...","slides":[{"heading":"...","body":"...","kind":"title|body|close"}]}`,
    infographic: `{"title":"...","kicker":"...","headline":"...","stats":[{"label":"...","value":"..."}],"beats":[{"n":"01","text":"..."}]}`,
    report: `{"title":"...","kind":"Report","sections":[{"heading":"...","body":"..."}]}`,
    briefing: `{"title":"...","kind":"Briefing doc","sections":[{"heading":"...","body":"..."}]}`,
    "study-guide": `{"title":"...","kind":"Study guide","sections":[{"heading":"...","body":"..."}]}`,
    faq: `{"title":"...","kind":"FAQ","sections":[{"heading":"...","body":"..."}]}`,
    timeline: `{"title":"...","kind":"Timeline","sections":[{"heading":"...","body":"..."}]}`,
    outline: `{"title":"...","kind":"Outline","sections":[{"heading":"...","body":"..."}]}`,
  };
  return `Notebook: ${title}\nKind: ${kind}\n${focus}\nPassages:\n${facts}\n\nJSON shape:\n${shapes[kind] || shapes.report}`;
}

function build(
  kind: ArtifactKind,
  sources: Source[],
  hits: RetrieveHit[],
  instructions: string,
  spec: Record<string, unknown>,
): Record<string, unknown> {
  const facts = uniqueFacts(hits, 14);
  const titleBase = sources[0]?.title || "Untitled notebook";

  switch (kind) {
    case "audio-overview":
      return audioOverview(titleBase, facts, sources, spec, instructions);
    case "video-overview":
      return videoOverview(titleBase, facts, sources);
    case "mind-map":
      return mindMap(titleBase, sources, hits);
    case "flashcards":
      return flashcards(titleBase, hits);
    case "quiz":
      return quiz(titleBase, hits);
    case "data-table":
      return dataTable(titleBase, sources, hits);
    case "slide-deck":
      return slides(titleBase, facts, sources);
    case "infographic":
      return infographic(titleBase, facts, sources);
    case "faq":
      return report("FAQ", titleBase, faqItems(hits));
    case "timeline":
      return report("Timeline", titleBase, timelineItems(hits));
    case "outline":
      return report("Outline", titleBase, outlineItems(sources, hits));
    case "study-guide":
      return report("Study guide", titleBase, studyGuide(sources, hits));
    case "briefing":
      return report("Briefing doc", titleBase, briefing(sources, hits, instructions));
    case "report":
    default:
      return report("Report", titleBase, briefing(sources, hits, instructions));
  }
}

function uniqueFacts(hits: RetrieveHit[], n: number): { text: string; cite: number; source: string }[] {
  const out: { text: string; cite: number; source: string }[] = [];
  const seen = new Set<string>();
  hits.forEach((h, i) => {
    const text = excerpt(h.chunk.text, h.source.topics[0] || h.source.title, 200);
    const key = text.slice(0, 80);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ text, cite: i + 1, source: h.source.title });
  });
  return out.slice(0, n);
}

function audioOverview(
  title: string,
  facts: { text: string; cite: number; source: string }[],
  sources: Source[],
  spec: Record<string, unknown>,
  instructions: string,
) {
  const format = (spec.format as string) || "deep-dive";
  const hostA = (spec.hostA as string) || "Avery";
  const hostB = (spec.hostB as string) || "Jules";
  const focus = instructions || `the ideas inside ${title}`;
  const beats = facts.slice(0, format === "brief" ? 5 : 10);
  const turns: { speaker: string; text: string }[] = [];

  turns.push({
    speaker: hostA,
    text:
      format === "debate"
        ? `Okay I have a take and I want you to push back. After sitting with ${sources.length} sources on ${focus}, I think the headline is simpler than people make it.`
        : `Welcome back. Today we're going into ${focus}. ${sources.length} source${sources.length === 1 ? "" : "s"} on the table, and I actually read them.`,
  });
  turns.push({
    speaker: hostB,
    text:
      format === "critique"
        ? `Before we get breathless — what's the weakest claim in here? Because I kept circling one sentence.`
        : `Same. And can we start with the thing that surprised me? ${beats[0]?.text || "There's a lot here."}`,
  });

  beats.forEach((f, i) => {
    const who = i % 2 === 0 ? hostA : hostB;
    const other = who === hostA ? hostB : hostA;
    if (i === 0 && format !== "critique") {
      turns.push({
        speaker: who,
        text: `Right — listen to this: ${f.text} That's from ${f.source}.`,
      });
    } else if (format === "debate" && i % 3 === 0) {
      turns.push({
        speaker: who,
        text: `I don't buy that as the whole story. ${f.text}`,
      });
      turns.push({
        speaker: other,
        text: `I'm not saying it's the whole story. I'm saying it's load-bearing. Without that, the rest of the argument sags.`,
      });
    } else {
      turns.push({
        speaker: who,
        text:
          i % 2 === 0
            ? `There's another layer though. ${f.text}`
            : `Yes — and it connects. ${f.text} I kept underlining that.`,
      });
    }
  });

  turns.push({
    speaker: hostA,
    text: `If someone only remembers one thing from this conversation, it should be that these sources are doing real work — not vibes. Go read the passages.`,
  });
  turns.push({
    speaker: hostB,
    text: `Or listen again. We'll be here. Thanks for sitting with us.`,
  });

  return {
    title: `Audio Overview · ${title}`,
    format,
    hosts: [hostA, hostB],
    durationEstimate: `${Math.max(4, Math.round(turns.length * 0.45))} min`,
    turns,
    focus,
  };
}

function videoOverview(
  title: string,
  facts: { text: string; cite: number; source: string }[],
  sources: Source[],
) {
  const scenes = [
    { kind: "title", heading: title, body: `A visual briefing from ${sources.length} sources.` },
    ...facts.slice(0, 6).map((f, i) => ({
      kind: "beat",
      heading: ["The claim", "The mechanism", "The tension", "The evidence", "The implication", "The open question"][i] || "Note",
      body: f.text,
      cite: f.cite,
    })),
    { kind: "close", heading: "What to do next", body: "Open the sources. Follow the citations. Don't outsource the judgment." },
  ];
  return { title: `Video Overview · ${title}`, scenes };
}

function mindMap(title: string, sources: Source[], hits: RetrieveHit[]) {
  const branches = sources.slice(0, 6).map((s) => {
    const kids = hits
      .filter((h) => h.source.id === s.id)
      .slice(0, 4)
      .map((h) => excerpt(h.chunk.text, s.title, 90));
    const extra = s.topics.slice(0, 3);
    return {
      id: s.id,
      label: s.title,
      children: (kids.length ? kids : extra).map((label, i) => ({
        id: `${s.id}-${i}`,
        label,
        children: [],
      })),
    };
  });
  return {
    title: `Mind map · ${title}`,
    root: { id: "root", label: title, children: branches },
  };
}

function flashcards(title: string, hits: RetrieveHit[]) {
  const cards = hits.slice(0, 12).map((h, i) => ({
    id: `c${i}`,
    front: `What does ${h.source.title} say about ${h.source.topics[0] || "this idea"}?`,
    back: excerpt(h.chunk.text, h.source.topics[0] || h.source.title, 240),
    sourceId: h.source.id,
  }));
  return { title: `Flashcards · ${title}`, cards };
}

function quiz(title: string, hits: RetrieveHit[]) {
  const questions = hits.slice(0, 6).map((h, i) => {
    const answer = excerpt(h.chunk.text, h.source.topics[0] || h.source.title, 110);
    const distractors = hits
      .filter((x) => x.chunk.id !== h.chunk.id)
      .slice(0, 3)
      .map((x) => excerpt(x.chunk.text, x.source.title, 90));
    while (distractors.length < 3) distractors.push("This claim does not appear in the selected sources.");
    const options = shuffle([answer, ...distractors.slice(0, 3)]);
    return {
      id: `q${i}`,
      prompt: `According to ${h.source.title}, which statement is best supported?`,
      options,
      answer,
      explain: `Drawn from ${h.source.title}.`,
    };
  });
  return { title: `Quiz · ${title}`, questions };
}

function dataTable(title: string, sources: Source[], hits: RetrieveHit[]) {
  const rows = sources.map((s) => {
    const hit = hits.find((h) => h.source.id === s.id);
    return {
      source: s.title,
      kind: s.kind,
      words: s.wordCount,
      topics: s.topics.slice(0, 3).join(", "),
      claim: hit ? excerpt(hit.chunk.text, s.title, 140) : s.summary.slice(0, 140),
    };
  });
  return {
    title: `Data table · ${title}`,
    columns: ["source", "kind", "words", "topics", "claim"],
    rows,
  };
}

function slides(title: string, facts: { text: string; cite: number }[], sources: Source[]) {
  const deck = [
    { heading: title, body: `Grounded in ${sources.length} sources.`, kind: "title" },
    { heading: "What this is about", body: facts[0]?.text || sources[0]?.summary || "", kind: "body" },
    ...facts.slice(1, 6).map((f, i) => ({
      heading: ["A load-bearing claim", "How it works", "Where it frays", "What follows", "Keep this"][i] || "Note",
      body: f.text,
      kind: "body",
    })),
    { heading: "Sources", body: sources.map((s) => s.title).join("  ·  "), kind: "close" },
  ];
  return { title: `Slides · ${title}`, slides: deck };
}

function infographic(title: string, facts: { text: string }[], sources: Source[]) {
  return {
    title: `Infographic · ${title}`,
    kicker: "From your sources",
    headline: title,
    stats: [
      { label: "Sources", value: String(sources.length) },
      { label: "Words", value: String(sources.reduce((a, s) => a + s.wordCount, 0)) },
      { label: "Ideas", value: String(facts.length) },
    ],
    beats: facts.slice(0, 5).map((f, i) => ({ n: String(i + 1).padStart(2, "0"), text: f.text })),
  };
}

function report(kind: string, title: string, sections: { heading: string; body: string }[]) {
  return { title: `${kind} · ${title}`, kind, sections };
}

function briefing(sources: Source[], hits: RetrieveHit[], instructions: string) {
  const facts = uniqueFacts(hits, 8);
  return [
    {
      heading: "Bottom line",
      body:
        facts[0]?.text ||
        sources[0]?.summary ||
        "No sources selected.",
    },
    {
      heading: instructions ? "Asked to focus on" : "What's in the notebook",
      body: instructions || sources.map((s) => `• ${s.title} — ${s.summary}`).join("\n"),
    },
    {
      heading: "Evidence",
      body: facts.map((f) => `• ${f.text} (${f.source})`).join("\n"),
    },
    {
      heading: "Open questions",
      body: "What would change this picture? Which source is doing the most work, and which is decorative?",
    },
  ];
}

function studyGuide(sources: Source[], hits: RetrieveHit[]) {
  return [
    { heading: "Must know", body: uniqueFacts(hits, 6).map((f) => `• ${f.text}`).join("\n") },
    { heading: "Terms", body: [...new Set(sources.flatMap((s) => s.topics))].slice(0, 10).map((t) => `• ${t}`).join("\n") },
    { heading: "Possible exam questions", body: sources.flatMap((s) => s.suggestedQuestions.slice(0, 1)).map((q) => `• ${q}`).join("\n") },
  ];
}

function faqItems(hits: RetrieveHit[]) {
  return hits.slice(0, 6).map((h) => ({
    heading: h.source.suggestedQuestions[0] || `What does ${h.source.title} argue?`,
    body: excerpt(h.chunk.text, h.source.title, 280),
  }));
}

function timelineItems(hits: RetrieveHit[]) {
  return hits.slice(0, 6).map((h, i) => ({
    heading: `Beat ${i + 1} · ${h.source.title}`,
    body: excerpt(h.chunk.text, h.source.title, 200),
  }));
}

function outlineItems(sources: Source[], hits: RetrieveHit[]) {
  return sources.map((s) => ({
    heading: s.title,
    body: hits
      .filter((h) => h.source.id === s.id)
      .slice(0, 3)
      .map((h) => `• ${excerpt(h.chunk.text, s.title, 140)}`)
      .join("\n") || s.summary,
  }));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function getSourceTextSafe(notebookId: string, sourceId: string) {
  return getSourceText(notebookId, sourceId);
}
