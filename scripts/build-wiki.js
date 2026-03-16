#!/usr/bin/env node

/**
 * Build wiki HTML pages from markdown sources in docs/wiki/
 * Outputs styled HTML to site/wiki/ with "Ship's Computer Database" theme.
 *
 * Usage: node scripts/build-wiki.js
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const WIKI_SRC = path.join(__dirname, '..', 'docs', 'wiki');
const WIKI_OUT = path.join(__dirname, '..', 'site', 'wiki');

const CATEGORY_ICONS = {
  'Getting Started': '&#x1F680;',
  'Core Systems': '&#x2699;',
  'Economy': '&#x1F4B0;',
  'Combat': '&#x2694;',
  'World': '&#x1F30D;',
  'Crew & Progression': '&#x1F4C8;',
  'Advanced': '&#x1F527;',
  'Guides': '&#x1F4D6;',
};

// ── Parse markdown ────────────────────────────────────────────────────

function parseArticle(filename) {
  const raw = fs.readFileSync(path.join(WIKI_SRC, filename), 'utf-8');
  const lines = raw.split('\n');
  let meta = {};
  if (lines[0] && lines[0].startsWith('<!-- meta:')) {
    try {
      meta = JSON.parse(lines[0].replace('<!-- meta:', '').replace('-->', '').trim());
    } catch (e) {
      console.warn(`  ! Bad meta in ${filename}`);
    }
  }
  const content = lines.slice(1).join('\n').trim();
  const slug = filename.replace(/^\d+-/, '').replace(/\.md$/, '');
  return { slug, title: meta.title || slug, order: meta.order || 99, category: meta.category || 'General', content };
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Extract headings for TOC ──────────────────────────────────────────

function extractHeadings(markdown) {
  const headings = [];
  const lines = markdown.split('\n');
  for (const line of lines) {
    const m = line.match(/^(#{2,3})\s+(.+)$/);
    if (m) {
      const depth = m[1].length;
      const text = m[2].replace(/\*\*/g, '');
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      headings.push({ depth, text, id });
    }
  }
  return headings;
}

// ── Custom renderer ───────────────────────────────────────────────────

function createRenderer() {
  const renderer = new marked.Renderer();

  renderer.heading = function ({ text, depth }) {
    if (depth === 1) return '';
    const id = text.replace(/\*\*/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return `<h${depth} id="${id}">${text}</h${depth}>\n`;
  };

  renderer.blockquote = function ({ raw }) {
    const inner = marked.parse(raw.replace(/^>\s?/gm, '').trim());
    return `<blockquote>${inner}</blockquote>\n`;
  };

  renderer.code = function ({ text, lang }) {
    const label = lang || 'terminal';
    return `<div class="code-block"><div class="code-block-header">${escapeHtml(label)}</div><pre><code>${escapeHtml(text)}</code></pre></div>\n`;
  };

  renderer.table = function ({ header, rows }) {
    let h = '<thead><tr>';
    for (const cell of header) h += `<th>${cell.text}</th>`;
    h += '</tr></thead>';
    let b = '<tbody>';
    for (const row of rows) {
      b += '<tr>';
      for (const cell of row) b += `<td>${cell.text}</td>`;
      b += '</tr>';
    }
    b += '</tbody>';
    return `<div class="table-wrap"><table>${h}${b}</table></div>\n`;
  };

  return renderer;
}

// ── Sidebar HTML (shared by all pages) ────────────────────────────────

function buildSidebar(articles, activeSlug) {
  const cats = {};
  for (const a of articles) {
    if (!cats[a.category]) cats[a.category] = [];
    cats[a.category].push(a);
  }

  let nav = '';
  for (const [cat, items] of Object.entries(cats)) {
    const icon = CATEGORY_ICONS[cat] || '&#x1F4C4;';
    nav += `<div class="sidebar-category">
      <div class="sidebar-category-title">${cat}</div>`;
    for (const a of items) {
      const cls = a.slug === activeSlug ? ' active' : '';
      nav += `<a href="/wiki/${a.slug}/" class="sidebar-link${cls}">${a.title}</a>`;
    }
    nav += '</div>';
  }

  return `<aside class="wiki-sidebar" id="sidebar">
    <div class="sidebar-header">
      <a href="/" class="sidebar-logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>
        <span>SW3K Wiki</span>
      </a>
      <div class="sidebar-badge">Knowledge Database</div>
    </div>
    <div class="sidebar-search">
      <div class="sidebar-search-wrap">
        <input type="text" placeholder="Search articles..." id="wiki-search" />
      </div>
    </div>
    <nav class="sidebar-nav" id="sidebar-nav">${nav}</nav>
    <div class="sidebar-footer">
      <a href="/">Home</a>
      <a href="/play">Play Game</a>
    </div>
  </aside>`;
}

// ── Article page template ─────────────────────────────────────────────

function articleTemplate(article, articles, prevArticle, nextArticle) {
  const renderer = createRenderer();
  const htmlContent = marked.parse(article.content, { renderer });
  const headings = extractHeadings(article.content);
  const h2s = headings.filter(h => h.depth === 2);

  let toc = '';
  if (h2s.length > 2) {
    toc = `<div class="toc">
      <div class="toc-title">Contents</div>
      <ol>${h2s.map(h => `<li><a href="#${h.id}">${h.text}</a></li>`).join('')}</ol>
    </div>`;
  }

  let prevNav = '';
  if (prevArticle) {
    prevNav = `<a href="/wiki/${prevArticle.slug}/" class="nav-prev"><span class="nav-label">Previous</span><span class="nav-title">${prevArticle.title}</span></a>`;
  }
  let nextNav = '';
  if (nextArticle) {
    nextNav = `<a href="/wiki/${nextArticle.slug}/" class="nav-next"><span class="nav-label">Next</span><span class="nav-title">${nextArticle.title}</span></a>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${article.title} - Space Wars 3000 Wiki</title>
  <link rel="stylesheet" href="/css/wiki-theme.css">
  <link rel="icon" href="/images/icons/icon-192x192.png">
</head>
<body>
  <div id="reading-progress"></div>
  <button class="sidebar-toggle" id="sidebar-toggle" aria-label="Toggle navigation">&#9776;</button>
  <div class="wiki-layout">
    ${buildSidebar(articles, article.slug)}
    <main class="wiki-main">
      <div class="wiki-content">
        <nav class="wiki-breadcrumb">
          <a href="/wiki/">Wiki</a>
          <span class="sep">/</span>
          <span>${article.category}</span>
          <span class="sep">/</span>
          <span class="current">${article.title}</span>
        </nav>
        <header class="article-header">
          <div class="article-category">${article.category}</div>
          <h1 class="article-title">${article.title}</h1>
        </header>
        ${toc}
        <article class="wiki-article">
          ${htmlContent}
        </article>
        <nav class="article-nav">
          ${prevNav}
          ${nextNav}
        </nav>
      </div>
    </main>
  </div>
  <script>
    // Reading progress
    window.addEventListener('scroll', function() {
      var h = document.documentElement;
      var pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
      document.getElementById('reading-progress').style.width = Math.min(pct, 100) + '%';
    });
    // Sidebar toggle (mobile)
    document.getElementById('sidebar-toggle').addEventListener('click', function() {
      document.getElementById('sidebar').classList.toggle('open');
    });
    // Search filter
    document.getElementById('wiki-search').addEventListener('input', function(e) {
      var q = e.target.value.toLowerCase();
      document.querySelectorAll('.sidebar-link').forEach(function(link) {
        link.style.display = link.textContent.toLowerCase().includes(q) || !q ? '' : 'none';
      });
      document.querySelectorAll('.sidebar-category').forEach(function(cat) {
        var visible = cat.querySelectorAll('.sidebar-link[style=""],.sidebar-link:not([style])');
        cat.style.display = visible.length || !q ? '' : 'none';
      });
    });
  </script>
</body>
</html>`;
}

// ── Wiki index page ───────────────────────────────────────────────────

function wikiIndexTemplate(articles) {
  const cats = {};
  for (const a of articles) {
    if (!cats[a.category]) cats[a.category] = [];
    cats[a.category].push(a);
  }

  let cardsHtml = '';
  for (const [cat, items] of Object.entries(cats)) {
    const icon = CATEGORY_ICONS[cat] || '&#x1F4C4;';
    const links = items.map(a =>
      `<li><a href="/wiki/${a.slug}/">${a.title}</a></li>`
    ).join('');

    cardsHtml += `
      <div class="category-card">
        <div class="category-card-header">
          <div class="category-icon">${icon}</div>
          <div>
            <div class="category-name">${cat}</div>
            <div class="category-count">${items.length} article${items.length > 1 ? 's' : ''}</div>
          </div>
        </div>
        <ul class="category-articles">${links}</ul>
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Space Wars 3000 Wiki</title>
  <link rel="stylesheet" href="/css/wiki-theme.css">
  <link rel="icon" href="/images/icons/icon-192x192.png">
</head>
<body>
  <button class="sidebar-toggle" id="sidebar-toggle" aria-label="Toggle navigation">&#9776;</button>
  <div class="wiki-layout">
    ${buildSidebar(articles, null)}
    <main class="wiki-main">
      <div class="wiki-content">
        <div class="wiki-index-hero">
          <h1>Knowledge Database</h1>
          <p>Your comprehensive guide to mastering the galaxy. Every ship stat, trade route, and combat tactic at your fingertips.</p>
          <div class="stat-bar">
            <div class="stat">
              <div class="stat-value">${articles.length}</div>
              <div class="stat-label">Articles</div>
            </div>
            <div class="stat">
              <div class="stat-value">${Object.keys(cats).length}</div>
              <div class="stat-label">Categories</div>
            </div>
          </div>
        </div>
        <div class="category-grid">
          ${cardsHtml}
        </div>
      </div>
    </main>
  </div>
  <script>
    document.getElementById('sidebar-toggle').addEventListener('click', function() {
      document.getElementById('sidebar').classList.toggle('open');
    });
    document.getElementById('wiki-search').addEventListener('input', function(e) {
      var q = e.target.value.toLowerCase();
      document.querySelectorAll('.sidebar-link').forEach(function(link) {
        link.style.display = link.textContent.toLowerCase().includes(q) || !q ? '' : 'none';
      });
      document.querySelectorAll('.sidebar-category').forEach(function(cat) {
        var visible = cat.querySelectorAll('.sidebar-link[style=""],.sidebar-link:not([style])');
        cat.style.display = visible.length || !q ? '' : 'none';
      });
    });
  </script>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────

function main() {
  const files = fs.readdirSync(WIKI_SRC).filter(f => f.endsWith('.md')).sort();
  const articles = files.map(parseArticle).sort((a, b) => a.order - b.order);
  console.log(`Found ${articles.length} wiki articles`);

  // Create output dirs
  for (const a of articles) fs.mkdirSync(path.join(WIKI_OUT, a.slug), { recursive: true });

  // Generate article pages
  for (let i = 0; i < articles.length; i++) {
    const prev = i > 0 ? articles[i - 1] : null;
    const next = i < articles.length - 1 ? articles[i + 1] : null;
    const html = articleTemplate(articles[i], articles, prev, next);
    fs.writeFileSync(path.join(WIKI_OUT, articles[i].slug, 'index.html'), html, 'utf-8');
    console.log(`  + ${articles[i].slug}/`);
  }

  // Generate index
  fs.mkdirSync(WIKI_OUT, { recursive: true });
  fs.writeFileSync(path.join(WIKI_OUT, 'index.html'), wikiIndexTemplate(articles), 'utf-8');
  console.log(`  + wiki/index.html`);
  console.log(`\nDone! ${articles.length + 1} pages generated.`);
}

main();
