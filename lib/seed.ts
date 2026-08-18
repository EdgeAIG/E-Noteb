import { createNotebook, getNotebook, listNotebooks, saveArtifact, saveNote, saveSession, touchNotebook } from "./store";
import { ingestText } from "./ingest";
import { generateArtifact } from "./studio";
import { nowIso, uid } from "./id";

const ATTENTION = `# Attention Is All You Need — working notes

The 2017 paper by Vaswani et al. proposed the Transformer, a sequence model that discards recurrence and convolution and relies entirely on attention. The claim is not modest: that attention, by itself, is a sufficient primitive for transduction.

## Why recurrence was the bottleneck

Recurrent neural networks, including LSTMs and GRUs, process tokens one after another. That sequential dependence prevents full parallelization inside a training example. Convolutional models can parallelize more easily, but they require stacked layers or wide kernels to grow the receptive field. Long-range dependencies therefore become expensive, either in wall-clock time or in path length.

The Transformer replaces that path with a constant number of sequential operations. Self-attention lets every position look at every other position in a single layer. The maximum path length between any two tokens is O(1), versus O(n) for an RNN.

## Scaled dot-product attention

Attention is described as mapping a query and a set of key-value pairs to an output. The output is a weighted sum of values, where the weight on each value is a compatibility between the query and the corresponding key.

Scaled dot-product attention is:

Attention(Q, K, V) = softmax(QKᵀ / √d_k) V

The scaling factor √d_k matters. When d_k is large, the dot products grow in magnitude, pushing the softmax into a region with vanishing gradients. Dividing by the square root keeps the variance of the dots in a friendlier range.

## Multi-head attention

A single attention head tends to average. Multi-head attention runs h learned projections in parallel, then concatenates and projects again. The paper uses h = 8, with d_k = d_v = 64, so the compute is comparable to a single full-dimensional head.

Different heads learn different things. Some heads specialize in syntactic relations, others in longer semantic links. This is not guaranteed by the math; it is an empirical regularity people have observed since.

## The rest of the architecture

The encoder is a stack of N = 6 identical layers. Each layer has multi-head self-attention and a position-wise feed-forward network, both wrapped in residual connections and layer normalization. The decoder is similar, with two additions: masked self-attention so that position i cannot peek at i+1…n, and cross-attention into the encoder output.

The feed-forward network is two linear layers with a ReLU (later work often uses GELU). Inner dimensionality is 2048. It is applied independently to each position — a 1×1 convolution, in spirit.

## Positional encoding

Because attention has no built-in order, the model adds positional encodings to the input embeddings. The original paper uses sine and cosine functions of different frequencies:

PE(pos, 2i) = sin(pos / 10000^{2i/d_model})
PE(pos, 2i+1) = cos(pos / 10000^{2i/d_model})

The authors also tried learned positional embeddings and found nearly identical results. Sinusoids were kept because they might extrapolate to sequences longer than those seen in training.

## Training and results

The base model was trained on WMT 2014 English-German, about 4.5 million sentence pairs. The big model set a new BLEU record of 28.4 on En-De, and 41.8 on En-Fr, at a fraction of the training cost of previous SOTA ensembles.

Training used Adam with a warmup learning-rate schedule: increase linearly for 4000 steps, then decay with the inverse square root of the step number. Residual dropout of 0.1 was applied. Label smoothing of 0.1 improved BLEU even as it hurt perplexity.

## What the paper did not claim

The paper did not claim that attention is biologically plausible. It did not claim that Transformers would become the default for images, audio, or agents. Those generalizations came later, and they are not free — quadratic attention is still expensive, and later work (sparse, linear, sliding-window, latent) exists because the original recipe does not scale naively to very long contexts.

The cleanest reading of the paper is narrower and stronger: for transduction, you do not need recurrence if you are willing to let every token attend, and you encode order explicitly.
`;

const HISTORY = `# A short history of sequence models, 2014–2017

This note sits beside the Transformer paper. It is not a recap. It is the neighborhood the paper walked into.

Seq2seq with RNNs (Sutskever et al., 2014) showed that a deep LSTM encoder and decoder could translate, end to end, without a phrase table. Bahdanau attention (2014/2015) then let the decoder look back at encoder states instead of trusting a single vector. That was the first time "attention" became a standard noun in NLP.

Luong et al. (2015) compared global and local attention and popularized the dot-product form. Show, Attend and Tell applied the same idea to images. WaveNet showed that dilated convolutions could also model long sequences, which is why the Transformer paper bothers to compare against ConvS2S.

ByteNet and ConvS2S (2017) were the convolutional rivals. They parallelize beautifully. Their weakness is path length: to connect distant tokens you stack layers. The Transformer authors treat this as the decisive comparison. Attention wins on path length; convolution wins on complexity per layer if you refuse to pay n².

GNMT, Google's production translator in 2016, was still a deep LSTM with attention. It worked. It was also expensive to train and awkward to parallelize. The industrial appetite for something that trained faster is part of why Attention Is All You Need landed when it did.

ELMo (2018) and BERT (2018) are aftershocks, not prequels, but they explain the paper's afterlife. Once you have a parallelizable encoder that can look both ways, unsupervised pretraining on huge corpora becomes obvious. The original paper is a translation paper. History turned it into a platform paper.
`;

const CRITIQUE = `# Against the cult of attention

A seminar memo. Not a takedown of the paper — a takedown of how the paper is now cited.

First, "attention is all you need" is a title, not a theorem. The architecture still needs embeddings, residual streams, feed-forward expansions, layer norm, positional encodings, and a great deal of data. Attention is the novel routing mechanism. It is not the only ingredient.

Second, quadratic cost is not a footnote. For a sequence of length n and head dimension d, attention is O(n²d). For documents, genomes, or audio at high sample rates, that is the whole game. Performer, Linformer, Longformer, FlashAttention, and every sliding-window variant exist because the original recipe is a luxury.

Third, the interpretability story is oversold. Attention weights are sometimes treated as explanations. They are not faithful explanations. Jain and Wallace (2019), and later work, showed that you can often redistribute attention without changing the output. Heads do specialize, but a highlighted token is not a causal account.

Fourth, order is still a problem. Sinusoidal encodings are clever. They are also a patch. Relative positions (Shaw, Raffel, RoPE) and learned biases (T5, ALiBi) keep being reinvented because "add a wave" is not a complete theory of sequence structure.

Fifth, the paper's translation wins were real and the compute story was honest. What followed — scaling laws, decoder-only LMs, instruction tuning — is a different scientific object. Citing Vaswani et al. for the behavior of a 400-billion-parameter chatbot is like citing the Wright Flyer for the economics of jet travel. Related. Not the same claim.

Read the paper. Then read what it does not say.
`;

const SLEEP = `# Sleep architecture for people who work too late

Human sleep is not a single state. It cycles through N1, N2, N3 (slow-wave), and REM, roughly every 90 minutes. Slow-wave sleep dominates the first half of the night; REM lengthens toward morning. If you cut the night short, you do not lose a little of everything equally — you amputate REM.

Adenosine builds during waking and is one reason caffeine, an adenosine antagonist, feels like clarity. It is also why a late coffee can steal the first cycle. Alcohol fragments the second half of the night: you fall faster, then wake more, and REM is suppressed.

Memory is not stored during the lecture. Hippocampal replay during slow-wave sleep, and emotional/procedural processing during REM, are the current textbook story. The details are messier than pop-science allows, but the practical claim is sturdy: a night of sleep is part of the work.

Light is the strongest zeitgeber. Morning outdoor light advances the clock; late screens delay it. Temperature, meal timing, and social schedules also pull. A "sleep hygiene" list that ignores the clock is incomplete.

This source is a briefing, not a medical document. It exists so the notebook can answer questions about cycles, caffeine, and tradeoffs without inventing physiology.
`;

export async function ensureSeed() {
  if (listNotebooks().length) return;

  const nb = createNotebook({
    title: "Attention is the primitive",
    description: "A working notebook on Transformers — the paper, the neighborhood, and the backlash.",
    emoji: "◎",
    tags: ["research", "ml", "seed"],
    cover: { palette: ["#d9ece6", "#7eb8a8", "#1f4d45"], motif: "constellation" },
  });

  const s1 = await ingestText({
    notebookId: nb.id,
    title: "Attention Is All You Need — working notes",
    text: ATTENTION,
    kind: "markdown",
    origin: "seed",
  });
  const s2 = await ingestText({
    notebookId: nb.id,
    title: "A short history of sequence models, 2014–2017",
    text: HISTORY,
    kind: "markdown",
    origin: "seed",
  });
  const s3 = await ingestText({
    notebookId: nb.id,
    title: "Against the cult of attention",
    text: CRITIQUE,
    kind: "markdown",
    origin: "seed",
  });

  saveNote({
    id: uid("note"),
    notebookId: nb.id,
    title: "What I actually need from this notebook",
    content:
      "I want to be able to explain the paper to a colleague in four minutes, defend it against the seminar memo, and not confuse 2017 translation results with 2026 chatbot folklore.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    pinned: true,
    sourceIds: [s1.id, s3.id],
  });

  const session = saveSession({
    id: uid("chat"),
    notebookId: nb.id,
    title: "First pass",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    messages: [
      {
        id: uid("m"),
        role: "user",
        content: "What problem was the Transformer actually solving in 2017?",
        createdAt: nowIso(),
      },
      {
        id: uid("m"),
        role: "assistant",
        content:
          "Wall-clock training, not a mystical new intelligence. Recurrent decoders forced sequential work inside each example, so you could not fully parallelize. Convolutional rivals parallelized but grew receptive fields by stacking layers, so distant tokens still sat far apart in computation. Self-attention makes the path between any two tokens constant, at the price of quadratic work. [1] The paper is a transduction paper with a compute story — later folklore turned it into a theory of mind. [3]",
        createdAt: nowIso(),
        citations: [
          {
            n: 1,
            sourceId: s1.id,
            sourceTitle: s1.title,
            chunkId: "seed",
            quote:
              "Recurrent neural networks, including LSTMs and GRUs, process tokens one after another. That sequential dependence prevents full parallelization inside a training example.",
            start: 0,
            end: 180,
          },
          {
            n: 3,
            sourceId: s3.id,
            sourceTitle: s3.title,
            chunkId: "seed",
            quote:
              "Citing Vaswani et al. for the behavior of a 400-billion-parameter chatbot is like citing the Wright Flyer for the economics of jet travel.",
            start: 0,
            end: 160,
          },
        ],
      },
    ],
  });
  void session;

  for (const kind of ["briefing", "mind-map", "flashcards", "audio-overview"] as const) {
    saveArtifact(generateArtifact({ notebookId: nb.id, kind }));
  }

  const sleep = createNotebook({
    title: "Sleep, actually",
    description: "Cycles, caffeine, and the part of the work that happens with the lights off.",
    emoji: "☽",
    tags: ["health", "seed"],
    cover: { palette: ["#e7e0f4", "#b5a3d6", "#4c3d73"], motif: "ripple" },
  });
  await ingestText({
    notebookId: sleep.id,
    title: "Sleep architecture for people who work too late",
    text: SLEEP,
    kind: "markdown",
    origin: "seed",
  });

  touchNotebook(nb.id, { lastOpenedAt: nowIso() });
}

export function seeded(id: string) {
  return Boolean(getNotebook(id));
}
