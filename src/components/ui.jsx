import { useEffect } from 'react';
import { X } from 'lucide-react';

export function Kbd({ children }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function StackedBar({ new: n = 0, learning = 0, mastered = 0, className = '' }) {
  const total = n + learning + mastered || 1;
  return (
    <div className={`flex h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 ${className}`} role="img"
      aria-label={`${mastered} mastered, ${learning} learning, ${n} new`}>
      <div className="bg-emerald-500" style={{ width: `${(mastered / total) * 100}%` }} />
      <div className="bg-amber-400" style={{ width: `${(learning / total) * 100}%` }} />
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div className={`card max-h-[92vh] w-full overflow-auto ${wide ? 'max-w-3xl' : 'max-w-xl'}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <h3 className="font-semibold">{title}</h3>
          <button className="btn-ghost !p-1.5" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export const STATUS_STYLE = {
  new: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  learning: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  mastered: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
};

export function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_STYLE[status]}`}>{status}</span>;
}

export function PosBadge({ pos }) {
  if (!pos) return null;
  return <span className="badge bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300">{pos}</span>;
}

export function Empty({ children }) {
  return <div className="card p-10 text-center text-slate-500 dark:text-slate-400">{children}</div>;
}
