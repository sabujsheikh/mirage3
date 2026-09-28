import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Kanban,
  CheckSquare,
  UserCheck,
  Tag,
  MessageSquare,
  HeartHandshake,
  Zap,
} from 'lucide-react';
import { CRMDashboardTab } from './CRMDashboardTab';
import { LeadsPipelineTab } from './LeadsPipelineTab';
import { FollowUpsTab } from './FollowUpsTab';
import { Customer360Tab } from './Customer360Tab';
import { SegmentsAndTagsTab } from './SegmentsAndTagsTab';
import { InteractionsTab } from './InteractionsTab';
import { AutomationsTab } from './AutomationsTab';
import { useApp } from '../../context/AppContext';

export type CRMTabType =
  | 'dashboard'
  | 'leads'
  | 'tasks'
  | 'customer360'
  | 'segments'
  | 'interactions'
  | 'automations';

interface CRMManagementViewProps {
  initialTab?: CRMTabType;
}

export const CRMManagementView: React.FC<CRMManagementViewProps> = ({
  initialTab = 'dashboard',
}) => {
  const { activePath, setActivePath } = useApp();
  const [activeTab, setActiveTab] = useState<CRMTabType>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (!activePath) return;
    if (activePath.includes('/crm/leads')) setActiveTab('leads');
    else if (activePath.includes('/crm/tasks')) setActiveTab('tasks');
    else if (activePath.includes('/crm/customer')) setActiveTab('customer360');
    else if (activePath.includes('/crm/segment')) setActiveTab('segments');
    else if (activePath.includes('/crm/interaction')) setActiveTab('interactions');
    else if (activePath.includes('/crm/automation')) setActiveTab('automations');
    else if (activePath.includes('/crm/dashboard') || activePath === '/crm') setActiveTab('dashboard');
  }, [activePath]);

  const tabs: { id: CRMTabType; label: string; icon: React.ReactNode; path: string }[] = [
    { id: 'dashboard', label: 'Overview & Triggers', icon: <LayoutDashboard className="w-4 h-4" />, path: '/crm/dashboard' },
    { id: 'leads', label: 'Leads & Inquiries', icon: <Kanban className="w-4 h-4" />, path: '/crm/leads' },
    { id: 'tasks', label: 'Follow-ups & Tasks', icon: <CheckSquare className="w-4 h-4" />, path: '/crm/tasks' },
    { id: 'customer360', label: 'Customer 360', icon: <UserCheck className="w-4 h-4" />, path: '/crm/customers' },
    { id: 'segments', label: 'Tags & Segments', icon: <Tag className="w-4 h-4" />, path: '/crm/segments' },
    { id: 'interactions', label: 'Touchpoints', icon: <MessageSquare className="w-4 h-4" />, path: '/crm/interactions' },
    { id: 'automations', label: 'Automations', icon: <Zap className="w-4 h-4" />, path: '/crm/automations' },
  ];

  const handleTabClick = (tab: { id: CRMTabType; path: string }) => {
    setActiveTab(tab.id);
    setActivePath(tab.path);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text)]">CRM & Customer Relations</h1>
              <p className="text-xs text-[var(--text-secondary)]">
                Omnichannel lead pipeline, follow-ups, fragrance taste profiles, and RFM loyalty tiers.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[var(--border)] pb-1 scrollbar-none">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'dashboard' && <CRMDashboardTab onNavigateTab={(tab) => {
          const target = tab as CRMTabType;
          setActiveTab(target);
          const found = tabs.find(t => t.id === target);
          if (found) setActivePath(found.path);
        }} />}
        {activeTab === 'leads' && <LeadsPipelineTab />}
        {activeTab === 'tasks' && <FollowUpsTab />}
        {activeTab === 'customer360' && <Customer360Tab />}
        {activeTab === 'segments' && <SegmentsAndTagsTab />}
        {activeTab === 'interactions' && <InteractionsTab />}
        {activeTab === 'automations' && <AutomationsTab />}
      </div>
    </div>
  );
};
