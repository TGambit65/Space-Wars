const modules = import.meta.glob('../../../docs/wiki/*.md', { eager: true, query: '?raw', import: 'default' });

function parseArticle(path, raw) {
  const metaMatch = raw.match(/^<!--\s*meta:\s*(\{.*?\})\s*-->/);
  let meta = {};
  let content = raw;
  if (metaMatch) {
    try {
      meta = JSON.parse(metaMatch[1]);
    } catch (e) { /* ignore parse errors */ }
    content = raw.slice(metaMatch[0].length).trimStart();
  }

  // Extract slug from filename: "01-getting-started.md" → "getting-started"
  const filename = path.split('/').pop().replace('.md', '');
  const slug = filename.replace(/^\d+-/, '');

  return {
    slug,
    title: meta.title || slug,
    order: meta.order || 99,
    icon: meta.icon || null,
    category: meta.category || 'Uncategorized',
    content,
  };
}

export const articles = Object.entries(modules)
  .map(([path, raw]) => parseArticle(path, raw))
  .sort((a, b) => a.order - b.order);

export const categories = [...new Set(articles.map(a => a.category))];

export function searchArticles(query) {
  if (!query) return articles;
  const q = query.toLowerCase();
  return articles.filter(
    a => a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q)
  );
}
