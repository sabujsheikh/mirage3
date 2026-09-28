import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Supplier, CurrencyCode } from '../../types';
import { X } from 'lucide-react';

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier?: Supplier | null;
  onSuccess?: (supplier: Supplier) => void;
}

export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  isOpen,
  onClose,
  supplier,
  onSuccess,
}) => {
  const { createSupplier, updateSupplier } = useApp();

  const [name, setName] = useState<string>('');
  const [contactPerson, setContactPerson] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [country, setCountry] = useState<string>('UAE');
  const [currency, setCurrency] = useState<CurrencyCode>('AED');
  const [defaultExchangeRate, setDefaultExchangeRate] = useState<number>(33.0);
  const [paymentTerms, setPaymentTerms] = useState<string>('Net 30');
  const [taxId, setTaxId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [initialPayable, setInitialPayable] = useState<number>(0);
  const [active, setActive] = useState<boolean>(true);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (supplier) {
      setName(supplier.name || '');
      setContactPerson(supplier.contact_person || '');
      setPhone(supplier.phone || '');
      setEmail(supplier.email || '');
      setAddress(supplier.address || '');
      setCountry(supplier.country || 'UAE');
      setCurrency(supplier.currency || 'AED');
      setDefaultExchangeRate(supplier.default_exchange_rate || 33.0);
      setPaymentTerms(supplier.payment_terms || 'Net 30');
      setTaxId(supplier.tax_id_or_trade_license || '');
      setNotes(supplier.notes || '');
      setActive(supplier.active !== false);
      setInitialPayable(0);
    } else {
      setName('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setAddress('');
      setCountry('UAE');
      setCurrency('AED');
      setDefaultExchangeRate(33.0);
      setPaymentTerms('Net 30');
      setTaxId('');
      setNotes('');
      setInitialPayable(0);
      setActive(true);
    }
    setErrorMsg('');
  }, [supplier, isOpen]);

  const handleCurrencyChange = (curr: CurrencyCode) => {
    setCurrency(curr);
    if (curr === 'AED') setDefaultExchangeRate(33.0);
    else if (curr === 'USD') setDefaultExchangeRate(122.0);
    else if (curr === 'EUR') setDefaultExchangeRate(133.0);
    else setDefaultExchangeRate(1.0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Supplier name is required');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      if (supplier) {
        const updated = await updateSupplier(supplier.id, {
          name: name.trim(),
          contact_person: contactPerson.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          country: country.trim(),
          currency,
          default_exchange_rate: Number(defaultExchangeRate) || 1,
          payment_terms: paymentTerms.trim(),
          tax_id_or_trade_license: taxId.trim(),
          notes: notes.trim(),
          active,
        });
        if (onSuccess) onSuccess(updated);
      } else {
        const created = await createSupplier({
          name: name.trim(),
          contact_person: contactPerson.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          country: country.trim(),
          currency,
          default_exchange_rate: Number(defaultExchangeRate) || 1,
          payment_terms: paymentTerms.trim(),
          tax_id_or_trade_license: taxId.trim(),
          notes: notes.trim(),
          initial_balance_payable: Number(initialPayable) || 0,
        });
        if (onSuccess) onSuccess(created);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save supplier');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[6px] w-full max-w-2xl overflow-hidden shadow-md">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
          <h2 className="text-sm font-semibold text-[var(--text)]">
            {supplier ? `Edit supplier: ${supplier.name}` : 'Add supplier'}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-2.5 bg-[var(--negative)]/10 border border-[var(--negative)]/20 rounded-[4px] text-[var(--negative)] text-xs">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Supplier name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dubai Wholesale Fragrance Trading LLC"
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-[4px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Contact person
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="e.g. Rashid Al-Mansoor"
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-[4px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +971 4 223 8890"
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-[4px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. export@fragrancetrading.ae"
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-[4px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Country
              </label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. UAE"
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-[4px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Warehouse 14, Al Quoz Industrial 3, Dubai, UAE"
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-[4px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => handleCurrencyChange(e.target.value as CurrencyCode)}
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-[4px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="AED">AED</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="BDT">BDT</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Default exchange rate (to BDT)
              </label>
              <input
                type="number"
                step="0.01"
                value={defaultExchangeRate}
                onChange={(e) => setDefaultExchangeRate(parseFloat(e.target.value) || 1)}
                className="w-full px-2.5 py-1.5 text-xs tabular-nums bg-[var(--surface-sunken)] border border-[var(--border)] rounded-[4px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Payment terms
              </label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="e.g. Net 30"
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-[4px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Trade license or tax ID
              </label>
              <input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="e.g. TRN-10029384910003"
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-[4px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            {!supplier && (
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                  Initial opening balance payable (BDT)
                </label>
                <input
                  type="number"
                  value={initialPayable}
                  onChange={(e) => setInitialPayable(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 text-xs tabular-nums bg-[var(--surface-sunken)] border border-[var(--border)] rounded-[4px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Freight notes, brand authorizations, etc."
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-[4px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            {supplier && (
              <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="supplier-active-check"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded border-[var(--border)] text-[var(--accent)]"
                />
                <label htmlFor="supplier-active-check" className="text-xs text-[var(--text)] cursor-pointer">
                  Active
                </label>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)] text-xs rounded-[4px] hover:bg-[var(--border)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-[var(--accent)] text-white text-xs rounded-[4px] hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : supplier ? 'Update supplier' : 'Save supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
