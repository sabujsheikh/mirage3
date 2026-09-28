import React, { useEffect, useState } from 'react';
import {
  Megaphone,
  Plus,
  Calendar,
  Users,
  CheckCircle2,
  TrendingUp,
  MessageCircle,
  Phone,
  Store,
  Clock,
  Filter,
} from 'lucide-react';
import { crmApi } from './crmApi';
import { CRMCampaign } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const CampaignsTab: React.FC = () => {
  const { currentUser } = useAuth();
  const [campaigns, setCampaigns] = useState<CRMCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [formData, setFormData] = useState<Partial<CRMCampaign>>({
    name: '',
    target_segment: 'VIP Fragrance Lovers',
    purpose: 'Promote seasonal luxury arrivals & exclusive decants',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    channel: 'messenger',
    description: '',
    target_customer_count: 50,
    status: 'planning',
  });

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const data = await crmApi.getCampaigns();
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    try {
      await crmApi.createCampaign(
        {
          ...formData,
          responsible_user_id: currentUser?.id || 'usr_owner',
          responsible_user_name: currentUser?.name || 'Sobuj Sehk',
        },
        currentUser?.id
      );
      setShowModal(false);
      setFormData({
        name: '',
        target_segment: 'VIP Fragrance Lovers',
        purpose: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        channel: 'messenger',
        description: '',
        target_customer_count: 50,
        status: 'planning',
      });
      await fetchCampaigns();
    } catch (err) {
      console.error('Failed to create campaign:', err);
    }
  };

  const handleStatusChange = async (id: string, newStatus: CRMCampaign['status']) => {
    try {
      await crmApi.updateCampaign(id, { status: newStatus }, currentUser?.id);
      await fetchCampaigns();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const safeCampaigns = Array.isArray(campaigns) ? campaigns : [];
  const filtered = safeCampaigns.filter((c) => {
    if (statusFilter === 'all') return true;
    return c && c.status === statusFilter;
  });

  const totalTarget = safeCampaigns.reduce((acc, c) => acc + (c?.target_customer_count || 0), 0);
  const totalContacted = safeCampaigns.reduce((acc, c) => acc + (c?.contacted_count || 0), 0);
  const totalConverted = safeCampaigns.reduce((acc, c) => acc + (c?.converted_count || 0), 0);
  const avgConversionRate = totalContacted > 0 ? ((totalConverted / totalContacted) * 100).toFixed(1) : '0';

  const channelIcons: Record<string, React.ReactNode> = {
    messenger: <MessageCircle className="w-3.5 h-3.5 text-blue-500" />,
    whatsapp: <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />,
    phone: <Phone className="w-3.5 h-3.5 text-amber-500" />,
    sms: <MessageCircle className="w-3.5 h-3.5 text-purple-500" />,
    in_person: <Store className="w-3.5 h-3.5 text-rose-500" />,
  };

  const statusBadges: Record<string, { label: string; class: string }> = {
    planning: { label: 'Planning', class: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    active: { label: 'Active', class: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
    completed: { label: 'Completed', class: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    cancelled: { label: 'Cancelled', class: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
  };

  return (
    <div className="space-y-6">
      {/* Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            Active Campaigns
          </span>
          <div className="text-2xl font-bold font-num text-[var(--text)] mt-1">
            {campaigns.filter((c) => c.status === 'active').length}
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
            {campaigns.length} total marketing drives
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            Target Audience
          </span>
          <div className="text-2xl font-bold font-num text-[var(--text)] mt-1">
            {totalTarget.toLocaleString()}
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
            Identified fragrance buyers
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            Outreach Contacted
          </span>
          <div className="text-2xl font-bold font-num text-blue-600 mt-1">
            {totalContacted.toLocaleString()}
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
            Messenger & WhatsApp touchpoints
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            Conversion Rate
          </span>
          <div className="text-2xl font-bold font-num text-emerald-600 mt-1">
            {avgConversionRate}%
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
            {totalConverted} converted purchases
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--text-secondary)]" />
          <div className="flex items-center gap-1.5 p-1 bg-[var(--surface-hover)] rounded-lg text-xs font-semibold">
            {['all', 'active', 'planning', 'completed'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-md capitalize transition-all ${
                  statusFilter === st
                    ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 text-xs font-bold rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Campaign
        </button>
      </div>

      {/* Campaigns Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[var(--text-secondary)]">Loading campaigns...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-center">
          <Megaphone className="w-10 h-10 text-[var(--text-secondary)] mx-auto mb-3 opacity-50" />
          <h4 className="text-sm font-bold text-[var(--text)]">No Campaigns Found</h4>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-md mx-auto">
            Design promotional drives, VIP scent tasting invites, and seasonal discounts to engage your customer segments.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((campaign) => {
            const badge = statusBadges[campaign.status] || statusBadges.planning;
            const progress =
              campaign.target_customer_count > 0
                ? Math.min(100, Math.round((campaign.contacted_count / campaign.target_customer_count) * 100))
                : 0;

            return (
              <div
                key={campaign.id}
                className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-4 hover:border-[var(--accent)]/30 transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                      {campaign.target_segment}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${badge.class}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-[var(--text)] leading-snug">
                    {campaign.name}
                  </h3>

                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                    {campaign.purpose || campaign.description || 'Targeted perfume campaign outreach.'}
                  </p>

                  <div className="pt-2 flex items-center gap-3 text-[11px] text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1">
                      {channelIcons[campaign.channel]}
                      <span className="capitalize">{campaign.channel}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{campaign.start_date.slice(5)} to {campaign.end_date?.slice(5) || 'Ongoing'}</span>
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--border)] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">Progress:</span>
                    <span className="font-bold text-[var(--text)]">
                      {campaign.contacted_count} / {campaign.target_customer_count} contacted
                    </span>
                  </div>

                  <div className="w-full h-1.5 bg-[var(--surface-hover)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      Converted: <strong className="text-emerald-600 font-bold">{campaign.converted_count || 0}</strong>
                    </div>
                    <select
                      value={campaign.status}
                      onChange={(e) => handleStatusChange(campaign.id, e.target.value as any)}
                      className="text-[11px] font-medium px-2 py-1 rounded bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] focus:outline-none"
                    >
                      <option value="planning">Planning</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create Campaign */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-[var(--accent)]" />
                Launch Customer Campaign
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase mb-1">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Eid Luxury Fragrance Preview"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] text-[var(--text)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase mb-1">
                    Target Segment
                  </label>
                  <select
                    value={formData.target_segment}
                    onChange={(e) => setFormData({ ...formData, target_segment: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] text-[var(--text)] focus:outline-none"
                  >
                    <option value="VIP Fragrance Lovers">VIP Fragrance Lovers</option>
                    <option value="High Spenders (৳15k+)">High Spenders (৳15k+)</option>
                    <option value="Oud & Amber Enthusiasts">Oud & Amber Enthusiasts</option>
                    <option value="Dormant (>60 Days)">Dormant (&gt;60 Days)</option>
                    <option value="Showroom Walk-in Regulars">Showroom Regulars</option>
                    <option value="All Customers">All Customers</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase mb-1">
                    Channel
                  </label>
                  <select
                    value={formData.channel}
                    onChange={(e) => setFormData({ ...formData, channel: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] text-[var(--text)] focus:outline-none"
                  >
                    <option value="messenger">Facebook Messenger</option>
                    <option value="whatsapp">WhatsApp Business</option>
                    <option value="phone">Direct Phone Call</option>
                    <option value="sms">SMS Broadcast</option>
                    <option value="in_person">Showroom In-Person</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.start_date || ''}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] text-[var(--text)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formData.end_date || ''}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] text-[var(--text)] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase mb-1">
                  Target Audience Count
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.target_customer_count || 50}
                  onChange={(e) =>
                    setFormData({ ...formData, target_customer_count: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] text-[var(--text)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase mb-1">
                  Purpose / Pitch Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Offer 10% complimentary tester decant for orders over ৳5,000..."
                  value={formData.purpose || ''}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] text-[var(--text)] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white font-bold hover:bg-[var(--accent)]/90"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
