import React, { useEffect, useState } from 'react';
import {
  Search,
  User,
  Phone,
  ShoppingBag,
  Clock,
  Tag,
  Star,
  Plus,
  RefreshCw,
  Calendar,
  DollarSign,
  Heart,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Filter,
  Sparkles,
  Edit2,
  Trash2,
} from 'lucide-react';
import { crmApi } from './crmApi';
import {
  Customer,
  Customer360Data,
  CustomerLifecycleStatus,
  CRMTag,
  CustomerPreferences,
  SpecialDate,
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';

export const Customer360Tab: React.FC = () => {
  const { currentUser } = useAuth();
  const { customers } = useApp();
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [c360, setC360] = useState<Customer360Data | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [availableTags, setAvailableTags] = useState<CRMTag[]>([]);

  // Modals / forms
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState<CustomerLifecycleStatus>('vip');
  const [overrideReason, setOverrideReason] = useState('');

  const [showPrefModal, setShowPrefModal] = useState(false);
  const [prefForm, setPrefForm] = useState<Partial<CustomerPreferences>>({});

  const [showDateModal, setShowDateModal] = useState(false);
  const [dateForm, setDateForm] = useState<Partial<SpecialDate>>({
    occasion: 'birthday',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [interactionForm, setInteractionForm] = useState({
    channel: 'phone',
    direction: 'outbound',
    summary: '',
    sentiment: 'positive',
    outcome: 'connected',
  });

  useEffect(() => {
    crmApi.getTags().then(setAvailableTags).catch(console.error);
  }, []);

  const fetchProfile = async (id: string) => {
    try {
      setLoadingProfile(true);
      const data = await crmApi.getCustomer360(id);
      setC360(data);
      setSelectedCustomerId(id);
    } catch (err) {
      console.error('Error fetching customer 360:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  // Handle Lifecycle Override
  const handleSaveOverride = async () => {
    if (!selectedCustomerId) return;
    try {
      await crmApi.overrideLifecycle(selectedCustomerId, overrideStatus, overrideReason, currentUser?.id);
      setShowOverrideModal(false);
      await fetchProfile(selectedCustomerId);
    } catch (err) {
      console.error('Error saving override:', err);
    }
  };

  const handleClearOverride = async () => {
    if (!selectedCustomerId) return;
    try {
      await crmApi.clearLifecycleOverride(selectedCustomerId, currentUser?.id);
      await fetchProfile(selectedCustomerId);
    } catch (err) {
      console.error('Error clearing override:', err);
    }
  };

  // Handle Tag toggle
  const handleAddTag = async (tagId: string) => {
    if (!selectedCustomerId) return;
    try {
      await crmApi.addTagToCustomer(selectedCustomerId, tagId, currentUser?.id);
      await fetchProfile(selectedCustomerId);
    } catch (err) {
      console.error('Failed to add tag:', err);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!selectedCustomerId) return;
    try {
      await crmApi.removeTagFromCustomer(selectedCustomerId, tagId, currentUser?.id);
      await fetchProfile(selectedCustomerId);
    } catch (err) {
      console.error('Failed to remove tag:', err);
    }
  };

  // Handle Preferences Save
  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;
    try {
      await crmApi.updatePreferences(selectedCustomerId, prefForm, currentUser?.id);
      setShowPrefModal(false);
      await fetchProfile(selectedCustomerId);
    } catch (err) {
      console.error('Failed to update preferences:', err);
    }
  };

  // Handle Special Date Save
  const handleSaveSpecialDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !dateForm.date) return;
    try {
      await crmApi.addSpecialDate(
        {
          ...dateForm,
          customer_id: selectedCustomerId,
          customer_name: c360?.customer?.name,
        },
        currentUser?.id
      );
      setShowDateModal(false);
      setDateForm({ occasion: 'birthday', date: new Date().toISOString().split('T')[0], notes: '' });
      await fetchProfile(selectedCustomerId);
    } catch (err) {
      console.error('Failed to save special date:', err);
    }
  };

  const handleDeleteSpecialDate = async (id: string) => {
    if (!selectedCustomerId) return;
    try {
      await crmApi.deleteSpecialDate(id, currentUser?.id);
      await fetchProfile(selectedCustomerId);
    } catch (err) {
      console.error('Failed to delete special date:', err);
    }
  };

  // Handle Log Interaction
  const handleLogInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !interactionForm.summary) return;
    try {
      await crmApi.logInteraction(
        {
          customer_id: selectedCustomerId,
          channel: interactionForm.channel as any,
          direction: interactionForm.direction as any,
          summary: interactionForm.summary,
          sentiment: interactionForm.sentiment as any,
          outcome: interactionForm.outcome,
        },
        currentUser?.id
      );
      setShowInteractionModal(false);
      setInteractionForm({
        channel: 'phone',
        direction: 'outbound',
        summary: '',
        sentiment: 'positive',
        outcome: 'connected',
      });
      await fetchProfile(selectedCustomerId);
    } catch (err) {
      console.error('Failed to log interaction:', err);
    }
  };

  const lifecycleBadges: Record<CustomerLifecycleStatus, { label: string; class: string }> = {
    new: { label: 'New', class: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    active: { label: 'Active', class: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
    vip: { label: 'VIP', class: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
    at_risk: { label: 'At Risk', class: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    dormant: { label: 'Dormant', class: 'bg-rose-500/10 text-rose-600 border-rose-500/20' },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Customer Directory (4 cols) */}
      <div className="lg:col-span-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
          <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">
            Customer Directory ({customers.length})
          </h3>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search by customer name, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
          {filteredCustomers.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--text-secondary)]">
              No matching customers.
            </div>
          ) : (
            filteredCustomers.map((c) => {
              const isSelected = selectedCustomerId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => fetchProfile(c.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                      : 'border-[var(--border)] bg-[var(--bg)] hover:border-[var(--accent)]/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="font-bold text-xs text-[var(--text)]">{c.name}</div>
                    <span className="text-[10px] font-bold font-num text-[var(--text)]">
                      ৳{(c.total_spent || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)] flex items-center justify-between mt-1">
                    <span>{c.phone}</span>
                    <span>{c.total_orders || 0} orders</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Customer 360 View (8 cols) */}
      <div className="lg:col-span-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-6">
        {loadingProfile ? (
          <div className="p-16 text-center text-xs text-[var(--text-secondary)] flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading Customer 360 profile and intelligence...
          </div>
        ) : !c360 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center mx-auto">
              <User className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[var(--text)]">Select a Customer</h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
              Choose a customer from the directory on the left to view complete 360 intelligence, order history, communication logs, and fragrance preferences.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header / Profile Card */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center font-bold text-base">
                  {c360.customer.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[var(--text)]">{c360.customer.name}</h2>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        lifecycleBadges[c360.lifecycle.status]?.class || 'bg-zinc-500/10 text-zinc-600'
                      }`}
                    >
                      {lifecycleBadges[c360.lifecycle.status]?.label || c360.lifecycle.status}
                    </span>
                    {c360.lifecycle.manual_override && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 font-bold">
                        Manual Override
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {c360.customer.phone}
                    </span>
                    <span>City: {c360.customer.city || 'Dhaka'}</span>
                    <span>Rating: {c360.customer.rating || 5.0} / 5.0</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowInteractionModal(true)}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 flex items-center gap-1"
                >
                  <MessageSquare className="w-3 h-3" />
                  Log Interaction
                </button>
                <button
                  onClick={() => {
                    setOverrideStatus(c360.lifecycle.status);
                    setOverrideReason(c360.lifecycle.override_reason || '');
                    setShowOverrideModal(true);
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--text)]"
                >
                  Lifecycle Status
                </button>
                {c360.lifecycle.manual_override && (
                  <button
                    onClick={handleClearOverride}
                    className="px-2 py-1.5 text-xs rounded-lg border border-[var(--border)] text-rose-600 hover:bg-rose-50"
                    title="Reset to automated formula"
                  >
                    Reset Auto
                  </button>
                )}
              </div>
            </div>

            {/* Quick KPI stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)]">
                <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Lifetime Value</div>
                <div className="text-base font-bold font-num text-emerald-600 mt-0.5">
                  ৳{(c360.customer.total_spent || 0).toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)]">
                <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Completed Orders</div>
                <div className="text-base font-bold font-num text-[var(--text)] mt-0.5">
                  {c360.orders.length}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)]">
                <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Days Since Order</div>
                <div className="text-base font-bold font-num text-[var(--text)] mt-0.5">
                  {c360.lifecycle.days_since_last_order ?? 'None'}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)]">
                <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Returns / RTO</div>
                <div className="text-base font-bold font-num text-rose-600 mt-0.5">
                  {c360.returns.length}
                </div>
              </div>
            </div>

            {/* Tags section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Customer Tags & Segments
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {c360.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                  >
                    {tag.name}
                    <button
                      onClick={() => handleRemoveTag(tag.id)}
                      className="hover:opacity-70 text-[10px] ml-0.5"
                    >
                      ✕
                    </button>
                  </span>
                ))}

                {/* Available tag dropdown */}
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddTag(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="text-xs px-2 py-0.5 rounded-full border border-dashed border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)] cursor-pointer"
                  defaultValue=""
                >
                  <option value="" disabled>
                    + Add Tag...
                  </option>
                  {availableTags
                    .filter((t) => !c360.tags.some((ct) => ct.id === t.id))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Fragrance Preferences Card */}
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-purple-600" />
                  <h4 className="text-xs font-bold text-[var(--text)]">Fragrance Profile & Taste</h4>
                </div>
                <button
                  onClick={() => {
                    setPrefForm(c360.preferences || {});
                    setShowPrefModal(true);
                  }}
                  className="text-xs font-bold text-[var(--accent)] hover:underline flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit Preferences
                </button>
              </div>

              {c360.preferences ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-[var(--text-secondary)] block">Favorite Olfactory Notes</span>
                    <span className="font-semibold text-[var(--text)]">
                      {c360.preferences.favorite_notes?.join(', ') || 'Not recorded'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-secondary)] block">Preferred Brands</span>
                    <span className="font-semibold text-[var(--text)]">
                      {c360.preferences.preferred_brands?.join(', ') || 'Any'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-secondary)] block">Concentration & Occasion</span>
                    <span className="font-semibold text-[var(--text)]">
                      {c360.preferences.preferred_concentration || 'EDP'} • {c360.preferences.scent_family || 'Gourmand'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[var(--text-secondary)]">
                  No fragrance taste recorded yet. Click 'Edit Preferences' to record perfume notes, favorite brands, and bottle size preferences.
                </div>
              )}
            </div>

            {/* Special Dates (Birthdays, Anniversaries, Eid) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-purple-600" />
                  Special Occasions & Milestones ({c360.special_dates?.length || 0})
                </h4>
                <button
                  onClick={() => setShowDateModal(true)}
                  className="text-xs font-bold text-[var(--accent)] hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add Occasion
                </button>
              </div>

              {c360.special_dates && c360.special_dates.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {c360.special_dates.map((d) => (
                    <div
                      key={d.id}
                      className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-[var(--text)] capitalize">
                          {(d.occasion || d.type || d.label || 'Special Occasion').replace('_', ' ')}
                        </span>
                        <div className="text-[11px] text-[var(--text-secondary)]">
                          {d.date} {d.notes && `• ${d.notes}`}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteSpecialDate(d.id)}
                        className="text-rose-500 hover:text-rose-700 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[var(--text-secondary)]">
                  No special dates recorded for this customer.
                </div>
              )}
            </div>

            {/* Unified Activity Timeline */}
            <div className="space-y-3 pt-4 border-t border-[var(--border)]">
              <h4 className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[var(--accent)]" />
                Customer History Timeline ({c360.timeline?.length || 0} events)
              </h4>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {c360.timeline && c360.timeline.length > 0 ? (
                  c360.timeline.map((event, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs flex items-start gap-3"
                    >
                      <div className="mt-0.5">
                        {event.type === 'order' ? (
                          <ShoppingBag className="w-4 h-4 text-emerald-600" />
                        ) : event.type === 'interaction' ? (
                          <MessageSquare className="w-4 h-4 text-blue-600" />
                        ) : event.type === 'return' ? (
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                        ) : (
                          <Clock className="w-4 h-4 text-[var(--accent)]" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[var(--text)] capitalize">
                            {event.type}: {event.summary || event.title}
                          </span>
                          <span className="text-[10px] text-[var(--text-secondary)]">
                            {new Date(event.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        {event.notes && (
                          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{event.notes}</p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-[var(--text-secondary)] text-center py-4">
                    No timeline events found.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Lifecycle Override */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-[var(--text)]">Override Customer Lifecycle Tier</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Status Tier
                </label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value as CustomerLifecycleStatus)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                >
                  <option value="new">New</option>
                  <option value="active">Active</option>
                  <option value="vip">VIP</option>
                  <option value="at_risk">At Risk</option>
                  <option value="dormant">Dormant</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Reason for Override *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. VIP celebrity customer or personal friend of owner"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveOverride}
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-bold"
                >
                  Save Override
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Preferences */}
      {showPrefModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-[var(--text)]">Edit Fragrance Preferences</h3>
            <form onSubmit={handleSavePreferences} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Favorite Olfactory Notes (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Amber, Vanilla, Oud, Bergamot"
                  value={prefForm.favorite_notes?.join(', ') || ''}
                  onChange={(e) =>
                    setPrefForm({
                      ...prefForm,
                      favorite_notes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Preferred Brands (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Khadlaj, Armaf, Rasasi, Dior"
                  value={prefForm.preferred_brands?.join(', ') || ''}
                  onChange={(e) =>
                    setPrefForm({
                      ...prefForm,
                      preferred_brands: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Preferred Concentration
                  </label>
                  <select
                    value={prefForm.preferred_concentration || 'EDP'}
                    onChange={(e) => setPrefForm({ ...prefForm, preferred_concentration: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  >
                    <option value="EDP">Eau de Parfum (EDP)</option>
                    <option value="EDT">Eau de Toilette (EDT)</option>
                    <option value="Extrait">Extrait de Parfum</option>
                    <option value="Attar">Pure Attar / Oil</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Bottle Size
                  </label>
                  <select
                    value={prefForm.bottle_size_preference || '100ML'}
                    onChange={(e) => setPrefForm({ ...prefForm, bottle_size_preference: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  >
                    <option value="100ML">100ML Full Bottle</option>
                    <option value="50ML">50ML Bottle</option>
                    <option value="200ML">200ML Jumbo</option>
                    <option value="combo">Combos & Gift Sets</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Special Tasting Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Prefers sweet drydown, dislikes powdery notes..."
                  value={prefForm.notes || ''}
                  onChange={(e) => setPrefForm({ ...prefForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowPrefModal(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-bold"
                >
                  Save Taste Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Special Occasion Date */}
      {showDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-[var(--text)]">Add Customer Special Date</h3>
            <form onSubmit={handleSaveSpecialDate} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Occasion Type
                </label>
                <select
                  value={dateForm.occasion}
                  onChange={(e) => setDateForm({ ...dateForm, occasion: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                >
                  <option value="birthday">Birthday</option>
                  <option value="anniversary">Anniversary</option>
                  <option value="eid">Eid Celebration</option>
                  <option value="other">Other Milestone</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={dateForm.date}
                  onChange={(e) => setDateForm({ ...dateForm, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Likes gift-wrapping with gold ribbon"
                  value={dateForm.notes || ''}
                  onChange={(e) => setDateForm({ ...dateForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowDateModal(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-bold"
                >
                  Add Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Log Interaction */}
      {showInteractionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-[var(--text)]">Log Customer Interaction</h3>
            <form onSubmit={handleLogInteraction} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Channel
                  </label>
                  <select
                    value={interactionForm.channel}
                    onChange={(e) => setInteractionForm({ ...interactionForm, channel: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  >
                    <option value="messenger">Messenger</option>
                    <option value="phone">Phone Call</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="in_person">In-Person Shop Visit</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Direction
                  </label>
                  <select
                    value={interactionForm.direction}
                    onChange={(e) => setInteractionForm({ ...interactionForm, direction: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  >
                    <option value="outbound">Outbound (We reached out)</option>
                    <option value="inbound">Inbound (Customer reached out)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Summary / Conversation Notes *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Customer inquired about restock timing for Armaf Club de Nuit..."
                  value={interactionForm.summary}
                  onChange={(e) => setInteractionForm({ ...interactionForm, summary: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Customer Sentiment
                  </label>
                  <select
                    value={interactionForm.sentiment}
                    onChange={(e) => setInteractionForm({ ...interactionForm, sentiment: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  >
                    <option value="positive">Positive / Delighted</option>
                    <option value="neutral">Neutral / Informational</option>
                    <option value="negative">Negative / Frustrated</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Outcome
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ordered, Promised callback"
                    value={interactionForm.outcome}
                    onChange={(e) => setInteractionForm({ ...interactionForm, outcome: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowInteractionModal(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-bold"
                >
                  Log Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
