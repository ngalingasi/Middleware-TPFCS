// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Printable GePG (exchequer) receipt document
// └──────────────────────────────────────────────────────────────────────────┘

import type { ReactNode } from 'react';
import type { PrintReceiptDocument } from '../../../types/gepg';
import './printDocuments.css';

function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <tr>
      <td className="label">{label}</td>
      <td className={`value${strong ? ' strong' : ''}`}>{children}</td>
    </tr>
  );
}

function Logo({ src }: { src: string }) {
  return <img src={src} alt="" onError={(e) => ((e.currentTarget.style.visibility = 'hidden'))} />;
}

/** Appendix 1: GePG exchequer receipt. */
export default function ReceiptDocument({ doc }: { doc: PrintReceiptDocument }) {
  const { receipt } = doc;

  return (
    <div className="gepg-doc-sheet">
      <div className="gepg-doc-head">
        <div className="gepg-doc-logos">
          <Logo src={doc.logos.coatOfArms} />
          <Logo src={doc.logos.gepg} />
        </div>
        <div className="gepg-doc-country">
          <strong>Jamhuri ya Muungano wa Tanzania</strong>
          United Republic of Tanzania
        </div>
        {doc.institution.name && <div className="gepg-doc-institution">{doc.institution.name}</div>}
        {doc.institution.subtitle && <div className="gepg-doc-subtitle">{doc.institution.subtitle}</div>}
        <div className="gepg-doc-title">
          {doc.title}
          <div className="gepg-doc-title-sw">{doc.titleSw}</div>
        </div>
      </div>

      <table className="gepg-doc-rows" style={{ marginTop: '4mm' }}>
        <tbody>
          <Row label="Receipt No" strong>
            {receipt.receiptNumber}
          </Row>
          <Row label="Received from" strong>
            {receipt.receivedFrom}
          </Row>
          <Row label="Amount">
            {receipt.amount} ({receipt.currency})
          </Row>
          <Row label="Amount in Words">{receipt.amountInWords}</Row>
          <Row label="Outstanding Balance">
            {receipt.outstandingBalance} ({receipt.currency})
          </Row>
        </tbody>
      </table>

      <table className="gepg-doc-rows">
        <thead>
          <tr>
            <td className="label">In respect of</td>
            <td style={{ fontWeight: 700, borderBottom: '1px solid #999' }}>Item Description(s)</td>
            <td className="amount" style={{ fontWeight: 700, borderBottom: '1px solid #999' }}>
              Item Amount
            </td>
          </tr>
        </thead>
        <tbody>
          {receipt.items.map((item, i) => (
            <tr key={i}>
              <td />
              <td>{item.description}</td>
              <td className="amount">{item.amount}</td>
            </tr>
          ))}
          <tr className="total">
            <td />
            <td style={{ textAlign: 'right' }}>Total Billed Amount</td>
            <td className="amount">
              {receipt.totalBilled} ({receipt.currency})
            </td>
          </tr>
        </tbody>
      </table>

      <table className="gepg-doc-rows" style={{ marginTop: '4mm' }}>
        <tbody>
          <Row label="Bill Reference">{receipt.billReference}</Row>
          <Row label="Payment Control Number" strong>
            {receipt.controlNumber}
          </Row>
          <Row label="Payment Date">{receipt.paymentDate}</Row>
          {receipt.pspName && (
            <Row label="Paid via">
              {receipt.pspName}
              {receipt.paymentChannel ? ` (${receipt.paymentChannel})` : ''}
            </Row>
          )}
          <Row label="Issued by">{receipt.issuedBy}</Row>
          <Row label="Date Issued">{receipt.dateIssued}</Row>
          <Row label="Signature">
            <span className="gepg-doc-signature" />
          </Row>
        </tbody>
      </table>

      <div className="gepg-doc-footer">Government e Payment Gateway © {new Date().getFullYear()} All Rights Reserved (GePG)</div>
    </div>
  );
}
