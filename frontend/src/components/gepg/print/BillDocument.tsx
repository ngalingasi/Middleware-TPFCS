// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Printable GePG bill and TISS/SWIFT transfer bill document
// └──────────────────────────────────────────────────────────────────────────┘

import type { ReactNode } from 'react';
import type { PrintBillDocument } from '../../../types/gepg';
import './printDocuments.css';

function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <tr>
      <td className="label">{label}</td>
      <td className={`value${strong ? ' strong' : ''}`} colSpan={2}>
        {children}
      </td>
    </tr>
  );
}

function Logo({ src, className }: { src: string; className?: string }) {
  // Logo files are supplied by the institution (public/images/gepg/); hide
  // the slot cleanly if one is missing instead of showing a broken image.
  return <img src={src} alt="" className={className} onError={(e) => ((e.currentTarget.style.visibility = 'hidden'))} />;
}

function Heading({ doc }: { doc: PrintBillDocument }) {
  return (
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
      <div className="gepg-doc-title">{doc.title}</div>
    </div>
  );
}

function Qr({ doc }: { doc: PrintBillDocument }) {
  if (!doc.qr) return null;

  return (
    <div className="gepg-doc-qr">
      {doc.qr.image ? (
        <>
          <img src={doc.qr.image} alt="GePG payment QR code" />
          <div>{doc.qr.caption}</div>
        </>
      ) : (
        // No image (qrcode package missing on the server): show the message so
        // nothing is lost, on screen only - an official print should not carry it.
        <div className="gepg-doc-qr-missing no-print">QR message: {JSON.stringify(doc.qr.payload)}</div>
      )}
    </div>
  );
}

function Items({ doc }: { doc: PrintBillDocument }) {
  const { bill } = doc;
  return (
    <table className="gepg-doc-rows">
      <tbody>
        {bill.items.map((item) => (
          <tr key={item.no}>
            <td className="label">Billed Item ({item.no})</td>
            <td className="value">{item.description}</td>
            <td className="amount">: {item.amount}</td>
          </tr>
        ))}
        <tr className="total">
          <td className="label">Total Billed Amount</td>
          <td />
          <td className="amount">
            : {bill.total} ({bill.currency})
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function Footer() {
  return <div className="gepg-doc-footer">Government e Payment Gateway © {new Date().getFullYear()} All Rights Reserved (GePG)</div>;
}

function HowToPay({ doc }: { doc: PrintBillDocument }) {
  const { payment } = doc;
  const cn = payment.controlNumber;
  const banks = payment.banks.length > 0 ? payment.banks.join(', ') : null;

  return (
    <div className="gepg-doc-howto">
      <div>
        <strong>Jinsi ya Kulipa</strong>
        <p>
          1. Kupitia Benki: Fika tawi lolote au wakala wa benki {banks ? `ya ${banks}` : 'iliyounganishwa na GePG'}. Namba ya kumbukumbu:{' '}
          <strong>{cn}</strong>.
        </p>
        {payment.mobileMoney && (
          <>
            <p>2. Kupitia Mitandao ya Simu:</p>
            <ul>
              <li>Ingia kwenye menyu ya mtandao husika</li>
              <li>Chagua 4 (Lipa Bili)</li>
              <li>Chagua 5 (Malipo ya Serikali)</li>
              <li>
                Ingiza <strong>{cn}</strong> kama namba ya kumbukumbu
              </li>
            </ul>
          </>
        )}
      </div>
      <div>
        <strong>How to Pay</strong>
        <p>
          1. Via Bank: Visit any branch or bank agent of {banks ?? 'a GePG-connected bank'}. Reference Number: <strong>{cn}</strong>.
        </p>
        {payment.mobileMoney && (
          <>
            <p>2. Via Mobile Network Operators (MNO): Enter the respective USSD menu of the MNO</p>
            <ul>
              <li>Select 4 (Make Payments)</li>
              <li>Select 5 (Government Payments)</li>
              <li>
                Enter <strong>{cn}</strong> as reference number
              </li>
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function Closing({ doc }: { doc: PrintBillDocument }) {
  const { bill } = doc;
  return (
    <table className="gepg-doc-rows">
      <tbody>
        <Row label="Expires on">{bill.expiresOn}</Row>
        <Row label="Prepared By" strong>
          {bill.preparedBy || '—'}
        </Row>
        {bill.collectionCentre && <Row label="Collection Centre">{bill.collectionCentre}</Row>}
        <Row label="Printed By">{bill.printedBy}</Row>
        <Row label="Printed on">{bill.printedOn}</Row>
        <Row label="Signature">
          <span className="gepg-doc-signature" />
        </Row>
      </tbody>
    </table>
  );
}

/** Appendix 3: government bill, payable by bank deposit or mobile money. */
function StandardBill({ doc }: { doc: PrintBillDocument }) {
  const { bill } = doc;
  return (
    <>
      <div className="gepg-doc-split">
        <div className="grow">
          <table className="gepg-doc-rows">
            <tbody>
              <Row label="Control Number" strong>
                {bill.controlNumber}
              </Row>
              <Row label="Payment Ref" strong>
                {bill.paymentReference}
              </Row>
              <Row label="Bill Reference">{bill.billReference}</Row>
              {bill.serviceProviderCode && (
                <Row label="Service Provider Code" strong>
                  {bill.serviceProviderCode}
                </Row>
              )}
              <Row label="Payer Name">{bill.payerName}</Row>
              <Row label="Payer Phone">{bill.payerPhone || '—'}</Row>
              <Row label="Bill Description">{bill.description || '—'}</Row>
            </tbody>
          </table>
        </div>
        <Qr doc={doc} />
      </div>
      <hr className="gepg-doc-rule" />
      <Items doc={doc} />
      <table className="gepg-doc-rows">
        <tbody>
          <Row label="Amount in Words" strong>
            {bill.amountInWords}
          </Row>
        </tbody>
      </table>
      <Closing doc={doc} />
      <HowToPay doc={doc} />
    </>
  );
}

/** Appendix 2: order form for an electronic funds transfer (TISS/SWIFT). */
function TransferBill({ doc }: { doc: PrintBillDocument }) {
  const { bill } = doc;
  const t = doc.transfer;
  if (!t) return null;

  return (
    <>
      <div className="gepg-doc-section-title">(a). Remitter / Tax Payer Details :-</div>
      <table className="gepg-doc-rows">
        <tbody>
          <Row label="Name of Account Holder(s)">
            <span className="gepg-doc-dots" />
          </Row>
          <Row label="Name of Commercial Bank">
            <span className="gepg-doc-dots" />
          </Row>
          <Row label="Bank Account Number">
            <span className="gepg-doc-dots" />
          </Row>
          <Row label="Signatories">
            <span className="gepg-doc-dots" style={{ minWidth: '45mm' }} /> | <span className="gepg-doc-dots" style={{ minWidth: '45mm' }} />
          </Row>
        </tbody>
      </table>

      <div className="gepg-doc-section-title">(b). Beneficiary Details :-</div>
      <div className="gepg-doc-split">
        <div className="grow">
          <table className="gepg-doc-rows">
            <tbody>
              <Row label="Beneficiary" strong>
                {t.beneficiaryName}
              </Row>
              <Row label="Bank" strong>
                {t.bankName}
              </Row>
              <Row label="Account Number" strong>
                {t.accountNumber}
              </Row>
              <Row label="SWIFT Code" strong>
                {t.swiftCode}
              </Row>
              <Row label="Control Number" strong>
                {bill.controlNumber}
              </Row>
            </tbody>
          </table>
        </div>
        <Qr doc={doc} />
      </div>

      <table className="gepg-doc-rows">
        <tbody>
          <Row label="Beneficiary Account (Field 59 of MT103)">{t.field59}</Row>
          <Row label="Payment Reference (Field 70 of MT103)">{t.field70}</Row>
          <Row label="Transfer Amount" strong>
            {bill.total} ({bill.currency})
          </Row>
          <Row label="Amount in Words" strong>
            {bill.amountInWords}
          </Row>
          <Row label="Being payment for">{t.beingPaymentFor || '—'}</Row>
        </tbody>
      </table>
      <hr className="gepg-doc-rule" />
      <Items doc={doc} />
      <Closing doc={doc} />

      <div className="gepg-doc-note">
        <strong>Note to Commercial Bank:</strong>
        <ol>
          <li>Please capture the above information correctly. Do not change or add any text, symbols or digits on the information provided.</li>
          <li>
            Field 59 of MT103 is an <strong>"Account Number"</strong> with value: <strong>{t.field59}</strong>. Must be captured correctly.
          </li>
          <li>
            Field 70 of MT103 is a <strong>"Control Number"</strong> with value: <strong>{t.field70}</strong>. Must be captured correctly.
          </li>
        </ol>
      </div>
    </>
  );
}

export default function BillDocument({ doc }: { doc: PrintBillDocument }) {
  return (
    <div className="gepg-doc-sheet">
      <Heading doc={doc} />
      {doc.type === 'transfer' ? <TransferBill doc={doc} /> : <StandardBill doc={doc} />}
      <Footer />
    </div>
  );
}
