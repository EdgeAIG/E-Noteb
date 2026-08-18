"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  FilePlus2,
  Loader2,
  MoreHorizontal,
  PanelLeftClose,
  PanelRightClose,
  Pencil,
  Plus,
  Search,
  Settings2,
  Share2,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import type {
  ChatGoal,
  ChatSession,
  Citation,
  Notebook,
  Note,
  ResponseLength,
  Source,
  StudioArtifact,
} from "@/lib/types";
import { api } from "@/lib/client";
import { Button, Empty, Field, Input, KindBadge, Modal, Panel, Pill, SectionLabel, Textarea, cn } from "./ui";
import { StudioPanel } from "./studio-panel";
import { SourceViewer } from "./source-viewer";

export interface Bundle {
  notebook: Notebook;
  sources: Source[];
  notes: Note[];
  artifacts: StudioArtifact[];
  sessions: ChatSession[];
}

export function Workspace({ id }: { id: string }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(true);
  const [right, setRight] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [viewSource, setViewSource] = useState<{ source: Source; quote?: string } | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [pendingAsk, setPendingAsk] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await api<Bundle>(`/api/notebooks/${id}/bundle`);
    setBundle(data);
    document.documentElement.dataset.theme = document.documentElement.dataset.theme || "paper";
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function patchNotebook(body: Partial<Notebook>) {
    if (!bundle) return;
    const next = await api<Notebook>(`/api/notebooks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    setBundle({ ...bundle, notebook: next });
  }

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Empty icon={<BookOpen />} title="Couldn't open this notebook" body={error} action={<Link href="/">Back home</Link>} />
      </div>
    );
  }
  if (!bundle) {
    return (
      <div className="grid min-h-screen place-items-center text-muted">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const { notebook, sources } = bundle;
  const enabledIds = sources.filter((s) => s.enabled).map((s) => s.id);

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-3">
        <Link href="/" className="rounded-xl p-2 text-muted hover:bg-ink/[.06]" aria-label="Home">
          <ArrowLeft size={18} />
        </Link>
        <span className="text-lg">{notebook.emoji}</span>
        {editingTitle ? (
          <input
            autoFocus
            defaultValue={notebook.title}
            className="h-9 flex-1 rounded-lg bg-transparent font-serif text-lg tracking-[-0.03em] outline-none"
            onBlur={(e) => {
              setEditingTitle(false);
              if (e.target.value.trim() && e.target.value !== notebook.title) {
                patchNotebook({ title: e.target.value.trim() });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        ) : (
          <button
            className="flex min-w-0 items-center gap-1.5 font-serif text-lg tracking-[-0.03em]"
            onClick={() => setEditingTitle(true)}
          >
            <span className="truncate">{notebook.title}</span>
            <Pencil size={13} className="text-muted" />
          </button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" onClick={() => setLeft((v) => !v)} title="Sources">
            <PanelLeftClose size={16} />
          </Button>
          <Button size="sm" onClick={() => setRight((v) => !v)} title="Studio">
            <PanelRightClose size={16} />
          </Button>
          <Button
            size="sm"
            tone="line"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              setToast("Link copied — anyone with this URL on your host can open it.");
              setTimeout(() => setToast(null), 2400);
            }}
          >
            <Share2 size={14} /> Share
          </Button>
          <Link href="/settings" className="rounded-xl p-2 text-muted hover:bg-ink/[.06]">
            <Settings2 size={16} />
          </Link>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-2 p-2" style={{
        gridTemplateColumns: `${left ? "minmax(240px,280px)" : "0fr"} minmax(0,1fr) ${right ? "minmax(260px,320px)" : "0fr"}`,
      }}>
        <div className={cn("min-h-0 min-w-0", !left && "overflow-hidden opacity-0")}>
          <SourcesPanel
            notebookId={id}
            sources={sources}
            onChange={load}
            onAdd={() => setAddOpen(true)}
            onOpen={(s) => setViewSource({ source: s })}
          />
        </div>
        <ChatPanel
          notebook={notebook}
          sources={sources}
          enabledIds={enabledIds}
          session={bundle.sessions[0] || null}
          pendingAsk={pendingAsk}
          onPendingConsumed={() => setPendingAsk(null)}
          onCite={(c) => {
            const s = sources.find((x) => x.id === c.sourceId);
            if (s) setViewSource({ source: s, quote: c.quote });
          }}
          onConfig={() => setConfigOpen(true)}
          onRefresh={load}
          onAdd={() => setAddOpen(true)}
        />
        <div className={cn("min-h-0 min-w-0", !right && "overflow-hidden opacity-0")}>
          <StudioPanel
            bundle={bundle}
            enabledIds={enabledIds}
            onChange={load}
            onOpenSource={(s) => setViewSource({ source: s })}
            onAsk={(q) => setPendingAsk(q)}
          />
        </div>
      </div>

      <AddSourceModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        notebookId={id}
        onAdded={async () => {
          setAddOpen(false);
          await load();
        }}
      />
      <ConfigureChat
        open={configOpen}
        notebook={notebook}
        onClose={() => setConfigOpen(false)}
        onSave={async (patch) => {
          await patchNotebook(patch);
          setConfigOpen(false);
        }}
      />
      {toast && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[12.5px] text-[var(--paper)] shadow-lift">
          {toast}
        </div>
      )}
      {viewSource && (
        <SourceViewer
          notebookId={id}
          source={viewSource.source}
          highlight={viewSource.quote}
          onClose={() => setViewSource(null)}
        />
      )}
    </div>
  );
}

function SourcesPanel({
  notebookId,
  sources,
  onChange,
  onAdd,
  onOpen,
}: {
  notebookId: string;
  sources: Source[];
  onChange: () => void;
  onAdd: () => void;
  onOpen: (s: Source) => void;
}) {
  const [q, setQ] = useState("");
  const [drag, setDrag] = useState(false);
  const visible = sources.filter((s) => s.title.toLowerCase().includes(q.toLowerCase()));
  const allOn = sources.length > 0 && sources.every((s) => s.enabled);

  async function uploadFile(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    await api(`/api/notebooks/${notebookId}/sources`, { method: "POST", body: fd });
    onChange();
  }

  async function toggle(s: Source, enabled: boolean) {
    await api(`/api/notebooks/${notebookId}/sources/${s.id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    });
    onChange();
  }
  async function toggleAll(enabled: boolean) {
    await Promise.all(sources.map((s) => toggle(s, enabled)));
  }
  async function remove(s: Source) {
    await api(`/api/notebooks/${notebookId}/sources/${s.id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <Panel
      className="relative h-full"
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setDrag(false);
        const file = e.dataTransfer.files?.[0];
        if (file) await uploadFile(file);
      }}
    >
      {drag && (
        <div className="absolute inset-0 z-10 grid place-items-center rounded-2xl border-2 border-dashed border-accent bg-accent/10 text-[13px] font-medium">
          Drop to add as a source
        </div>
      )}
      <SectionLabel
        extra={
          <Button size="sm" tone="solid" onClick={onAdd}>
            <Plus size={14} /> Add
          </Button>
        }
      >
        Sources
      </SectionLabel>
      <div className="border-b border-line px-3 py-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search sources"
            className="h-8 w-full rounded-lg bg-paper/80 pl-8 pr-2 text-[12.5px] outline-none"
          />
        </div>
        {sources.length > 0 && (
          <label className="mt-2 flex items-center gap-2 text-[12px] text-muted">
            <input type="checkbox" checked={allOn} onChange={(e) => toggleAll(e.target.checked)} />
            Select all · {sources.filter((s) => s.enabled).length} in use
          </label>
        )}
      </div>
      <div className="panel-scroll flex-1 overflow-auto">
        {visible.length === 0 ? (
          <Empty
            icon={<FilePlus2 />}
            title="Saved sources will appear here"
            body="Upload a PDF, paste notes, or drop a URL. Chat stays silent until something is on the table."
            action={
              <Button tone="solid" size="sm" onClick={onAdd}>
                Add sources
              </Button>
            }
          />
        ) : (
          <ul className="p-1.5">
            {visible.map((s) => (
              <li key={s.id} className="group flex items-start gap-2 rounded-xl px-2 py-2 hover:bg-ink/[.04]">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={s.enabled}
                  onChange={(e) => toggle(s, e.target.checked)}
                />
                <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(s)}>
                  <div className="flex items-center gap-2">
                    <KindBadge kind={s.kind} />
                    <span className="truncate text-[13px] font-medium">{s.title}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-muted">{s.summary}</p>
                </button>
                <button
                  className="rounded-md p-1 text-muted opacity-0 hover:bg-clay/10 hover:text-clay group-hover:opacity-100"
                  onClick={() => remove(s)}
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function ChatPanel({
  notebook,
  sources,
  enabledIds,
  session,
  pendingAsk,
  onPendingConsumed,
  onCite,
  onConfig,
  onRefresh,
  onAdd,
}: {
  notebook: Notebook;
  sources: Source[];
  enabledIds: string[];
  session: ChatSession | null;
  pendingAsk: string | null;
  onPendingConsumed: () => void;
  onCite: (c: Citation) => void;
  onConfig: () => void;
  onRefresh: () => void;
  onAdd: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<ChatSession | null>(session);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => setLocal(session), [session]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [local?.messages.length, busy]);
  useEffect(() => {
    if (pendingAsk) {
      send(pendingAsk);
      onPendingConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAsk]);

  const suggestions = useMemo(() => {
    const qs = sources.filter((s) => s.enabled).flatMap((s) => s.suggestedQuestions);
    return [...new Set(qs)].slice(0, 4);
  }, [sources]);

  async function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed || busy) return;
    setText("");
    setBusy(true);
    setLocal((prev) => {
      const base = prev || {
        id: "tmp",
        notebookId: notebook.id,
        title: "Chat",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
      };
      return {
        ...base,
        messages: [
          ...base.messages,
          { id: "tmp-user", role: "user", content: trimmed, createdAt: new Date().toISOString() },
        ],
      };
    });
    try {
      const res = await api<{ session: ChatSession }>(`/api/notebooks/${notebook.id}/chat`, {
        method: "POST",
        body: JSON.stringify({
          message: trimmed,
          sessionId: local?.id,
          sourceIds: enabledIds,
          goal: notebook.goal,
          customGoal: notebook.customGoal,
          responseLength: notebook.responseLength,
        }),
      });
      setLocal(res.session);
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveNote(content: string) {
    await api(`/api/notebooks/${notebook.id}/notes`, {
      method: "POST",
      body: JSON.stringify({ title: content.slice(0, 48), content }),
    });
    onRefresh();
  }

  const empty = !local?.messages.length;

  return (
    <Panel className="h-full">
      <SectionLabel
        extra={
          <>
            <Button
              size="sm"
              onClick={() => {
                setLocal({
                  id: "tmp",
                  notebookId: notebook.id,
                  title: "New chat",
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  messages: [],
                });
              }}
            >
              New
            </Button>
            <Button size="sm" onClick={onConfig}>
              <SlidersHorizontal size={14} /> Configure
            </Button>
          </>
        }
      >
        Chat
      </SectionLabel>
      <div ref={scroller} className="panel-scroll min-h-0 flex-1 overflow-auto">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 font-serif text-2xl text-accent-2">
              {notebook.emoji || "◎"}
            </div>
            <h2 className="font-serif text-[28px] tracking-[-0.035em]">{notebook.title}</h2>
            <p className="mt-1 text-[13px] text-muted">
              {enabledIds.length} source{enabledIds.length === 1 ? "" : "s"}
            </p>
            {sources.length === 0 && (
              <Button className="mt-4" tone="solid" onClick={onAdd}>
                Add a source to begin
              </Button>
            )}
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-5 px-5 py-6">
            {local!.messages.map((m) => (
              <article key={m.id} className={cn("rise", m.role === "user" ? "text-right" : "")}>
                {m.role === "user" ? (
                  <div className="inline-block max-w-[92%] rounded-2xl bg-ink/[.06] px-3.5 py-2 text-left text-[14px] leading-relaxed">
                    {m.content}
                  </div>
                ) : (
                  <div>
                    <RichAnswer text={m.content} citations={m.citations || []} onCite={onCite} />
                    <div className="mt-2 flex gap-1">
                      <Button size="sm" onClick={() => saveNote(m.content)}>
                        Save to note
                      </Button>
                    </div>
                  </div>
                )}
              </article>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-[13px] text-muted">
                <span className="inline-flex gap-1">
                  <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                  <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:120ms]" />
                  <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:240ms]" />
                </span>
                Reading your sources…
              </div>
            )}
          </div>
        )}
      </div>
      <div className="border-t border-line p-3">
        {empty && suggestions.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <Pill key={s} onClick={() => send(s)}>
                {s}
              </Pill>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
          className="flex items-end gap-2 rounded-2xl border border-line bg-paper/70 p-2"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            rows={1}
            placeholder={sources.length ? "Start typing…" : "Add a source, then ask"}
            className="max-h-36 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[14px] outline-none"
          />
          <Button tone="solid" disabled={!text.trim() || busy} className="shrink-0">
            {busy ? <Loader2 size={16} className="animate-spin" /> : "Ask"}
          </Button>
        </form>
        <p className="mt-1.5 text-center text-[10.5px] text-muted">
          Answers are grounded in selected sources. Uncheck a source to take it out of the room.
        </p>
      </div>
    </Panel>
  );
}

export function RichAnswer({
  text,
  citations,
  onCite,
}: {
  text: string;
  citations: Citation[];
  onCite: (c: Citation) => void;
}) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <div className="text-[14.5px] leading-[1.65]">
      {parts.map((p, i) => {
        const m = p.match(/^\[(\d+)\]$/);
        if (!m) {
          const bits = p.split(/(\*\*[^*]+\*\*)/g);
          return (
            <span key={i} className="whitespace-pre-wrap">
              {bits.map((b, j) =>
                b.startsWith("**") && b.endsWith("**") ? (
                  <strong key={j}>{b.slice(2, -2)}</strong>
                ) : (
                  <span key={j}>{b}</span>
                ),
              )}
            </span>
          );
        }
        const cite = citations.find((c) => c.n === Number(m[1]));
        if (!cite) return <span key={i}>{p}</span>;
        return (
          <button
            key={i}
            className="cite-chip"
            title={cite.sourceTitle}
            onClick={() => onCite(cite)}
          >
            {cite.n}
          </button>
        );
      })}
    </div>
  );
}

function AddSourceModal({
  open,
  onClose,
  notebookId,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  notebookId: string;
  onAdded: () => void;
}) {
  const [tab, setTab] = useState<"upload" | "paste" | "url" | "youtube">("upload");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      onAdded();
      setTitle("");
      setText("");
      setUrl("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add sources" wide>
      <div className="mb-4 flex gap-1 rounded-xl bg-paper p-1">
        {(["upload", "paste", "url", "youtube"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-[13px] capitalize",
              tab === t ? "bg-card shadow-soft" : "text-muted",
            )}
          >
            {t === "url" ? "Website" : t === "youtube" ? "YouTube" : t}
          </button>
        ))}
      </div>
      {tab === "upload" && (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
          <FilePlus2 className="mb-2 text-muted" />
          <span className="font-medium">Drop a file, or click to browse</span>
          <span className="mt-1 text-[12px] text-muted">PDF, DOCX, MD, TXT, CSV, JSON, EPUB, audio, images</span>
          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const fd = new FormData();
              fd.append("file", file);
              run(async () => {
                await api(`/api/notebooks/${notebookId}/sources`, { method: "POST", body: fd });
              });
            }}
          />
        </label>
      )}
      {tab === "paste" && (
        <div className="space-y-3">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lecture notes" />
          </Field>
          <Field label="Text">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste anything…" />
          </Field>
          <Button tone="solid" disabled={!text.trim() || busy} onClick={() => run(async () => {
            await api(`/api/notebooks/${notebookId}/sources`, {
              method: "POST",
              body: JSON.stringify({ title, text, kind: "paste" }),
            });
          })}>
            {busy ? "Adding…" : "Add pasted source"}
          </Button>
        </div>
      )}
      {tab === "url" && (
        <div className="space-y-3">
          <Field label="URL" hint="Public web pages and YouTube videos with captions.">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </Field>
          <Button tone="solid" disabled={!url.trim() || busy} onClick={() => run(async () => {
            await api(`/api/notebooks/${notebookId}/sources`, {
              method: "POST",
              body: JSON.stringify({ url }),
            });
          })}>
            {busy ? "Fetching…" : "Add link"}
          </Button>
        </div>
      )}
      {err && <p className="mt-3 text-[13px] text-clay">{err}</p>}
    </Modal>
  );
}

function ConfigureChat({
  open,
  notebook,
  onClose,
  onSave,
}: {
  open: boolean;
  notebook: Notebook;
  onClose: () => void;
  onSave: (p: Partial<Notebook>) => void;
}) {
  const [goal, setGoal] = useState<ChatGoal>(notebook.goal);
  const [custom, setCustom] = useState(notebook.customGoal);
  const [len, setLen] = useState<ResponseLength>(notebook.responseLength);
  useEffect(() => {
    setGoal(notebook.goal);
    setCustom(notebook.customGoal);
    setLen(notebook.responseLength);
  }, [notebook, open]);

  return (
    <Modal open={open} onClose={onClose} title="Configure chat">
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-[12px] font-medium text-muted">Conversational goal</p>
          <div className="grid gap-2">
            {(
              [
                ["default", "Default", "A precise research partner. Answers only from selected sources."],
                ["learning-guide", "Learning guide", "Teaches, then asks a follow-up that checks you."],
                ["custom", "Custom", "Write the role, audience, and what 'good' looks like."],
              ] as const
            ).map(([id, label, help]) => (
              <button
                key={id}
                onClick={() => setGoal(id)}
                className={cn(
                  "rounded-2xl border px-3 py-2.5 text-left",
                  goal === id ? "border-accent bg-accent/5" : "border-line",
                )}
              >
                <div className="flex items-center justify-between text-[13px] font-semibold">
                  {label}
                  {goal === id && <Check size={14} className="text-accent" />}
                </div>
                <p className="mt-0.5 text-[12px] text-muted">{help}</p>
              </button>
            ))}
          </div>
          {goal === "custom" && (
            <Textarea className="mt-2" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="You are a TA. Quiz me. Don't give the answer first." />
          )}
        </div>
        <div>
          <p className="mb-2 text-[12px] font-medium text-muted">Response length</p>
          <div className="flex gap-2">
            {(["default", "longer", "shorter"] as const).map((id) => (
              <Pill key={id} active={len === id} onClick={() => setLen(id)} className="capitalize">
                {id}
              </Pill>
            ))}
          </div>
        </div>
        <div className="flex justify-end">
          <Button tone="solid" onClick={() => onSave({ goal, customGoal: custom, responseLength: len })}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}


