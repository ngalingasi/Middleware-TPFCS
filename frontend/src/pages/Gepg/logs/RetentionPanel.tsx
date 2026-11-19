// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 19/11/2026
// │ Retention panel: how long logs are kept, what is stored now, and a clean-up button
// └──────────────────────────────────────────────────────────────────────────┘

import { useCallback, useEffect, useState } from 'react';
import Button from '../../../components/ui/button/Button';
import { toast } from '../../../components/tpfcs/Toast';
import { gepgSettingsApi } from '../../../api/gepgSettings';
import { logsApi, type RetentionOverview } from '../../../api/logs';
import { gepgErrorMessage } from '../../../utils/gepgError';
import { fieldClass, when } from './shared';

const STORAGE_KEY = 'gepg_logs_retention_open';

// the choice is a convenience only; a blocked localStorage must not break the page
const remembered = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

export default function RetentionPanel() {
  const [open, setOpen] = useState(remembered);
  const [overview, setOverview] = useState<RetentionOverview | null>(null);
  const [messages, setMessages] = useState('');
  const [audit, setAudit] = useState('');
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const load = useCallback(() => {
    logsApi
      .retention()
      .then((res) => {
        setOverview(res.data.data);
        setMessages(String(res.data.data.messages.days));
        setAudit(String(res.data.data.audit.days));
      })
      .catch((err) => toast.error('Failed to load the log retention', gepgErrorMessage(err)));
  }, []);

  useEffect(load, [load]);

  if (!overview) return null;

  const toggle = () => {
    setOpen((value) => {
      try {
        localStorage.setItem(STORAGE_KEY, value ? '0' : '1');
      } catch {
        /* not remembered */
      }
      return !value;
    });
  };

  const dirty = messages !== String(overview.messages.days) || audit !== String(overview.audit.days);

  const save = async () => {
    setSaving(true);
    try {
      await gepgSettingsApi.update({ log_days_messages: messages, log_days_audit: audit });
      toast.success('Retention saved', 'Applies at the next daily clean-up');
      load();
    } catch (err: any) {
      const errors = err?.response?.data?.errors;
      toast.error('Not saved', errors ? Object.values(errors).join(' ') : gepgErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const cleanNow = async () => {
    if (!window.confirm(`Delete messages older than ${overview.messages.days} days and audit and sign-in history older than ${overview.audit.days} days from the database now?`)) return;
    setCleaning(true);
    try {
      const res = await logsApi.runRetention();
      toast.success('Clean-up done', res.data.message);
      load();
    } catch (err) {
      toast.error('Clean-up failed', gepgErrorMessage(err));
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center justify-between gap-3 p-4 text-left">
        <div className="min-w-0">
          <h3 className="text-base font-medium text-gray-800 dark:text-white/90">How long logs are kept</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {open
              ? 'Older rows are deleted from the database once a day. Change the days here or on the Settings page.'
              : `Raw messages ${overview.messages.days} days · audit and sign-ins ${overview.audit.days} days`}
          </p>
        </div>
        <svg className={`h-5 w-5 flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-100 p-4 dark:border-gray-800">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Raw messages (days): billing system requests, calls to GePG, GePG callbacks</label>
              <input className={`${fieldClass} mt-1`} inputMode="numeric" value={messages} onChange={(e) => setMessages(e.target.value.replace(/\D/g, '').slice(0, 4))} />
              <p className="mt-1 text-xs text-gray-400">
                Now {overview.messages.total.toLocaleString()} stored, oldest {when(overview.messages.oldest)}
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Audit and sign-in history (days)</label>
              <input className={`${fieldClass} mt-1`} inputMode="numeric" value={audit} onChange={(e) => setAudit(e.target.value.replace(/\D/g, '').slice(0, 4))} />
              <p className="mt-1 text-xs text-gray-400">
                Now {overview.audit.total.toLocaleString()} stored, oldest {when(overview.audit.oldest)}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" disabled={cleaning} onClick={cleanNow}>
              {cleaning ? 'Cleaning…' : 'Clean up now'}
            </Button>
            <Button size="sm" disabled={!dirty || saving} onClick={save}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
