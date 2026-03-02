const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { parseSummaryMarkdown } = require("../src/parse_md.js");
const { videoPage, indexPage } = require("../src/templates.js");

const ROOT = process.cwd();
const IN_DIR = path.join(ROOT, "summaries_md");
const OUT_DIR = path.join(ROOT, "docs");
const ASSETS_DIR = path.join(OUT_DIR, "assets");
const CSS_SRC = path.join(ROOT, "src", "styles.css");
const CSS_OUT = path.join(ASSETS_DIR, "styles.css");
const BUILD_STATE = path.join(ROOT, ".build-state.json");

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function hashContent(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function readBuildState() {
  try {
    return JSON.parse(fs.readFileSync(BUILD_STATE, "utf8"));
  } catch {
    return { sources: {} };
  }
}

function writeBuildState(state) {
  fs.writeFileSync(BUILD_STATE, JSON.stringify(state, null, 2) + "\n", "utf8");
}

function formatFooterDate(isoDate) {
  if (!isoDate) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function slugify(input) {
  return String(input || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "item";
}

function extractMeta(file) {
  const baseName = path.basename(file, ".md");
  const normalized = baseName.replaceAll("⧸", "/").replace(/\s+/g, " ").trim();
  const dateMatch = normalized.match(/(\d{2})\/(\d{2})\/(\d{4})$/);
  const rawLabel = dateMatch ? normalized.slice(0, dateMatch.index).replace(/\s*-\s*$/, "").trim() : normalized;
  const segments = rawLabel.split(/\s*-\s*/).map(s => s.trim()).filter(Boolean);
  const category = titleCase(segments[0] || "Resumo");
  const series = titleCase(segments.slice(1).join(" • "));

  if (!dateMatch) {
    return {
      sourceName: baseName,
      category,
      series,
      isoDate: "",
      displayDate: "",
      sortDate: 0
    };
  }

  const [, day, month, year] = dateMatch;
  const isoDate = `${year}-${month}-${day}`;
  const dt = new Date(`${isoDate}T00:00:00Z`);

  return {
    sourceName: baseName,
    category,
    series,
    isoDate,
    displayDate: new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    }).format(dt),
    sortDate: dt.getTime()
  };
}

function cleanOutDir() {
  ensureDir(OUT_DIR);
  for (const entry of fs.readdirSync(OUT_DIR)) {
    const full = path.join(OUT_DIR, entry);
    if (entry === ".nojekyll") continue;
    fs.rmSync(full, { recursive: true, force: true });
  }
}

function copyAssets() {
  ensureDir(ASSETS_DIR);
  fs.copyFileSync(CSS_SRC, CSS_OUT);
  fs.writeFileSync(path.join(OUT_DIR, ".nojekyll"), "");
}

function buildOnce() {
  ensureDir(IN_DIR);
  cleanOutDir();
  copyAssets();

  const files = fs.readdirSync(IN_DIR).filter(f => f.endsWith(".md"));
  const items = [];
  const prevState = readBuildState();
  const nextState = { sources: {} };

  for (const file of files) {
    const full = path.join(IN_DIR, file);
    const md = fs.readFileSync(full, "utf8");
    const contentHash = hashContent(md);
    const prevEntry = prevState.sources?.[file];
    const lastUpdated = !prevEntry
      ? ""
      : prevEntry.hash === contentHash
        ? prevEntry.lastUpdated || ""
        : new Date().toISOString().slice(0, 10);

    let data;
    try {
      data = parseSummaryMarkdown(md);
    } catch (e) {
      console.error("❌ Falha parse:", file);
      console.error(e);
      continue;
    }

    const baseName = path.basename(file, ".md");
    const slug = slugify(baseName || data.title);
    const meta = extractMeta(file);
    data.meta = {
      ...meta,
      footerText: lastUpdated
        ? `Resumo preparado para leitura, ensino e reflexão • atualizado em ${formatFooterDate(lastUpdated)}`
        : "Resumo preparado para leitura, ensino e reflexão"
    };

    const pageDir = path.join(OUT_DIR, slug);
    ensureDir(pageDir);

    const html = videoPage({ data, slug });
    fs.writeFileSync(path.join(pageDir, "index.html"), html, "utf8");

    items.push({ slug, title: data.title || slug, file, meta });
    nextState.sources[file] = {
      hash: contentHash,
      lastUpdated
    };
  }

  items.sort((a, b) => {
    const dateDiff = (b.meta?.sortDate || 0) - (a.meta?.sortDate || 0);
    if (dateDiff !== 0) return dateDiff;
    return (a.title || "").localeCompare(b.title || "");
  });

  const indexHtml = indexPage({ items });
  fs.writeFileSync(path.join(OUT_DIR, "index.html"), indexHtml, "utf8");
  writeBuildState(nextState);

  console.log(`✅ Build OK: ${items.length} páginas em /docs`);
}

function watch() {
  console.log("👀 Watch mode (summaries_md/ + src/)... Ctrl+C para sair");
  buildOnce();

  const debounce = (fn, ms = 200) => {
    let t = null;
    return () => { clearTimeout(t); t = setTimeout(fn, ms); };
  };
  const reb = debounce(buildOnce, 200);

  [IN_DIR, path.join(ROOT, "src")].forEach(dir => {
    ensureDir(dir);
    fs.watch(dir, { recursive: true }, (evt, filename) => {
      if (!filename) return;
      if (filename.endsWith(".md") || filename.endsWith(".js") || filename.endsWith(".css")) reb();
    });
  });
}

const args = process.argv.slice(2);
if (args.includes("--watch")) watch();
else buildOnce();
