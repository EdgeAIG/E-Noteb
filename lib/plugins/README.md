# Writing a Noteb plugin

Every vendor-shaped thing in Noteb is a plugin. The product never hard-codes a key, a host, or a model id.

## Kinds

`model` · `embed` · `tts` · `stt` · `ingest` · `storage` · `vector` · `research` · `studio`

## Add one

1. Append a `PluginManifest` in `lib/plugins/manifest.ts`.
2. If it needs a network call, handle its `id` in the matching switch:
   - models → `completeWithPlugin` in `lib/rag.ts`
   - research → `webSearch` in `lib/research.ts`
   - ingest → `lib/ingest.ts`
3. Enable it in Settings and put your key in the vault. Keys stay in `data/runtime/settings.json`.

## Contract

A model plugin receives a system prompt already stuffed with retrieved passages and must cite with `[n]`. If it fails, Noteb falls back to the local grounded engine. The user should never see a blank chat because a vendor blinked.

## Local first

`local-grounded`, `local-lexical`, `browser-speech`, `local-fs`, and `ingest-core` are always on. A fresh install is a complete product.
