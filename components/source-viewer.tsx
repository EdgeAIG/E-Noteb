"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Source } from "@/lib/types";
import { api } from "@/lib/client";
import { Button, KindBadge, Pill } from "./ui";

export function SourceViewer({
  notebookId,
  source,
  highlight,
  onClose,
}: {
  notebookId: string;
  source: Source;
  highlight?: string;
  onClose: () => void;
}) {
  const [text, setText] = useState("Loading…");

  useEffect(() => {
    api<{ text: string }>(`/api/notebooks/${notebookId}/sources/${source.id}/text`).then((d) =>
      setText(d.text || ""),
    );
  }, [notebookId, source.id]);

  return (
    <div className="fixed inset-0 z-40 flex">
      <button className="flex-1 bg-ink/25 backdrop-blur-[2px]" onClick={onClose} aria-label="Close source" />
      <aside className="flex h-full w-full max-w-xl flex-col border-l border-line bg-card shadow-lift rise sm:max-w-2xl">
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <KindBadge kind={source.kind} />
              <span className="text-[11px] text-muted">{source.wordCount.toLocaleString()} words</span>
            </div>
            <h2 className="font-serif text-2xl tracking-[-0.03em]">{source.title}</h2>
            <p className="mt-1 text-[12.5px] text-muted">{source.origin}</p>
          </div>
          <Button size="icon" onClick={onClose} aria-label="Close">
            <X size={16} />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 border-b border-line px-5 py-3">
          {source.topics.map((t) => (
            <Pill key={t}>{t}</Pill>
          ))}
        </div>
        <div className="panel-scroll flex-1 overflow-auto px-6 py-5">
          <p className="mb-4 rounded-2xl bg-paper px-4 py-3 text-[13px] leading-relaxed text-muted">
            {source.summary}
          </p>
          <Highlighted text={text} needle={highlight} />
        </div>
      </aside>
    </div>
  );
}

function Highlighted({ text, needle }: { text: string; needle?: string }) {
  if (!needle) {
    return <pre className="whitespace-pre-wrap font-sans text-[14.5px] leading-[1.7]">{text}</pre>;
  }
  const idx = text.toLowerCase().indexOf(needle.slice(0, 80).toLowerCase());
  if (idx < 0) {
    return (
      <>
        <div className="mb-4 rounded-xl border border-warm/40 bg-warm/10 px-3 py-2 text-[13px]">
          Cited passage: “{needle}”
        </div>
        <pre className="whitespace-pre-wrap font-sans text-[14.5px] leading-[1.7]">{text}</pre>
      </>
    );
  }
  const before = text.slice(0, idx);
  const hit = text.slice(idx, idx + needle.length);
  const after = text.slice(idx + needle.length);
  return (
    <pre className="whitespace-pre-wrap font-sans text-[14.5px] leading-[1.7]">
      {before}
      <mark className="rounded bg-warm/35 px-0.5">{hit || needle}</mark>
      {after}
    </pre>
  );
}
