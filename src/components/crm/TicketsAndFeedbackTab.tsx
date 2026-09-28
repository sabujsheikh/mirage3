import React, { useEffect, useState } from 'react';
import {
  LifeBuoy,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  Star,
  User,
  Filter,
} from 'lucide-react';
import { crmApi } from './crmApi';
import { CRMTicket, CustomerFeedback } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';

interface TicketsAndFeedbackTabProps {
  initialSubTab?: 'tickets' | 'feedback';
}

export const TicketsAndFeedbackTab: React.FC<TicketsAndFeedbackTabProps> = ({
  initialSubTab = 'tickets',
}) => {
  const { currentUser } = useAuth();
  const { customers } = useApp();
  const [subTab, setSubTab] = useState<'tickets' | 'feedback'>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const [tickets, setTickets] = useState<CRMTicket[]>([]);
  const [feedbacks, setFeedbacks] = useState<CustomerFeedback[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketForm, setTicketForm] = useState<Partial<CRMTicket>>({
    customer_name: '',
    subject: '',
    description: '',
    category: 'damaged',
    priority: 'medium',
  });

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState<Partial<CustomerFeedback>>({
    customer_name: '',
    rating: 5,
    comment: '',
    fragrance_longevity: 5,
    packaging_score: 5,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tList, fList] = await Promise.all([crmApi.getTickets(), crmApi.getFeedback()]);
      setTickets(Array.isArray(tList) ? tList : []);
      setFeedbacks(Array.isArray(fList) ? fList : []);
    } catch (err) {
      console.error('Failed to load tickets/feedback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketForm.subject) return;

    try {
      await crmApi.createTicket(ticketForm, currentUser?.id, currentUser?.name);
      setShowTicketModal(false);
      setTicketForm({
        customer_name: '',
        subject: '',
        description: '',
        category: 'damaged',
        priority: 'medium',
      });
      await fetchData();
    } catch (err) {
      console.error('Failed to create ticket:', err);
    }
  };

  const handleCreateFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackForm.comment) return;

    try {
      await crmApi.submitFeedback(feedbackForm, currentUser?.id);
      setShowFeedbackModal(false);
      setFeedbackForm({
        customer_name: '',
        rating: 5,
        comment: '',
        fragrance_longevity: 5,
        packaging_score: 5,
      });
      await fetchData();
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  };

  const handleResolveTicket = async (id: string) => {
    const resolution = prompt('Enter resolution notes:');
    if (!resolution) return;
    try {
      await crmApi.resolveTicket(id, resolution, currentUser?.id);
      await fetchData();
    } catch (err) {
      console.error('Failed to resolve ticket:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Subtab Toggle */}
      <div className="flex items-center justify-between p-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSubTab('tickets')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              subTab === 'tickets'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <LifeBuoy className="w-4 h-4" />
            Support Tickets & Complaints ({(Array.isArray(tickets) ? tickets : []).filter((t) => t && t.status !== 'resolved').length} open)
          </button>
          <button
            onClick={() => setSubTab('feedback')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              subTab === 'feedback'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Star className="w-4 h-4" />
            CSAT & Fragrance Reviews ({(Array.isArray(feedbacks) ? feedbacks : []).length})
          </button>
        </div>

        {subTab === 'tickets' ? (
          <button
            onClick={() => setShowTicketModal(true)}
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Open Ticket
          </button>
        ) : (
          <button
            onClick={() => setShowFeedbackModal(true)}
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Log Review
          </button>
        )}
      </div>

      {/* Content depending on subTab */}
      {subTab === 'tickets' ? (
        <div className="space-y-3">
          {tickets.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--text-secondary)] border border-dashed border-[var(--border)] rounded-xl bg-[var(--surface)]">
              No tickets found. All customer support issues are resolved.
            </div>
          ) : (
            tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/50 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                        ticket.priority === 'urgent'
                          ? 'bg-rose-500/10 text-rose-600'
                          : ticket.priority === 'high'
                          ? 'bg-amber-500/10 text-amber-600'
                          : 'bg-blue-500/10 text-blue-600'
                      }`}
                    >
                      {ticket.priority}
                    </span>
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                      Category: {ticket.category}
                    </span>
                    <h4 className="text-xs font-bold text-[var(--text)]">{ticket.subject}</h4>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)]">{ticket.description}</p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-secondary)] pt-1">
                    <span className="font-semibold text-[var(--text)] flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {ticket.customer_name}
                    </span>
                    <span>Status: {ticket.status}</span>
                    {ticket.resolution && (
                      <span className="text-emerald-600">Resolution: {ticket.resolution}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {ticket.status !== 'resolved' ? (
                    <button
                      onClick={() => handleResolveTicket(ticket.id)}
                      className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Resolve
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Resolved
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Feedback List */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {feedbacks.length === 0 ? (
            <div className="col-span-2 p-8 text-center text-xs text-[var(--text-secondary)] border border-dashed border-[var(--border)] rounded-xl bg-[var(--surface)]">
              No customer reviews recorded yet.
            </div>
          ) : (
            feedbacks.map((f) => (
              <div
                key={f.id}
                className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[var(--text)]">{f.customer_name}</span>
                  <div className="flex items-center gap-0.5 text-amber-500 text-xs">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${i < f.rating ? 'fill-current' : 'opacity-30'}`}
                      />
                    ))}
                  </div>
                </div>

                <p className="text-xs text-[var(--text-secondary)] italic">"{f.comment}"</p>

                <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] pt-2 border-t border-[var(--border)]">
                  <span>Longevity: {f.fragrance_longevity || 5}/5</span>
                  <span>Packaging: {f.packaging_score || 5}/5</span>
                  <span>{new Date(f.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal: Open Ticket */}
      {showTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-[var(--text)]">Open Support Ticket / Complaint</h3>
            <form onSubmit={handleCreateTicket} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Customer
                </label>
                <select
                  value={ticketForm.customer_id}
                  onChange={(e) => {
                    const c = customers.find((cust) => cust.id === e.target.value);
                    setTicketForm({
                      ...ticketForm,
                      customer_id: e.target.value,
                      customer_name: c?.name || '',
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

              {!ticketForm.customer_id && (
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Or Customer Name
                  </label>
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={ticketForm.customer_name}
                    onChange={(e) => setTicketForm({ ...ticketForm, customer_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Atomizer nozzle leaking on Karus Gold"
                  value={ticketForm.subject}
                  onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Issue Category
                  </label>
                  <select
                    value={ticketForm.category}
                    onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  >
                    <option value="damaged">Damaged Bottle / Leaking</option>
                    <option value="wrong_item">Wrong Fragrance Sent</option>
                    <option value="delivery_delay">Courier Delay / Stuck</option>
                    <option value="scent_performance">Scent Performance / Longevity</option>
                    <option value="other">Other Inquiry</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Priority
                  </label>
                  <select
                    value={ticketForm.priority}
                    onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Detailed Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Customer stated box was crushed upon delivery..."
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowTicketModal(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-bold"
                >
                  Create Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Feedback */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-[var(--text)]">Log Customer Review & CSAT</h3>
            <form onSubmit={handleCreateFeedback} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Customer
                </label>
                <select
                  value={feedbackForm.customer_id}
                  onChange={(e) => {
                    const c = customers.find((cust) => cust.id === e.target.value);
                    setFeedbackForm({
                      ...feedbackForm,
                      customer_id: e.target.value,
                      customer_name: c?.name || '',
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

              {!feedbackForm.customer_id && (
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Or Customer Name
                  </label>
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={feedbackForm.customer_name}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, customer_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Overall Rating (1 to 5 Stars)
                </label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={feedbackForm.rating}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, rating: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] font-num"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Customer Review Comment *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Loved the projection and packaging, arrived in pristine condition!"
                  value={feedbackForm.comment}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, comment: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowFeedbackModal(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-bold"
                >
                  Submit Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
