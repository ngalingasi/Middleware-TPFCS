import { useEffect, useId } from 'react';
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

interface GepgDatePickerProps {
  value?: string; // 'YYYY-MM-DD'
  onChange: (date: string) => void;
  placeholder?: string;
  id?: string;
}

/**
 * Compact flatpickr-backed date input, used anywhere the app needs a date
 * (bill expiry, reconciliation transaction date) instead of the native
 * browser <input type="date"> picker.
 */
export default function GepgDatePicker({ value, onChange, placeholder = 'Select date', id }: GepgDatePickerProps) {
  const generatedId = useId().replace(/:/g, '');
  const inputId = id ?? `gepg-date-${generatedId}`;

  useEffect(() => {
    const instance = flatpickr(`#${inputId}`, {
      static: true,
      monthSelectorType: 'static',
      dateFormat: 'Y-m-d',
      defaultDate: value || undefined,
      onChange: (selectedDates, dateStr) => onChange(dateStr),
    });

    return () => {
      if (!Array.isArray(instance)) {
        instance.destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputId]);

  return (
    <div className="relative">
      <input
        id={inputId}
        placeholder={placeholder}
        readOnly
        className="h-9 w-full cursor-pointer rounded-lg border appearance-none px-3 py-2 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:focus:border-brand-800"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-gray-400">
        <CalendarIcon className="size-4" />
      </span>
    </div>
  );
}
