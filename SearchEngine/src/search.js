const TOKEN_RE = /[0-9A-Za-z가-힣]{2,}/g;

const JOSA_SUFFIXES = [
  "에서는", "으로는", "에서도", "에게서", "으로부터", "입니다", "습니다",
  "에서", "으로", "에게", "보다", "까지", "부터", "처럼", "같이", "이나",
  "하는", "되는", "은", "는", "이", "가", "을", "를", "의", "에", "와",
  "과", "도", "로", "만",
];

function stripJosa(token) {
  if (![...token].some((ch) => ch >= "가" && ch <= "힣")) return token;
  for (const suffix of JOSA_SUFFIXES) {
    if (token.endsWith(suffix) && token.length - suffix.length >= 2) {
      return token.slice(0, -suffix.length);
    }
  }
  return token;
}

export function tokenize(text) {
  if (!text) return [];
  const tokens = [];
  const lower = String(text).toLowerCase();
  for (const match of lower.matchAll(TOKEN_RE)) {
    const raw = match[0];
    tokens.push(raw);
    const stem = stripJosa(raw);
    if (stem !== raw && stem.length >= 2) tokens.push(stem);
  }
  return tokens;
}

export function buildIndex(pages) {
  const documents = new Map();
  const inverted = new Map();
  const docLengths = new Map();

  pages.forEach((page, docId) => {
    const title = page.title || "";
    const text = page.text || "";
    const tokens = tokenize(`${title} ${title} ${text}`);
    documents.set(docId, {
      docId,
      url: page.url,
      title,
      text,
    });
    docLengths.set(docId, tokens.length);
    const tf = new Map();
    for (const tok of tokens) tf.set(tok, (tf.get(tok) || 0) + 1);
    for (const [term, count] of tf) {
      if (!inverted.has(term)) inverted.set(term, new Map());
      inverted.get(term).set(docId, count);
    }
  });

  const avgDocLen =
    docLengths.size === 0
      ? 0
      : [...docLengths.values()].reduce((a, b) => a + b, 0) / docLengths.size;

  return { documents, inverted, docLengths, avgDocLen };
}

function bm25(index, terms, docId, k1 = 1.5, b = 0.75) {
  const n = index.documents.size;
  if (!n) return 0;
  let score = 0;
  const dl = index.docLengths.get(docId) || 0;
  const avgdl = index.avgDocLen || 1;
  for (const term of terms) {
    const postings = index.inverted.get(term);
    if (!postings || !postings.has(docId)) continue;
    const df = postings.size;
    const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
    const tf = postings.get(docId);
    const denom = tf + k1 * (1 - b + (b * dl) / avgdl);
    score += (idf * (tf * (k1 + 1))) / denom;
  }
  return score;
}

function makeSnippet(text, terms, radius = 70) {
  if (!text) return "";
  const lower = text.toLowerCase();
  let pos = -1;
  let hit = "";
  for (const term of terms) {
    const i = lower.indexOf(term);
    if (i !== -1 && (pos === -1 || i < pos)) {
      pos = i;
      hit = term;
    }
  }
  if (pos === -1) {
    const snippet = text.slice(0, radius * 2).trim();
    return snippet + (text.length > snippet.length ? "…" : "");
  }
  const start = Math.max(0, pos - radius);
  const end = Math.min(text.length, pos + hit.length + radius);
  let snippet = text.slice(start, end).trim();
  if (start > 0) snippet = `…${snippet}`;
  if (end < text.length) snippet = `${snippet}…`;
  return snippet;
}

export function search(index, query, limit = 10) {
  const terms = tokenize(query);
  if (!terms.length || index.documents.size === 0) return [];
  const candidates = new Set();
  for (const term of terms) {
    const postings = index.inverted.get(term);
    if (postings) for (const docId of postings.keys()) candidates.add(docId);
  }
  const scored = [];
  for (const docId of candidates) {
    const score = bm25(index, terms, docId);
    if (score > 0) scored.push([score, docId]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  return scored.slice(0, limit).map(([score, docId]) => {
    const doc = index.documents.get(docId);
    return {
      url: doc.url,
      title: doc.title,
      snippet: makeSnippet(doc.text, terms),
      score: Math.round(score * 10000) / 10000,
    };
  });
}
