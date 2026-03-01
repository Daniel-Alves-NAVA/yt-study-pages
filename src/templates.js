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
  
  function pageShell({ title, content, relativeBase }) {
    return `<!doctype html>
  <html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="${relativeBase}assets/styles.css" />
  </head>
  <body>
    <div class="container">
      ${content}
      <div class="footer">Gerado automaticamente • ${new Date().toISOString().slice(0,10)}</div>
    </div>
  </body>
  </html>`;
  }
  
  function renderTopbar({ relativeBase, slug }) {
    return `
    <div class="topbar">
      <div class="brand">
        <a href="${relativeBase}index.html" class="brand">📚 Study Pages</a>
        <span class="badge">${escapeHtml(slug)}</span>
      </div>
      <div class="actions">
        <button class="btn" id="toggle-study" type="button">Modo estudo: OFF</button>
        <button class="btn" id="toggle-answers" type="button">Revelar: ON</button>
        <button class="btn" id="mark-done" type="button">Marcar como estudado</button>
      </div>
    </div>`;
  }
  
  // Técnicas: active recall / efeito de geração (input antes de revelar)
  function recallBox({ id, prompt, placeholder = "Escreva sua resposta (fica salva no navegador)..." }) {
    return `
    <div class="recall">
      <div class="recall-head">
        <strong>✍️ Tente responder antes de ver</strong>
        <span class="muted">${escapeHtml(prompt)}</span>
      </div>
      <textarea class="recall-input" data-recall-id="${escapeHtml(id)}" rows="3" placeholder="${escapeHtml(placeholder)}"></textarea>
      <div class="recall-actions">
        <button class="btn" type="button" data-recall-save="${escapeHtml(id)}">Salvar</button>
        <button class="btn" type="button" data-recall-clear="${escapeHtml(id)}">Limpar</button>
      </div>
    </div>`;
  }
  
  function qaCard({ q, a, id }) {
    return `
    <div class="qa">
      <div class="q">
        <strong>❓ ${escapeHtml(q)}</strong>
        <button class="btn" type="button" data-toggle-answer="${escapeHtml(id)}">Toggle</button>
      </div>
      <div class="answer" data-answer data-answer-id="${escapeHtml(id)}">
        ${a ? escapeHtml(a) : `<span class="muted">Sem gabarito (use sua resposta e marque “acertou/quase/errei”).</span>`}
      </div>
      ${recallBox({ id: "qa:" + id, prompt: "Responda sem olhar." })}
    </div>
    `;
  }
  
  function renderClientScript({ slug }) {
    return `
  <script>
  (() => {
    const slug = ${JSON.stringify(slug)};
    const KEY_DONE = "study:done:" + slug;
    const KEY_STUDY = "study:mode";
    const KEY_REVEAL = "study:reveal"; // answers/details visible
  
    const btnStudy = document.getElementById("toggle-study");
    const btnReveal = document.getElementById("toggle-answers");
    const btnDone = document.getElementById("mark-done");
  
    const applyStudy = (on) => {
      document.documentElement.dataset.study = on ? "1" : "0";
      btnStudy.textContent = "Modo estudo: " + (on ? "ON" : "OFF");
    };
  
    const applyReveal = (on) => {
      document.documentElement.dataset.reveal = on ? "1" : "0";
      btnReveal.textContent = "Revelar: " + (on ? "ON" : "OFF");
  
      // Answers
      document.querySelectorAll("[data-answer]").forEach(el => {
        el.classList.toggle("hidden", !on);
      });
  
      // Blocks that should hide in study mode (teachings/reflections/prayer)
      document.querySelectorAll("[data-hide-when-study]").forEach(el => {
        // se estiver em modo estudo, esconder; caso contrário respeitar reveal
        const study = document.documentElement.dataset.study === "1";
        el.classList.toggle("hidden", study);
      });
  
      // Teaching blocks can be tied to reveal too
      document.querySelectorAll("[data-teaching]").forEach(el => {
        const study = document.documentElement.dataset.study === "1";
        el.classList.toggle("hidden", study ? true : !on);
      });
    };
  
    const applyDone = () => {
      const done = localStorage.getItem(KEY_DONE) === "1";
      btnDone.textContent = done ? "Estudado ✓" : "Marcar como estudado";
      btnDone.style.opacity = done ? "0.85" : "1";
    };
  
    // init
    applyStudy(localStorage.getItem(KEY_STUDY) === "1");
    const revealDefault = localStorage.getItem(KEY_REVEAL);
    applyReveal(revealDefault === null ? true : revealDefault === "1");
    applyDone();
  
    btnStudy?.addEventListener("click", () => {
      const next = !(localStorage.getItem(KEY_STUDY) === "1");
      localStorage.setItem(KEY_STUDY, next ? "1" : "0");
      applyStudy(next);
      // reapply to enforce hiding blocks
      const reveal = (localStorage.getItem(KEY_REVEAL) ?? "1") === "1";
      applyReveal(reveal);
    });
  
    btnReveal?.addEventListener("click", () => {
      const next = (localStorage.getItem(KEY_REVEAL) ?? "1") === "0";
      localStorage.setItem(KEY_REVEAL, next ? "1" : "0");
      applyReveal(next);
    });
  
    btnDone?.addEventListener("click", () => {
      const done = localStorage.getItem(KEY_DONE) === "1";
      localStorage.setItem(KEY_DONE, done ? "0" : "1");
      applyDone();
    });
  
    // Toggle individual answers
    document.querySelectorAll("[data-toggle-answer]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-toggle-answer");
        const ans = document.querySelector('[data-answer-id="' + id + '"]');
        if (!ans) return;
        ans.classList.toggle("hidden");
      });
    });
  
    // Recall inputs (efeito de geração)
    const loadRecall = (id) => localStorage.getItem("study:recall:" + slug + ":" + id) || "";
    const saveRecall = (id, val) => localStorage.setItem("study:recall:" + slug + ":" + id, val);
  
    document.querySelectorAll("[data-recall-id]").forEach(el => {
      const id = el.getAttribute("data-recall-id");
      el.value = loadRecall(id);
      el.addEventListener("change", () => saveRecall(id, el.value));
    });
  
    document.querySelectorAll("[data-recall-save]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-recall-save");
        const el = document.querySelector('[data-recall-id="' + id + '"]');
        if (!el) return;
        saveRecall(id, el.value);
      });
    });
  
    document.querySelectorAll("[data-recall-clear]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-recall-clear");
        const el = document.querySelector('[data-recall-id="' + id + '"]');
        if (!el) return;
        el.value = "";
        saveRecall(id, "");
      });
    });
  
    // Checklist (aplicações/ações)
    document.querySelectorAll("[data-check-id]").forEach(box => {
      const id = box.getAttribute("data-check-id");
      const key = "study:check:" + slug + ":" + id;
      box.checked = localStorage.getItem(key) === "1";
      box.addEventListener("change", () => {
        localStorage.setItem(key, box.checked ? "1" : "0");
      });
    });
  })();
  </script>
  `;
  }
  
  function videoPage({ data, slug }) {
    const title = data.title || slug;
  
    // 1) Texto-base
    const textoBase = renderBullets(data.texto_base);
  
    // 2) Referências
    const refs = data.referencias || { confirmadas: [], citadas_nao_explicadas: [], implicitas: [] };
  
    // 4) Fluxo
    const fluxo = Array.isArray(data.fluxo) && data.fluxo.length
      ? `<div class="timeline">
          ${data.fluxo.map((x, i) => `
            <div class="step">
              <div class="step-title">${escapeHtml(x.stage || ("Etapa " + (i+1)))}</div>
              ${renderBullets(x.bullets || [])}
              ${recallBox({ id: "fluxo:" + i, prompt: "Antes de ver/relêr: qual a ideia central desta etapa?" })}
            </div>
          `).join("")}
        </div>`
      : `<p class="muted">—</p>`;
  
    // 5) Mapa Bíblia → Sermão
    const mapa = Array.isArray(data.mapa_biblia_sermao) ? data.mapa_biblia_sermao : [];
    const mapaHtml = mapa.length
      ? mapa.map((p, i) => `
        <div class="section">
          <h3>${escapeHtml(p.title || ("Ponto " + (i+1)))}</h3>
          <div class="grid two">
            <div class="card">
              <h2>📍 Âncora</h2>
              <p>${escapeHtml(p.ancora || "—")}</p>
            </div>
            <div class="card">
              <h2>🧾 Evidência</h2>
              <p>${escapeHtml(p.evidencia || "—")}</p>
            </div>
          </div>
  
          ${recallBox({ id: "ensino:" + i, prompt: "Tente formular o ENSINO a partir da Âncora + Evidência." })}
  
          <div class="card hidden" data-teaching>
            <h2>🧠 Ensino (revelar)</h2>
            <p>${escapeHtml(p.ensino || "—")}</p>
          </div>
        </div>
      `).join("")
      : `<p class="muted">—</p>`;
  
    // Panorama
    const panorama = Array.isArray(data.panorama) ? data.panorama : [];
    const panoramaHtml = panorama.length
      ? panorama.map((x, i) => `
        <div class="section">
          <h3>${escapeHtml(x.title || ("Item " + (i+1)))}</h3>
          ${renderBullets(x.bullets || [])}
          ${recallBox({ id: "panorama:" + i, prompt: "Qual detalhe aqui muda sua interpretação do texto?" })}
        </div>
      `).join("")
      : `<p class="muted">—</p>`;
  
    // Aplicações (checklist)
    const aplicacoes = Array.isArray(data.aplicacoes) ? data.aplicacoes : [];
    const aplicacoesHtml = aplicacoes.length
      ? `<div class="checklist">
          ${aplicacoes.map((t, i) => `
            <label class="checkitem">
              <input type="checkbox" data-check-id="aplic:${i}">
              <span>${escapeHtml(t)}</span>
            </label>
          `).join("")}
        </div>`
      : `<p class="muted">—</p>`;
  
    // Alertas
    const alertas = renderBullets(data.alertas);
  
    // Perguntas (flashcards sem gabarito)
    const perguntas = Array.isArray(data.perguntas) ? data.perguntas : [];
    const perguntasHtml = perguntas.length
      ? perguntas.map((q, i) => qaCard({ q, a: null, id: "p" + (i+1) })).join("")
      : `<p class="muted">—</p>`;
  
    // Leituras
    const leituras = renderBullets(data.leituras_complementares);
  
    // Reflexões/Ações/Oração (ocultas em modo estudo)
    const reflexoes = renderBullets(data.reflexoes);
    const acoes = Array.isArray(data.acoes_praticas) && data.acoes_praticas.length
      ? `<div class="checklist">
          ${data.acoes_praticas.map((t, i) => `
            <label class="checkitem">
              <input type="checkbox" data-check-id="acao:${i}">
              <span>${escapeHtml(t)}</span>
            </label>
          `).join("")}
        </div>`
      : `<p class="muted">—</p>`;
  
    const oracao = data.oracao_guiada
      ? `<div class="prayer">${escapeHtml(data.oracao_guiada).replaceAll("\n","<br/>")}</div>`
      : `<p class="muted">—</p>`;
  
    const content = `
      ${renderTopbar({ relativeBase: "../", slug })}
  
      <div class="header">
        <h1 class="h1">${escapeHtml(title)}</h1>
        <div class="meta">
          <span class="muted">Formato: Markdown → UI de estudo</span>
        </div>
      </div>
  
      <div class="grid two">
        <div class="card">
          <h2>1) Texto-base</h2>
          ${textoBase}
        </div>
  
        <div class="card">
          <h2>3) Tese central</h2>
          <p class="lead">${escapeHtml(data.tese || "—")}</p>
          ${recallBox({ id: "tese", prompt: "Reescreva a tese com suas palavras (sem olhar)." })}
        </div>
      </div>
  
      <div class="grid">
        <div class="card">
          <h2>2) Referências bíblicas</h2>
          <div class="grid three">
            <div class="mini">
              <h3>✅ Confirmadas</h3>
              ${renderBullets(refs.confirmadas)}
            </div>
            <div class="mini">
              <h3>⚪ Citadas mas não explicadas</h3>
              ${renderBullets(refs.citadas_nao_explicadas)}
            </div>
            <div class="mini">
              <h3>🟡 Implícitas (conferir)</h3>
              ${renderBullets(refs.implicitas)}
            </div>
          </div>
        </div>
  
        <div class="card">
          <h2>4) Fluxo da mensagem</h2>
          ${fluxo}
        </div>
  
        <div class="card">
          <h2>5) Mapa Bíblia → Sermão</h2>
          ${mapaHtml}
        </div>
  
        <div class="card">
          <h2>Panorama histórico e cultural</h2>
          ${panoramaHtml}
        </div>
  
        <div class="card">
          <h2>6) Aplicações práticas (checklist)</h2>
          ${aplicacoesHtml}
          ${recallBox({ id: "aplicacao_hoje", prompt: "Escolha 1 aplicação e escreva como vai praticar hoje." })}
        </div>
  
        <div class="card">
          <h2>7) Alertas / pendências</h2>
          ${alertas}
        </div>
  
        <div class="card">
          <h2>8) Perguntas para revisão (Active Recall)</h2>
          ${perguntasHtml}
        </div>
  
        <div class="card">
          <h2>Leituras complementares</h2>
          ${leituras}
        </div>
  
        <div class="card hidden" data-hide-when-study>
          <h2>Reflexões práticas</h2>
          ${reflexoes}
        </div>
  
        <div class="card hidden" data-hide-when-study>
          <h2>Ações práticas</h2>
          ${acoes}
        </div>
  
        <div class="card hidden" data-hide-when-study>
          <h2>Oração guiada</h2>
          ${oracao}
        </div>
      </div>
  
      ${renderClientScript({ slug })}
    `;
  
    return pageShell({ title, content, relativeBase: "../" });
  }
  
  function indexPage({ items }) {
    const rows = items.map(it => `
      <tr>
        <td>
          <a class="rowlink" href="./${escapeHtml(it.slug)}/index.html">
            <div class="title">${escapeHtml(it.title)}</div>
            <div class="sub">${escapeHtml(it.file)}</div>
          </a>
        </td>
        <td><a class="btn" href="./${escapeHtml(it.slug)}/index.html">Abrir</a></td>
      </tr>
    `).join("");
  
    const content = `
      <div class="topbar">
        <div class="brand">
          <span>📚 Study Pages</span>
          <span class="badge">Index</span>
        </div>
        <div class="actions">
          <span class="muted" style="font-size:13px;">Coloque .md em <code>summaries_md/</code> e rode <code>npm run build</code></span>
        </div>
      </div>
  
      <div class="header">
        <h1 class="h1">Resumos para estudo</h1>
        <div class="meta"><span>Total: <strong>${items.length}</strong></span></div>
      </div>
  
      <div class="card">
        <h2>📄 Lista</h2>
        <table class="table">
          <thead><tr><th>Título</th><th></th></tr></thead>
          <tbody>
            ${rows || `<tr><td colspan="2" class="muted">Nenhum arquivo encontrado em <code>summaries_md/</code>.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  
    return pageShell({ title: "Study Pages - Index", content, relativeBase: "./" });
  }
  
  module.exports = { videoPage, indexPage };