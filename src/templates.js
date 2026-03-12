function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderBullets(items) {
  if (!Array.isArray(items) || items.length === 0) return `<p class="muted">—</p>`;
  return `<ul class="list">${items.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
}

function renderParagraph(text) {
  const t = String(text ?? "").trim();
  if (!t) return `<p class="muted">—</p>`;
  const ps = t.split("\n").map(p => p.trim()).filter(Boolean);
  return ps.map(p => `<p>${escapeHtml(p)}</p>`).join("");
}

function renderMetaPills(meta = {}) {
  const pills = [meta.category, meta.series, meta.displayDate].filter(Boolean);
  if (pills.length === 0) return "";
  return `<div class="meta-pills">${pills.map(item => `<span class="pill">${escapeHtml(item)}</span>`).join("")}</div>`;
}

function pageShell({ title, content, relativeBase, script = "" }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${relativeBase}assets/styles.css" />
</head>
<body>
  <div class="page-glow page-glow-a"></div>
  <div class="page-glow page-glow-b"></div>
  <div class="container">
    ${content}
    <div class="footer">Conteúdo organizado a partir da ministração • ${new Date().toISOString().slice(0, 10)}</div>
  </div>
  ${script ? `<script>${script}</script>` : ""}
</body>
</html>`;
}

function topbar({ relativeBase, badge = "Colecao", actionLabel = "Voltar", actionHref = "index.html" }) {
  return `
  <div class="topbar">
    <div class="brand">
      <a href="${relativeBase}index.html" class="brand-link">Reader</a>
      <span class="badge">${escapeHtml(badge)}</span>
    </div>
    <div class="actions">
      <a class="btn btn-ghost" href="${relativeBase}${escapeHtml(actionHref)}">${escapeHtml(actionLabel)}</a>
    </div>
  </div>`;
}

function toc(items) {
  return `
  <nav class="card toc" aria-label="Sumário do resumo">
    <div class="card-eyebrow">Navegação</div>
    <div class="toc-title">Percurso de leitura</div>
    <div class="toc-grid">
      ${items.map(([id, label]) => `<a class="toc-link" href="#${id}" data-section-link="${id}">${escapeHtml(label)}</a>`).join("")}
    </div>
  </nav>`;
}

function section({ id, title, bodyHtml, tone = "" }) {
  const toneClass = tone ? ` section-${tone}` : "";
  return `
  <section class="card section${toneClass}" id="${escapeHtml(id)}" data-section="${escapeHtml(id)}">
    <h2>${escapeHtml(title)}</h2>
    ${bodyHtml}
  </section>`;
}

function statsBar(data, refs) {
  const cards = [
    { label: "Texto-base", value: data.texto_base?.length || 0 },
    { label: "Referências", value: refs.confirmadas?.length || 0 },
    { label: "Aplicações", value: data.aplicacoes?.length || 0 },
    { label: "Alertas", value: data.alertas?.length || 0 }
  ];

  return `
  <div class="stats-grid">
    ${cards.map(card => `
      <div class="stat-card">
        <div class="stat-value">${escapeHtml(card.value)}</div>
        <div class="stat-label">${escapeHtml(card.label)}</div>
      </div>
    `).join("")}
  </div>`;
}

function heroSummary(data) {
  const highlights = [
    data.tese ? `<div class="hero-note"><strong>Tese:</strong> ${escapeHtml(data.tese)}</div>` : "",
    data.aplicacoes?.[0] ? `<div class="hero-note"><strong>Primeira aplicação:</strong> ${escapeHtml(data.aplicacoes[0])}</div>` : ""
  ].filter(Boolean).join("");

  return highlights ? `<div class="hero-notes">${highlights}</div>` : "";
}

function readingScript() {
  return `
const sectionLinks = Array.from(document.querySelectorAll("[data-section-link]"));
const sections = Array.from(document.querySelectorAll("[data-section]"));
const progressBar = document.querySelector("[data-reading-progress]");
const backToTop = document.querySelector("[data-back-to-top]");

function updateProgress() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const doc = document.documentElement;
  const max = doc.scrollHeight - window.innerHeight;
  const pct = max > 0 ? Math.min(100, Math.max(0, (scrollTop / max) * 100)) : 0;
  if (progressBar) progressBar.style.width = pct + "%";
  if (backToTop) backToTop.hidden = pct < 18;
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const id = entry.target.getAttribute("data-section");
    sectionLinks.forEach(link => link.classList.toggle("is-active", link.getAttribute("data-section-link") === id));
  });
}, { rootMargin: "-35% 0px -45% 0px", threshold: 0.1 });

sections.forEach(section => observer.observe(section));
window.addEventListener("scroll", updateProgress, { passive: true });
window.addEventListener("resize", updateProgress);
updateProgress();

if (backToTop) {
  backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}
`;
}

function indexScript() {
  return `
const searchInput = document.querySelector("[data-search]");
const sortSelect = document.querySelector("[data-sort]");
const filterSelect = document.querySelector("[data-filter]");
const list = document.querySelector("[data-list]");
const empty = document.querySelector("[data-empty]");
const count = document.querySelector("[data-count]");

function getCards() {
  return Array.from(list.querySelectorAll("[data-item]"));
}

function normalize(value) {
  return (value || "").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
}

function applyState() {
  const term = normalize(searchInput.value);
  const filter = filterSelect.value;
  const sort = sortSelect.value;
  const cards = getCards();

  cards.forEach(card => {
    const haystack = normalize(card.dataset.search);
    const category = card.dataset.category || "";
    const visible = (!term || haystack.includes(term)) && (!filter || category === filter);
    card.hidden = !visible;
  });

  const visibleCards = cards.filter(card => !card.hidden);
  visibleCards.sort((a, b) => {
    if (sort === "title-asc") return a.dataset.title.localeCompare(b.dataset.title, "pt-BR");
    if (sort === "title-desc") return b.dataset.title.localeCompare(a.dataset.title, "pt-BR");
    return Number(b.dataset.sortDate || 0) - Number(a.dataset.sortDate || 0);
  }).forEach(card => list.appendChild(card));

  count.textContent = String(visibleCards.length);
  empty.hidden = visibleCards.length !== 0;
}

[searchInput, sortSelect, filterSelect].forEach(node => node.addEventListener("input", applyState));
applyState();
`;
}

function videoPage({ data, slug }) {
  const title = data.title || slug;
  const meta = data.meta || {};
  const refs = data.referencias || { confirmadas: [], citadas_nao_explicadas: [], implicitas: [] };
  const tocItems = [
    ["texto-base", "Texto-base"],
    ["referencias", "Referências"],
    ["tese", "Tese central"],
    ["fluxo", "Fluxo da mensagem"],
    ["mapa", "Mapa Bíblia → Sermão"],
    ["panorama", "Panorama histórico"],
    ["aplicacoes", "Aplicações práticas"],
    ["alertas", "Alertas / pendências"],
    ["leituras", "Leituras complementares"]
  ];

  const fluxoHtml = Array.isArray(data.fluxo) && data.fluxo.length
    ? `<div class="flow">
        ${data.fluxo.map((x, i) => `
          <div class="flow-item">
            <div class="flow-step">Etapa ${i + 1}</div>
            <div class="flow-title">${escapeHtml(x.stage || ("Etapa " + (i + 1)))}</div>
            ${renderBullets(x.bullets || [])}
          </div>
        `).join("")}
      </div>`
    : `<p class="muted">—</p>`;

  const mapa = Array.isArray(data.mapa_biblia_sermao) ? data.mapa_biblia_sermao : [];
  const mapaHtml = mapa.length
    ? `<div class="mapa-stack">${mapa.map((p, i) => `
      <article class="mapa-item">
        <div class="card-eyebrow">Ponto ${i + 1}</div>
        <h3>${escapeHtml(p.title || ("Ponto " + (i + 1)))}</h3>
        <div class="mapa-grid">
          <div class="mini-card">
            <div class="mini-label">Âncora</div>
            <div class="mini-text">${escapeHtml(p.ancora || "—")}</div>
          </div>
          <div class="mini-card">
            <div class="mini-label">Evidência</div>
            <div class="mini-text">${escapeHtml(p.evidencia || "—")}</div>
          </div>
        </div>
        <div class="mini-card teaching">
          <div class="mini-label">Ensino</div>
          <div class="mini-text">${escapeHtml(p.ensino || "—")}</div>
        </div>
      </article>
    `).join("")}</div>`
    : `<p class="muted">—</p>`;

  const panorama = Array.isArray(data.panorama) ? data.panorama : [];
  const panoramaHtml = panorama.length
    ? `<div class="subsection-grid">${panorama.map((x, i) => `
      <div class="subsection">
        <div class="card-eyebrow">Aspecto ${i + 1}</div>
        <h3>${escapeHtml(x.title || ("Item " + (i + 1)))}</h3>
        ${renderBullets(x.bullets || [])}
      </div>
    `).join("")}</div>`
    : `<p class="muted">—</p>`;

  const content = `
    <div class="reading-progress"><span data-reading-progress></span></div>
    ${topbar({ relativeBase: "../", badge: meta.category || "Resumo" })}

    <header class="hero">
      <div class="hero-copy">
        <div class="card-eyebrow">Resumo de Estudo</div>
        <h1 class="hero-title">${escapeHtml(title)}</h1>
        <p class="hero-subtitle">Leitura estruturada para revisão, ensino e acompanhamento do conteúdo ministrado.</p>
        ${renderMetaPills(meta)}
        ${heroSummary(data)}
      </div>
      <aside class="hero-side">
        <div class="hero-panel">
          <div class="hero-panel-title">Visão rápida</div>
          <p>Resumo organizado para consulta, revisão e ensino com navegação por blocos e leitura progressiva.</p>
        </div>
        ${statsBar(data, refs)}
      </aside>
    </header>

    ${toc(tocItems)}

    <div class="stack">
      ${section({
        id: "texto-base",
        title: "1) Texto-base",
        tone: "anchor",
        bodyHtml: renderBullets(data.texto_base)
      })}

      ${section({
        id: "referencias",
        title: "2) Referências bíblicas",
        bodyHtml: `
          <div class="refs-grid">
            <div class="mini-card">
              <div class="mini-label">Confirmadas</div>
              ${renderBullets(refs.confirmadas)}
            </div>
            <div class="mini-card">
              <div class="mini-label">Citadas mas não explicadas</div>
              ${renderBullets(refs.citadas_nao_explicadas)}
            </div>
            <div class="mini-card">
              <div class="mini-label">Implícitas</div>
              ${renderBullets(refs.implicitas)}
            </div>
          </div>
        `
      })}

      ${section({
        id: "tese",
        title: "3) Tese central",
        tone: "thesis",
        bodyHtml: `<div class="prose lead">${renderParagraph(data.tese || "")}</div>`
      })}

      ${section({
        id: "fluxo",
        title: "4) Fluxo da mensagem",
        bodyHtml: fluxoHtml
      })}

      ${section({
        id: "mapa",
        title: "5) Mapa Bíblia → Sermão",
        bodyHtml: mapaHtml
      })}

      ${section({
        id: "panorama",
        title: "Panorama histórico e cultural",
        bodyHtml: panoramaHtml
      })}

      ${section({
        id: "aplicacoes",
        title: "6) Aplicações práticas",
        tone: "action",
        bodyHtml: renderBullets(data.aplicacoes)
      })}

      ${section({
        id: "alertas",
        title: "7) Alertas / pendências",
        bodyHtml: renderBullets(data.alertas)
      })}

      ${section({
        id: "leituras",
        title: "Leituras complementares",
        bodyHtml: renderBullets(data.leituras_complementares)
      })}
    </div>

    <button class="back-to-top" type="button" data-back-to-top hidden>Topo</button>
  `;

  return pageShell({ title, content, relativeBase: "../", script: readingScript() });
}

function indexPage({ items }) {
  const categories = Array.from(new Set(items.map(item => item.meta?.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const latest = items[0];
  const cards = items.map(it => {
    const meta = it.meta || {};
    const summaryBits = [meta.category, meta.series, meta.displayDate, it.file, it.title].filter(Boolean).join(" ");
    return `
    <article
      class="summary-card"
      data-item
      data-title="${escapeHtml(it.title || "")}"
      data-category="${escapeHtml(meta.category || "")}"
      data-sort-date="${escapeHtml(String(meta.sortDate || 0))}"
      data-search="${escapeHtml(summaryBits)}"
    >
      <div class="summary-card-top">
        <div>
          <div class="card-eyebrow">${escapeHtml(meta.category || "Resumo")}</div>
          <h2>${escapeHtml(it.title)}</h2>
        </div>
        <span class="date-chip">${escapeHtml(meta.displayDate || "Sem data")}</span>
      </div>
      <p class="summary-card-copy">${escapeHtml(meta.series || "Leitura estruturada do conteúdo em formato de revisão.")}</p>
      <div class="summary-card-meta">
        <span>${escapeHtml(it.file)}</span>
      </div>
      <div class="summary-card-actions">
        <a class="btn" href="./${escapeHtml(it.slug)}/index.html">Abrir leitura</a>
      </div>
    </article>`;
  }).join("");

  const content = `
    ${topbar({ relativeBase: "./", badge: "Arquivo", actionLabel: "GitHub Pages", actionHref: "index.html" })}

    <header class="hero hero-index">
      <div class="hero-copy">
        <div class="card-eyebrow">Biblioteca</div>
        <h1 class="hero-title">Resumos para leitura, revisão e ensino</h1>
        <p class="hero-subtitle">Coleção de estudos organizados para leitura rápida, navegação por tema e consulta posterior.</p>
        <div class="meta-pills">
          <span class="pill">Total <strong data-count>${items.length}</strong></span>
          <span class="pill">${escapeHtml(categories.length)} categorias</span>
          <span class="pill">Fonte: summaries_md/</span>
        </div>
      </div>
      <aside class="hero-side hero-side-index">
        <div class="feature-card">
          <div class="card-eyebrow">Destaque</div>
          <h2>${escapeHtml(latest?.title || "Nenhum resumo disponível")}</h2>
          <p>${escapeHtml(latest?.meta?.displayDate || "Adicione arquivos em summaries_md/ para começar.")}</p>
          ${latest ? `<a class="btn" href="./${escapeHtml(latest.slug)}/index.html">Abrir mais recente</a>` : ""}
        </div>
      </aside>
    </header>

    <section class="card filter-card">
      <div class="filter-grid">
        <label class="field">
          <span>Buscar</span>
          <input type="search" placeholder="Título, arquivo, série..." data-search />
        </label>
        <label class="field">
          <span>Categoria</span>
          <select data-filter>
            <option value="">Todas</option>
            ${categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}
          </select>
        </label>
        <label class="field">
          <span>Ordenação</span>
          <select data-sort>
            <option value="date-desc">Mais recentes</option>
            <option value="title-asc">Título A-Z</option>
            <option value="title-desc">Título Z-A</option>
          </select>
        </label>
      </div>
    </section>

    <section class="summary-grid" data-list>
      ${cards}
    </section>

    <section class="card empty-state" data-empty hidden>
      <h2>Nenhum resumo encontrado</h2>
      <p class="muted">Ajuste a busca ou o filtro para encontrar outra leitura.</p>
    </section>
  `;

  return pageShell({ title: "Reader - Index", content, relativeBase: "./", script: indexScript() });
}

module.exports = { videoPage, indexPage };
