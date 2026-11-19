// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 19/11/2026
// │ Shared pieces of the Logs page: styles, filter inputs and the pager
// └──────────────────────────────────────────────────────────────────────────┘

import Button from '../../../components/ui/button/Button';
import GepgDatePicker from '../../../components/form/GepgDatePicker';

export const th = 'px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300';
export const fieldClass =
  'h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90';

export const when = (v?: string | null) => (v ? new Date(v).toLocaleString() : '—');

export const size = (n?: number | null) => (n ? (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`) : '—');

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block min-w-[140px] flex-1 text-xs text-gray-500 dark:text-gray-400">
      <span className="mb-1 block">{label}</span>
      {children}
    </div>
  );
}

export function Pager({ page, pages, total, noun, onPage }: { page: number; pages: number; total: number; noun: string; onPage: (page: number) => void }) {
  return (
    <div className="flex items-center justify-between p-3 text-sm text-gray-500 dark:text-gray-400">
      <span>
        {total.toLocaleString()} {total === 1 ? noun : noun.replace(/y$/, 'ie') + 's'}
      </span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <span>
          Page {page} of {pages}
        </span>
        <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

export function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="break-words text-gray-700 dark:text-gray-300">{children || '—'}</dd>
    </div>
  );
}

// The From / To pair used by every log tab: a calendar, and "from" can never pass "to".
export function DateRange({ startDate, endDate, onChange }: { startDate: string; endDate: string; onChange: (key: 'startDate' | 'endDate', value: string) => void }) {
  return (
    <>
      <Field label="From date">
        <GepgDatePicker size="md" clearable placeholder="Any" value={startDate} maxDate={endDate || undefined} onChange={(v) => onChange('startDate', v)} />
      </Field>
      <Field label="To date">
        <GepgDatePicker size="md" clearable placeholder="Any" value={endDate} minDate={startDate || undefined} onChange={(v) => onChange('endDate', v)} />
      </Field>
    </>
  );
}
