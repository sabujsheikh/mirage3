import { PageHeader } from '../common/PageHeader';
import React, { useState } from 'react';
import { Shield, UserPlus, Check, X, Lock, Key } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRoleTier, Capability } from '../../types';

export const UsersView: React.FC = () => {
  const { allUsers, currentUser, tier, setRoleTier, toggleCapability } = useAuth();
  const [selectedUser, setSelectedUser] = useState<string>(allUsers[0]?.id || '');

  const activeUser = allUsers.find(u => u.id === selectedUser) || allUsers[0];

  const CAPABILITIES: { key: Capability; label: string; desc: string }[] = [
    { key: 'create_edit_orders', label: 'Create / Edit Orders', desc: 'Can enter Messenger orders and walk-in sales' },
    { key: 'cancel_orders', label: 'Cancel Orders', desc: 'Can cancel confirmed orders and release stock' },
    { key: 'pack_orders', label: 'Pack & Verify Orders', desc: 'Can scan-match barcodes and complete parcel packing' },
    { key: 'dispatch_orders', label: 'Dispatch Orders', desc: 'Can assign Steadfast tracking and dispatch parcels' },
    { key: 'create_edit_products', label: 'Manage Products', desc: 'Can create SKUs, edit retail prices, and manage bundles' },
    { key: 'receive_stock', label: 'Receive Shipments', desc: 'Can log incoming supplier stock and update landed cost' },
    { key: 'transfer_stock', label: 'Transfer Stock', desc: 'Can move inventory between Main Back-store and Shop Floor' },
    { key: 'adjust_stock', label: 'Adjust Stock / Testers', desc: 'Can log damage, shrinkage, VIP gifts and tester conversions' },
    { key: 'view_cost_margin', label: 'View Landed Cost & Margins', desc: 'Can see supplier purchase cost and gross profit' },
    { key: 'view_accounts', label: 'View Accounting Books', desc: 'Can inspect chart of accounts, bank balances and money buckets' },
    { key: 'view_sales_financial_ledger', label: 'View Sales & Payments Ledger', desc: 'Can access the order-centric financial Sales & Payments ledger in Accounting' },
    { key: 'manage_accounts', label: 'Manage Journal & Expenses', desc: 'Can post journal entries, expenses, salaries and reconciliations' },
    { key: 'manage_users', label: 'Manage Users & Permissions', desc: 'Can add staff accounts, change roles and toggle permissions' },
    { key: 'system_settings', label: 'System Settings', desc: 'Can configure delivery charge presets and company profile' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-5 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[var(--accent)]">4-Tier User Roles & Granular Permissions (Section 20)</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Tier 1: Owner (Unrestricted) &#8226; Tier 2: Accountant &#8226; Tier 3: Showroom & Sales Staff &#8226; Tier 4: Packing Team
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: User List */}
        <div className="lg:col-span-4 space-y-2">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 shadow-xs">
            <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider mb-3">
              Staff Directory ({allUsers.length})
            </h3>
            <div className="space-y-1.5">
              {allUsers.map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUser(u.id)}
                  className={`w-full p-3 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between ${
                    selectedUser === u.id
                      ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]'
                      : 'bg-[var(--surface-sunken)] border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--text)]'
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs">{u.name}</div>
                    <div className="text-[11px] text-[var(--text-secondary)]">{u.email}</div>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[var(--card)] border border-[var(--border)]">
                    Tier {u.tier}: {u.role}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Role & Capability Toggle Matrix */}
        <div className="lg:col-span-8 space-y-4">
          {activeUser && (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[var(--accent)]">
                    Permissions for {activeUser.name}
                  </h3>
                  <span className="text-xs text-[var(--text-secondary)]">{activeUser.email}</span>
                </div>

                {/* Role Tier Selector */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-[var(--text-secondary)]">Role Tier:</label>
                  <select
                    value={activeUser.tier}
                    onChange={e => setRoleTier(activeUser.id, Number(e.target.value) as UserRoleTier)}
                    disabled={activeUser.id === 'usr_owner' && currentUser?.id !== 'usr_owner'}
                    className="p-1.5 border border-[var(--border)] rounded bg-[var(--card)] text-xs font-bold text-[var(--accent)]"
                  >
                    <option value={1}>Tier 1: Owner</option>
                    <option value={2}>Tier 2: Accountant</option>
                    <option value={3}>Tier 3: Showroom / Sales</option>
                    <option value={4}>Tier 4: Packing Team</option>
                  </select>
                </div>
              </div>

              {/* Granular Capabilities List */}
              <div className="divide-y divide-[var(--border)]">
                {CAPABILITIES.map(cap => {
                  const hasCap = activeUser.capabilities.includes(cap.key);
                  const isOwner = activeUser.tier === 1;

                  return (
                    <div key={cap.key} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-[var(--text)]">{cap.label}</div>
                        <div className="text-[11px] text-[var(--text-secondary)]">{cap.desc}</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleCapability(activeUser.id, cap.key)}
                        disabled={isOwner}
                        className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                          hasCap
                            ? 'bg-[var(--status-green)] text-white'
                            : 'bg-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--status-red)]/20 hover:text-[var(--status-red)]'
                        } ${isOwner ? 'opacity-70 cursor-not-allowed' : ''}`}
                      >
                        {hasCap ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        <span>{hasCap ? 'Allowed' : 'Denied'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
