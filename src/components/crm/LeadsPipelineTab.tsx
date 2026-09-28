import React, { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Kanban,
  List,
  Phone,
  MessageSquare,
  DollarSign,
  User,
  Calendar,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
  ShoppingBag,
  MoreVertical,
  ChevronRight,
  AlertCircle,
  Tag,
} from 'lucide-react';
import { crmApi } from './crmApi';
import { Lead, LeadStage, LeadSource } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';

const STAGES: { key: LeadStage; label: string; color: string; badge: string }[] = [
  { key: 'new', label: 'New Lead', color: 'border-blue-500/30 bg-blue-500/5', badge: 'bg-blue-500/10 text-blue-600' },
  { key: 'contacted', label: 'Contacted', color: 'border-indigo-500/30 bg-indigo-500/5', badge: 'bg-indigo-500/10 text-indigo-600' },
  { key: 'qualified', label: 'Qualified', color: 'border-purple-500/30 bg-purple-500/5', badge: 'bg-purple-500/10 text-purple-600' },
  { key: 'proposal', label: 'Proposal Sent', color: 'border-amber-500/30 bg-amber-500/5', badge: 'bg-amber-500/10 text-amber-600' },
  { key: 'won', label: 'Won / Converted', color: 'border-emerald-500/30 bg-emerald-500/5', badge: 'bg-emerald-500/10 text-emerald-600' },
  { key: 'lost', label: 'Lost / Closed', color: 'border-rose-500/30 bg-rose-500/5', badge: 'bg-rose-500/10 text-rose-600' },
];

export const LeadsPipelineTab: React.FC = () => {
  const { currentUser } = useAuth();
  const { products, customers } = useApp();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [lostLead, setLostLead] = useState<Lead | null>(null);
  const [lostReason, setLostReason] = useState('');

  // Form State
  const [formData, setFormData] = useState<Partial<Lead>>({
    name: '',
    phone: '',
    source: 'messenger',
    expected_value: 0,
    preferred_fragrances: [],
    notes: '',
    stage: 'new',
  });

  // Convert to Order form
  const [orderForm, setOrderForm] = useState({
    product_id: '',
    quantity: 1,
    unit_price: 0,
    delivery_charge: 70,
    address: '',
    delivery_method: 'steadfast' as 'steadfast' | 'in_house' | 'self_pickup',
  });

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const data = await crmApi.getLeads({
        search: search || undefined,
        source: sourceFilter || undefined,
      });
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [search, sourceFilter]);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;
    try {
      await crmApi.createLead(
        {
          ...formData,
          assigned_to: currentUser?.id || 'usr_owner',
          assigned_to_name: currentUser?.name || 'Sobuj Sehk',
        },
        currentUser?.id,
        currentUser?.name
      );
      setShowAddModal(false);
      setFormData({
        name: '',
        phone: '',
        source: 'messenger',
        expected_value: 0,
        preferred_fragrances: [],
        notes: '',
        stage: 'new',
      });
      await fetchLeads();
    } catch (err) {
      console.error('Error creating lead:', err);
    }
  };

  const handleStageChange = async (leadId: string, newStage: LeadStage) => {
    if (newStage === 'lost') {
      const lead = leads.find((l) => l.id === leadId);
      if (lead) {
        setLostLead(lead);
        setShowLostModal(true);
      }
      return;
    }

    try {
      await crmApi.changeLeadStage(leadId, newStage, undefined, currentUser?.id, currentUser?.name);
      await fetchLeads();
    } catch (err) {
      console.error('Error changing stage:', err);
    }
  };

  const handleConfirmLost = async () => {
    if (!lostLead) return;
    try {
      await crmApi.changeLeadStage(lostLead.id, 'lost', lostReason, currentUser?.id, currentUser?.name);
      setShowLostModal(false);
      setLostLead(null);
      setLostReason('');
      await fetchLeads();
    } catch (err) {
      console.error('Error marking lost:', err);
    }
  };

  const handleStartConvert = (lead: Lead) => {
    setConvertingLead(lead);
    const prod = products[0];
    setOrderForm({
      product_id: prod?.id || '',
      quantity: 1,
      unit_price: prod?.selling_price || 3000,
      delivery_charge: 70,
      address: '',
      delivery_method: 'steadfast',
    });
    setShowConvertModal(true);
  };

  const handleConfirmConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingLead || !orderForm.product_id) return;

    try {
      const selectedProd = products.find((p) => p.id === orderForm.product_id);
      const payload = {
        customer_name: convertingLead.name,
        customer_phone: convertingLead.phone,
        shipping_address: orderForm.address || 'Dhaka, Bangladesh',
        fulfillment_type: orderForm.delivery_method,
        delivery_charge: orderForm.delivery_charge,
        items: [
          {
            product_id: orderForm.product_id,
            product_name: selectedProd?.display_name || selectedProd?.perfume_name || 'Perfume',
            sku: selectedProd?.sku || 'SKU',
            quantity: Number(orderForm.quantity),
            unit_price: Number(orderForm.unit_price),
            subtotal: Number(orderForm.quantity) * Number(orderForm.unit_price),
          },
        ],
      };

      await crmApi.convertLeadToOrder(convertingLead.id, payload, currentUser?.id, currentUser?.name);
      setShowConvertModal(false);
      setConvertingLead(null);
      await fetchLeads();
    } catch (err) {
      console.error('Conversion failed:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              type="text"
              placeholder="Search leads by name, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
          >
            <option value="">All Sources</option>
            <option value="messenger">Messenger</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">Phone Call</option>
            <option value="walk_in">Walk-in</option>
            <option value="referral">Referral</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center rounded-lg border border-[var(--border)] p-0.5 bg-[var(--bg)]">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded text-xs font-semibold flex items-center gap-1 ${
                viewMode === 'kanban' ? 'bg-[var(--surface)] text-[var(--accent)] shadow-xs' : 'text-[var(--text-secondary)]'
              }`}
              title="Kanban Board"
            >
              <Kanban className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded text-xs font-semibold flex items-center gap-1 ${
                viewMode === 'list' ? 'bg-[var(--surface)] text-[var(--accent)] shadow-xs' : 'text-[var(--text-secondary)]'
              }`}
              title="Table List"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 text-xs font-bold rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Main View: Kanban or List */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const stageLeads = (leads || []).filter((l) => l && l.stage === stage.key);
            const totalStageVal = stageLeads.reduce((acc, l) => acc + (l.expected_value || 0), 0);

            return (
              <div
                key={stage.key}
                className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] min-w-[240px] max-h-[calc(100vh-280px)]"
              >
                {/* Stage Header */}
                <div className="p-3 border-b border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stage.badge}`}>
                      {stageLeads.length}
                    </span>
                    <span className="text-xs font-bold text-[var(--text)]">{stage.label}</span>
                  </div>
                  <span className="text-[10px] font-bold font-num text-[var(--text-secondary)]">
                    ৳{totalStageVal.toLocaleString()}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="p-2 space-y-2 overflow-y-auto flex-1">
                  {stageLeads.length === 0 ? (
                    <div className="p-6 text-center text-[11px] text-[var(--text-secondary)] border border-dashed border-[var(--border)] rounded-lg">
                      No leads
                    </div>
                  ) : (
                    stageLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--accent)] transition-all shadow-xs space-y-2 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-bold text-[var(--text)] group-hover:text-[var(--accent)]">
                              {lead.name}
                            </h4>
                            <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-[var(--text-secondary)]" />
                              {lead.phone}
                            </div>
                          </div>
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[var(--surface-hover)] text-[var(--text-secondary)]">
                            {lead.source}
                          </span>
                        </div>

                        {lead.preferred_fragrances && lead.preferred_fragrances.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {lead.preferred_fragrances.map((f, i) => (
                              <span
                                key={i}
                                className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 font-medium"
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-[var(--border)] text-[11px]">
                          <span className="font-bold font-num text-[var(--text)]">
                            ৳{(lead.expected_value || 0).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-[var(--text-secondary)]">
                            Score: {lead.score || 50}/100
                          </span>
                        </div>

                        {/* Quick Actions */}
                        <div className="pt-2 flex items-center justify-between gap-1">
                          {lead.stage !== 'won' && (
                            <button
                              onClick={() => handleStartConvert(lead)}
                              className="px-2 py-1 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 flex items-center gap-1 transition-colors"
                            >
                              <ShoppingBag className="w-2.5 h-2.5" />
                              Convert
                            </button>
                          )}

                          <div className="flex items-center gap-1 ml-auto">
                            {lead.stage !== 'new' && (
                              <button
                                onClick={() => {
                                  const idx = STAGES.findIndex((s) => s.key === lead.stage);
                                  if (idx > 0) handleStageChange(lead.id, STAGES[idx - 1].key);
                                }}
                                className="px-1.5 py-1 text-[10px] rounded border border-[var(--border)] hover:bg-[var(--surface)] text-[var(--text-secondary)]"
                                title="Move back"
                              >
                                ←
                              </button>
                            )}
                            {lead.stage !== 'won' && lead.stage !== 'lost' && (
                              <button
                                onClick={() => {
                                  const idx = STAGES.findIndex((s) => s.key === lead.stage);
                                  if (idx < STAGES.length - 2) handleStageChange(lead.id, STAGES[idx + 1].key);
                                }}
                                className="px-1.5 py-1 text-[10px] rounded border border-[var(--border)] hover:bg-[var(--surface)] text-[var(--accent)] font-bold"
                                title="Advance stage"
                              >
                                →
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--surface-hover)] border-b border-[var(--border)] text-[var(--text-secondary)] uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Lead / Customer</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4 text-right">Expected Value</th>
                  <th className="py-3 px-4">Interests</th>
                  <th className="py-3 px-4">Assigned To</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-[var(--text-secondary)]">
                      No leads found matching current filter.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => {
                    const stageObj = STAGES.find((s) => s.key === lead.stage);
                    return (
                      <tr key={lead.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-[var(--text)]">{lead.name}</div>
                          <div className="text-[11px] text-[var(--text-secondary)]">{lead.phone}</div>
                        </td>
                        <td className="py-3 px-4 capitalize">{lead.source}</td>
                        <td className="py-3 px-4">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stageObj?.badge}`}>
                            {stageObj?.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-num font-bold text-[var(--text)]">
                          ৳{(lead.expected_value || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {lead.preferred_fragrances?.map((f, i) => (
                              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 font-medium">
                                {f}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[var(--text-secondary)]">
                          {lead.assigned_to_name || 'Sobuj Sehk'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {lead.stage !== 'won' && (
                              <button
                                onClick={() => handleStartConvert(lead)}
                                className="px-2 py-1 text-[11px] font-bold rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                              >
                                Convert to Order
                              </button>
                            )}
                            <button
                              onClick={() => {
                                const nextStage = lead.stage === 'new' ? 'contacted' : lead.stage === 'contacted' ? 'qualified' : 'won';
                                handleStageChange(lead.id, nextStage);
                              }}
                              className="px-2 py-1 text-[11px] font-bold rounded border border-[var(--border)] hover:bg-[var(--surface)] text-[var(--accent)]"
                            >
                              Advance
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create Lead */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <h3 className="text-sm font-bold text-[var(--text)]">Add New Sales Lead</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text)] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Customer / Lead Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Arif Islam"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Mobile Phone Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="01XXXXXXXXX"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Channel / Source
                  </label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value as LeadSource })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  >
                    <option value="messenger">Facebook Messenger</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="phone">Phone Inquiry</option>
                    <option value="walk_in">Walk-In Shop</option>
                    <option value="referral">Referral</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Expected Value (৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="3000"
                    value={formData.expected_value || ''}
                    onChange={(e) => setFormData({ ...formData, expected_value: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Fragrances of Interest (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Karus Gold, Dunescape, Sauvage"
                  value={formData.preferred_fragrances?.join(', ')}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      preferred_fragrances: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Notes & Details
                </label>
                <textarea
                  rows={3}
                  placeholder="Customer preference notes, agreed discount or delivery timing..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-bold hover:bg-[var(--accent)]/90"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Convert to Order */}
      {showConvertModal && convertingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div>
                <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-emerald-600" />
                  Convert Lead to Confirmed Order
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Customer: <span className="font-semibold text-[var(--text)]">{convertingLead.name}</span> ({convertingLead.phone})
                </p>
              </div>
              <button
                onClick={() => setShowConvertModal(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text)] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmConvert} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Select Product / Perfume *
                </label>
                <select
                  value={orderForm.product_id}
                  onChange={(e) => {
                    const prod = products.find((p) => p.id === e.target.value);
                    setOrderForm({
                      ...orderForm,
                      product_id: e.target.value,
                      unit_price: prod?.selling_price || 0,
                    });
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name || p.perfume_name} (৳{p.selling_price}) — Avail: {p.available_stock ?? p.stock_quantity ?? 10}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={orderForm.quantity}
                    onChange={(e) => setOrderForm({ ...orderForm, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] font-num"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Agreed Unit Price (৳)
                  </label>
                  <input
                    type="number"
                    value={orderForm.unit_price}
                    onChange={(e) => setOrderForm({ ...orderForm, unit_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] font-num"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Fulfillment Method
                  </label>
                  <select
                    value={orderForm.delivery_method}
                    onChange={(e) => setOrderForm({ ...orderForm, delivery_method: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  >
                    <option value="steadfast">Steadfast Courier COD</option>
                    <option value="in_house">In-House Local Delivery</option>
                    <option value="self_pickup">Customer Self-Pickup</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Delivery Charge (৳)
                  </label>
                  <input
                    type="number"
                    value={orderForm.delivery_charge}
                    onChange={(e) => setOrderForm({ ...orderForm, delivery_charge: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] font-num"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Delivery Address *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="House, Road, Area, Dhaka"
                  value={orderForm.address}
                  onChange={(e) => setOrderForm({ ...orderForm, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                />
              </div>

              <div className="p-3 rounded-lg bg-[var(--surface-hover)] border border-[var(--border)] flex items-center justify-between font-bold text-xs">
                <span>Calculated Order Total:</span>
                <span className="text-base text-emerald-600 font-num">
                  ৳{(orderForm.quantity * orderForm.unit_price + orderForm.delivery_charge).toLocaleString()}
                </span>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowConvertModal(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Generate Order & Reserve Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Mark Lead Lost */}
      {showLostModal && lostLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <h3 className="text-sm font-bold text-rose-600 flex items-center gap-1.5">
                <XCircle className="w-4 h-4" />
                Mark Lead as Lost
              </h3>
              <button
                onClick={() => setShowLostModal(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text)] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-[var(--text-secondary)] space-y-2">
              <p>
                Record why lead for <span className="font-semibold text-[var(--text)]">{lostLead.name}</span> did not convert:
              </p>
              <select
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
              >
                <option value="">Select Lost Reason</option>
                <option value="price_too_high">Price too high / Wanted higher discount</option>
                <option value="out_of_stock">Fragrance out of stock / Desired size unavailable</option>
                <option value="competitor">Purchased from competitor</option>
                <option value="fake_or_unresponsive">Customer unresponsive after inquiry</option>
                <option value="delivery_time">Delivery timeline too long</option>
                <option value="changed_mind">Customer changed mind</option>
              </select>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setShowLostModal(false)}
                className="px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLost}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 text-xs"
              >
                Confirm Lost
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
