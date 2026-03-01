function normalize(s) {
  return String(s ?? "").replace(/\r\n/g, "\n");
}

function stripMd(s) {
  // remove marcações simples (mantém texto)
  return String(s ?? "")
    .replace(/^\s*-\s+/gm, "- ")
    .replace(/\s+$/gm, "")
    .trim();
}

function linesToBullets(block) {
  const lines = normalize(block).split("\n").map(l => l.trim()).filter(Boolean);
  const out = [];
  for (const l of lines) {
    if (l.startsWith("- ")) out.push(stripMd(l.slice(2)));
    else if (/^\d+\.\s+/.test(l)) out.push(stripMd(l.replace(/^\d+\.\s+/, "")));
    else out.push(stripMd(l));
  }
  return out.filter(Boolean);
}

function parseNumberedFlow(block) {
  // 1. Introdução
  //    - ...
  // 2. Desenvolvimento
  //    - ...
  const lines = normalize(block).split("\n");
  const items = [];
  let cur = null;

  const flush = () => {
    if (cur) {
      cur.bullets = cur.bullets.filter(Boolean);
      items.push(cur);
      cur = null;
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, "");
    const m = line.match(/^\s*\d+\.\s+(.+?)\s*$/);
    if (m) {
      flush();
      cur = { stage: stripMd(m[1]), bullets: [] };
      continue;
    }
    const b = line.match(/^\s*-\s+(.+?)\s*$/);
    if (b && cur) {
      cur.bullets.push(stripMd(b[1]));
      continue;
    }
    // linhas soltas dentro do bloco
    if (cur && line.trim()) cur.bullets.push(stripMd(line.trim()));
  }
  flush();
  return items;
}

function parseReferences(block) {
  // ### Confirmadas
  // - ...
  // ### CITADAS MAS NÃO EXPLICADAS
  // - (nenhuma)
  // ### IMPLÍCITAS (conferir)
  // - ...
  const sections = {};
  const lines = normalize(block).split("\n");
  let cur = null;

  const start = (name) => {
    cur = name;
    if (!sections[cur]) sections[cur] = [];
  };

  for (const line of lines) {
    const h = line.match(/^\s*###\s+(.+?)\s*$/);
    if (h) {
      start(stripMd(h[1]));
      continue;
    }
    const b = line.match(/^\s*-\s+(.+?)\s*$/);
    if (b && cur) {
      const v = stripMd(b[1]);
      if (v.toLowerCase() === "(nenhuma)" || v.toLowerCase() === "nenhuma") continue;
      sections[cur].push(v);
    }
  }

  // normaliza nomes prováveis
  const out = {
    confirmadas: sections["Confirmadas"] || sections["CONFIRMADAS"] || [],
    citadas_nao_explicadas:
      sections["CITADAS MAS NÃO EXPLICADAS"] ||
      sections["Citadas mas não explicadas"] ||
      [],
    implicitas:
      sections["IMPLÍCITAS (conferir)"] ||
      sections["Implícitas (conferir)"] ||
      []
  };

  return out;
}

function parseMapaBiblia(block) {
  // ### Ponto 1
  // - Âncora: ...
  // - Ensino: ...
  // - Evidência: ...
  const lines = normalize(block).split("\n");
  const pontos = [];
  let cur = null;

  const flush = () => {
    if (cur) pontos.push(cur);
    cur = null;
  };

  for (const line of lines) {
    const h = line.match(/^\s*###\s+(.+?)\s*$/);
    if (h) {
      flush();
      cur = { title: stripMd(h[1]), ancora: "", ensino: "", evidencia: "" };
      continue;
    }
    const m = line.match(/^\s*-\s*(Âncora|Ancora)\s*:\s*(.+)\s*$/i);
    if (m && cur) { cur.ancora = stripMd(m[2]); continue; }
    const e = line.match(/^\s*-\s*Ensino\s*:\s*(.+)\s*$/i);
    if (e && cur) { cur.ensino = stripMd(e[1]); continue; }
    const v = line.match(/^\s*-\s*Evidência\s*:\s*(.+)\s*$/i);
    if (v && cur) { cur.evidencia = stripMd(v[1]); continue; }
  }
  flush();
  return pontos;
}

function parsePanorama(block) {
  // 1) Contexto histórico geral
  //    - ...
  const lines = normalize(block).split("\n");
  const items = [];
  let cur = null;

  const flush = () => {
    if (cur) items.push(cur);
    cur = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, "");
    const h = line.match(/^\s*\d+\)\s+(.+?)\s*$/);
    if (h) {
      flush();
      cur = { title: stripMd(h[1]), bullets: [] };
      continue;
    }
    const b = line.match(/^\s*-\s+(.+?)\s*$/);
    if (b && cur) cur.bullets.push(stripMd(b[1]));
  }
  flush();
  return items;
}

function parseQuestions(block) {
  // 1. Pergunta...
  const lines = normalize(block).split("\n");
  const q = [];
  for (const l of lines) {
    const m = l.match(/^\s*\d+\.\s+(.+?)\s*$/);
    if (m) q.push(stripMd(m[1]));
  }
  // fallback bullets
  if (q.length === 0) return linesToBullets(block);
  return q;
}

function parseActionsAndPrayer(block) {
  // ### Ações práticas
  // 1. ...
  // ### Oração guiada
  // texto...
  const parts = normalize(block).split("\n### ").map((s, i) => (i === 0 ? s : "### " + s));
  const out = { reflexoes: [], acoes: [], oracao: "" };

  // Reflexões práticas (bullets antes dos subheads)
  const first = parts[0];
  out.reflexoes = linesToBullets(first);

  for (const p of parts.slice(1)) {
    const h = p.match(/^###\s+(.+?)\s*\n([\s\S]*)$/);
    if (!h) continue;
    const title = stripMd(h[1]).toLowerCase();
    const body = stripMd(h[2]);

    if (title.includes("ações")) out.acoes = parseQuestions(body);
    else if (title.includes("oração")) out.oracao = body;
  }

  return out;
}

function splitSections(md) {
  // captura "## 1) ..." até o próximo "##"
  const text = normalize(md);
  const titleMatch = text.match(/^#\s+(.+?)\s*$/m);
  const docTitle = titleMatch ? stripMd(titleMatch[1]) : "Resumo";

  const sectionRegex = /^##\s+(.+?)\s*\n([\s\S]*?)(?=^##\s+|\Z)/gm;
  const sections = [];
  let m;
  while ((m = sectionRegex.exec(text)) !== null) {
    sections.push({ heading: stripMd(m[1]), body: stripMd(m[2]) });
  }
  return { docTitle, sections };
}

function parseSummaryMarkdown(md) {
  const { docTitle, sections } = splitSections(md);

  const data = {
    title: docTitle,
    // slug opcional: se você colocar no MD como "slug: ..." podemos capturar depois
    texto_base: [],
    referencias: { confirmadas: [], citadas_nao_explicadas: [], implicitas: [] },
    tese: "",
    fluxo: [],
    mapa_biblia_sermao: [],
    panorama: [],
    aplicacoes: [],
    alertas: [],
    perguntas: [],
    leituras_complementares: [],
    reflexoes: [],
    acoes_praticas: [],
    oracao_guiada: ""
  };

  for (const s of sections) {
    const h = s.heading.toLowerCase();

    if (h.startsWith("1) texto-base")) {
      data.texto_base = linesToBullets(s.body);
    } else if (h.startsWith("2) referências")) {
      data.referencias = parseReferences(s.body);
    } else if (h.startsWith("3) tese")) {
      data.tese = stripMd(s.body);
    } else if (h.startsWith("4) fluxo")) {
      data.fluxo = parseNumberedFlow(s.body);
    } else if (h.includes("mapa bíblia") || h.includes("mapa biblia")) {
      data.mapa_biblia_sermao = parseMapaBiblia(s.body);
    } else if (h.startsWith("panorama histórico")) {
      data.panorama = parsePanorama(s.body);
    } else if (h.startsWith("6) aplicações")) {
      data.aplicacoes = linesToBullets(s.body);
    } else if (h.startsWith("7) alertas")) {
      data.alertas = linesToBullets(s.body);
    } else if (h.startsWith("8) perguntas")) {
      data.perguntas = parseQuestions(s.body);
    } else if (h.startsWith("leituras complementares")) {
      data.leituras_complementares = linesToBullets(s.body);
    } else if (h.startsWith("reflexões práticas")) {
      const tail = parseActionsAndPrayer(s.body);
      data.reflexoes = tail.reflexoes;
      data.acoes_praticas = tail.acoes;
      data.oracao_guiada = tail.oracao;
    }
  }

  return data;
}

module.exports = { parseSummaryMarkdown };