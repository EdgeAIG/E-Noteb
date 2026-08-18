"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Trash2, X } from "lucide-react";
import type { Source, StudioArtifact } from "@/lib/types";
import { Button } from "./ui";

export function ArtifactView({
  artifact,
  sources,
  onClose,
  onRegenerate,
  onDelete,
  onAsk,
  onOpenSource,
}: {
  artifact: StudioArtifact;
  sources: Source[];
  onClose: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
  onAsk: (q: string) => void;
  onOpenSource: (s: Source) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3">
      <button className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-lift rise">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <h2 className="min-w-0 flex-1 truncate font-serif text-xl tracking-[-0.03em]">{artifact.title}</h2>
          <Button size="sm" onClick={onRegenerate}>
            <RotateCcw size={13} /> Regenerate
          </Button>
          <Button size="sm" tone="danger" onClick={onDelete}>
            <Trash2 size={13} />
          </Button>
          <Button size="icon" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>
        <div className="panel-scroll min-h-0 flex-1 overflow-auto p-5">
          <Body artifact={artifact} sources={sources} onAsk={onAsk} onOpenSource={onOpenSource} />
        </div>
      </div>
    </div>
  );
}

function Body({
  artifact,
  sources,
  onAsk,
  onOpenSource,
}: {
  artifact: StudioArtifact;
  sources: Source[];
  onAsk: (q: string) => void;
  onOpenSource: (s: Source) => void;
}) {
  const p = artifact.payload;
  switch (artifact.kind) {
    case "audio-overview":
      return <AudioBody payload={p} />;
    case "video-overview":
      return <VideoBody payload={p} />;
    case "mind-map":
      return <MindBody payload={p} onAsk={onAsk} />;
    case "flashcards":
      return <CardsBody payload={p} />;
    case "quiz":
      return <QuizBody payload={p} />;
    case "data-table":
      return <TableBody payload={p} />;
    case "slide-deck":
      return <SlidesBody payload={p} />;
    case "infographic":
      return <InfoBody payload={p} />;
    default:
      return <ReportBody payload={p} sources={sources} onOpenSource={onOpenSource} />;
  }
}

function AudioBody({ payload }: { payload: Record<string, unknown> }) {
  const turns = (payload.turns as { speaker: string; text: string }[]) || [];
  const hosts = (payload.hosts as string[]) || ["Avery", "Jules"];
  const [i, setI] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [join, setJoin] = useState("");
  const [joined, setJoined] = useState<{ speaker: string; text: string }[]>([]);
  const idx = useRef(-1);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  function speakFrom(start: number) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    idx.current = start;
    setI(start);
    setPlaying(true);
    const voices = window.speechSynthesis.getVoices();
    const vA = voices.find((v) => /female|samantha|victoria|zira/i.test(v.name)) || voices[0];
    const vB = voices.find((v) => v !== vA && /male|daniel|david|alex/i.test(v.name)) || voices[1] || voices[0];

    const next = () => {
      const n = idx.current + 1;
      if (n >= turns.length) {
        setPlaying(false);
        return;
      }
      idx.current = n;
      setI(n);
      const u = new SpeechSynthesisUtterance(turns[n].text);
      u.voice = turns[n].speaker === hosts[0] ? vA : vB;
      u.rate = 1.02;
      u.pitch = turns[n].speaker === hosts[0] ? 1.05 : 0.92;
      u.onend = next;
      window.speechSynthesis.speak(u);
    };
    idx.current = start - 1;
    next();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-paper px-4 py-3">
        <Button tone="solid" onClick={() => (playing ? (window.speechSynthesis.cancel(), setPlaying(false)) : speakFrom(i < 0 ? 0 : i))}>
          {playing ? <Pause size={16} /> : <Play size={16} />} {playing ? "Pause" : "Play overview"}
        </Button>
        <span className="text-[12.5px] text-muted">
          {hosts.join(" & ")} · {(payload.format as string) || "deep-dive"} · {String(payload.durationEstimate || "")}
        </span>
      </div>
      <ol className="space-y-3">
        {turns.map((t, n) => (
          <li
            key={n}
            className={`rounded-2xl px-4 py-3 ${n === i ? "bg-accent/10" : "bg-paper/60"}`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{t.speaker}</p>
            <p className="mt-1 text-[14.5px] leading-relaxed">{t.text}</p>
          </li>
        ))}
        {joined.map((t, n) => (
          <li key={`j${n}`} className="rounded-2xl bg-accent/10 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{t.speaker}</p>
            <p className="mt-1 text-[14.5px] leading-relaxed">{t.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function VideoBody({ payload }: { payload: Record<string, unknown> }) {
  const scenes = (payload.scenes as { kind: string; heading: string; body: string }[]) || [];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % Math.max(scenes.length, 1)), 4200);
    return () => clearInterval(t);
  }, [scenes.length]);
  const s = scenes[i];
  if (!s) return null;
  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-3xl bg-accent-2 text-white">
        <div className="absolute inset-0 opacity-40 notebook-cover motif-ripple" style={{ ["--c1" as string]: "#1f4d45", ["--c2" as string]: "#7eb8a8", ["--c3" as string]: "#0b4f47" }} />
        <div className="relative flex h-full flex-col justify-end p-8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">{s.kind}</p>
          <h3 className="font-serif text-4xl tracking-[-0.03em]">{s.heading}</h3>
          <p className="mt-2 max-w-xl text-[15px] text-white/85">{s.body}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-1">
        {scenes.map((_, n) => (
          <button key={n} onClick={() => setI(n)} className={`h-1.5 flex-1 rounded-full ${n === i ? "bg-accent" : "bg-line"}`} />
        ))}
      </div>
    </div>
  );
}

function MindBody({ payload, onAsk }: { payload: Record<string, unknown>; onAsk: (q: string) => void }) {
  const root = payload.root as Node;
  if (!root) return null;
  return (
    <div className="overflow-auto">
      <div className="min-w-[640px] pb-6">
        <MindNode node={root} depth={0} onAsk={onAsk} />
      </div>
    </div>
  );
}

type Node = { id: string; label: string; children?: Node[] };

function MindNode({ node, depth, onAsk }: { node: Node; depth: number; onAsk: (q: string) => void }) {
  return (
    <div className={depth === 0 ? "" : "ml-8 border-l border-line pl-4"}>
      <button
        onClick={() => onAsk(`Tell me more about: ${node.label}`)}
        className={`my-1.5 rounded-2xl border px-3 py-2 text-left text-[13.5px] hover:border-accent ${
          depth === 0 ? "border-accent bg-accent/10 font-serif text-lg" : "border-line bg-paper"
        }`}
      >
        {node.label}
      </button>
      <div>
        {node.children?.map((c) => (
          <MindNode key={c.id} node={c} depth={depth + 1} onAsk={onAsk} />
        ))}
      </div>
    </div>
  );
}

function CardsBody({ payload }: { payload: Record<string, unknown> }) {
  const cards = (payload.cards as { id: string; front: string; back: string }[]) || [];
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const c = cards[i];
  if (!c) return <p>No cards.</p>;
  return (
    <div className="mx-auto max-w-lg">
      <button
        onClick={() => setFlip((f) => !f)}
        className="flex min-h-[220px] w-full items-center justify-center rounded-3xl border border-line bg-paper px-8 py-10 text-center font-serif text-2xl leading-snug tracking-[-0.03em]"
      >
        {flip ? c.back : c.front}
      </button>
      <div className="mt-4 flex items-center justify-between text-[13px]">
        <Button onClick={() => (setI((x) => Math.max(0, x - 1)), setFlip(false))}>Back</Button>
        <span className="text-muted">
          {i + 1} / {cards.length} · click card to flip
        </span>
        <Button onClick={() => (setI((x) => Math.min(cards.length - 1, x + 1)), setFlip(false))}>Next</Button>
      </div>
    </div>
  );
}

function QuizBody({ payload }: { payload: Record<string, unknown> }) {
  const questions = (payload.questions as { id: string; prompt: string; options: string[]; answer: string; explain: string }[]) || [];
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const score = useMemo(
    () => questions.filter((q) => answers[q.id] === q.answer).length,
    [answers, questions],
  );
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {questions.map((q, n) => (
        <div key={q.id} className="rounded-2xl border border-line p-4">
          <p className="text-[14px] font-medium">
            {n + 1}. {q.prompt}
          </p>
          <div className="mt-2 grid gap-1.5">
            {q.options.map((o) => {
              const picked = answers[q.id] === o;
              const correct = done && o === q.answer;
              const wrong = done && picked && o !== q.answer;
              return (
                <button
                  key={o}
                  onClick={() => !done && setAnswers((a) => ({ ...a, [q.id]: o }))}
                  className={`rounded-xl border px-3 py-2 text-left text-[13px] ${
                    correct ? "border-accent bg-accent/10" : wrong ? "border-clay bg-clay/10" : picked ? "border-accent" : "border-line"
                  }`}
                >
                  {o}
                </button>
              );
            })}
          </div>
          {done && <p className="mt-2 text-[12.5px] text-muted">{q.explain}</p>}
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Button tone="solid" onClick={() => setDone(true)}>
          Check answers
        </Button>
        {done && (
          <p className="font-serif text-xl">
            {score} / {questions.length}
          </p>
        )}
      </div>
    </div>
  );
}

function TableBody({ payload }: { payload: Record<string, unknown> }) {
  const columns = (payload.columns as string[]) || [];
  const rows = (payload.rows as Record<string, unknown>[]) || [];
  return (
    <div className="overflow-auto rounded-2xl border border-line">
      <table className="w-full text-left text-[13px]">
        <thead className="bg-paper text-[11px] uppercase tracking-wide text-muted">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {columns.map((c) => (
                <td key={c} className="px-3 py-2 align-top">
                  {String(r[c] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SlidesBody({ payload }: { payload: Record<string, unknown> }) {
  const slides = (payload.slides as { heading: string; body: string; kind: string }[]) || [];
  const [i, setI] = useState(0);
  const s = slides[i];
  if (!s) return null;
  return (
    <div>
      <div className="flex aspect-[16/9] flex-col justify-end rounded-3xl bg-accent-2 p-10 text-white">
        <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">{s.kind}</p>
        <h3 className="font-serif text-4xl tracking-[-0.03em]">{s.heading}</h3>
        <p className="mt-3 max-w-2xl text-[16px] text-white/85">{s.body}</p>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Button onClick={() => setI((x) => Math.max(0, x - 1))}>Previous</Button>
        <div className="flex gap-1">
          {slides.map((_, n) => (
            <button key={n} onClick={() => setI(n)} className={`h-2 w-2 rounded-full ${n === i ? "bg-accent" : "bg-line"}`} />
          ))}
        </div>
        <Button onClick={() => setI((x) => Math.min(slides.length - 1, x + 1))}>Next</Button>
      </div>
    </div>
  );
}

function InfoBody({ payload }: { payload: Record<string, unknown> }) {
  const stats = (payload.stats as { label: string; value: string }[]) || [];
  const beats = (payload.beats as { n: string; text: string }[]) || [];
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-paper">
      <div className="bg-accent-2 px-8 py-8 text-white">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">{String(payload.kicker || "")}</p>
        <h3 className="font-serif text-4xl tracking-[-0.03em]">{String(payload.headline || "")}</h3>
        <div className="mt-6 flex gap-8">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="font-serif text-3xl">{s.value}</div>
              <div className="text-[11px] uppercase tracking-wide text-white/60">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3 p-6 sm:grid-cols-2">
        {beats.map((b) => (
          <div key={b.n} className="rounded-2xl bg-card px-4 py-3">
            <div className="font-mono text-[11px] text-accent">{b.n}</div>
            <p className="mt-1 text-[13.5px] leading-relaxed">{b.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportBody({
  payload,
  sources,
  onOpenSource,
}: {
  payload: Record<string, unknown>;
  sources: Source[];
  onOpenSource: (s: Source) => void;
}) {
  const sections = (payload.sections as { heading: string; body: string }[]) || [];
  return (
    <article className="mx-auto max-w-2xl">
      {sections.map((s) => (
        <section key={s.heading} className="mb-6">
          <h3 className="font-serif text-2xl tracking-[-0.03em]">{s.heading}</h3>
          <p className="mt-2 whitespace-pre-wrap text-[14.5px] leading-[1.7]">{s.body}</p>
        </section>
      ))}
      <div className="mt-8 border-t border-line pt-4">
        <p className="text-[12px] font-semibold text-muted">Sources in play</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {sources.filter((s) => s.enabled).map((s) => (
            <button key={s.id} onClick={() => onOpenSource(s)} className="rounded-full border border-line px-3 py-1 text-[12px]">
              {s.title}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}
