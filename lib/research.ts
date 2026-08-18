import type { Source } from "./types";
import { ingestText } from "./ingest";
import { retrieve } from "./rag";
import { getSettings, listSources } from "./store";
import { pluginConfigured } from "./plugins/manifest";

export interface ResearchPlan {
  question: string;
  subquestions: string[];
  localFindings: { question: string; answer: string; sourceTitles: string[] }[];
  webFindings: { title: string; url: string; snippet: string }[];
  report: string;
  addedSource?: Source;
}

export async function deepResearch(notebookId: string, question: string): Promise<ResearchPlan> {
  const settings = getSettings();
  const sources = listSources(notebookId).filter((s) => s.enabled);
  const subquestions = plan(question);

  const localFindings = subquestions.map((q) => {
    const hits = retrieve(notebookId, q, undefined, 4);
    return {
      question: q,
      answer: hits[0] ? hits[0].chunk.text.slice(0, 320) : "Nothing local on this subquestion.",
      sourceTitles: [...new Set(hits.map((h) => h.source.title))],
    };
  });

  let webFindings: ResearchPlan["webFindings"] = [];
  const researchId = settings.defaultResearchPlugin;
  if (researchId && pluginConfigured(researchId, settings)) {
    webFindings = await webSearch(researchId, settings.plugins[researchId].values, question);
  }

  const report = renderReport(question, sources, localFindings, webFindings);
  const addedSource = await ingestText({
    notebookId,
    title: `Deep Research — ${question.slice(0, 72)}`,
    text: report,
    kind: "note",
    origin: "deep-research",
  });

  return { question, subquestions, localFindings, webFindings, report, addedSource };
}

function plan(question: string): string[] {
  return [
    question,
    `What is already established about: ${question}`,
    `Where is the disagreement around: ${question}`,
    `What would a careful next experiment or reading be for: ${question}`,
  ];
}

async function webSearch(
  pluginId: string,
  values: Record<string, string>,
  query: string,
): Promise<ResearchPlan["webFindings"]> {
  try {
    if (pluginId === "tavily") {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: values.apiKey, query, max_results: 5 }),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.results || []).map((r: { title: string; url: string; content: string }) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
      }));
    }
    if (pluginId === "brave") {
      const res = await fetch(
        "https://api.search.brave.com/res/v1/web/search?q=" + encodeURIComponent(query),
        { headers: { Accept: "application/json", "X-Subscription-Token": values.apiKey } },
      );
      if (!res.ok) return [];
      const json = await res.json();
      return (json.web?.results || []).slice(0, 5).map((r: { title: string; url: string; description: string }) => ({
        title: r.title,
        url: r.url,
        snippet: r.description,
      }));
    }
  } catch {
    return [];
  }
  return [];
}

function renderReport(
  question: string,
  sources: Source[],
  local: ResearchPlan["localFindings"],
  web: ResearchPlan["webFindings"],
): string {
  return `# Deep Research\n\n**Question.** ${question}\n\n## From this notebook\n\n${
    sources.length
      ? local
          .map(
            (f) =>
              `### ${f.question}\n\n${f.answer}\n\n*Sources: ${f.sourceTitles.join(", ") || "none"}*`,
          )
          .join("\n\n")
      : "_No local sources yet._"
  }\n\n## From the web\n\n${
    web.length
      ? web.map((w) => `- [${w.title}](${w.url}) — ${w.snippet}`).join("\n")
      : "_No research plugin configured. Add Tavily or Brave in Settings to let Deep Research leave the notebook._"
  }\n\n## Synthesis\n\nThe local sources are the ground truth of this notebook. Web results are leads, not evidence, until you ingest them as sources.\n`;
}
