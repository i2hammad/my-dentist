import { imgUrl } from '../lib/api';
import { Rows, SquaresFour } from '@phosphor-icons/react';

// Table / Cards view switcher. `view` is 'table' | 'cards'.
export function ViewToggle({ view, onChange }) {
  return (
    <div className="view-toggle">
      <button className={view === 'table' ? 'active' : ''} onClick={() => onChange('table')} title="Table view">
        <Rows size={16} weight="bold" /> Table
      </button>
      <button className={view === 'cards' ? 'active' : ''} onClick={() => onChange('cards')} title="Card view">
        <SquaresFour size={16} weight="bold" /> Cards
      </button>
    </div>
  );
}

export function PageHeader({ title, crumb, actions }) {
  return (
    <div className="card-head" style={{ alignItems: 'flex-start' }}>
      <div>
        <div className="page-title">{title}</div>
        <div className="breadcrumb">Dashboard {crumb ? `› ${crumb}` : ''}</div>
      </div>
      <div className="row-actions">{actions}</div>
    </div>
  );
}

const TONES = ['blue', 'green', 'amber', 'purple'];
export function StatCards({ items }) {
  // Filled look: solid gradient color tile + white glyph (matches the design).
  const grad = {
    blue: 'linear-gradient(135deg,#3B82F6,#2563EB)',
    green: 'linear-gradient(135deg,#34D399,#10B981)',
    amber: 'linear-gradient(135deg,#FBBF24,#F59E0B)',
    purple: 'linear-gradient(135deg,#A78BFA,#8B5CF6)',
  };
  return (
    <div className="stat-grid">
      {items.map((s, i) => {
        const tone = s.tone || TONES[i % TONES.length];
        const Icon = s.icon;
        return (
          <div className="stat-card" key={i}>
            <div className="icon" style={{ background: grad[tone], color: '#fff' }}>
              {Icon ? <Icon size={24} /> : null}
            </div>
            <div>
              <div className="label">{s.label}</div>
              <div className="value">{s.value}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// When `onClick` is provided the whole cell becomes clickable (e.g. open detail).
export function UserCell({ name, sub, img, onClick }) {
  return (
    <div className={'cell-user' + (onClick ? ' clickable' : '')} onClick={onClick} role={onClick ? 'button' : undefined}>
      {img ? <img className="avatar" src={imgUrl(img)} alt="" /> : <div className="avatar" />}
      <div>
        <div className="name">{name || '—'}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
    </div>
  );
}

// Popular badge: green = earned (20k pts), blue = paid.
export function PopularBadge({ type }) {
  if (!type) return null;
  return (
    <span className={`badge ${type === 'paid' ? 'blue' : 'green'}`} title={type === 'paid' ? 'Paid popular' : 'Earned (20k+ points)'}>
      ★ Popular{type === 'paid' ? ' (Paid)' : ''}
    </span>
  );
}

export function Stars({ value = 0 }) {
  const full = Math.round(value);
  return <span className="stars">{'★'.repeat(full)}{'☆'.repeat(Math.max(0, 5 - full))}</span>;
}

export function Pagination({ page, pages, total, onPage }) {
  if (!pages) return null;
  const nums = [];
  for (let i = 1; i <= pages && i <= 5; i++) nums.push(i);
  return (
    <div className="pagination">
      <span>{total} total · page {page} of {pages}</span>
      <div className="pages">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</button>
        {nums.map((n) => (
          <button key={n} className={n === page ? 'active' : ''} onClick={() => onPage(n)}>{n}</button>
        ))}
        <button disabled={page >= pages} onClick={() => onPage(page + 1)}>›</button>
      </div>
    </div>
  );
}

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
export const money = (n) => 'Rs. ' + (n || 0).toLocaleString();
