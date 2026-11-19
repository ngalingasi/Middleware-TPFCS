import { useEffect, useId, useRef } from 'react';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.css';
import type { SVGProps } from 'react';

// Inline calendar icon - deliberately not imported from the shared icons
// barrel (../../icons), which pulls in every icon in the project at once
// and has a known-broken entry (ai-icon.svg) that fails to transform
// under this project's Vite + vite-plugin-svgr combo. Same fix pattern
// as EyeIcons.tsx.
function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 2C8.41421 2 8.75 2.33579 8.75 2.75V3.75H15.25V2.75C15.25 2.33579 15.5858 2 16 2C16.4142 2 16.75 2.33579 16.75 2.75V3.75H18.5C19.7426 3.75 20.75 4.75736 20.75 6V9V19C20.75 20.2426 19.7426 21.25 18.5 21.25H5.5C4.25736 21.25 3.25 20.2426 3.25 19V9V6C3.25 4.75736 4.25736 3.75 5.5 3.75H7.25V2.75C7.25 2.33579 7.58579 2 8 2ZM8 5.25H5.5C5.08579 5.25 4.75 5.58579 4.75 6V8.25H19.25V6C19.25 5.58579 18.9142 5.25 18.5 5.25H16H8ZM19.25 9.75H4.75V19C4.75 19.4142 5.08579 19.75 5.5 19.75H18.5C18.9142 19.75 19.25 19.4142 19.25 19V9.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

// The area the calendar must stay inside: the nearest scrolling box (a dialog body, for
// example), otherwise the window.
function boundsOf(el: HTMLElement) {
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'hidden') {
      const r = node.getBoundingClientRect();
      return { top: Math.max(r.top, 0), bottom: Math.min(r.bottom, window.innerHeight), left: Math.max(r.left, 0), right: Math.min(r.right, window.innerWidth) };
    }
  }
  return { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };
}

// Opens above the field when there is room (that keeps it off the table or form below it),
// below when there is not, and slides sideways if it would leave the screen.
function placeCalendar(instance: flatpickr.Instance) {
  const calendar = instance.calendarContainer;
  const input = instance.input.getBoundingClientRect();
  const area = boundsOf(instance.input);
  const height = calendar.offsetHeight || 330;
  const room = { above: input.top - area.top, below: area.bottom - input.bottom };
  const above = room.above >= height + 8 || room.above > room.below;

  calendar.style.top = above ? 'auto' : '';
  calendar.style.bottom = above ? 'calc(100% + 2px)' : '';

  const box = calendar.getBoundingClientRect();
  const slide = box.right > area.right - 8 ? area.right - 8 - box.right : box.left < area.left + 8 ? area.left + 8 - box.left : 0;
  if (slide) calendar.style.left = `${(parseFloat(calendar.style.left) || 0) + slide}px`;
}

interface GepgDatePickerProps {
  value?: string; // 'YYYY-MM-DD'
  onChange: (date: string) => void;
  placeholder?: string;
  id?: string;
  /** shows a small x that empties the date; for filters */
  clearable?: boolean;
  /** 'YYYY-MM-DD' limits, so a "from" date cannot pass its "to" date */
  minDate?: string;
  maxDate?: string;
  size?: 'sm' | 'md';
}

/**
 * Compact flatpickr-backed date input, used anywhere the app needs a date
 * (bill expiry, reconciliation transaction date, log filters) instead of the
 * native browser <input type="date"> picker. The value is controlled: when the
 * parent changes or clears it, the calendar follows.
 */
export default function GepgDatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  id,
  clearable = false,
  minDate,
  maxDate,
  size = 'sm',
}: GepgDatePickerProps) {
  const generatedId = useId().replace(/:/g, '');
  const inputId = id ?? `gepg-date-${generatedId}`;
  const picker = useRef<flatpickr.Instance | null>(null);
  const callback = useRef(onChange);
  callback.current = onChange;

  useEffect(() => {
    const instance = flatpickr(`#${inputId}`, {
      static: true,
      monthSelectorType: 'static',
      dateFormat: 'Y-m-d',
      defaultDate: value || undefined,
      minDate,
      maxDate,
      onChange: (_dates, dateStr) => callback.current(dateStr),
      onOpen: (_dates, _str, self) => requestAnimationFrame(() => placeCalendar(self)),
      onMonthChange: (_dates, _str, self) => requestAnimationFrame(() => placeCalendar(self)),
    });
    picker.current = Array.isArray(instance) ? instance[0] : instance;

    return () => {
      picker.current?.destroy();
      picker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputId]);

  useEffect(() => {
    const instance = picker.current;
    if (!instance) return;
    if ((value || '') !== instance.input.value) instance.setDate(value || '', false);
  }, [value]);

  useEffect(() => {
    picker.current?.set('minDate', minDate || undefined);
    picker.current?.set('maxDate', maxDate || undefined);
  }, [minDate, maxDate]);

  return (
    <div className="relative">
      <input
        id={inputId}
        placeholder={placeholder}
        readOnly
        className={`${size === 'md' ? 'h-10' : 'h-9'} w-full cursor-pointer rounded-lg border appearance-none px-3 py-2 ${clearable ? 'pr-14' : 'pr-9'} text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:focus:border-brand-800`}
      />
      {clearable && value && (
        <button
          type="button"
          aria-label="Clear date"
          onClick={() => picker.current?.clear()}
          className="absolute right-9 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-gray-400">
        <CalendarIcon className="size-4" />
      </span>
    </div>
  );
}
