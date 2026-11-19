// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 19/11/2026
// │ Sessions tab: who is signed in now, with a way to end a session
// └──────────────────────────────────────────────────────────────────────────┘

import { useCallback, useEffect, useState } from 'react';
import Badge from '../../../components/ui/badge/Badge';
import Button from '../../../components/ui/button/Button';
import { toast } from '../../../components/tpfcs/Toast';
import { logsApi, type ActiveSession } from '../../../api/logs';
import { gepgErrorMessage } from '../../../utils/gepgError';
import { th, when } from './shared';

export default function SessionsTab() {
  const [rows, setRows] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    logsApi
      .sessions()
      .then((res) => setRows(res.data.data))
      .catch((err) => toast.error('Failed to load the sessions', gepgErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const end = async (s: ActiveSession) => {
    if (!window.confirm(`Sign ${s.username ?? 'this user'} out of the session from ${s.ip_address ?? 'unknown address'}?`)) return;
    try {
      await logsApi.endSession(s.id);
      toast.success('Session ended', s.username ?? '');
      load();
    } catch (err) {
      toast.error('Could not end the session', gepgErrorMessage(err));
    }
  };

  return (
    <div>
      <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
        Everyone who is signed in right now. Ending a session signs that browser out the next time it talks to the bridge.
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="min-w-full">
          <thead className="bg-gray-50 dark:bg-white/[0.03]">
            <tr>
              <th className={th}>User</th>
              <th className={th}>Role</th>
              <th className={th}>IP address</th>
              <th className={th}>Browser</th>
              <th className={th}>Signed in</th>
              <th className={th}>Expires</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-center text-sm text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-400">
                  Nobody is signed in.
                </td>
              </tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="odd:bg-white even:bg-gray-50 dark:odd:bg-transparent dark:even:bg-white/[0.03]">
                <td className="px-3 py-2 text-sm text-gray-800 dark:text-white/90">
                  {s.username ?? '—'} {s.current && <Badge size="sm" color="success">You</Badge>}
                </td>
                <td className="px-3 py-2 text-sm text-gray-500">{s.role ?? '—'}</td>
                <td className="px-3 py-2 text-sm text-gray-500">{s.ip_address ?? '—'}</td>
                <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{s.browser || '—'}</td>
                <td className="px-3 py-2 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">{when(s.created_at)}</td>
                <td className="px-3 py-2 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">{when(s.expires_at)}</td>
                <td className="px-3 py-2 text-right">
                  {!s.current && (
                    <Button size="sm" variant="outline" onClick={() => end(s)}>
                      End session
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
