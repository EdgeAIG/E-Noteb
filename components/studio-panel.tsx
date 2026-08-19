"use client";

import { useMemo, useState } from "react";
import {
  AudioLines,
  BookMarked,
  Clapperboard,
  Columns3,
  HelpCircle,
  Layers3,
  Map as MapIcon,
  Presentation,
  Sparkles,
  Table2,
  Trash2,
} from "lucide-react";
import type { ArtifactKind, Note, StudioArtifact } from "@/lib/types";
import { api } from "@/lib/client";
import { Button, Field, Input, Modal, Panel, SectionLabel, Textarea } from "./ui";
import type { Bundle } from "./workspace";
import { ArtifactView } from "./artifact";

const TILES: {
  kind: ArtifactKind;
  label: string;
  hint: string;
  icon: typeof AudioLines;
}[] = [
  { kind: "audio-overview", label: "Audio Overview", hint: "Two hosts, your sources.", icon: AudioLines },
  { kind: "video-overview", label: "Video Overview", hint: "A narrated briefing.", icon: Clapperboard },
  { kind: "slide-deck", label: "Slide Deck", hint: "Presenter-ready.", icon: Presentation },
  { kind: "infographic", label: "Infographic", hint: "One visual page.", icon: Layers3 },
  { kind: "mind-map", label: "Mind Map", hint: "Click a node to ask.", icon: Map },
  { kind: "report", label: "Reports", hint: "Briefing, FAQ, guide.", icon: BookMarked },
  { kind: "flashcards", label: "Flashcards", hint: "Flip until it sticks.", icon: Columns3 },
  { kind: "quiz", label: "Quiz", hint: "Check yourself.", icon: HelpCircle },
  { kind: "data-table", label: "Data Table", hint: "Sources, side by side.", icon: Table2 },
];

export function StudioPanel({
  bundle,
  enabledIds,
  onChange,
  onOpenSource,
  onAsk,
}: {
  bundle: Bundle;
  enabledIds: string[];
  onChange: () => void;
  onOpenSource: (s: Bundle["sources"][number]) => void;
  onAsk: (q: string) => void;
}) {
  const [open, setOpen] = useState<StudioArtifact | null>(null);
  const [gen, setGen] = useState<ArtifactKind | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [researchQ, setResearchQ] = useState("");

  const latest = useMemo(() => {
    const map = new Map<string, StudioArtifact>();
    for (const a of bundle.artifacts) if (!map.has(a.kind)) map.set(a.kind, a);
    return map;
  }, [bundle.artifacts]);

  async function generate(kind: ArtifactKind, extra?: { instructions?: string; spec?: Record<string, unknown> }) {
    setBusy(kind);
    try {
      const art = await api<StudioArtifact>(`/api/notebooks/${bundle.notebook.id}/studio`, {
        method: "POST",
        body: JSON.stringify({ kind, sourceIds: enabledIds, ...extra }),
      });
      await onChange();
      setOpen(art);
      setGen(null);
    } finally {
      setBusy(null);
    }
  }

  async function addNote(title: string, content: string) {
    await api(`/api/notebooks/${bundle.notebook.id}/notes`, {
      method: "POST",
      body: JSON.stringify({ title, content }),
    });
    setNoteOpen(false);
    onChange();
  }

  async function removeNote(n: Note) {
    await api(`/api/notebooks/${bundle.notebook.id}/notes/${n.id}`, { method: "DELETE" });
    onChange();
  }

  async function research() {
    if (!researchQ.trim()) return;
    setBusy("research");
    try {
      await api(`/api/notebooks/${bundle.notebook.id}/research`, {
        method: "POST",
        body: JSON.stringify({ question: researchQ }),
      });
      setResearchQ("");
      onChange();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel className="h-full">
      <SectionLabel extra={<Sparkles size={14} className="text-muted" />}>Studio</SectionLabel>
      <div className="panel-scroll min-h-0 flex-1 overflow-auto p-2">
        <div className="grid grid-cols-2 gap-2">
          {TILES.map((t) => {
            const existing = latest.get(t.kind);
            const Icon = t.icon;
            return (
              <button
                key={t.kind}
                disabled={!enabledIds.length || busy === t.kind}
                onClick={() => (existing ? setOpen(existing) : setGen(t.kind))}
                className="rounded-2xl border border-line bg-paper/50 p-3 text-left hover:border-accent/35 disabled:opacity-40"
              >
                <Icon size={18} className="text-accent-2" />
                <div className="mt-2 text-[12.5px] font-semibold leading-tight">{t.label}</div>
                <div className="mt-0.5 text-[11px] text-muted">{existing ? "Open" : t.hint}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl border border-line p-3">
          <p className="text-[12px] font-semibold">Deep Research</p>
          <p className="mt-0.5 text-[11px] text-muted">
            Plan, search this notebook, optionally the web, and save a cited briefing as a source.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              value={researchQ}
              onChange={(e) => setResearchQ(e.target.value)}
              placeholder="What should we investigate?"
              className="h-9 flex-1 rounded-xl border border-line bg-card px-2.5 text-[12.5px] outline-none"
            />
            <Button size="sm" tone="solid" disabled={!researchQ.trim() || !!busy} onClick={research}>
              {busy === "research" ? "…" : "Go"}
            </Button>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between px-1">
          <p className="text-[12px] font-semibold">Notes</p>
          <Button size="sm" onClick={() => setNoteOpen(true)}>
            + Note
          </Button>
        </div>
        <ul className="mt-1 space-y-1.5">
          {bundle.notes.map((n) => (
            <li key={n.id} className="group rounded-xl border border-line px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <button className="text-left" onClick={() => setOpen({
                  id: n.id,
                  notebookId: n.notebookId,
                  kind: "report",
                  title: n.title,
                  createdAt: n.createdAt,
                  updatedAt: n.updatedAt,
                  status: "ready",
                  spec: {},
                  payload: { title: n.title, sections: [{ heading: n.title, body: n.content }] },
                })}>
                  <p className="text-[13px] font-medium">{n.title}</p>
                  <p className="line-clamp-2 text-[11.5px] text-muted">{n.content}</p>
                </button>
                <button className="text-muted opacity-0 group-hover:opacity-100" onClick={() => removeNote(n)}>
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ))}
          {bundle.notes.length === 0 && (
            <p className="px-1 text-[12px] text-muted">Saved answers and your own writing live here.</p>
          )}
        </ul>
      </div>

      {open && (
        <ArtifactView
          artifact={open}
          sources={bundle.sources}
          onClose={() => setOpen(null)}
          onRegenerate={() => generate(open.kind, { instructions: String(open.spec.instructions || "") })}
          onDelete={async () => {
            await api(`/api/notebooks/${bundle.notebook.id}/artifacts/${open.id}`, { method: "DELETE" });
            setOpen(null);
            onChange();
          }}
          onAsk={(q) => {
            setOpen(null);
            onAsk(q);
          }}
          onOpenSource={onOpenSource}
        />
      )}

      <GenerateModal
        kind={gen}
        onClose={() => setGen(null)}
        busy={!!busy}
        onGenerate={(instructions, spec) => gen && generate(gen, { instructions, spec })}
      />
      <NoteModal open={noteOpen} onClose={() => setNoteOpen(false)} onSave={addNote} />
    </Panel>
  );
}

function GenerateModal({
  kind,
  onClose,
  onGenerate,
  busy,
}: {
  kind: ArtifactKind | null;
  onClose: () => void;
  onGenerate: (instructions: string, spec: Record<string, unknown>) => void;
  busy: boolean;
}) {
  const [instructions, setInstructions] = useState("");
  const [format, setFormat] = useState("deep-dive");
  if (!kind) return null;
  const tile = TILES.find((t) => t.kind === kind);
  return (
    <Modal open onClose={onClose} title={tile?.label || "Generate"}>
      <Field label="Focus (optional)" hint="Who is this for? What should it emphasize or skip?">
        <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="For a colleague who has not read the sources…" />
      </Field>
      {kind === "audio-overview" && (
        <div className="mt-3">
          <p className="mb-1.5 text-[12px] font-medium text-muted">Format</p>
          <div className="flex flex-wrap gap-1.5">
            {["deep-dive", "brief", "critique", "debate"].map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`rounded-full border px-2.5 py-1 text-[12px] capitalize ${format === f ? "border-accent bg-accent/10" : "border-line"}`}
              >
                {f.replace("-", " ")}
              </button>
            ))}
          </div>
        </div>
      )}
      {kind === "report" && (
        <p className="mt-3 text-[12px] text-muted">
          Generates a briefing. From chat you can also ask for a study guide, FAQ, timeline, or outline.
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <Button tone="solid" disabled={busy} onClick={() => onGenerate(instructions, { format })}>
          {busy ? "Writing…" : "Generate"}
        </Button>
      </div>
    </Modal>
  );
}

function NoteModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (title: string, content: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="New note">
      <div className="space-y-3">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Note">
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} />
        </Field>
        <Button
          tone="solid"
          disabled={!content.trim()}
          onClick={() => {
            onSave(title || content.slice(0, 48), content);
            setTitle("");
            setContent("");
          }}
        >
          Save note
        </Button>
      </div>
    </Modal>
  );
}
