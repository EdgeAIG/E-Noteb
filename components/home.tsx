"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  MoreHorizontal,
  Pin,
  Plus,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import type { Notebook } from "@/lib/types";
import { api } from "@/lib/client";
import { prettyDate } from "@/lib/id";
import { Button, Input, Wordmark } from "./ui";

export function Home() {
  const router = useRouter();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);

  async function load() {
    const data = await api<{ notebooks: Notebook[] }>("/api/notebooks");
    setNotebooks(data.notebooks);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return notebooks;
    return notebooks.filter(
      (n) =>
        n.title.toLowerCase().includes(s) ||
        n.description.toLowerCase().includes(s) ||
        n.tags.some((t) => t.includes(s)),
    );
  }, [notebooks, q]);

  const recents = filtered.filter((n) => n.pinned).concat(
    filtered.filter((n) => !n.pinned).slice(0, 3),
  );

  async function create() {
    setBusy(true);
    try {
      const nb = await api<Notebook>("/api/notebooks", { method: "POST", body: "{}" });
      router.push(`/n/${nb.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Partial<Notebook>) {
    await api(`/api/notebooks/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    await load();
    setMenu(null);
  }

  async function remove(id: string) {
    await api(`/api/notebooks/${id}`, { method: "DELETE" });
    await load();
    setMenu(null);
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
        <Wordmark />
        <div className="flex items-center gap-2">
          <a
            href="/settings"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] text-muted hover:bg-ink/[.06]"
          >
            <Settings size={16} /> Settings
          </a>
          <Button tone="solid" onClick={create} disabled={busy}>
            <Plus size={16} /> Create new
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="flex flex-wrap items-end justify-between gap-4 pb-8 pt-6">
          <div>
            <h1 className="font-serif text-[36px] leading-none tracking-[-0.035em]">Notebooks</h1>
            <p className="mt-2 max-w-xl text-[13.5px] text-muted">
              Sources left, chat center, studio right. Grounded answers. Your keys.
            </p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search notebooks"
              className="pl-9"
            />
          </div>
        </section>

        {!!recents.length && !q && (
          <section className="mb-10">
            <h2 className="mb-3 text-[13px] font-semibold text-muted">Recently opened</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {recents.slice(0, 3).map((n) => (
                <NotebookCard
                  key={n.id}
                  n={n}
                  menu={menu}
                  setMenu={setMenu}
                  onOpen={() => router.push(`/n/${n.id}`)}
                  onPin={() => patch(n.id, { pinned: !n.pinned })}
                  onArchive={() => patch(n.id, { archived: true })}
                  onDelete={() => remove(n.id)}
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-[13px] font-semibold text-muted">
              {q ? `${filtered.length} matching` : "All notebooks"}
            </h2>
          </div>
          {filtered.length === 0 ? (
            <button
              onClick={create}
              className="flex w-full flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-card/60 px-8 py-20 text-center"
            >
              <span className="font-serif text-2xl">Create your first notebook</span>
              <span className="mt-2 max-w-sm text-[13px] text-muted">
                Drop in a paper, a lecture, a messy folder. Then ask it something only those pages can answer.
              </span>
            </button>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((n) => (
                <NotebookCard
                  key={n.id}
                  n={n}
                  menu={menu}
                  setMenu={setMenu}
                  onOpen={() => router.push(`/n/${n.id}`)}
                  onPin={() => patch(n.id, { pinned: !n.pinned })}
                  onArchive={() => patch(n.id, { archived: true })}
                  onDelete={() => remove(n.id)}
                />
              ))}
              <button
                onClick={create}
                className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-card/40 text-muted hover:border-accent/40 hover:text-ink"
              >
                <Plus size={22} />
                <span className="mt-2 text-[13px] font-medium">New notebook</span>
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function NotebookCard({
  n,
  menu,
  setMenu,
  onOpen,
  onPin,
  onArchive,
  onDelete,
}: {
  n: Notebook;
  menu: string | null;
  setMenu: (id: string | null) => void;
  onOpen: () => void;
  onPin: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [c1, c2, c3] = n.cover.palette;
  return (
    <article className="group relative overflow-hidden rounded-3xl border border-line bg-card shadow-lift">
      <button onClick={onOpen} className="block w-full text-left">
        <div
          className={`notebook-cover motif-${n.cover.motif} relative h-28`}
          style={{ ["--c1" as string]: c1, ["--c2" as string]: c2, ["--c3" as string]: c3 }}
        >
          <span className="absolute bottom-3 left-4 font-serif text-3xl text-white/90 drop-shadow">
            {n.emoji}
          </span>
          {n.pinned && (
            <span className="absolute right-3 top-3 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-ink">
              Pinned
            </span>
          )}
        </div>
        <div className="px-4 pb-4 pt-3">
          <h3 className="truncate font-serif text-[20px] tracking-[-0.03em]">{n.title}</h3>
          <p className="mt-1 line-clamp-2 min-h-[40px] text-[12.5px] leading-relaxed text-muted">
            {n.description || "No description yet."}
          </p>
          <p className="mt-3 text-[11.5px] text-muted">
            {n.sourceCount} source{n.sourceCount === 1 ? "" : "s"} · {prettyDate(n.updatedAt)}
          </p>
        </div>
      </button>
      <div className="absolute right-2 top-[7.4rem]">
        <button
          className="rounded-lg p-1.5 text-muted opacity-0 hover:bg-ink/[.06] group-hover:opacity-100"
          onClick={() => setMenu(menu === n.id ? null : n.id)}
        >
          <MoreHorizontal size={16} />
        </button>
        {menu === n.id && (
          <div className="absolute right-0 z-10 mt-1 w-40 overflow-hidden rounded-xl border border-line bg-card py-1 text-[13px] shadow-lift">
            <MenuItem icon={<Pin size={14} />} onClick={onPin}>
              {n.pinned ? "Unpin" : "Pin"}
            </MenuItem>
            <MenuItem icon={<Archive size={14} />} onClick={onArchive}>
              Archive
            </MenuItem>
            <MenuItem icon={<Trash2 size={14} />} onClick={onDelete} danger>
              Delete
            </MenuItem>
          </div>
        )}
      </div>
    </article>
  );
}

function MenuItem({
  children,
  icon,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-ink/[.05] ${danger ? "text-clay" : ""}`}
    >
      {icon}
      {children}
    </button>
  );
}
