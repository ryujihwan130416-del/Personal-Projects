const $ = (id) => document.getElementById(id);

const searchForm = $("search-form");
const crawlForm = $("crawl-form");
const qInput = $("q");
const resultsSection = $("results-section");
const resultsEl = $("results");
const emptyEl = $("empty");
const resultLabel = $("result-label");
const statsEl = $("stats");
const crawlStatus = $("crawl-status");
const crawlBtn = $("crawl-btn");
const resetBtn = $("reset-btn");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function highlight(snippet, query) {
  const safe = escapeHtml(snippet);
  const terms = query
    .toLowerCase()
    .match(/[0-9a-z가-힣]{2,}/g);
  if (!terms || !terms.length) return safe;
  const unique = [...new Set(terms)].sort((a, b) => b.length - a.length);
  let out = safe;
  for (const term of unique) {
    const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    out = out.replace(re, "<mark>$1</mark>");
  }
  return out;
}

async function refreshStats() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    statsEl.textContent = `색인 ${data.documents}문서 · 단어 ${data.terms}개`;
    if (data.crawling) {
      crawlStatus.textContent = "크롤링 중…";
    }
  } catch {
    statsEl.textContent = "서버에 연결할 수 없습니다.";
  }
}

async function runSearch(query) {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=12`);
  if (!res.ok) {
    throw new Error("검색 요청이 실패했습니다.");
  }
  const data = await res.json();
  resultsSection.hidden = false;
  resultLabel.textContent = `"${query}" 결과 ${data.count}건`;
  resultsEl.innerHTML = "";

  if (!data.results.length) {
    emptyEl.hidden = false;
    return;
  }

  emptyEl.hidden = true;
  const frag = document.createDocumentFragment();
  for (const item of data.results) {
    const li = document.createElement("li");
    const isFixture = item.url.startsWith("fixture://");
    const href = isFixture ? "#" : item.url;
    li.innerHTML = `
      <h3 class="result-title"><a href="${escapeHtml(href)}" ${isFixture ? "" : 'target="_blank" rel="noopener"'}>${escapeHtml(item.title)}</a></h3>
      <p class="result-url">${escapeHtml(item.url)}</p>
      <p class="result-snippet">${highlight(item.snippet, query)}</p>
    `;
    frag.appendChild(li);
  }
  resultsEl.appendChild(frag);
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = qInput.value.trim();
  if (!query) return;
  try {
    await runSearch(query);
  } catch (err) {
    crawlStatus.textContent = err.message || "검색 실패";
  }
});

crawlForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const seeds = $("seeds")
    .value.split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!seeds.length) return;

  crawlBtn.disabled = true;
  crawlStatus.textContent = "크롤링 중… 잠시만요.";

  try {
    const res = await fetch("/api/crawl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seeds,
        max_pages: Number($("max-pages").value) || 20,
        max_depth: Number($("max-depth").value) || 1,
        same_host_only: true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || "크롤 실패");
    }
    crawlStatus.textContent = `${data.added}페이지 추가 · 전체 ${data.total}문서`;
    await refreshStats();
  } catch (err) {
    crawlStatus.textContent = err.message || "크롤 실패";
  } finally {
    crawlBtn.disabled = false;
  }
});

resetBtn.addEventListener("click", async () => {
  resetBtn.disabled = true;
  try {
    const res = await fetch("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ use_fixtures: true }),
    });
    const data = await res.json();
    crawlStatus.textContent = `샘플 문서 ${data.total}개로 초기화했습니다.`;
    resultsSection.hidden = true;
    await refreshStats();
  } catch {
    crawlStatus.textContent = "초기화에 실패했습니다.";
  } finally {
    resetBtn.disabled = false;
  }
});

refreshStats();
qInput.focus();
