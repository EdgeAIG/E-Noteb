import { NextRequest, NextResponse } from "next/server";
import { ensureSeed } from "@/lib/seed";
import {
  createNotebook,
  createSession,
  deleteArtifact,
  deleteNote,
  deleteNotebook,
  deleteSource,
  getNotebook,
  getNotebookBundle,
  getSession,
  getSettings,
  getSource,
  getSourceText,
  listNotebooks,
  saveArtifact,
  saveNote,
  saveSession,
  saveSettings,
  saveSource,
  touchNotebook,
} from "@/lib/store";
import { ingestFile, ingestText, ingestUrl } from "@/lib/ingest";
import { groundedAnswer, retrieve } from "@/lib/rag";
import { generateArtifact } from "@/lib/studio";
import { deepResearch } from "@/lib/research";
import { PLUGIN_MANIFESTS } from "@/lib/plugins/manifest";
import { nowIso, uid } from "@/lib/id";
import type { ArtifactKind, ChatGoal, ResponseLength, Source } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

async function segs(ctx: Ctx) {
  return (await ctx.params).path || [];
}

async function ready() {
  await ensureSeed();
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function notFound(msg = "Not found") {
  return json({ error: msg }, 404);
}

export async function GET(req: NextRequest, ctx: Ctx) {
  await ready();
  const path = await segs(ctx);
  const [a, b, c, d] = path;

  if (a === "health") return json({ ok: true, name: "noteb" });
  if (a === "status") {
    const { connectionStatus } = await import("@/lib/llm");
    return json(connectionStatus());
  }
  if (a === "plugins") return json({ plugins: PLUGIN_MANIFESTS, settings: getSettings() });
  if (a === "settings") return json(getSettings());
  if (a === "notebooks" && !b) return json({ notebooks: listNotebooks() });
  if (a === "notebooks" && b && c === "bundle") {
    const bundle = getNotebookBundle(b);
    return bundle ? json(bundle) : notFound("Notebook missing");
  }
  if (a === "notebooks" && b && !c) {
    const nb = getNotebook(b);
    return nb ? json(nb) : notFound("Notebook missing");
  }
  if (a === "notebooks" && b && c === "sources" && d && path[4] === "text") {
    return json({ text: getSourceText(b, d), source: getSource(b, d) });
  }
  if (a === "notebooks" && b && c === "sources" && d) {
    const s = getSource(b, d);
    return s ? json(s) : notFound("Source missing");
  }
  return notFound();
}

export async function POST(req: NextRequest, ctx: Ctx) {
  await ready();
  const path = await segs(ctx);
  const [a, b, c] = path;

  if (a === "notebooks" && !b) {
    const body = await safeJson(req);
    return json(createNotebook(body || {}));
  }

  if (a === "notebooks" && b && c === "sources") {
    const ctype = req.headers.get("content-type") || "";
    if (ctype.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return json({ error: "file required" }, 400);
      const buf = Buffer.from(await file.arrayBuffer());
      const source = await ingestFile({
        notebookId: b,
        filename: file.name,
        mime: file.type || "application/octet-stream",
        buf,
      });
      return json(source);
    }
    const body = await safeJson(req);
    if (body?.url) return json(await ingestUrl(b, String(body.url)));
    if (body?.text) {
      return json(
        await ingestText({
          notebookId: b,
          title: body.title || "Pasted source",
          text: String(body.text),
          kind: body.kind || "paste",
          origin: body.origin || "pasted",
        }),
      );
    }
    return json({ error: "Provide a file, url, or text" }, 400);
  }

  if (a === "notebooks" && b && c === "chat") {
    return handleChat(b, await safeJson(req));
  }

  if (a === "notebooks" && b && c === "studio") {
    const body = await safeJson(req);
    const art = await generateArtifact({
      notebookId: b,
      kind: body.kind as ArtifactKind,
      sourceIds: body.sourceIds as string[] | undefined,
      instructions: body.instructions as string | undefined,
      spec: body.spec as Record<string, unknown> | undefined,
    });
    return json(saveArtifact(art));
  }

  if (a === "notebooks" && b && c === "notes") {
    const body = await safeJson(req);
    const note = saveNote({
      id: uid("note"),
      notebookId: b,
      title: body.title || "Untitled note",
      content: body.content || "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      pinned: Boolean(body.pinned),
      sourceIds: body.sourceIds || [],
      fromChatMessageId: body.fromChatMessageId,
    });
    return json(note);
  }

  if (a === "plugins" && b === "test") {
    const body = await safeJson(req);
    const { testModel } = await import("@/lib/llm");
    const pluginId = String(body.pluginId || "");
    const settings = getSettings();
    const values = {
      ...(settings.plugins[pluginId]?.values || {}),
      ...((body.values as Record<string, string>) || {}),
    };
    return json(
      await testModel({
        pluginId,
        apiKey: values.apiKey,
        baseUrl: values.baseUrl,
        model: values.model,
      }),
    );
  }

  if (a === "notebooks" && b && c === "research") {
    const body = await safeJson(req);
    if (!body?.question) return json({ error: "question required" }, 400);
    return json(await deepResearch(b, String(body.question)));
  }

  return notFound();
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  await ready();
  const [a, b, c, d] = await segs(ctx);
  const body = await safeJson(req);

  if (a === "notebooks" && b && !c) {
    const next = touchNotebook(b, body);
    return next ? json(next) : notFound();
  }
  if (a === "notebooks" && b && c === "sources" && d) {
    const src = getSource(b, d);
    if (!src) return notFound();
    const next: Source = { ...src, ...body, updatedAt: nowIso() };
    saveSource(next, getSourceText(b, d));
    return json(next);
  }
  if (a === "notebooks" && b && c === "notes" && d) {
    const existing = getNotebookBundle(b)?.notes.find((n) => n.id === d);
    if (!existing) return notFound();
    return json(saveNote({ ...existing, ...body, updatedAt: nowIso() }));
  }
  return notFound();
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  await ready();
  const path = await segs(ctx);
  if (path[0] === "settings") {
    const body = await safeJson(req);
    return json(saveSettings({ ...getSettings(), ...body }));
  }
  return notFound();
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  await ready();
  const [a, b, c, d] = await segs(ctx);
  if (a === "notebooks" && b && !c) {
    deleteNotebook(b);
    return json({ ok: true });
  }
  if (a === "notebooks" && b && c === "sources" && d) {
    deleteSource(b, d);
    return json({ ok: true });
  }
  if (a === "notebooks" && b && c === "notes" && d) {
    deleteNote(b, d);
    return json({ ok: true });
  }
  if (a === "notebooks" && b && c === "artifacts" && d) {
    deleteArtifact(b, d);
    return json({ ok: true });
  }
  return notFound();
}

async function handleChat(notebookId: string, body: Record<string, unknown>) {
  const notebook = getNotebook(notebookId);
  if (!notebook) return notFound();
  const message = String(body.message || "").trim();
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

  let session = body.sessionId ? getSession(notebookId, String(body.sessionId)) : null;
  if (!session) session = createSession(notebookId);

  const userMsg = {
    id: uid("m"),
    role: "user" as const,
    content: message,
    createdAt: nowIso(),
  };
  session.messages.push(userMsg);
  if (session.messages.length === 1) session.title = message.slice(0, 72);

  const sourceIds = (body.sourceIds as string[] | undefined) || undefined;
  const hits = retrieve(notebookId, message, sourceIds, 8);
  const sources = (await import("@/lib/store")).listSources(notebookId).filter(
    (s) => s.enabled && (!sourceIds || sourceIds.includes(s.id)),
  );

  const goal = (body.goal as ChatGoal) || notebook.goal;
  const customGoal = String(body.customGoal ?? notebook.customGoal ?? "");
  const responseLength = (body.responseLength as ResponseLength) || notebook.responseLength;

  const local = groundedAnswer({
    question: message,
    hits,
    sources,
    goal,
    customGoal,
    responseLength,
    history: session.messages,
  });

  const settings = getSettings();
  const pluginId = String(body.modelPlugin || notebook.chatModelPlugin || settings.defaultModelPlugin);
  let content = local.content;
  const citations = local.citations;

  const { complete, resolveModel, citationSystemPrompt } = await import("@/lib/llm");
  const handle = resolveModel(settings, pluginId);
  if (handle) {
    const llm = await complete({
      handle,
      system:
        citationSystemPrompt(hits) +
        (customGoal ? `\n\nUser goal: ${customGoal}` : "") +
        (goal === "learning-guide" ? "\nTeach, then ask one follow-up." : ""),
      messages: session.messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
    });
    if (llm.ok) content = llm.text;
    else {
      content =
        local.content +
        `\n\n_${handle.pluginId} did not answer (${llm.error}). This reply is from the local grounded engine._`;
    }
  }

  const assistant = {
    id: uid("m"),
    role: "assistant" as const,
    content,
    createdAt: nowIso(),
    citations,
  };
  session.messages.push(assistant);
  session.updatedAt = nowIso();
  saveSession(session);
  touchNotebook(notebookId, { lastOpenedAt: nowIso() });
  return NextResponse.json({ session, message: assistant });
}

async function safeJson(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}
