import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * Breadcrumb navigation for sub-pages.
 * @param {{ items: Array<{ label: string, path?: string }> }} props
 */
const Breadcrumb = ({ items, className = '' }) => (
  <nav className={`flex items-center gap-1.5 text-xs text-gray-400 ${className}`} aria-label="Breadcrumb">
    {items.map((item, i) => (
      <Fragment key={i}>
        {i > 0 && <ChevronRight className="w-3 h-3 text-gray-600 shrink-0" />}
        {item.path ? (
          <Link to={item.path} className="hover:text-accent-cyan transition-colors truncate">
            {item.label}
          </Link>
        ) : (
          <span className="text-white truncate" aria-current="page">{item.label}</span>
        )}
      </Fragment>
    ))}
  </nav>
);

export default Breadcrumb;
