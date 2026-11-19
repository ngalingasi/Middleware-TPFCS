// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 19/11/2026
// │ Payload viewer: a raw request or answer, formatted, with a copy button
// └──────────────────────────────────────────────────────────────────────────┘

import { useMemo, useState } from 'react';

function prettyXml(xml: string): string {
  const tokens = xml.match(/<[^>]+>|[^<]+/g) ?? [];
  const lines: string[] = [];
  let depth = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const pad = '  '.repeat(depth);
    if (token.startsWith('</')) {
      depth = Math.max(depth - 1, 0);
      lines.push('  '.repeat(depth) + token);
    } else if (token.startsWith('<')) {
      const selfClosing = /\/>$/.test(token) || /^<[?!]/.test(token);
      const next = tokens[i + 1];
      if (!selfClosing && next && !next.startsWith('<') && tokens[i + 2]?.startsWith('</')) {
        lines.push(pad + token + next.trim() + tokens[i + 2]);
        i += 2;
      } else if (!selfClosing && next?.startsWith('</')) {
        lines.push(pad + token + next);
        i += 1;
      } else {
        lines.push(pad + token);
        if (!selfClosing) depth += 1;
      }
    } else if (token.trim()) {
      lines.push(pad + token.trim());
    }
  }
  return lines.join('\n');
}

function format(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return text;
    }
  }
  if (trimmed.startsWith('<')) {
    const joined = trimmed.replace(/>\s*</g, '><');
    return joined.length < 200000 ? prettyXml(joined) : text;
  }
  return text;
}

interface Props {
  title: string;
  text: string | null | undefined;
  note?: string;
}

export default function PayloadViewer({ title, text, note }: Props) {
  const [raw, setRaw] = useState(false);
  const [copied, setCopied] = useState(false);
  const shown = useMemo(() => (text ? (raw ? text : format(text)) : ''), [text, raw]);

  const copy = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="font-medium text-gray-800 dark:text-white/90">
          {title}
          {text ? <span className="ml-2 text-xs font-normal text-gray-400">{text.length.toLocaleString()} characters</span> : null}
        </p>
        {text && (
          <div className="flex gap-3 text-xs">
            <button type="button" onClick={() => setRaw((v) => !v)} className="text-brand-600 hover:underline dark:text-brand-400">
              {raw ? 'Formatted' : 'Exactly as received'}
            </button>
            <button type="button" onClick={copy} className="text-brand-600 hover:underline dark:text-brand-400">
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>
      {note && <p className="mb-1 text-xs text-gray-400">{note}</p>}
      {text ? (
        <pre className="max-h-72 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-800 dark:bg-white/[0.04] dark:text-gray-200">{shown}</pre>
      ) : (
        <p className="text-sm text-gray-400">Nothing was recorded.</p>
      )}
    </div>
  );
}
