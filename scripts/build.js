const fs = require("fs");
const path = require("path");
const { parseSummaryMarkdown } = require("../src/parse_md.js");
const { videoPage, indexPage } = require("../src/templates.js");

const ROOT = process.cwd();
const IN_DIR = path.join(ROOT, "summaries_md");
const OUT_DIR = path.join(ROOT, "docs");
const ASSETS_DIR = path.join(OUT_DIR, "assets");
const CSS_SRC = path.join(ROOT, "src", "styles.css");
const CSS_OUT = path.join(ASSETS_DIR, "styles.css");

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function slugify(input) {
  return String(input || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "item";
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

  for (const file of files) {
    const full = path.join(IN_DIR, file);
    const md = fs.readFileSync(full, "utf8");

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

    const pageDir = path.join(OUT_DIR, slug);
    ensureDir(pageDir);

    const html = videoPage({ data, slug });
    fs.writeFileSync(path.join(pageDir, "index.html"), html, "utf8");

    items.push({ slug, title: data.title || slug, file });
  }

  // sort A-Z por título
  items.sort((a, b) => (a.title || "").localeCompare(b.title || ""));

  const indexHtml = indexPage({ items });
  fs.writeFileSync(path.join(OUT_DIR, "index.html"), indexHtml, "utf8");

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