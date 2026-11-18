// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 18/11/2026
// │ Row actions: one "⋮" button per table row that opens a menu of actions
// └──────────────────────────────────────────────────────────────────────────┘

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface RowAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
  hidden?: boolean;
}

const WIDTH = 192;

export default function RowActions({ actions }: { actions: RowAction[] }) {
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const visible = actions.filter((a) => !a.hidden);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const outside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) close();
    };
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  const toggle = () => {
    if (pos) return setPos(null);
    const r = button.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(r.right - WIDTH, window.innerWidth - WIDTH - 8));
    const opensUp = window.innerHeight - r.bottom < visible.length * 40 + 24;
    setPos(opensUp ? { bottom: window.innerHeight - r.top + 4, left } : { top: r.bottom + 4, left });
  };

  if (visible.length === 0) return null;

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label="Actions"
        aria-haspopup="menu"
        aria-expanded={!!pos}
        onClick={toggle}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      {pos &&
        createPortal(
          <div
            ref={panel}
            role="menu"
            style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, width: WIDTH, zIndex: 99990 }}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
          >
            {visible.map((a) => (
              <button
                key={a.label}
                type="button"
                role="menuitem"
                disabled={a.disabled}
                title={a.title}
                onClick={() => {
                  setPos(null);
                  a.onClick();
                }}
                className={`block w-full px-4 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                  a.danger
                    ? 'text-error-600 hover:bg-error-50 dark:text-error-500 dark:hover:bg-error-500/10'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.05]'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
