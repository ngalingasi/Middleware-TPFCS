// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Bill print page (bill and TISS/SWIFT transfer bill)
// └──────────────────────────────────────────────────────────────────────────┘

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import BillDocument from '../../components/gepg/print/BillDocument';
import { billsApi } from '../../api/bills';
import type { PrintBillDocument } from '../../types/gepg';
import { gepgErrorMessage } from '../../utils/gepgError';

export default function BillPrintPage() {
  const { billId } = useParams<{ billId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const type = searchParams.get('type') === 'transfer' ? 'transfer' : 'bill';

  const [doc, setDoc] = useState<PrintBillDocument | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!billId) return;
    setLoading(true);
    setError('');
    billsApi
      .printData(billId, type)
      .then((res) => setDoc(res.data.data))
      .catch((err) => setError(gepgErrorMessage(err, 'Could not load the document')))
      .finally(() => setLoading(false));
  }, [billId, type]);

  return (
    <div style={{ background: '#eee', minHeight: '100vh', padding: '12px' }}>
      <div className="no-print mx-auto mb-3 flex max-w-[190mm] flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={() => navigate(`/bills/${billId}`)} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-gray-700 hover:bg-gray-50">
          ← Back to bill
        </button>
        <Link
          to={`/bills/${billId}/print${type === 'bill' ? '?type=transfer' : ''}`}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-gray-700 hover:bg-gray-50"
        >
          {type === 'bill' ? 'Show TISS/SWIFT transfer bill' : 'Show standard bill'}
        </Link>
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
          <BillDocument doc={doc} />
        </>
      )}
    </div>
  );
}
