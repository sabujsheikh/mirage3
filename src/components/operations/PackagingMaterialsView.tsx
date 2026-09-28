import React, { useState, useMemo } from 'react';
import {
  Package, Search, Plus, CheckCircle2, AlertTriangle, AlertCircle,
  XCircle, Truck, Edit2, Barcode, Hash, DollarSign, MapPin, Clock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { PackagingMaterial, PackagingCategory, PackagingStockMovement } from '../../types';
import { PageHeader } from '../common/PageHeader';
import { Modal } from '../common/Modal';

const CATEGORY_LABELS: Record<PackagingCategory, string> = {
  carton: 'Carton',
  poly: 'Poly',
  wrapping: 'Wrapping',
  tape: 'Tape',
  cutting_tool: 'Cutting Tool',
  gift: 'Gift',
  label: 'Label',
  other: 'Other',
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; icon: React.ReactNode }> = {
  healthy: { color: 'text-[var(--status-green)]', bg: 'bg-[var(--status-green)]/10', border: 'border-[var(--status-green)]/24', label: 'Healthy', icon: <CheckCircle2 className="w-3 h-3" /> },
  low_stock: { color: 'text-[var(--status-amber)]', bg: 'bg-[var(--status-amber)]/10', border: 'border-[var(--status-amber)]/24', label: 'Low Stock', icon: <AlertTriangle className="w-3 h-3" /> },
  critical: { color: 'text-[var(--status-red)]', bg: 'bg-[var(--status-red)]/10', border: 'border-[var(--status-red)]/24', label: 'Critical', icon: <AlertCircle className="w-3 h-3" /> },
  out_of_stock: { color: 'text-[var(--status-red)]', bg: 'bg-[var(--status-red)]/15', border: 'border-[var(--status-red)]/30', label: 'Out of Stock', icon: <XCircle className="w-3 h-3" /> },
};

export const PackagingMaterialsView: React.FC = () => {
  const { packagingMaterials, packagingMovements, createPackagingMaterial, updatePackagingMaterial, receivePackagingStock } = useApp();
  const { currentUser } = useAuth();

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal state
  const [selectedMaterial, setSelectedMaterial] = useState<PackagingMaterial | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);

  // Create form
  const [newName, setNewName] = useState('');
  const [newBarcode, setNewBarcode] = useState('');
  const [newCategory, setNewCategory] = useState<PackagingCategory>('carton');
  const [newUnit, setNewUnit] = useState('piece');
  const [newReorderLevel, setNewReorderLevel] = useState(10);
  const [newUnitCost, setNewUnitCost] = useState(0);
  const [newOpeningStock, setNewOpeningStock] = useState(0);
  const [newNotes, setNewNotes] = useState('');

  // Receive form
  const [receiveQty, setReceiveQty] = useState(0);
  const [receiveCost, setReceiveCost] = useState(0);
  const [receiveNote, setReceiveNote] = useState('');

  // Edit state
  const [editName, setEditName] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editCategory, setEditCategory] = useState<PackagingCategory>('carton');
  const [editReorderLevel, setEditReorderLevel] = useState(10);
  const [editUnitCost, setEditUnitCost] = useState(0);
  const [editNotes, setEditNotes] = useState('');

  const filteredMaterials = useMemo(() => {
    return packagingMaterials.filter(m => {
      if (catFilter !== 'all' && m.category !== catFilter) return false;
      if (statusFilter !== 'all') {
        const s = (m as any).status || 'healthy';
        if (s !== statusFilter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return m.name.toLowerCase().includes(q) || m.barcode.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q);
      }
      return true;
    });
  }, [packagingMaterials, catFilter, statusFilter, search]);

  const handleCreate = async () => {
    if (!newName || !newBarcode) return;
    await createPackagingMaterial({
      name: newName, barcode: newBarcode, category: newCategory,
      unit: newUnit, reorder_level: newReorderLevel, unit_cost: newUnitCost,
      opening_stock: newOpeningStock, notes: newNotes,
      actor_id: currentUser?.id, actor_name: currentUser?.name,
    });
    setShowCreateModal(false);
    setNewName(''); setNewBarcode(''); setNewNotes(''); setNewOpeningStock(0); setNewUnitCost(0);
  };

  const handleReceive = async () => {
    if (!selectedMaterial || receiveQty <= 0) return;
    await receivePackagingStock(selectedMaterial.id, receiveQty, receiveCost, receiveNote, currentUser?.id, currentUser?.name);
    setShowReceiveModal(false);
    setReceiveQty(0); setReceiveCost(0); setReceiveNote('');
    setSelectedMaterial(null);
  };

  const handleEditSave = async () => {
    if (!selectedMaterial) return;
    await updatePackagingMaterial(selectedMaterial.id, {
      name: editName, barcode: editBarcode, category: editCategory,
      reorder_level: editReorderLevel, unit_cost: editUnitCost, notes: editNotes,
    }, currentUser?.id, currentUser?.name);
    setSelectedMaterial(null);
  };

  const openRow = (m: PackagingMaterial) => {
    setSelectedMaterial(m);
    setEditName(m.name); setEditBarcode(m.barcode); setEditCategory(m.category);
    setEditReorderLevel(m.reorder_level); setEditUnitCost(m.unit_cost); setEditNotes(m.notes || '');
  };

  const lowStockCount = packagingMaterials.filter(m => {
    const s = (m as any).status || 'healthy';
    return s === 'low_stock' || s === 'critical' || s === 'out_of_stock';
  }).length;

  const totalValue = packagingMaterials.reduce((sum, m) => sum + m.on_hand * m.unit_cost, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations / Packaging"
        title="Packaging Materials"
        desc="Stock management for cartons, poly bags, tape, wrapping, and packing tools"
        actions={
          <div className="flex gap-2">
            <button onClick={() => { setShowCreateModal(true); }} className="erp-btn-primary">
              <Plus className="w-3.5 h-3.5" /> <span>Add Material</span>
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-secondary)] mb-1">
            <span className="text-[11px] font-semibold">Total Materials</span>
            <Package className="w-3.5 h-3.5 text-[var(--accent)]" />
          </div>
          <div className="text-lg font-bold font-num text-[var(--text)]">{packagingMaterials.length}</div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-secondary)] mb-1">
            <span className="text-[11px] font-semibold">Total Stock Value</span>
            <DollarSign className="w-3.5 h-3.5 text-[var(--accent)]" />
          </div>
          <div className="text-lg font-bold font-num text-[var(--text)]">&#2547;{totalValue.toLocaleString()}</div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-secondary)] mb-1">
            <span className="text-[11px] font-semibold">Low Stock Alerts</span>
            <AlertTriangle className="w-3.5 h-3.5 text-[var(--status-amber)]" />
          </div>
          <div className="text-lg font-bold font-num text-[var(--text)]">{lowStockCount}</div>
          <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">materials need reorder</div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-secondary)] mb-1">
            <span className="text-[11px] font-semibold">Low Stock Warnings</span>
            <AlertCircle className="w-3.5 h-3.5 text-[var(--status-red)]" />
          </div>
          {lowStockCount > 0 ? (
            <div className="text-[11px] text-[var(--status-amber)] font-medium">
              {packagingMaterials.filter(m => (m as any).status !== 'healthy').slice(0, 3).map(m => (
                <div key={m.id}>&#8226; {m.name}: {m.on_hand} available, reorder {m.reorder_level}</div>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-[var(--status-green)] font-medium">All materials stocked</div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search materials..." className="erp-input pl-9 w-full" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="erp-select">
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="erp-select">
          <option value="all">All Status</option>
          <option value="healthy">Healthy</option>
          <option value="low_stock">Low Stock</option>
          <option value="critical">Critical</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>
      </div>

      {/* Dense Table */}
      <div className="dense-table-container bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xs">
        <table className="dense-table">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] p-3">Material</th>
              <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] p-3">Barcode</th>
              <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] p-3">Category</th>
              <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] p-3">On Hand</th>
              <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] p-3">Reserved</th>
              <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] p-3">Available</th>
              <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] p-3">Reorder</th>
              <th className="text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] p-3">Status</th>
              <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] p-3">Unit Cost</th>
            </tr>
          </thead>
          <tbody>
            {filteredMaterials.map(m => {
              const status = (m as any).status || 'healthy';
              const sc = STATUS_CONFIG[status] || STATUS_CONFIG.healthy;
              const isLow = status !== 'healthy';
              return (
                <tr
                  key={m.id}
                  onClick={() => openRow(m)}
                  className={`dense-table-row-clickable border-b border-[var(--border)]/50 cursor-pointer transition-colors ${isLow ? 'bg-[var(--status-amber)]/5' : ''}`}
                >
                  <td className="p-3">
                    <div className="text-[13px] font-semibold text-[var(--text)]">{m.name}</div>
                    <div className="text-[11px] text-[var(--text-secondary)]">{m.sku} &#8226; {m.unit}</div>
                  </td>
                  <td className="p-3">
                    <span className="pill-teal inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold font-num border">
                      {m.barcode}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="text-[12px] text-[var(--text)]">{CATEGORY_LABELS[m.category]}</span>
                  </td>
                  <td className="p-3 text-right font-num text-[13px] font-bold text-[var(--text)]">{m.on_hand}</td>
                  <td className="p-3 text-right font-num text-[13px] text-[var(--text-secondary)]">{m.reserved}</td>
                  <td className="p-3 text-right font-num text-[13px] font-bold text-[var(--text)]">{m.available}</td>
                  <td className="p-3 text-right font-num text-[12px] text-[var(--text-secondary)]">{m.reorder_level}</td>
                  <td className="p-3 text-center">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${sc.bg} ${sc.color} ${sc.border}`}>
                      {sc.icon} {sc.label}
                    </span>
                  </td>
                  <td className="p-3 text-right font-num text-[12px] text-[var(--text-secondary)]">&#2547;{m.unit_cost}</td>
                </tr>
              );
            })}
            {filteredMaterials.length === 0 && (
              <tr><td colSpan={9} className="p-8 text-center text-[var(--text-secondary)] text-sm">No packaging materials found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Material Detail / Edit Modal */}
      {selectedMaterial && (
        <Modal isOpen={!!selectedMaterial} onClose={() => setSelectedMaterial(null)} title={selectedMaterial.name} size="lg">
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} className="erp-input w-full mt-1" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Barcode</label>
                <input value={editBarcode} onChange={e => setEditBarcode(e.target.value)} className="erp-input w-full mt-1 font-num" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Category</label>
                <select value={editCategory} onChange={e => setEditCategory(e.target.value as PackagingCategory)} className="erp-select w-full mt-1">
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Reorder Level</label>
                <input type="number" value={editReorderLevel} onChange={e => setEditReorderLevel(Number(e.target.value))} className="erp-input w-full mt-1 font-num" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Unit Cost (&#2547;)</label>
                <input type="number" value={editUnitCost} onChange={e => setEditUnitCost(Number(e.target.value))} className="erp-input w-full mt-1 font-num" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Notes</label>
                <input value={editNotes} onChange={e => setEditNotes(e.target.value)} className="erp-input w-full mt-1" />
              </div>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-[var(--border)]">
              <button onClick={() => { setShowReceiveModal(true); }} className="erp-btn-primary">
                <Truck className="w-3.5 h-3.5" /> Receive Stock
              </button>
              <div className="flex gap-2">
                <button onClick={() => setSelectedMaterial(null)} className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors">Cancel</button>
                <button onClick={handleEditSave} className="erp-btn-primary"><Edit2 className="w-3.5 h-3.5" /> Save Changes</button>
              </div>
            </div>
            {/* Movement History */}
            <div className="pt-3 border-t border-[var(--border)]">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">Recent Stock Movements</h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {packagingMovements.filter(mv => mv.material_id === selectedMaterial.id).slice(0, 10).map(mv => (
                  <div key={mv.id} className="flex items-center justify-between text-[11px] py-1 border-b border-[var(--border)]/50 last:border-0">
                    <span className="text-[var(--text-secondary)]">{new Date(mv.created_at).toLocaleDateString()} &#8226; {mv.reason}</span>
                    <span className={`font-num font-bold ${mv.quantity_delta > 0 ? 'text-[var(--status-green)]' : 'text-[var(--status-red)]'}`}>
                      {mv.quantity_delta > 0 ? '+' : ''}{mv.quantity_delta}
                    </span>
                  </div>
                ))}
                {packagingMovements.filter(mv => mv.material_id === selectedMaterial.id).length === 0 && (
                  <div className="text-[11px] text-[var(--text-secondary)] py-2">No movements recorded</div>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Material Modal */}
      {showCreateModal && (
        <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Add Packaging Material" size="md">
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Material Name *</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} className="erp-input w-full mt-1" placeholder="e.g. Medium Carton" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Barcode *</label>
                <input value={newBarcode} onChange={e => setNewBarcode(e.target.value)} className="erp-input w-full mt-1 font-num" placeholder="e.g. CTN-M" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Category</label>
                <select value={newCategory} onChange={e => setNewCategory(e.target.value as PackagingCategory)} className="erp-select w-full mt-1">
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Unit</label>
                <input value={newUnit} onChange={e => setNewUnit(e.target.value)} className="erp-input w-full mt-1" placeholder="piece, roll, pack" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Reorder Level</label>
                <input type="number" value={newReorderLevel} onChange={e => setNewReorderLevel(Number(e.target.value))} className="erp-input w-full mt-1 font-num" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Unit Cost (&#2547;)</label>
                <input type="number" value={newUnitCost} onChange={e => setNewUnitCost(Number(e.target.value))} className="erp-input w-full mt-1 font-num" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Opening Stock</label>
                <input type="number" value={newOpeningStock} onChange={e => setNewOpeningStock(Number(e.target.value))} className="erp-input w-full mt-1 font-num" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Notes</label>
                <input value={newNotes} onChange={e => setNewNotes(e.target.value)} className="erp-input w-full mt-1" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={!newName || !newBarcode} className="erp-btn-primary disabled:opacity-50"><Plus className="w-3.5 h-3.5" /> Create Material</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Receive Stock Modal */}
      {showReceiveModal && selectedMaterial && (
        <Modal isOpen={showReceiveModal} onClose={() => { setShowReceiveModal(false); setSelectedMaterial(null); }} title={`Receive Stock \u2014 ${selectedMaterial.name}`} size="md">
          <div className="space-y-4 p-5">
            <div className="bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg p-3">
              <div className="text-[12px] font-semibold text-[var(--text)]">{selectedMaterial.name}</div>
              <div className="text-[11px] text-[var(--text-secondary)]">Current stock: {selectedMaterial.on_hand} {selectedMaterial.unit} &#8226; Barcode: {selectedMaterial.barcode}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Quantity *</label>
                <input type="number" value={receiveQty} onChange={e => setReceiveQty(Number(e.target.value))} className="erp-input w-full mt-1 font-num" min={1} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Unit Cost (&#2547;)</label>
                <input type="number" value={receiveCost} onChange={e => setReceiveCost(Number(e.target.value))} className="erp-input w-full mt-1 font-num" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Reference / Invoice</label>
              <input value={receiveNote} onChange={e => setReceiveNote(e.target.value)} className="erp-input w-full mt-1" placeholder="Purchase invoice # or supplier reference" />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button onClick={() => { setShowReceiveModal(false); setSelectedMaterial(null); }} className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors">Cancel</button>
              <button onClick={handleReceive} disabled={receiveQty <= 0} className="erp-btn-primary disabled:opacity-50"><Truck className="w-3.5 h-3.5" /> Receive {receiveQty} {selectedMaterial.unit}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
