import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  Phone,
  Store,
  Plus,
  Search,
  Filter,
  User,
  Calendar,
  Smile,
  Meh,
  Frown,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { crmApi } from './crmApi';
import { CRMInteraction } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';

export const InteractionsTab: React.FC = () => {
  const { currentUser } = useAuth();
  const { customers } = useApp();
  const [interactions, setInteractions] = useState<CRMInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('');
  const [showLogModal, setShowLogModal] = useState(false);

  const [formData, setFormData] = useState<Partial<CRMInteraction>>({
    customer_id: '',
    customer_name: '',
    channel: 'phone',
    direction: 'outbound',
    summary: '',
    sentiment: 'positive',
    outcome: '',
  });

  const fetchInteractions = async () => {
    try {
      setLoading(true);
      const data = await crmApi.getInteractions();
      setInteractions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load interactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInteractions();
  }, []);

  const handleLogInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.summary) return;

    try {
      await crmApi.logInteraction(formData, currentUser?.id, currentUser?.name);
      setShowLogModal(false);
      setFormData({
        customer_id: '',
        customer_name: '',
        channel: 'phone',
        direction: 'outbound',
        summary: '',
        sentiment: 'positive',
        outcome: '',
      });
      await fetchInteractions();
    } catch (err) {
      console.error('Error logging interaction:', err);
    }
  };

  const filtered = (interactions || []).filter((i) => {
    if (channelFilter && i.channel !== channelFilter) return false;
    if (sentimentFilter && i.sentiment !== sentimentFilter) return false;
    return true;
  });

  const getChannelIcon = (ch: string) => {
    switch (ch) {
      case 'phone':
        return <Phone className="w-4 h-4 text-emerald-600" />;
      case 'messenger':
        return <MessageSquare className="w-4 h-4 text-blue-600" />;
      case 'whatsapp':
        return <MessageSquare className="w-4 h-4 text-emerald-500" />;
      case 'in_person':
        return <Store className="w-4 h-4 text-purple-600" />;
      default:
        return <MessageSquare className="w-4 h-4 text-[var(--accent)]" />;
    }
  };

  const getSentimentBadge = (sent?: string) => {
    switch (sent) {
      case 'positive':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
            <Smile className="w-3 h-3" /> Positive
          </span>
        );
      case 'negative':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600">
            <Frown className="w-3 h-3" /> Negative
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-500/10 text-zinc-600">
            <Meh className="w-3 h-3" /> Neutral
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Action and Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
          >
            <option value="">All Channels</option>
            <option value="phone">Phone Calls</option>
            <option value="messenger">Facebook Messenger</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="in_person">In-Person Visits</option>
          </select>

          <select
            value={sentimentFilter}
            onChange={(e) => setSentimentFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
          >
            <option value="">All Sentiments</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
        </div>

        <button
          onClick={() => setShowLogModal(true)}
          className="w-full sm:w-auto px-3.5 py-2 text-xs font-bold rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 flex items-center justify-center gap-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Log Touchpoint</span>
        </button>
      </div>

      {/* Interactions Feed */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--text-secondary)] border border-dashed border-[var(--border)] rounded-xl bg-[var(--surface)]">
            No interactions recorded matching the current filter.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/50 transition-all space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[var(--surface-hover)] flex items-center justify-center">
                    {getChannelIcon(item.channel)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--text)]">
                        {item.customer_name || 'Anonymous Customer'}
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)] uppercase flex items-center gap-0.5">
                        {item.direction === 'outbound' ? (
                          <ArrowUpRight className="w-3 h-3 text-blue-500" />
                        ) : (
                          <ArrowDownLeft className="w-3 h-3 text-emerald-500" />
                        )}
                        {item.direction}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-2 mt-0.5">
                      <span className="capitalize">{item.channel.replace('_', ' ')}</span>
                      <span>•</span>
                      <span>Logged by {item.logged_by_name}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {getSentimentBadge(item.sentiment)}
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <p className="text-xs text-[var(--text)] pl-10.5 leading-relaxed">
                {item.summary}
              </p>

              {item.outcome && (
                <div className="text-[11px] text-[var(--text-secondary)] pl-10.5 flex items-center gap-1.5 pt-1">
                  <span className="font-semibold text-[var(--text)]">Outcome:</span>
                  <span>{item.outcome}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal: Log Interaction */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-[var(--text)]">Record Communication Touchpoint</h3>
            <form onSubmit={handleLogInteraction} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Customer (Optional if general)
                </label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => {
                    const cust = customers.find((c) => c.id === e.target.value);
                    setFormData({
                      ...formData,
                      customer_id: e.target.value,
                      customer_name: cust?.name || '',
                    });
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                >
                  <option value="">Select Existing Customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              {!formData.customer_id && (
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Or Customer Name
                  </label>
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Channel
                  </label>
                  <select
                    value={formData.channel}
                    onChange={(e) => setFormData({ ...formData, channel: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  >
                    <option value="phone">Phone Call</option>
                    <option value="messenger">Facebook Messenger</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="in_person">In-Person Shop Visit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Direction
                  </label>
                  <select
                    value={formData.direction}
                    onChange={(e) => setFormData({ ...formData, direction: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  >
                    <option value="outbound">Outbound (We initiated)</option>
                    <option value="inbound">Inbound (Customer called/messaged)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Summary & Notes *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Notes from the call or conversation..."
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Sentiment
                  </label>
                  <select
                    value={formData.sentiment}
                    onChange={(e) => setFormData({ ...formData, sentiment: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  >
                    <option value="positive">Positive / Delighted</option>
                    <option value="neutral">Neutral / Inquiry</option>
                    <option value="negative">Negative / Dissatisfied</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Outcome
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Order placed, Promised visit"
                    value={formData.outcome}
                    onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-bold"
                >
                  Save Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
