export const MAX_KNOWLEDGE_PROMPT_CHARS = 12_000;

export interface KnowledgeDocumentForRetrieval {
  id: string;
  title: string;
  body: string;
  enabled: boolean;
}

function tokenize(text: string): string[] {
  const stopwords = new Set(['a', 'an', 'and', 'are', 'can', 'does', 'for', 'how', 'i', 'is', 'it', 'me', 'of', 'on', 'or', 'the', 'this', 'to', 'what', 'when', 'where', 'with', 'you']);
  return (text.toLowerCase().match(/[a-z0-9\u0980-\u09ff]+/g) || []).filter((token) => !stopwords.has(token));
}

export function selectRelevantKnowledge(
  documents: KnowledgeDocumentForRetrieval[],
  query: string,
  history: string[] = [],
  maxChars = MAX_KNOWLEDGE_PROMPT_CHARS,
): KnowledgeDocumentForRetrieval[] {
  if (!Number.isInteger(maxChars) || maxChars < 1) return [];
  const queryTokens = new Set(tokenize([query, ...history].join(' ')));
  if (queryTokens.size === 0) return [];

  const ranked = documents
    .filter((document) => document.enabled)
    .map((document) => {
      const tokens = tokenize(`${document.title} ${document.body}`);
      const score = tokens.reduce((total, token) => total + (queryTokens.has(token) ? 1 : 0), 0);
      return { document, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.document.title.localeCompare(b.document.title));

  const selected: KnowledgeDocumentForRetrieval[] = [];
  let usedChars = 0;
  for (const entry of ranked) {
    const estimatedChars = entry.document.title.length + entry.document.body.length + 40;
    if (selected.length > 0 && usedChars + estimatedChars > maxChars) continue;
    selected.push(entry.document);
    usedChars += estimatedChars;
    if (usedChars >= maxChars) break;
  }
  return selected;
}

export function formatKnowledgeForPrompt(documents: KnowledgeDocumentForRetrieval[]): string {
  return documents
    .map((document) => `## ${document.title}\n${document.body}`)
    .join('\n\n');
}