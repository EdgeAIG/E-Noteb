# Noteb

A self-hosted, plugin-first research notebook at the level of Gemini Notebook (NotebookLM) — except every piece is yours.

Sources on the left. A grounded conversation in the middle. A studio on the right. Models, embeddings, speech, ingest, storage, and research tools are plugins. Bring your own key, or stay on the local grounded engine and never leave the machine.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). A seed notebook is created on first boot so you can judge the product immediately.

## What is a plugin

Anything that can be swapped without rewriting the product:

- **Models** — Noteb Grounded (local), OpenAI, Anthropic, Gemini, OpenRouter, Groq, Ollama, any OpenAI-compatible endpoint
- **Embeddings** — lexical BM25 (always on), OpenAI
- **Speech** — browser voices, OpenAI TTS, ElevenLabs
- **Ingest** — PDF, DOCX, Markdown, HTML, URL, YouTube captions, CSV, JSON, EPUB, paste, audio/image placeholders
- **Storage** — local filesystem, S3/R2/MinIO
- **Research** — Tavily, Brave Search

Keys live in `data/runtime/settings.json`. Nothing is sent anywhere unless you enable a plugin and ask it to work.

## Studio

Audio Overview (two-host, joinable via Play), Video Overview, Slide Deck, Infographic, Mind Map, Reports, Flashcards, Quiz, Data Table, Deep Research.

## Layout

The 2026 Gemini Notebook grammar, intact:

1. **Sources** — checkboxes are the attention mask. Uncheck a source and it leaves the room.
2. **Chat** — answers only from selected sources, with numbered citation chips that open the passage.
3. **Studio** — one click to Audio Overview, Video Overview, slides, mind map, reports, flashcards, quiz, infographic, data table.

Configure chat for Default, Learning Guide, or a custom role. Set response length. Deep Research plans subquestions, searches the notebook (and the web if you plug in Tavily or Brave), and saves the briefing as a source.

## Run it how you want

```bash
npm install && npm run dev     # http://localhost:3000
docker compose up --build      # same, data in a volume
```

A seed notebook ("Attention is the primitive") is created on first boot so you can judge the product immediately — including a two-host Audio Overview and a lived-in chat.

## Stack

Next.js 14 · TypeScript · Tailwind · a JSON/filesystem store in `data/runtime`. No cloud account required. No telemetry.
