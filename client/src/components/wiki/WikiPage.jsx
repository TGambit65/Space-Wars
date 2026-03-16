import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import {
  Search, Rocket, Map, Wrench, ShoppingCart, Swords, Globe, Building2,
  Users, TrendingUp, Boxes, Target, UsersRound, Bot, Gem, GraduationCap, BookOpen
} from 'lucide-react';
import { articles, categories, searchArticles } from './wikiData';

const iconMap = {
  Rocket, Map, Wrench, ShoppingCart, Swords, Globe, Building2,
  Users, TrendingUp, Boxes, Target, UsersRound, Bot, Gem, GraduationCap, BookOpen,
};

const mdComponents = {
  h1: ({ children, ...props }) => (
    <h1 className="text-2xl text-neon-cyan font-display font-bold mb-4 pb-2" style={{ borderBottom: '1px solid rgba(0,255,255,0.15)' }} {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-xl text-neon-cyan/90 font-display font-semibold mt-8 mb-3" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-lg text-neon-cyan/80 font-display font-medium mt-6 mb-2" {...props}>{children}</h3>
  ),
  p: ({ children, ...props }) => (
    <p className="text-gray-300 leading-relaxed mb-4" {...props}>{children}</p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="list-disc list-inside text-gray-300 mb-4 space-y-1 ml-2" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="list-decimal list-inside text-gray-300 mb-4 space-y-1 ml-2" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-gray-300" {...props}>{children}</li>
  ),
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto mb-6 rounded-lg" style={{ border: '1px solid rgba(0,255,255,0.12)' }}>
      <table className="w-full text-sm" {...props}>{children}</table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead style={{ background: 'rgba(0,255,255,0.06)' }} {...props}>{children}</thead>
  ),
  th: ({ children, ...props }) => (
    <th className="text-left px-3 py-2 text-neon-cyan/80 font-display font-semibold text-xs uppercase tracking-wider" style={{ borderBottom: '1px solid rgba(0,255,255,0.12)' }} {...props}>{children}</th>
  ),
  td: ({ children, ...props }) => (
    <td className="px-3 py-2 text-gray-300" style={{ borderBottom: '1px solid rgba(0,255,255,0.06)' }} {...props}>{children}</td>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="mb-4 pl-4 py-2 text-gray-300 rounded-r" style={{ borderLeft: '3px solid rgba(0,255,255,0.4)', background: 'rgba(0,255,255,0.03)' }} {...props}>{children}</blockquote>
  ),
  code: ({ inline, children, className, ...props }) => {
    if (inline) {
      return <code className="px-1.5 py-0.5 rounded text-neon-cyan text-sm" style={{ background: 'rgba(0,255,255,0.08)' }} {...props}>{children}</code>;
    }
    return (
      <pre className="mb-4 p-4 rounded-lg overflow-x-auto text-sm text-gray-300" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,255,255,0.1)' }}>
        <code className={className} {...props}>{children}</code>
      </pre>
    );
  },
  strong: ({ children, ...props }) => (
    <strong className="text-white font-semibold" {...props}>{children}</strong>
  ),
  hr: (props) => (
    <hr className="my-6" style={{ borderColor: 'rgba(0,255,255,0.1)' }} {...props} />
  ),
  a: ({ href, children, ...props }) => {
    // Internal wiki links like ?article=ships
    if (href && href.startsWith('?article=')) {
      return (
        <a href={href} className="text-neon-cyan hover:text-neon-cyan/80 underline underline-offset-2" {...props}>{children}</a>
      );
    }
    return <a href={href} className="text-neon-cyan hover:text-neon-cyan/80 underline underline-offset-2" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
  },
};

export default function WikiPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const activeSlug = searchParams.get('article') || articles[0]?.slug;

  const filtered = useMemo(() => searchArticles(query), [query]);
  const activeArticle = useMemo(
    () => articles.find(a => a.slug === activeSlug) || articles[0],
    [activeSlug]
  );

  const selectArticle = useCallback((slug) => {
    setSearchParams({ article: slug });
    setQuery('');
  }, [setSearchParams]);

  // Scroll to hash on article change
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      setTimeout(() => {
        const el = document.getElementById(hash.slice(1));
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [activeSlug]);

  const grouped = useMemo(() => {
    const map = {};
    for (const cat of categories) {
      map[cat] = filtered.filter(a => a.category === cat);
    }
    return map;
  }, [filtered]);

  return (
    <div className="flex h-full" style={{ minHeight: 'calc(100vh - 0px)' }}>
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 overflow-y-auto p-4" style={{ background: 'rgba(0,0,0,0.2)', borderRight: '1px solid rgba(0,255,255,0.08)' }}>
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search wiki..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm text-white placeholder-gray-500 outline-none"
            style={{ background: 'rgba(0,255,255,0.04)', border: '1px solid rgba(0,255,255,0.1)' }}
          />
        </div>

        {/* Categories */}
        {categories.map(cat => {
          const items = grouped[cat];
          if (!items || items.length === 0) return null;
          return (
            <div key={cat} className="mb-3">
              <div className="text-[10px] uppercase tracking-widest text-gray-500 font-display mb-1 px-2">{cat}</div>
              {items.map(a => {
                const Icon = iconMap[a.icon] || BookOpen;
                const isActive = a.slug === activeSlug;
                return (
                  <button
                    key={a.slug}
                    onClick={() => selectArticle(a.slug)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all duration-150 text-left ${
                      isActive ? 'text-neon-cyan' : 'text-gray-400 hover:text-neon-cyan/70 hover:bg-white/[0.02]'
                    }`}
                    style={isActive ? { background: 'rgba(0,255,255,0.06)' } : undefined}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className={isActive ? 'font-semibold' : ''}>{a.title}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-8 max-w-4xl">
        {activeArticle ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSlug]}
            components={mdComponents}
          >
            {activeArticle.content}
          </ReactMarkdown>
        ) : (
          <p className="text-gray-500">Select an article from the sidebar.</p>
        )}
      </main>
    </div>
  );
}
