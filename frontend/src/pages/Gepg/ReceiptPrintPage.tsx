// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Receipt print page
// └──────────────────────────────────────────────────────────────────────────┘

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import ReceiptDocument from '../../components/gepg/print/ReceiptDocument';
import { paymentsApi } from '../../api/payments';
import type { PrintReceiptDocument } from '../../types/gepg';
import { gepgErrorMessage } from '../../utils/gepgError';

/** Standalone print view for a GePG receipt - see BillPrintPage for why it sits outside the app shell. */
export default function ReceiptPrintPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();

  const [doc, setDoc] = useState<PrintReceiptDocument | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!paymentId) return;
    paymentsApi
      .receiptData(paymentId)
      .then((res) => setDoc(res.data.data))
      .catch((err) => setError(gepgErrorMessage(err, 'Could not load the receipt')))
      .finally(() => setLoading(false));
  }, [paymentId]);

  return (
    <div style={{ background: '#eee', minHeight: '100vh', padding: '12px' }}>
      <div className="no-print mx-auto mb-3 flex max-w-[190mm] items-center gap-2 text-sm">
        <button type="button" onClick={() => navigate(`/payments/${paymentId}`)} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-gray-700 hover:bg-gray-50">
          ← Back to payment
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!doc}
          className="ml-auto rounded-lg bg-brand-500 px-4 py-1.5 font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          Print
        </button>
      </div>

      {loading && <p className="no-print text-center text-sm text-gray-600">Loading…</p>}
      {error && <p className="no-print mx-auto max-w-[190mm] rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {doc && (
        <>
          {doc.warnings.length > 0 && (
            <div className="no-print mx-auto mb-3 max-w-[190mm]">
              {doc.warnings.map((w) => (
                <div key={w} className="gepg-doc-screen-note">
                  {w}
                </div>
              ))}
            </div>
          )}
          <ReceiptDocument doc={doc} />
        </>
      )}
    </div>
  );
}
