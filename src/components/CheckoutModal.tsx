import { Check, Copy, Upload, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { apiFetch } from '../lib/api';

export function CheckoutModal() {
  const { data, checkoutPlanId, closeCheckout, showToast, setActiveView } = usePlatform();
  const [selectedPlanId, setSelectedPlanId] = useState<number>(0);
  const [selectedMethodId, setSelectedMethodId] = useState<number>(0);
  const [senderRef, setSenderRef] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (checkoutPlanId && data) {
      setSelectedPlanId(checkoutPlanId);
      setSelectedMethodId(data.paymentMethods[0]?.id || 0);
      setError('');
      setReceiptFile(null);
      setSenderRef('');
      setNotes('');
    }
  }, [checkoutPlanId, data]);

  if (!checkoutPlanId || !data) return null;

  const activePlan = data.plans.find((p) => p.id === selectedPlanId) || data.plans[0];
  const activeMethod = data.paymentMethods.find((m) => m.id === selectedMethodId) || data.paymentMethods[0];

  const handleCopy = (val: string) => {
    navigator.clipboard?.writeText(val);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlan || !activeMethod) return;
    setError('');
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('plan_id', String(activePlan.id));
      form.append('payment_method_id', String(activeMethod.id));
      form.append('sender_reference', senderRef);
      form.append('notes', notes);
      if (receiptFile) form.append('receipt', receiptFile);

      await apiFetch('/api/payments/request', {
        method: 'POST',
        body: form,
      });
      closeCheckout();
      showToast('Payment receipt submitted. An administrator will verify and activate your subscription shortly.');
      setActiveView('student');
    } catch (err: any) {
      setError(err?.message || 'Failed to submit payment request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="relative my-8 w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <button
          type="button"
          onClick={closeCheckout}
          aria-label="Close checkout"
          className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          Subscription Checkout (Egypt)
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Select your plan and preferred Egyptian payment channel, then upload your transfer receipt.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Plan selector */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">1. Subscription Plan</label>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-700 focus:outline-none"
            >
              {data.plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.price_egp} EGP ({p.duration_days} Days)
                </option>
              ))}
            </select>
          </div>

          {/* Payment method tabs */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">2. Payment Method</label>
            <div className="grid grid-cols-2 gap-2">
              {data.paymentMethods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMethodId(m.id)}
                  className={`rounded-lg border px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                    m.id === activeMethod?.id
                      ? 'border-blue-700 bg-blue-50/70 text-blue-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* Payment instructions box */}
          {activeMethod && activePlan && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <p className="text-xs font-medium text-slate-500">{activeMethod.account_label}</p>
                  <p className="font-mono-num mt-0.5 text-sm font-semibold text-slate-900">
                    {activeMethod.account_value}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(activeMethod.account_value)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-xs font-medium text-slate-600">Amount Due</span>
                <span className="font-mono-num text-lg font-bold text-slate-900">{activePlan.price_egp} EGP</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{activeMethod.instructions}</p>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              3. Sender Wallet Phone / Transaction Reference
            </label>
            <input
              type="text"
              required
              value={senderRef}
              onChange={(e) => setSenderRef(e.target.value)}
              placeholder="e.g. 01012345678 or InstaPay Ref #49281"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              4. Upload Payment Receipt (Screenshot / PDF)
            </label>
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600 hover:border-blue-600 hover:bg-blue-50/40">
              <span className="flex items-center gap-2 truncate">
                <Upload className="h-4 w-4 shrink-0 text-slate-500" />
                <span className="truncate">{receiptFile ? receiptFile.name : 'Choose receipt image or PDF'}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-blue-700">Browse</span>
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Optional Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional info for verification"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ backgroundColor: 'var(--brand-blue)' }}
          >
            {submitting ? 'Submitting Receipt...' : 'Submit Payment for Verification'}
          </button>
        </form>
      </div>
    </div>
  );
}
