import { load } from "cheerio";
import type { Source, SourceKind } from "./types";
import { nowIso, uid } from "./id";
import { chunkText, suggestQuestions, summarizeLocal, topicsLocal } from "./rag";
import { saveChunks, saveSource } from "./store";

export async function ingestText(opts: {
  notebookId: string;
  title: string;
  text: string;
  kind?: SourceKind;
  origin?: string;
  mime?: string;
}): Promise<Source> {
  const text = normalize(opts.text);
  const title = opts.title || guessTitle(text);
  const topics = topicsLocal(text);
  const source: Source = {
    id: uid("src"),
    notebookId: opts.notebookId,
    kind: opts.kind || "text",
    title,
    origin: opts.origin || "pasted",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    enabled: true,
    summary: summarizeLocal(text, title),
    wordCount: text.split(/\s+/).filter(Boolean).length,
    charCount: text.length,
    topics,
    suggestedQuestions: suggestQuestions(title, text, topics),
    status: "ready",
    mime: opts.mime,
  };
  saveSource(source, text);
  saveChunks(opts.notebookId, source.id, chunkText(opts.notebookId, source.id, text));
  return source;
}

export async function ingestUrl(notebookId: string, url: string): Promise<Source> {
  const yt = youtubeId(url);
  if (yt) return ingestYoutube(notebookId, url, yt);

  const res = await fetch(url, {
    headers: { "User-Agent": "Noteb/0.1 (self-hosted research notebook)" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Could not fetch ${url} (${res.status})`);
  const contentType = res.headers.get("content-type") || "";
  const buf = Buffer.from(await res.arrayBuffer());

  if (contentType.includes("pdf") || url.toLowerCase().endsWith(".pdf")) {
    const text = await extractPdf(buf);
    return ingestText({ notebookId, title: url.split("/").pop() || url, text, kind: "pdf", origin: url, mime: "application/pdf" });
  }
  const html = buf.toString("utf8");
  const { title, text } = extractHtml(html, url);
  return ingestText({ notebookId, title, text, kind: "url", origin: url, mime: "text/html" });
}

export async function ingestFile(opts: {
  notebookId: string;
  filename: string;
  mime: string;
  buf: Buffer;
}): Promise<Source> {
  const { filename, mime, buf, notebookId } = opts;
  const lower = filename.toLowerCase();
  if (mime.includes("pdf") || lower.endsWith(".pdf")) {
    return ingestText({
      notebookId,
      title: filename,
      text: await extractPdf(buf),
      kind: "pdf",
      origin: filename,
      mime,
    });
  }
  if (mime.includes("word") || lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return ingestText({ notebookId, title: filename, text: value, kind: "docx", origin: filename, mime });
  }
  if (lower.endsWith(".md") || mime.includes("markdown")) {
    return ingestText({ notebookId, title: filename, text: buf.toString("utf8"), kind: "markdown", origin: filename, mime });
  }
  if (lower.endsWith(".csv") || mime.includes("csv")) {
    return ingestText({ notebookId, title: filename, text: csvToProse(buf.toString("utf8")), kind: "csv", origin: filename, mime });
  }
  if (lower.endsWith(".json") || mime.includes("json")) {
    return ingestText({
      notebookId,
      title: filename,
      text: jsonToProse(buf.toString("utf8")),
      kind: "json",
      origin: filename,
      mime,
    });
  }
  if (lower.endsWith(".epub")) {
    return ingestText({
      notebookId,
      title: filename,
      text: stripXml(buf.toString("utf8")),
      kind: "epub",
      origin: filename,
      mime,
    });
  }
  if (mime.startsWith("audio/") || /\.(mp3|wav|m4a|ogg)$/.test(lower)) {
    return ingestText({
      notebookId,
      title: filename,
      text: `Audio source “${filename}” was added. Connect a speech-to-text plugin in Settings to transcribe it automatically. For now you can paste a transcript as a second source.`,
      kind: "audio",
      origin: filename,
      mime,
    });
  }
  if (mime.startsWith("image/")) {
    return ingestText({
      notebookId,
      title: filename,
      text: `Image source “${filename}” was added. Connect a vision-capable model in Settings to describe and OCR it. You can also paste any extracted text as a note.`,
      kind: "image",
      origin: filename,
      mime,
    });
  }
  return ingestText({
    notebookId,
    title: filename,
    text: buf.toString("utf8"),
    kind: "text",
    origin: filename,
    mime,
  });
}

async function extractPdf(buf: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n\n") : text;
}

function extractHtml(html: string, url: string): { title: string; text: string } {
  const $ = load(html);
  $("script,style,nav,footer,noscript,iframe,svg,form").remove();
  const title =
    $("meta[property='og:title']").attr("content") ||
    $("title").first().text() ||
    $("h1").first().text() ||
    url;
  const article = $("article").text() || $("main").text() || $("body").text();
  return { title: cleanSpace(title), text: cleanSpace(article) };
}

async function ingestYoutube(notebookId: string, url: string, id: string): Promise<Source> {
  const caption = await fetchYoutubeCaptions(id);
  const title = caption.title || `YouTube ${id}`;
  const text =
    caption.text ||
    `No captions were available for this video (${url}). Paste a transcript, or connect a speech-to-text plugin.`;
  return ingestText({ notebookId, title, text, kind: "youtube", origin: url });
}

async function fetchYoutubeCaptions(id: string): Promise<{ title?: string; text: string }> {
  try {
    const timed = await fetch(`https://www.youtube.com/watch?v=${id}`, {
      headers: { "User-Agent": "Mozilla/5.0 Noteb" },
    });
    const html = await timed.text();
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1]?.replace(" - YouTube", "");
    const apiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
    if (!apiKey) return { title, text: "" };
    const player = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: { client: { clientName: "WEB", clientVersion: "2.20240101.00.00" } },
        videoId: id,
      }),
    });
    const json = await player.json();
    const tracks =
      json?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    const track =
      tracks.find((t: { languageCode: string }) => t.languageCode?.startsWith("en")) || tracks[0];
    if (!track?.baseUrl) return { title: json?.videoDetails?.title || title, text: "" };
    const xml = await (await fetch(track.baseUrl)).text();
    const $ = load(xml, { xmlMode: true });
    const lines: string[] = [];
    $("text").each((_, el) => {
      const t = $(el).text().replace(/\n/g, " ").trim();
      if (t) lines.push(decode(t));
    });
    return { title: json?.videoDetails?.title || title, text: lines.join(" ") };
  } catch {
    return { text: "" };
  }
}

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
  } catch {
    return null;
  }
  return null;
}

function csvToProse(csv: string): string {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return "";
  const headers = splitCsv(lines[0]);
  return lines
    .slice(1)
    .map((line) => {
      const cells = splitCsv(line);
      return headers.map((h, i) => `${h}: ${cells[i] || ""}`).join(" · ");
    })
    .join("\n");
}

function splitCsv(line: string): string[] {
  return line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
}

function jsonToProse(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function stripXml(s: string): string {
  return cleanSpace(s.replace(/<[^>]+>/g, " "));
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function cleanSpace(s: string): string {
  return s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

function normalize(s: string): string {
  return s.replace(/\u0000/g, "").trim();
}

function guessTitle(text: string): string {
  const line = text.split("\n").map((l) => l.trim()).find((l) => l.length > 8) || "Untitled source";
  return line.replace(/^#+\s*/, "").slice(0, 90);
}
