"use client";

import { clsx } from "clsx";
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export function cn(...a: Array<string | false | null | undefined>) {
  return clsx(a);
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-[9px] shadow-soft"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(145deg, #1a8a7a, #0b4f47)",
      }}
      aria-hidden
    >
      <span
        className="absolute rounded-[2px_7px_2px_2px] border-[1.5px] border-white/85"
        style={{ inset: size * 0.22 }}
      />
      <span className="absolute right-[22%] top-[18%] h-[5px] w-[5px] rounded-full bg-[#e7c56a]" />
    </span>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <Logo />
      <span className="leading-none">
        <span className="block font-serif text-[22px] font-semibold tracking-[-0.03em]">Noteb</span>
        {!compact && (
          <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
            self-hosted
          </span>
        )}
      </span>
    </span>
  );
}

export function Button({
  tone = "ghost",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "ghost" | "solid" | "line" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition disabled:opacity-50",
        size === "sm" && "h-8 rounded-lg px-2.5 text-[12.5px]",
        size === "md" && "h-9 rounded-xl px-3 text-[13px]",
        size === "lg" && "h-11 rounded-2xl px-4 text-[14px]",
        size === "icon" && "h-9 w-9 rounded-xl",
        tone === "ghost" && "text-ink/80 hover:bg-ink/[.06]",
        tone === "line" && "border border-line bg-card hover:bg-ink/[.03]",
        tone === "solid" && "bg-accent text-white hover:brightness-110",
        tone === "danger" && "text-clay hover:bg-clay/10",
        className,
      )}
      {...props}
    />
  );
}

export function IconBtn(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <Button size="icon" {...props} />;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-muted/80">{hint}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-10 w-full rounded-xl border border-line bg-card px-3 text-[13.5px] outline-none ring-accent/30 placeholder:text-muted/70 focus:ring-2",
        props.className,
      )}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-[120px] w-full resize-y rounded-xl border border-line bg-card px-3 py-2 text-[13.5px] outline-none ring-accent/30 placeholder:text-muted/70 focus:ring-2",
        props.className,
      )}
    />
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center">
      <button className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
      <div
        className={cn(
          "relative max-h-[88vh] w-full overflow-auto rounded-3xl border border-line bg-card p-5 shadow-lift rise",
          wide ? "max-w-3xl" : "max-w-lg",
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-serif text-2xl tracking-[-0.03em]">{title}</h2>
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <div className="mb-3 text-muted">{icon}</div>
      <h3 className="font-serif text-xl tracking-[-0.03em]">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Pill({
  children,
  active,
  onClick,
  className,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[12px]",
        active
          ? "border-accent/40 bg-accent/10 text-accent-2"
          : "border-line bg-card text-muted",
        onClick && "hover:border-accent/40",
        className,
      )}
    >
      {children}
    </Comp>
  );
}

export function SectionLabel({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="flex h-11 items-center justify-between border-b border-line px-3">
      <span className="text-[13px] font-semibold">{children}</span>
      <div className="flex items-center gap-1">{extra}</div>
    </div>
  );
}

export function Panel({ children, className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn("flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-card", className)}
      {...rest}
    >
      {children}
    </section>
  );
}

export function KindBadge({ kind }: { kind: string }) {
  const label: Record<string, string> = {
    pdf: "PDF",
    docx: "DOCX",
    markdown: "MD",
    text: "TXT",
    html: "HTML",
    url: "Web",
    youtube: "YouTube",
    audio: "Audio",
    image: "Image",
    epub: "EPUB",
    csv: "CSV",
    json: "JSON",
    note: "Note",
    paste: "Paste",
  };
  const colors: Record<string, string> = {
    pdf: "bg-[#f4d2ca] text-[#7a2e22]",
    youtube: "bg-[#f4d2ca] text-[#7a2e22]",
    url: "bg-[#dce7f5] text-[#2a4066]",
    markdown: "bg-[#d9ece6] text-[#1f4d45]",
    docx: "bg-[#dce7f5] text-[#2a4066]",
    audio: "bg-[#e7e0f4] text-[#4c3d73]",
    paste: "bg-[#f3e3c8] text-[#8a5a1b]",
    note: "bg-[#e7e0f4] text-[#4c3d73]",
  };
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide", colors[kind] || "bg-[var(--chip)] text-muted")}>
      {label[kind] || kind}
    </span>
  );
}
