import "./styles.css";
import seedCorpus from "./corpus.json";
import { buildIndex, search, tokenize } from "./search.js";

const STORAGE_KEY = "seorab.corpus.v1";

const $ = (id) => document.getElementById(id);

const searchForm = $("search-form");
const addForm = $("add-form");
const qInput = $("q");
const resultsSection = $("results-section");
const resultsEl = $("results");
const emptyEl = $("empty");
const resultLabel = $("result-label");
const statsEl = $("stats");
const addStatus = $("add-status");
const resetBtn = $("reset-btn");

let pages = loadPages();
let index = buildIndex(pages);

function loadPages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    /* ignore */
  }
  return structuredClone(seedCorpus);
}

function savePages() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
}

function rebuild() {
  index = buildIndex(pages);
  refreshStats();
}

function refreshStats() {
  const terms = index.inverted.size;
  statsEl.textContent = `색인 ${pages.length}문서 · 단어 ${terms}개`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function highlight(snippet, query) {
  const safe = escapeHtml(snippet);
  const terms = [...new Set(tokenize(query))].sort((a, b) => b.length - a.length);
  let out = safe;
  for (const term of terms) {
    const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    out = out.replace(re, "<mark>$1</mark>");
  }
  return out;
}

function runSearch(query) {
  const results = search(index, query, 12);
  resultsSection.hidden = false;
  $("hero").classList.add("is-compact");
  resultLabel.textContent = `"${query}" 결과 ${results.length}건`;
  resultsEl.innerHTML = "";

  if (!results.length) {
    emptyEl.hidden = false;
    return;
  }

  emptyEl.hidden = true;
  const frag = document.createDocumentFragment();
  for (const item of results) {
    const li = document.createElement("li");
    const isLocal = String(item.url).startsWith("fixture://") || String(item.url).startsWith("local://");
    const href = isLocal ? "#" : item.url;
    li.innerHTML = `
      <h3 class="result-title"><a href="${escapeHtml(href)}" ${isLocal ? "" : 'target="_blank" rel="noopener"'}>${escapeHtml(item.title)}</a></h3>
      <p class="result-url">${escapeHtml(item.url)}</p>
      <p class="result-snippet">${highlight(item.snippet, query)}</p>
    `;
    frag.appendChild(li);
  }
  resultsEl.appendChild(frag);
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = qInput.value.trim();
  if (!query) return;
  runSearch(query);
});

addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = $("doc-title").value.trim();
  const text = $("doc-body").value.trim();
  if (!title || !text) return;
  pages.push({
    url: `local://note/${Date.now()}`,
    title,
    text,
  });
  savePages();
  rebuild();
  addStatus.textContent = `"${title}" 추가 · 전체 ${pages.length}문서`;
  $("doc-title").value = "";
  $("doc-body").value = "";
});

resetBtn.addEventListener("click", () => {
  pages = structuredClone(seedCorpus);
  savePages();
  rebuild();
  resultsSection.hidden = true;
  $("hero").classList.remove("is-compact");
  addStatus.textContent = `샘플 문서 ${pages.length}개로 초기화했습니다.`;
});

document.querySelector(".brand")?.addEventListener("click", (event) => {
  event.preventDefault();
  resultsSection.hidden = true;
  $("hero").classList.remove("is-compact");
  qInput.value = "";
  qInput.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

rebuild();
qInput.focus();
