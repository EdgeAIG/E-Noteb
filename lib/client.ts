export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = j.error || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json();
}

export function kindLabel(kind: string) {
  const map: Record<string, string> = {
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
  return map[kind] || kind;
}
