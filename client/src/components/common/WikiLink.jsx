import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

const TERM_TO_SLUG = {
  'trading': 'trading',
  'trade': 'trading',
  'combat': 'combat',
  'ships': 'ships',
  'ship': 'ships',
  'ship designer': 'ship-designer',
  'shipyard': 'ship-designer',
  'navigation': 'navigation',
  'sector map': 'navigation',
  'planets': 'planets',
  'colonies': 'colonies',
  'colony': 'colonies',
  'crew': 'crew',
  'progression': 'progression',
  'crafting': 'crafting',
  'missions': 'missions',
  'corporations': 'corporations',
  'corporation': 'corporations',
  'automation': 'automation',
  'artifacts': 'artifacts',
};

export default function WikiLink({ term, children, className = '' }) {
  const slug = TERM_TO_SLUG[(term || '').toLowerCase()];
  if (!slug) return <span className={className}>{children || term}</span>;

  return (
    <Link
      to={`/wiki?article=${slug}`}
      className={`inline-flex items-center gap-1 text-neon-cyan/70 hover:text-neon-cyan transition-colors underline underline-offset-2 decoration-neon-cyan/30 ${className}`}
      title={`Learn more about ${term}`}
    >
      {children || term}
      <BookOpen className="w-3 h-3 shrink-0 opacity-60" />
    </Link>
  );
}
