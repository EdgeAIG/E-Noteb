"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import type { AppSettings, PluginManifest, ThemeId } from "@/lib/types";
import { api } from "@/lib/client";
import { Button, Field, Input, Wordmark, cn } from "./ui";

const THEMES: { id: ThemeId; label: string }[] = [
  { id: "paper", label: "Paper" },
  { id: "ink", label: "Ink" },
  { id: "parchment", label: "Parchment" },
  { id: "gemini", label: "Gemini-adjacent" },
  { id: "high-contrast", label: "High contrast" },
];

export function SettingsApp() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);
  const [saved, setSaved] = useState(false);
  const [kind, setKind] = useState<string>("model");

  useEffect(() => {
    api<{ plugins: PluginManifest[]; settings: AppSettings }>("/api/plugins").then((d) => {
      setPlugins(d.plugins);
      setSettings(d.settings);
      document.documentElement.dataset.theme = d.settings.theme;
    });
  }, []);

  async function save(next: AppSettings) {
    setSettings(next);
    document.documentElement.dataset.theme = next.theme;
    await api("/api/settings", { method: "PUT", body: JSON.stringify(next) });
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }

  if (!settings) {
    return <div className="grid min-h-screen place-items-center text-muted">Loading settings…</div>;
  }

  const kinds = [...new Set(plugins.map((p) => p.kind))];
  const shown = plugins.filter((p) => p.kind === kind);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-5">
        <Link href="/" className="rounded-xl p-2 hover:bg-ink/[.06]">
          <ArrowLeft size={18} />
        </Link>
        <Wordmark compact />
        <span className="ml-auto text-[12px] text-muted">{saved ? "Saved" : "Bring your own everything"}</span>
      </header>
      <main className="mx-auto grid max-w-5xl gap-8 px-6 pb-24 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-1">
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Appearance</p>
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => save({ ...settings, theme: t.id })}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px]",
                settings.theme === t.id ? "bg-card shadow-soft" : "hover:bg-ink/[.04]",
              )}
            >
              {t.label}
              {settings.theme === t.id && <Check size={14} />}
            </button>
          ))}
          <p className="px-2 pb-2 pt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Plugins</p>
          {kinds.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={cn(
                "flex w-full rounded-xl px-3 py-2 text-left text-[13px] capitalize",
                kind === k ? "bg-card shadow-soft" : "hover:bg-ink/[.04]",
              )}
            >
              {k}
            </button>
          ))}
        </aside>
        <section>
          <h1 className="font-serif text-4xl tracking-[-0.035em]">Settings</h1>
          <p className="mt-2 max-w-xl text-[14px] text-muted">
            Noteb never phones home. Keys live in <span className="font-mono text-[12px]">data/runtime/settings.json</span> on this machine. Disable a plugin and it is gone from the path.
          </p>

          {kind === "model" && (
            <div className="mt-6 rounded-2xl border border-line bg-card p-4">
              <Field label="Default chat model">
                <select
                  className="h-10 w-full rounded-xl border border-line bg-card px-3 text-[13px]"
                  value={settings.defaultModelPlugin}
                  onChange={(e) => save({ ...settings, defaultModelPlugin: e.target.value })}
                >
                  {plugins
                    .filter((p) => p.kind === "model")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
          )}

          <div className="mt-5 space-y-3">
            {shown.map((p) => {
              const cfg = settings.plugins[p.id] || { enabled: false, values: {} };
              return (
                <article key={p.id} className="rounded-2xl border border-line bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[15px] font-semibold">{p.name}</h3>
                      <p className="mt-0.5 text-[12.5px] text-muted">{p.description}</p>
                    </div>
                    <label className="flex items-center gap-2 text-[12px]">
                      <input
                        type="checkbox"
                        checked={p.alwaysOn || cfg.enabled}
                        disabled={p.alwaysOn}
                        onChange={(e) =>
                          save({
                            ...settings,
                            plugins: {
                              ...settings.plugins,
                              [p.id]: { ...cfg, enabled: e.target.checked },
                            },
                          })
                        }
                      />
                      {p.alwaysOn ? "Always on" : "Enabled"}
                    </label>
                  </div>
                  {p.fields.length > 0 && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {p.fields.map((f) => (
                        <Field key={f.key} label={f.label} hint={f.help}>
                          <Input
                            type={f.type === "password" ? "password" : "text"}
                            placeholder={f.placeholder}
                            value={cfg.values[f.key] || ""}
                            onChange={(e) =>
                              save({
                                ...settings,
                                plugins: {
                                  ...settings.plugins,
                                  [p.id]: {
                                    ...cfg,
                                    values: { ...cfg.values, [f.key]: e.target.value },
                                  },
                                },
                              })
                            }
                          />
                        </Field>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div className="mt-8 rounded-2xl border border-line p-4">
            <h3 className="font-serif text-xl">You</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Display name">
                <Input
                  value={settings.displayName}
                  onChange={(e) => save({ ...settings, displayName: e.target.value })}
                />
              </Field>
              <Field label="Language">
                <Input
                  value={settings.language}
                  onChange={(e) => save({ ...settings, language: e.target.value })}
                />
              </Field>
            </div>
            <div className="mt-4">
              <Button
                tone="line"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = "noteb-settings.json";
                  a.click();
                }}
              >
                Export settings
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
