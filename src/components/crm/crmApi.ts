/**
 * Typed client API for CRM & Relationship Management Module
 */

import {
  Lead,
  LeadStage,
  CRMInteraction,
  CRMTask,
  CRMTag,
  CustomerLifecycleRecord,
  CustomerLifecycleStatus,
  CustomerPreferences,
  CRMTicket,
  CRMFeedback,
  SpecialDate,
  Opportunity,
  CRMCampaign,
  CRMAutomationRule,
  CustomerSegmentFilter,
  Customer360Data,
  CRMDashboardSummary,
  ReorderOpportunity,
  Customer,
} from '../../types';


function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("mirage_session_token") : null;
  const headers: Record<string, string> = { ...extraHeaders };
  if (token) {
    headers["Authorization"] = "Bearer " + token;
    headers["x-session-token"] = token;
  }
  return headers;
}

async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const customHeaders = init.headers ? (init.headers as Record<string, string>) : {};
  const mergedHeaders = getAuthHeaders(customHeaders);
  return fetch(input, {
    ...init,
    headers: mergedHeaders,
  });
}

export const crmApi = {
  // Dashboard Aggregates
  async getDashboard(): Promise<CRMDashboardSummary> {
    const res = await apiFetch('/api/crm/dashboard');
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Leads
  async getLeads(params?: {
    stage?: string;
    source?: string;
    search?: string;
    assigned_to?: string;
  }): Promise<Lead[]> {
    const query = new URLSearchParams();
    if (params?.stage) query.set('stage', params.stage);
    if (params?.source) query.set('source', params.source);
    if (params?.search) query.set('search', params.search);
    if (params?.assigned_to) query.set('assigned_to', params.assigned_to);

    const res = await apiFetch(`/api/crm/leads?${query.toString()}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getLead(id: string): Promise<Lead> {
    const res = await apiFetch(`/api/crm/leads/${id}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createLead(data: Partial<Lead>, actorId = 'usr_owner', _actorName?: string): Promise<Lead> {
    const res = await apiFetch('/api/crm/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateLead(id: string, updates: Partial<Lead>, actorId = 'usr_owner', _actorName?: string): Promise<Lead> {
    const res = await apiFetch(`/api/crm/leads/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async changeLeadStage(
    id: string,
    stage: LeadStage,
    lost_reason?: string,
    actorId = 'usr_owner',
    _actorName?: string
  ): Promise<Lead> {
    const res = await apiFetch(`/api/crm/leads/${id}/stage`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
      body: JSON.stringify({ stage, lost_reason }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async convertLeadToOrder(
    leadId: string,
    orderPayload: any,
    actorId = 'usr_owner',
    _actorName?: string
  ): Promise<{ order: any; lead: Lead }> {
    const res = await apiFetch(`/api/crm/leads/${leadId}/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
      body: JSON.stringify(orderPayload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Interactions
  async getInteractions(customerId?: string, leadId?: string): Promise<CRMInteraction[]> {
    const query = new URLSearchParams();
    if (customerId) query.set('customer_id', customerId);
    if (leadId) query.set('lead_id', leadId);

    const res = await apiFetch(`/api/crm/interactions?${query.toString()}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async logInteraction(
    data: Partial<CRMInteraction>,
    actorId = 'usr_owner',
    _actorName?: string
  ): Promise<CRMInteraction> {
    const res = await apiFetch('/api/crm/interactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Tasks & Follow-ups
  async getTasks(params?: {
    status?: string;
    assigned_to?: string;
    priority?: string;
    customer_id?: string;
    lead_id?: string;
  }): Promise<CRMTask[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.assigned_to) query.set('assigned_to', params.assigned_to);
    if (params?.priority) query.set('priority', params.priority);
    if (params?.customer_id) query.set('customer_id', params.customer_id);
    if (params?.lead_id) query.set('lead_id', params.lead_id);

    const res = await apiFetch(`/api/crm/tasks?${query.toString()}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createTask(data: Partial<CRMTask>, actorId = 'usr_owner'): Promise<CRMTask> {
    const res = await apiFetch('/api/crm/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateTask(id: string, updates: Partial<CRMTask>, actorId = 'usr_owner'): Promise<CRMTask> {
    const res = await apiFetch(`/api/crm/tasks/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async completeTask(id: string, notes?: string, actorId = 'usr_owner'): Promise<CRMTask> {
    const res = await apiFetch(`/api/crm/tasks/${id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
      body: JSON.stringify({ notes }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async snoozeTask(id: string, snoozed_until: string, actorId = 'usr_owner'): Promise<CRMTask> {
    const res = await apiFetch(`/api/crm/tasks/${id}/snooze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
      body: JSON.stringify({ snoozed_until }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Customer 360
  async getCustomer360(customerId: string): Promise<Customer360Data> {
    const res = await apiFetch(`/api/crm/customers/${customerId}/360`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getCustomerTimeline(customerId: string): Promise<any[]> {
    const res = await apiFetch(`/api/crm/customers/${customerId}/timeline`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async overrideLifecycle(
    customerId: string,
    status: CustomerLifecycleStatus,
    reason: string,
    actorId = 'usr_owner'
  ): Promise<CustomerLifecycleRecord> {
    const res = await apiFetch(`/api/crm/customers/${customerId}/lifecycle/override`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
      body: JSON.stringify({ status, reason }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async clearLifecycleOverride(customerId: string, actorId = 'usr_owner'): Promise<CustomerLifecycleRecord> {
    const res = await apiFetch(`/api/crm/customers/${customerId}/lifecycle/clear`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getPreferences(customerId: string): Promise<CustomerPreferences | null> {
    const res = await apiFetch(`/api/crm/customers/${customerId}/preferences`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updatePreferences(
    customerId: string,
    data: Partial<CustomerPreferences>,
    actorId = 'usr_owner'
  ): Promise<CustomerPreferences> {
    const res = await apiFetch(`/api/crm/customers/${customerId}/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Tags & Segments
  async getTags(): Promise<CRMTag[]> {
    const res = await apiFetch('/api/crm/tags');
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createTag(name: string, color: string, actorId = 'usr_owner', _actorName?: string): Promise<CRMTag> {
    const res = await apiFetch('/api/crm/tags', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
      body: JSON.stringify({ name, color }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async addTagToCustomer(customerId: string, tag_id: string, actorId = 'usr_owner') {
    const res = await apiFetch(`/api/crm/customers/${customerId}/tags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
      body: JSON.stringify({ tag_id }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async removeTagFromCustomer(customerId: string, tag_id: string, actorId = 'usr_owner') {
    const res = await apiFetch(`/api/crm/customers/${customerId}/tags/${tag_id}`, {
      method: 'DELETE',
      headers: {
        'x-authenticated-user-id': actorId,
      },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async bulkTagCustomers(customer_ids: string[], tag_ids: string[], actorId = 'usr_owner') {
    const res = await apiFetch('/api/crm/customers/bulk-tag', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
      body: JSON.stringify({ customer_ids, tag_ids }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async filterCustomers(filter: CustomerSegmentFilter): Promise<Customer[]> {
    const res = await apiFetch('/api/crm/segments/filter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filter),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async exportSegmentCSV(filter: CustomerSegmentFilter): Promise<Blob> {
    const res = await apiFetch('/api/crm/segments/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filter),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.blob();
  },

  // Tickets
  async getTickets(params?: { status?: string; priority?: string; customer_id?: string }): Promise<CRMTicket[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.priority) query.set('priority', params.priority);
    if (params?.customer_id) query.set('customer_id', params.customer_id);

    const res = await apiFetch(`/api/crm/tickets?${query.toString()}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createTicket(data: Partial<CRMTicket>, actorId = 'usr_owner', _actorName?: string): Promise<CRMTicket> {
    const res = await apiFetch('/api/crm/tickets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateTicket(id: string, updates: Partial<CRMTicket>, actorId = 'usr_owner'): Promise<CRMTicket> {
    const res = await apiFetch(`/api/crm/tickets/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async resolveTicket(id: string, resolution_notes: string, actorId = 'usr_owner'): Promise<CRMTicket> {
    const res = await apiFetch(`/api/crm/tickets/${id}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
      body: JSON.stringify({ resolution_notes }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Feedback
  async getFeedback(customerId?: string): Promise<CRMFeedback[]> {
    const query = customerId ? `?customer_id=${customerId}` : '';
    const res = await apiFetch(`/api/crm/feedback${query}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async recordFeedback(data: Partial<CRMFeedback>, actorId = 'usr_owner'): Promise<CRMFeedback> {
    const res = await apiFetch('/api/crm/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async submitFeedback(data: Partial<CRMFeedback>, actorId = 'usr_owner'): Promise<CRMFeedback> {
    return this.recordFeedback(data, actorId);
  },

  // Special Dates
  async getSpecialDates(customerId?: string | number): Promise<SpecialDate[]> {
    const query = typeof customerId === 'string' && customerId ? `?customer_id=${customerId}` : '';
    const res = await apiFetch(`/api/crm/special-dates${query}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getUpcomingDates(days = 30): Promise<any[]> {
    const res = await apiFetch(`/api/crm/special-dates/upcoming?days=${days}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async addSpecialDate(data: Partial<SpecialDate>, actorId = 'usr_owner'): Promise<SpecialDate> {
    const res = await apiFetch('/api/crm/special-dates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async deleteSpecialDate(id: string, actorId = 'usr_owner'): Promise<{ success: boolean }> {
    const res = await apiFetch(`/api/crm/special-dates/${id}`, {
      method: 'DELETE',
      headers: { 'x-authenticated-user-id': actorId },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Opportunities
  async getOpportunities(): Promise<Opportunity[]> {
    const res = await apiFetch('/api/crm/opportunities');
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createOpportunity(data: Partial<Opportunity>, actorId = 'usr_owner', _actorName?: string): Promise<Opportunity> {
    const res = await apiFetch('/api/crm/opportunities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateOpportunity(id: string, updates: Partial<Opportunity>, actorId = 'usr_owner'): Promise<Opportunity> {
    const res = await apiFetch(`/api/crm/opportunities/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Campaigns
  async getCampaigns(): Promise<CRMCampaign[]> {
    const res = await apiFetch('/api/crm/campaigns');
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createCampaign(data: Partial<CRMCampaign>, actorId = 'usr_owner'): Promise<CRMCampaign> {
    const res = await apiFetch('/api/crm/campaigns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateCampaign(id: string, updates: Partial<CRMCampaign>, actorId = 'usr_owner'): Promise<CRMCampaign> {
    const res = await apiFetch(`/api/crm/campaigns/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Reorder Intelligence
  async getReorderOpportunities(): Promise<ReorderOpportunity[]> {
    const res = await apiFetch('/api/crm/reorder-opportunities');
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Automations
  async getAutomations(): Promise<CRMAutomationRule[]> {
    const res = await apiFetch('/api/crm/automations');
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateAutomation(id: string, updates: Partial<CRMAutomationRule>, actorId = 'usr_owner'): Promise<CRMAutomationRule> {
    const res = await apiFetch(`/api/crm/automations/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': actorId,
      },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async runAutomations(): Promise<any> {
    const res = await apiFetch('/api/crm/automations/run', { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Reports
  async getReports(): Promise<any> {
    const res = await apiFetch('/api/crm/reports');
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
