import React, { useState } from 'react';
import { Database, X, CheckCircle2, AlertCircle, Coins, Boxes } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const OpeningBalanceModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const { products, accounts, setOpeningStock, setOpeningBalance } = useApp();

  const [activeTab, setActiveTab] = useState<'inventory' | 'accounts'>('inventory');

  // Inventory Opening State
  const [selectedProdId, setSelectedProdId] = useState<string>(products[0]?.id || '');
  const [warehouseId, setWarehouseId] = useState<string>('wh_shop');
  const [quantity, setQuantity] = useState<number>(20);
  const [unitCost, setUnitCost] = useState<number>(1800);
  const [opDate, setOpDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Account Opening State
  const [selectedAccId, setSelectedAccId] = useState<string>('acc_cash');
  const [accAmount, setAccAmount] = useState<number>(50000);
  const [accDesc, setAccDesc] = useState<string>('Opening Balance at Go-Live');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await setOpeningStock({
        product_id: selectedProdId,
        warehouse_id: warehouseId,
        quantity,
        unit_cost: unitCost,
        date: opDate,
      });
      setSuccessMsg('Opening stock balance recorded successfully with journal equity credit.');
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to set opening stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await setOpeningBalance({
        account_id: selectedAccId,
        amount: accAmount,
        date: opDate,
        description: accDesc,
      });
      setSuccessMsg('Account opening balance journal entry posted successfully.');
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to set account opening balance');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="bg-[var(--card)] rounded-xl shadow-2xl max-w-lg w-full p-6 border border-[var(--border)] space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="text-base font-bold text-[var(--accent)]">Opening Balance Entry (Phase 1)</h3>
          </div>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text)] p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[var(--border)] gap-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`pb-2 border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'inventory'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Inventory Stock Opening</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('accounts')}
            className={`pb-2 border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'accounts'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Financial Bucket Opening</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-[var(--status-red)]/10 text-[var(--status-red)] rounded text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-[var(--status-green)]/10 text-[var(--status-green)] rounded text-xs font-semibold">
            {successMsg}
          </div>
        )}

        {activeTab === 'inventory' ? (
          <form onSubmit={handleStockSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                Select Product SKU
              </label>
              <select
                value={selectedProdId}
                onChange={e => setSelectedProdId(e.target.value)}
                className="w-full p-2 border border-[var(--border)] rounded bg-[var(--card)] text-xs"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    [{p.sku}] {p.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                  Warehouse
                </label>
                <select
                  value={warehouseId}
                  onChange={e => setWarehouseId(e.target.value)}
                  className="w-full p-2 border border-[var(--border)] rounded bg-[var(--card)] text-xs"
                >
                  <option value="wh_shop">Shop Floor (Showroom)</option>
                  <option value="wh_main">Main / Back-store (2nd Floor)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                  Opening Quantity
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(Number(e.target.value))}
                  className="w-full p-2 border border-[var(--border)] rounded font-mono font-bold text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                  Cost Valuation Per Unit (BDT)
                </label>
                <input
                  type="number"
                  value={unitCost}
                  onChange={e => setUnitCost(Number(e.target.value))}
                  className="w-full p-2 border border-[var(--border)] rounded font-mono font-bold text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                  Opening Date
                </label>
                <input
                  type="date"
                  value={opDate}
                  onChange={e => setOpDate(e.target.value)}
                  className="w-full p-2 border border-[var(--border)] rounded text-xs"
                />
              </div>
            </div>

            <div className="p-3 bg-[var(--surface-sunken)] rounded text-[11px] text-[var(--text-secondary)]">
              <strong>Accounting Treatment:</strong> Posts an <code>OPENING_BALANCE</code> stock movement and balances the general ledger by crediting <em>Opening Balance Equity</em> (Section 40.1).
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded hover:opacity-90 cursor-pointer"
              >
                {isSubmitting ? 'Saving...' : 'Post Opening Stock'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleAccountSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                Select Financial Account / Bucket
              </label>
              <select
                value={selectedAccId}
                onChange={e => setSelectedAccId(e.target.value)}
                className="w-full p-2 border border-[var(--border)] rounded bg-[var(--card)] text-xs font-medium"
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    [{a.code}] {a.name} ({a.type.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                  Opening Balance Amount (BDT)
                </label>
                <input
                  type="number"
                  value={accAmount}
                  onChange={e => setAccAmount(Number(e.target.value))}
                  className="w-full p-2 border border-[var(--border)] rounded font-mono font-bold text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={opDate}
                  onChange={e => setOpDate(e.target.value)}
                  className="w-full p-2 border border-[var(--border)] rounded text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                Description / Memo
              </label>
              <input
                type="text"
                value={accDesc}
                onChange={e => setAccDesc(e.target.value)}
                className="w-full p-2 border border-[var(--border)] rounded text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded hover:opacity-90 cursor-pointer"
              >
                {isSubmitting ? 'Saving...' : 'Post Opening Journal Entry'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
