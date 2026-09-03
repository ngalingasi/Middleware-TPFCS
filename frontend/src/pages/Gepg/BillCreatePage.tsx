import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ComponentCard from '../../components/common/ComponentCard';
import Label from '../../components/form/Label';
import Input from '../../components/form/input/InputField';
import Select from '../../components/form/Select';
import GepgDatePicker from '../../components/form/GepgDatePicker';
import Button from '../../components/ui/button/Button';
import { billsApi } from '../../api/bills';
import { gfsCodesApi } from '../../api/gfsCodes';
import type { CreateBillPayload, GfsCodeRecord } from '../../types/gepg';
import { toast } from '../../components/tpfcs/Toast';

interface ItemRow {
  uid: number; // stable identity for React's key - array index isn't
  // enough here: Select (below) is uncontrolled (defaultValue only, no
  // re-sync after mount), so removing a middle row would otherwise leave
  // a stale dropdown value showing at the shifted position.
  billItemRef: string;
  billItemAmount: string;
  gfsCode: string;
}

export default function BillCreatePage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const [billId, setBillId] = useState('');
  const [payerId, setPayerId] = useState('');
  const [payerName, setPayerName] = useState('');
  const [payerCellNumber, setPayerCellNumber] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [billDescription, setBillDescription] = useState('');
  const [billExpiryDate, setBillExpiryDate] = useState('');
  const [currency, setCurrency] = useState('TZS');

  const nextUid = useRef(1);
  const emptyItem = (): ItemRow => ({ uid: nextUid.current++, billItemRef: '', billItemAmount: '', gfsCode: '' });
  const [items, setItems] = useState<ItemRow[]>(() => [emptyItem()]);
  const [submitImmediately, setSubmitImmediately] = useState(true);

  const [gfsCodes, setGfsCodes] = useState<GfsCodeRecord[]>([]);
  const [loadingGfsCodes, setLoadingGfsCodes] = useState(true);

  useEffect(() => {
    gfsCodesApi
      .listActive()
      .then((res) => setGfsCodes(res.data.data))
      .catch(() => toast.error('Failed to load GFS codes', 'Bill items cannot be created until this list loads - try refreshing.'))
      .finally(() => setLoadingGfsCodes(false));
  }, []);

  const gfsCodeOptions = gfsCodes.map((g) => ({
    value: g.code,
    label: g.description ? `${g.code} — ${g.description}` : g.code,
  }));

  const totalAmount = items.reduce((sum, it) => sum + (parseFloat(it.billItemAmount) || 0), 0);

  const updateItem = (uid: number, field: keyof ItemRow, value: string) => {
    setItems((prev) => prev.map((it) => (it.uid === uid ? { ...it, [field]: value } : it)));
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (uid: number) => setItems((prev) => prev.filter((it) => it.uid !== uid));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!billId || !payerId || !payerName || !billExpiryDate || items.some((it) => !it.billItemRef || !it.billItemAmount || !it.gfsCode)) {
      toast.error('Missing fields', 'Please fill in all required fields including at least one complete bill item.');
      return;
    }

    const payload: CreateBillPayload = {
      billId,
      billAmount: totalAmount,
      billEquivAmount: totalAmount,
      billExpiryDate,
      payerId,
      payerName,
      payerCellNumber: payerCellNumber || undefined,
      payerEmail: payerEmail || undefined,
      billDescription: billDescription || undefined,
      currency,
      items: items.map((it) => ({
        billItemRef: it.billItemRef,
        billItemAmount: parseFloat(it.billItemAmount),
        billItemEquivAmount: parseFloat(it.billItemAmount),
        gfsCode: it.gfsCode,
      })),
    };

    setSubmitting(true);
    try {
      if (submitImmediately) {
        await billsApi.createAndSubmit(payload);
        toast.success('Bill created and submitted to GePG');
      } else {
        await billsApi.create(payload);
        toast.success('Bill created', 'Submit it to GePG when ready.');
      }
      navigate(`/bills/${billId}`);
    } catch (err: any) {
      toast.error('Failed to create bill', err?.response?.data?.message ?? 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageMeta title="New Bill | Tanzania Police Force Corporation Sole" description="Create a new bill" />
      <PageBreadcrumb pageTitle="New Bill" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <ComponentCard title="Bill Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Bill ID *</Label>
              <Input value={billId} onChange={(e) => setBillId(e.target.value)} placeholder="e.g. BILL-0001" />
            </div>
            <div>
              <Label>Expiry Date *</Label>
              <GepgDatePicker value={billExpiryDate} onChange={setBillExpiryDate} placeholder="Select expiry date" />
            </div>
            <div>
              <Label>Currency</Label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={billDescription} onChange={(e) => setBillDescription(e.target.value)} placeholder="Optional" />
            </div>
          </div>
        </ComponentCard>

        <ComponentCard title="Payer">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Payer ID *</Label>
              <Input value={payerId} onChange={(e) => setPayerId(e.target.value)} />
            </div>
            <div>
              <Label>Payer Name *</Label>
              <Input value={payerName} onChange={(e) => setPayerName(e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={payerCellNumber} onChange={(e) => setPayerCellNumber(e.target.value)} placeholder="255700000000" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={payerEmail} onChange={(e) => setPayerEmail(e.target.value)} />
            </div>
          </div>
        </ComponentCard>

        <ComponentCard title="Bill Items" desc="Each item needs a GFS (Government Finance Statistics) code">
          <div className="space-y-4">
            {!loadingGfsCodes && gfsCodes.length === 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
                No GFS codes configured yet — ask an admin to add one under GFS Codes before creating a bill.
              </p>
            )}
            {items.map((item) => (
              <div key={item.uid} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-100 p-3 sm:grid-cols-[1fr_1fr_1fr_auto] dark:border-gray-800">
                <div>
                  <Label>Item Ref *</Label>
                  <Input value={item.billItemRef} onChange={(e) => updateItem(item.uid, 'billItemRef', e.target.value)} />
                </div>
                <div>
                  <Label>GFS Code *</Label>
                  <Select
                    options={gfsCodeOptions}
                    defaultValue={item.gfsCode}
                    placeholder={loadingGfsCodes ? 'Loading…' : 'Select GFS code'}
                    onChange={(value) => updateItem(item.uid, 'gfsCode', value)}
                  />
                </div>
                <div>
                  <Label>Amount *</Label>
                  <Input type="number" value={item.billItemAmount} onChange={(e) => updateItem(item.uid, 'billItemAmount', e.target.value)} />
                </div>
                <div className="flex items-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => removeItem(item.uid)} disabled={items.length === 1}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              + Add Item
            </Button>

            <div className="flex justify-end border-t border-gray-100 pt-4 text-sm dark:border-gray-800">
              <span className="text-gray-500 dark:text-gray-400">
                Total: <span className="font-semibold text-gray-800 dark:text-white/90">{currency} {totalAmount.toLocaleString()}</span>
              </span>
            </div>
          </div>
        </ComponentCard>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={submitImmediately}
              onChange={(e) => setSubmitImmediately(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Submit to GePG immediately after creating
          </label>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/bills')}>
              Cancel
            </Button>
            <Button disabled={submitting}>{submitting ? 'Saving…' : 'Create Bill'}</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
