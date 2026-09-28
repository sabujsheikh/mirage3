import React, { useEffect, useState } from 'react';
import {
  Tag,
  Filter,
  Download,
  Plus,
  Users,
  CheckSquare,
  Square,
  Sparkles,
  RefreshCw,
  Search,
} from 'lucide-react';
import { crmApi } from './crmApi';
import { CRMTag, Customer, CustomerLifecycleStatus, CustomerSegmentFilter } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';

export const SegmentsAndTagsTab: React.FC = () => {
  const { currentUser } = useAuth();
  const { customers } = useApp();
  const [tags, setTags] = useState<CRMTag[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#2563eb');
  const [creatingTag, setCreatingTag] = useState(false);

  // Segment filter state
  const [filter, setFilter] = useState<CustomerSegmentFilter>({
    status: undefined,
    min_orders: undefined,
    min_spent: undefined,
    max_days_since_order: undefined,
  });

  const [filteredList, setFilteredList] = useState<Customer[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTagId, setBulkTagId] = useState('');
  const [exporting, setExporting] = useState(false);

  const fetchTags = async () => {
    try {
      const data = await crmApi.getTags();
      setTags(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  };

  const applyFilter = async () => {
    try {
      const list = await crmApi.filterCustomers(filter);
      setFilteredList(Array.isArray(list) ? list : []);
      setSelectedIds([]);
    } catch (err) {
      console.error('Failed to filter customers:', err);
    }
  };

  useEffect(() => {
    fetchTags();
    applyFilter();
  }, [filter]);

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    try {
      setCreatingTag(true);
      await crmApi.createTag(newTagName.trim(), newTagColor, currentUser?.id, currentUser?.name);
      setNewTagName('');
      await fetchTags();
    } catch (err) {
      console.error('Failed to create tag:', err);
    } finally {
      setCreatingTag(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredList.map((c) => c.id));
    }
  };

  const toggleSelectCustomer = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleApplyBulkTag = async () => {
    if (!bulkTagId || selectedIds.length === 0) return;
    try {
      await crmApi.bulkTagCustomers(selectedIds, [bulkTagId], currentUser?.id);
      alert(`Successfully added tag to ${selectedIds.length} customers.`);
      setSelectedIds([]);
    } catch (err) {
      console.error('Failed to apply bulk tag:', err);
    }
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const blob = await crmApi.exportSegmentCSV(filter);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mirage_customers_segment_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top section: Tags Palette & Creation */}
      <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
              <Tag className="w-4 h-4 text-[var(--accent)]" />
              CRM Label & Tag Management
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Create tags to categorize high spenders, decant lovers, niche collectors, or wholesale merchants.
            </p>
          </div>
        </div>

        {/* Existing Tags */}
        <div className="flex flex-wrap items-center gap-2">
          {tags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
              style={{
                backgroundColor: `${t.color}15`,
                borderColor: `${t.color}30`,
                color: t.color,
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
              {t.name}
            </span>
          ))}
        </div>

        {/* Create Tag Form */}
        <form onSubmit={handleCreateTag} className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border)]">
          <input
            type="text"
            placeholder="New tag name (e.g. Gourmand Enthusiast)..."
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] w-64"
          />

          <input
            type="color"
            value={newTagColor}
            onChange={(e) => setNewTagColor(e.target.value)}
            className="w-8 h-8 rounded border border-[var(--border)] bg-transparent cursor-pointer"
            title="Pick tag color"
          />

          <button
            type="submit"
            disabled={creatingTag || !newTagName.trim()}
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Tag
          </button>
        </form>
      </div>

      {/* Segmentation Engine */}
      <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
          <div>
            <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
              <Filter className="w-4 h-4 text-purple-600" />
              Dynamic Customer Segmentation Engine
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Filter customer lists by RFM traits, spending thresholds, and inactivity windows
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={exporting || filteredList.length === 0}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--text)] flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {exporting ? 'Exporting...' : `Export Segment (${filteredList.length})`}
            </button>
          </div>
        </div>

        {/* Filter Criteria Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
              Lifecycle Status
            </label>
            <select
              value={filter.status || ''}
              onChange={(e) => setFilter({ ...filter, status: (e.target.value as any) || undefined })}
              className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
            >
              <option value="">All Lifecycles</option>
              <option value="vip">VIP High Value</option>
              <option value="loyal">Loyal Repeat</option>
              <option value="active">Active Regular</option>
              <option value="at_risk">At Risk (60d silent)</option>
              <option value="dormant">Dormant (90d silent)</option>
              <option value="new">New Customer</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
              Minimum Spent (৳)
            </label>
            <input
              type="number"
              placeholder="e.g. 5000"
              value={filter.min_spent ?? ''}
              onChange={(e) =>
                setFilter({
                  ...filter,
                  min_spent: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] font-num"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
              Minimum Completed Orders
            </label>
            <input
              type="number"
              placeholder="e.g. 2"
              value={filter.min_orders ?? ''}
              onChange={(e) =>
                setFilter({
                  ...filter,
                  min_orders: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] font-num"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
              Inactive For At Least (Days)
            </label>
            <input
              type="number"
              placeholder="e.g. 60"
              value={filter.min_days_since_order ?? ''}
              onChange={(e) =>
                setFilter({
                  ...filter,
                  min_days_since_order: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] font-num"
            />
          </div>
        </div>

        {/* Bulk Tag Action Bar */}
        {selectedIds.length > 0 && (
          <div className="p-3 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30 flex items-center justify-between gap-3 text-xs">
            <span className="font-bold text-[var(--accent)]">
              {selectedIds.length} customers selected
            </span>
            <div className="flex items-center gap-2">
              <select
                value={bulkTagId}
                onChange={(e) => setBulkTagId(e.target.value)}
                className="px-2.5 py-1 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-xs"
              >
                <option value="">Select Tag to Apply...</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleApplyBulkTag}
                disabled={!bulkTagId}
                className="px-3 py-1 rounded-md bg-[var(--accent)] text-white font-bold hover:bg-[var(--accent)]/90 disabled:opacity-50"
              >
                Apply Tag
              </button>
            </div>
          </div>
        )}

        {/* Filtered Customer Table */}
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-hover)] border-b border-[var(--border)] text-[var(--text-secondary)] font-semibold uppercase">
              <tr>
                <th className="p-3 w-8">
                  <button onClick={toggleSelectAll} className="p-1">
                    {selectedIds.length === filteredList.length && filteredList.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-[var(--accent)]" />
                    ) : (
                      <Square className="w-4 h-4 text-[var(--border)]" />
                    )}
                  </button>
                </th>
                <th className="p-3">Customer</th>
                <th className="p-3">Phone</th>
                <th className="p-3 text-right">Lifetime Spent</th>
                <th className="p-3 text-center">Orders</th>
                <th className="p-3 text-center">Rating</th>
                <th className="p-3">City</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-xs text-[var(--text-secondary)]">
                    No customers match current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredList.map((c) => {
                  const isSelected = selectedIds.includes(c.id);
                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-[var(--surface-hover)] transition-colors ${
                        isSelected ? 'bg-[var(--accent)]/5' : ''
                      }`}
                    >
                      <td className="p-3">
                        <button onClick={() => toggleSelectCustomer(c.id)} className="p-1">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[var(--accent)]" />
                          ) : (
                            <Square className="w-4 h-4 text-[var(--border)]" />
                          )}
                        </button>
                      </td>
                      <td className="p-3 font-bold text-[var(--text)]">{c.name}</td>
                      <td className="p-3 text-[var(--text-secondary)] font-num">{c.phone}</td>
                      <td className="p-3 text-right font-num font-bold text-[var(--text)]">
                        ৳{(c.total_spent || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-center font-num text-[var(--text)]">
                        {c.total_orders || 0}
                      </td>
                      <td className="p-3 text-center font-num text-[var(--text-secondary)]">
                        {c.rating ? `${c.rating.toFixed(1)} ★` : '—'}
                      </td>
                      <td className="p-3 text-[var(--text-secondary)]">{c.city || 'Dhaka'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
