import { PageHeader } from '../common/PageHeader';
import React, { useState } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  Clock,
  User,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Eye,
  Plus,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowRight,
  Sparkles,
  Lock,
  Hash,
  X,
  Bell,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { AuditLogEntry, ApprovalRequest, ApprovalRequestType } from '../../types';

export const AuditLogView: React.FC = () => {
  const {
    auditLogs,
    approvalRequests,
    approvalSummary,
    notifications,
    createApprovalRequest,
    reviewApprovalRequest,
    refreshAll,
  } = useApp();
  const { currentUser, can } = useAuth();

  const [activeTab, setActiveTab] = useState<'audit_trail' | 'approvals' | 'alerts'>('audit_trail');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');

  // Selected Log Diff Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  // Review Approval Modal
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'approved' | 'rejected'>('approved');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

  // New Approval Request Modal
  const [showNewRequestModal, setShowNewRequestModal] = useState<boolean>(false);
  const [reqType, setReqType] = useState<ApprovalRequestType>('price_discount_override');
  const [reqTitle, setReqTitle] = useState<string>('');
  const [reqDesc, setReqDesc] = useState<string>('');
  const [reqImpact, setReqImpact] = useState<number>(0);
  const [isSubmittingReq, setIsSubmittingReq] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Filtered Audit Logs
  const filteredLogs = auditLogs.filter((log) => {
    if (actionFilter !== 'all' && !log.action.toLowerCase().includes(actionFilter.toLowerCase())) {
      return false;
    }
    if (entityFilter !== 'all' && log.entity_type !== entityFilter) {
      return false;
    }
    if (userFilter !== 'all' && log.user_id !== userFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const mAction = log.action.toLowerCase().includes(q);
      const mEntity = log.entity_type.toLowerCase().includes(q);
      const mUser = log.user_name.toLowerCase().includes(q);
      const mDetails = JSON.stringify(log.details || {}).toLowerCase().includes(q);
      const mHash = (log.hash || '').toLowerCase().includes(q);
      if (!mAction && !mEntity && !mUser && !mDetails && !mHash) return false;
    }
    return true;
  });

  // Unique lists for filters
  const uniqueEntities = Array.from(new Set(auditLogs.map((l) => l.entity_type)));
  const uniqueUsers = Array.from(new Set(auditLogs.map((l) => JSON.stringify({ id: l.user_id, name: l.user_name })))).map(
    (s) => JSON.parse(s)
  );

  const pendingApprovalsCount = approvalRequests.filter((r) => r.status === 'pending').length;

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApproval) return;
    setIsSubmittingReview(true);
    try {
      await reviewApprovalRequest(selectedApproval.id, reviewDecision, reviewNotes);
      setSelectedApproval(null);
      setReviewNotes('');
    } catch (err: any) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle.trim() || !reqDesc.trim()) {
      setErrorMsg('Please enter request title and detailed justification.');
      return;
    }
    setIsSubmittingReq(true);
    setErrorMsg('');
    try {
      await createApprovalRequest({
        request_type: reqType,
        title: reqTitle,
        description: reqDesc,
        impact_amount: Number(reqImpact) || 0,
      });
      setShowNewRequestModal(false);
      setReqTitle('');
      setReqDesc('');
      setReqImpact(0);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit approval request');
    } finally {
      setIsSubmittingReq(false);
    }
  };

  const exportAuditLogsToCsv = () => {
    const headers = ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'Details', 'Cryptographic Hash'];
    const rows = filteredLogs.map((l) => [
      l.created_at,
      l.user_name,
      l.action,
      l.entity_type,
      l.entity_id,
      JSON.stringify(l.details || {}).replace(/"/g, '""'),
      l.hash || '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.map((c) => `"${c}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mirage_audit_trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto" id="audit-approvals-view">
      {/* Top Header */}
      <PageHeader
        eyebrow="Governance"
        title="Audit Log & Governance"
        desc="Append-only system event log, financial and inventory modifications, and multi-tier approval requests"
        actions={
          <button
            onClick={() => setShowNewRequestModal(true)}
            className="erp-btn-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Submit Approval Request</span>
          </button>
        }
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-medium">Immutable Audit Entries</span>
            <ShieldCheck className="w-4 h-4 text-[var(--status-green)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--text)]">{auditLogs.length}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1 font-mono">100% Cryptographically Hashed</div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-medium">Pending Sign-Off Requests</span>
            <Lock className="w-4 h-4 text-[var(--status-amber)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--status-amber)]">{pendingApprovalsCount}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            Impact: &#2547;{(approvalSummary?.total_pending_impact || 0).toLocaleString()}
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-medium">Total Approvals Processed</span>
            <CheckCircle2 className="w-4 h-4 text-[var(--status-teal)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--status-teal)]">
            {approvalRequests.filter((r) => r.status === 'approved').length}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            Rejected: {approvalRequests.filter((r) => r.status === 'rejected').length}
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-medium">Active Priority Alerts</span>
            <Bell className="w-4 h-4 text-[var(--status-red)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--status-red)]">
            {notifications.filter((n) => !n.read).length}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Unread business notifications</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] gap-2">
        <button
          onClick={() => setActiveTab('audit_trail')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'audit_trail'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Audit Trail Explorer ({filteredLogs.length})
        </button>

        <button
          onClick={() => setActiveTab('approvals')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'approvals'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <Lock className="w-4 h-4" />
          Approval Sign-Off Queue ({approvalRequests.length})
          {pendingApprovalsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-[color-mix(in_srgb,var(--status-amber)_10%,transparent)] text-white font-black text-[10px]">
              {pendingApprovalsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'alerts'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <Bell className="w-4 h-4" />
          System Alerts & Notification Hub ({notifications.length})
        </button>
      </div>

      {/* TAB 1: AUDIT TRAIL EXPLORER */}
      {activeTab === 'audit_trail' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search audit trail by user, action, entity, hash..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-[var(--border)] rounded-lg bg-[var(--surface-sunken)] text-[var(--text)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-semibold"
              >
                <option value="all">All Entity Types</option>
                {uniqueEntities.map((ent) => (
                  <option key={ent} value={ent}>
                    {ent.toUpperCase()}
                  </option>
                ))}
              </select>

              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-semibold"
              >
                <option value="all">All Actors / Users</option>
                {uniqueUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="dense-table-container">
            <div className="overflow-x-auto">
              <table className="dense-table">
                <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[11px] text-[var(--text-muted)] uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Timestamp & Hash</th>
                    <th className="px-4 py-3">Actor / User</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity Type & ID</th>
                    <th className="px-4 py-3">Audit Details</th>
                    <th className="px-4 py-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-xs text-[var(--text-muted)]">
                        No audit log entries found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-mono text-[11px] text-[var(--text)] font-semibold">
                            {new Date(log.created_at).toLocaleString('en-GB')}
                          </div>
                          {log.hash && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[var(--accent)] bg-[var(--surface-sunken)] px-1.5 py-0.2 rounded border border-[var(--border)]">
                              <Hash className="w-2.5 h-2.5" />
                              {log.hash}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span className="font-bold text-[var(--text)]">{log.user_name}</span>
                          <span className="block text-[10px] text-[var(--text-muted)] font-mono">{log.user_id}</span>
                        </td>

                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded bg-[var(--surface-sunken)] text-[var(--accent)] font-bold text-[10px] uppercase font-mono border border-[var(--border)]">
                            {log.action}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-mono text-[11px] text-[var(--text-muted)]">
                          <span className="font-bold text-[var(--text)]">{log.entity_type}</span>
                          {log.entity_id ? ` #${log.entity_id.slice(-6)}` : ''}
                        </td>

                        <td className="px-4 py-3 text-[var(--text-muted)] font-mono text-[11px] max-w-xs truncate">
                          {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="p-1.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded text-[var(--text)] hover:bg-[var(--accent)] hover:text-white transition-colors cursor-pointer"
                            title="Inspect Audit Diff & State"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: APPROVAL SIGN-OFF QUEUE */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="dense-table-container">
            <div className="overflow-x-auto">
              <table className="dense-table">
                <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[11px] text-[var(--text-muted)] uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Request # & Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Title & Justification</th>
                    <th className="px-4 py-3">Requester</th>
                    <th className="px-4 py-3 text-right">Impact (&#2547;)</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {approvalRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-xs text-[var(--text-muted)]">
                        No approval requests in history.
                      </td>
                    </tr>
                  ) : (
                    approvalRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                        <td className="px-4 py-3 font-mono">
                          <div className="font-bold text-[var(--text)]">{req.request_number}</div>
                          <div className="text-[10px] text-[var(--text-muted)]">
                            {new Date(req.requested_at).toLocaleDateString()}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded bg-[var(--surface-sunken)] text-[var(--accent)] font-bold text-[10px] uppercase font-mono border border-[var(--border)]">
                            {req.request_type.replace(/_/g, ' ')}
                          </span>
                        </td>

                        <td className="px-4 py-3 max-w-sm">
                          <div className="font-bold text-[var(--text)]">{req.title}</div>
                          <div className="text-[11px] text-[var(--text-muted)]">{req.description}</div>
                          {req.review_notes && (
                            <div className="text-[10px] text-[var(--status-teal)] mt-0.5 italic">
                              Reviewer Notes: {req.review_notes}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-semibold text-[var(--text)]">{req.requested_by_name}</div>
                          {req.reviewed_by_name && (
                            <div className="text-[10px] text-[var(--text-muted)]">
                              Signed by: {req.reviewed_by_name}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right font-mono font-bold text-[var(--text)] text-sm">
                          &#2547;{req.impact_amount.toLocaleString()}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {req.status === 'pending' ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[color-mix(in_srgb,var(--status-amber)_10%,transparent)] text-[var(--status-amber)]">
                              PENDING SIGN-OFF
                            </span>
                          ) : req.status === 'approved' ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] text-[var(--status-green)]">
                              APPROVED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] text-[var(--status-red)]">
                              REJECTED
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {req.status === 'pending' && can('manage_accounts') ? (
                            <button
                              onClick={() => {
                                setSelectedApproval(req);
                                setReviewDecision('approved');
                                setReviewNotes('');
                              }}
                              className="px-3 py-1.5 bg-[var(--accent)] text-white font-bold rounded-lg text-xs hover:opacity-90 shadow-xs cursor-pointer"
                            >
                              Sign Off
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedApproval(req);
                              }}
                              className="px-3 py-1 bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)] rounded text-xs hover:bg-[var(--surface-hover)] cursor-pointer"
                            >
                              View Details
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SYSTEM ALERTS & NOTIFICATIONS HUB */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <div className="divide-y divide-[var(--border)] bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xs overflow-hidden">
            {notifications.length === 0 ? (
              <div className="p-12 text-center text-xs text-[var(--text-muted)]">
                No active notifications. System operating normally.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 flex items-start gap-4 hover:bg-[var(--surface-hover)] transition-colors ${
                    !n.read ? 'bg-[var(--surface-sunken)]/60' : ''
                  }`}
                >
                  <div className="mt-0.5">
                    {n.priority === 'critical' ? (
                      <div className="w-8 h-8 rounded-full bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-red)_30%,transparent)] flex items-center justify-center text-[var(--status-red)]">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    ) : n.priority === 'warning' ? (
                      <div className="w-8 h-8 rounded-full bg-[color-mix(in_srgb,var(--status-amber)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-amber)_30%,transparent)] flex items-center justify-center text-[var(--status-amber)]">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[color-mix(in_srgb,var(--status-teal)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-teal)_30%,transparent)] flex items-center justify-center text-[var(--status-teal)]">
                        <Bell className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-[var(--text)] text-sm flex items-center gap-2">
                        {n.title || n.type.replace(/_/g, ' ').toUpperCase()}
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-[var(--accent)] inline-block" />
                        )}
                      </h4>
                      <span className="text-[11px] text-[var(--text-muted)] font-mono">
                        {new Date(n.created_at).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-[var(--text-muted)] mt-1">{n.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* --- MODAL: Inspect Audit State Diff --- */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[var(--accent)]" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)]">Immutable Audit Trail Record</h3>
                  <p className="text-xs text-[var(--text-muted)]">ID: {selectedLog.id} &#8226; Hash: {selectedLog.hash || 'Verified'}</p>
                </div>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto font-mono">
              <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)] text-xs">
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Actor User</span>
                  <p className="font-bold text-[var(--text)]">{selectedLog.user_name} ({selectedLog.user_id})</p>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Action & Entity</span>
                  <p className="font-bold text-[var(--accent)]">{selectedLog.action} on {selectedLog.entity_type} ({selectedLog.entity_id})</p>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--text)] mb-1">Details & Context Payload</label>
                <pre className="p-3 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[11px] text-[var(--text)] overflow-x-auto whitespace-pre-wrap">
                  {typeof selectedLog.details === 'string' ? selectedLog.details : JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>

              {(selectedLog.old_state || selectedLog.new_state) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[var(--status-red)] mb-1">Previous State (Before)</label>
                    <pre className="p-3 bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-red)_30%,transparent)] rounded-lg text-[10px] text-[var(--status-red)] overflow-x-auto">
                      {JSON.stringify(selectedLog.old_state, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[var(--status-green)] mb-1">New State (After)</label>
                    <pre className="p-3 bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-green)_30%,transparent)] rounded-lg text-[10px] text-[var(--status-green)] overflow-x-auto">
                      {JSON.stringify(selectedLog.new_state, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[var(--border)] bg-[var(--surface-sunken)] flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-xs font-bold rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: Review Approval Request --- */}
      {selectedApproval && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[var(--accent)]" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)]">Review Sign-Off: {selectedApproval.request_number}</h3>
                  <p className="text-xs text-[var(--text-muted)]">Submitted by {selectedApproval.requested_by_name}</p>
                </div>
              </div>
              <button onClick={() => setSelectedApproval(null)} className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReview} className="p-6 space-y-4">
              <div className="p-4 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)] space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[var(--text)] uppercase text-[10px]">{selectedApproval.request_type.replace(/_/g, ' ')}</span>
                  <span className="font-mono font-bold text-sm text-[var(--accent)]">
                    Impact: &#2547;{selectedApproval.impact_amount.toLocaleString()}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-[var(--text)]">{selectedApproval.title}</h4>
                <p className="text-[var(--text-muted)] text-[11px]">{selectedApproval.description}</p>
              </div>

              {selectedApproval.status === 'pending' && can('manage_accounts') ? (
                <>
                  <div>
                    <label className="block font-bold text-[var(--text)] mb-1">Decision Sign-Off</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setReviewDecision('approved')}
                        className={`p-3 rounded-xl border font-bold text-center transition-all cursor-pointer ${
                          reviewDecision === 'approved'
                            ? 'bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] text-white border-[var(--status-green)] shadow-sm'
                            : 'bg-[var(--surface)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                        }`}
                      >
                        &#9989; Authorize & Execute
                      </button>

                      <button
                        type="button"
                        onClick={() => setReviewDecision('rejected')}
                        className={`p-3 rounded-xl border font-bold text-center transition-all cursor-pointer ${
                          reviewDecision === 'rejected'
                            ? 'bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] text-white border-[var(--status-red)] shadow-sm'
                            : 'bg-[var(--surface)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                        }`}
                      >
                        &#10060; Reject Request
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-[var(--text)] mb-1">Review Notes / Reason</label>
                    <textarea
                      rows={2}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="e.g. Approved discount override for loyal client..."
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => setSelectedApproval(null)}
                      className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-xs font-bold rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingReview}
                      className="px-5 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-lg hover:opacity-90 shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingReview ? 'Submitting...' : 'Confirm Decision'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)] text-[11px] space-y-1">
                  <p className="font-bold text-[var(--text)]">
                    Status: <span className="uppercase text-[var(--accent)]">{selectedApproval.status}</span>
                  </p>
                  {selectedApproval.reviewed_by_name && (
                    <p className="text-[var(--text-muted)]">
                      Reviewed by <strong>{selectedApproval.reviewed_by_name}</strong> at {selectedApproval.reviewed_at}
                    </p>
                  )}
                  {selectedApproval.review_notes && (
                    <p className="text-[var(--text-muted)] italic">Notes: {selectedApproval.review_notes}</p>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: Submit New Approval Request --- */}
      {showNewRequestModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-[var(--accent)]" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)]">Submit Sign-Off Request</h3>
                  <p className="text-xs text-[var(--text-muted)]">Request Owner/GM authorization for restricted action</p>
                </div>
              </div>
              <button onClick={() => setShowNewRequestModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-red)_30%,transparent)] rounded-xl text-[var(--status-red)]">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block font-bold text-[var(--text)] mb-1">Request Category *</label>
                <select
                  value={reqType}
                  onChange={(e) => setReqType(e.target.value as ApprovalRequestType)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-semibold"
                >
                  <option value="price_discount_override">Price Discount Override (&gt;15%)</option>
                  <option value="order_cancellation">Order Cancellation & Refund (&gt;&#2547;5,000)</option>
                  <option value="damaged_writeoff">Damaged Stock Scrap Write-Off</option>
                  <option value="high_expense">High Expense Claim (&gt;&#2547;20,000)</option>
                  <option value="manual_journal">Manual Journal Balance Adjustment</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[var(--text)] mb-1">Subject / Summary *</label>
                <input
                  type="text"
                  placeholder="e.g. 20% Discount for Wholesale Buyer..."
                  value={reqTitle}
                  onChange={(e) => setReqTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                />
              </div>

              <div>
                <label className="block font-bold text-[var(--text)] mb-1">Estimated Financial Impact (&#2547;)</label>
                <input
                  type="number"
                  min="0"
                  value={reqImpact}
                  onChange={(e) => setReqImpact(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--accent)] font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-[var(--text)] mb-1">Justification & Details *</label>
                <textarea
                  rows={3}
                  placeholder="Provide full context, reason, and customer/order reference..."
                  value={reqDesc}
                  onChange={(e) => setReqDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowNewRequestModal(false)}
                  className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-xs font-bold rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReq}
                  className="px-5 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-lg hover:opacity-90 shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingReq ? 'Submitting...' : 'Submit for Sign-Off'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
