import { useEffect, useState } from 'react';
import { useObservable } from 'dexie-react-hooks';
import { Cloud, CloudOff, RefreshCw, LogIn, LogOut, CheckCircle2, AlertTriangle } from 'lucide-react';
import { db, cloudEnabled } from '../lib/db.js';
import { afterSync } from '../lib/boot.js';

/** Header control: sign in / sync status / sign out. Renders nothing in local-only builds. */
export default function SyncBadge() {
  if (!cloudEnabled) return null;
  return <CloudControl />;
}

function CloudControl() {
  const user = useObservable(db.cloud.currentUser);
  const sync = useObservable(db.cloud.syncState);
  const [open, setOpen] = useState(false);
  const signedIn = !!user?.isLoggedIn;

  // Once a signed-in device is fully in sync: collapse duplicates, seed if the cloud was empty.
  useEffect(() => {
    if (signedIn && sync?.phase === 'in-sync') afterSync().catch((e) => console.warn(e));
  }, [signedIn, sync?.phase]);

  if (!signedIn)
    return (
      <button className="btn-outline !px-2.5 !py-1.5" onClick={() => db.cloud.login()} title="Sign in to sync your progress across devices">
        <LogIn size={15} /> <span className="hidden sm:inline">Sign in to sync</span>
      </button>
    );

  const busy = ['pushing', 'pulling', 'not-in-sync', 'initial'].includes(sync?.phase) && sync?.status !== 'offline';
  const offline = sync?.phase === 'offline' || sync?.status === 'offline' || sync?.status === 'disconnected';
  const error = sync?.phase === 'error';
  const Icon = error ? AlertTriangle : offline ? CloudOff : busy ? RefreshCw : CheckCircle2;
  const label = error ? 'Sync error' : offline ? 'Offline' : busy ? 'Syncing…' : 'Synced';

  return (
    <div className="relative">
      <button className="btn-ghost !px-2.5 !py-1.5" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Icon size={16} className={`${busy ? 'animate-spin' : ''} ${error ? 'text-rose-500' : offline ? 'text-slate-400' : 'text-emerald-500'}`} />
        <span className="hidden text-xs sm:inline">{label}</span>
      </button>
      {open && (
        <div className="card absolute right-0 top-full z-40 mt-2 w-64 space-y-2 p-3 text-sm" onMouseLeave={() => setOpen(false)}>
          <div className="flex items-center gap-2 text-xs text-slate-500"><Cloud size={14} /> {user.email || user.name || user.userId}</div>
          {error && <p className="text-xs text-rose-600">{sync?.error?.message || 'Could not sync. Will retry.'}</p>}
          <button className="btn-outline w-full justify-start" onClick={() => db.cloud.sync({ purpose: 'pull' }).catch(() => {})}><RefreshCw size={14} /> Sync now</button>
          <button className="btn-ghost w-full justify-start text-rose-600" onClick={() => { setOpen(false); db.cloud.logout(); }}><LogOut size={14} /> Sign out</button>
        </div>
      )}
    </div>
  );
}
