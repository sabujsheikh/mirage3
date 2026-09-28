import { db } from './db';
import {
  Lead,
  LeadStage,
  LeadSource,
  CRMInteraction,
  InteractionType,
  InteractionDirection,
  CRMTask,
  CRMTaskPriority,
  CRMTaskStatus,
  CRMTag,
  CustomerLifecycleStatus,
  CustomerLifecycleRecord,
  CustomerPreferences,
  CRMTicket,
  CRMTicketPriority,
  CRMTicketStatus,
  CRMFeedback,
  SpecialDate,
  Opportunity,
  OpportunityStage,
  OpportunityType,
  CRMCampaign,
  CRMAutomationRule,
  UnifiedTimelineEvent,
  ProductInterest,
  ReorderOpportunity,
  CustomerSegmentFilter,
  Customer360Data,
  CRMDashboardSummary,
  CRMAnalyticsReport,
  Customer,
  Order,
} from '../src/types';

export class CRMService {
  public leads: Map<string, Lead> = new Map();
  public interactions: Map<string, CRMInteraction> = new Map();
  public tasks: Map<string, CRMTask> = new Map();
  public tags: Map<string, CRMTag> = new Map();
  public customerTags: Map<string, Set<string>> = new Map(); // customer_id -> Set of tag_ids
  public lifecycles: Map<string, CustomerLifecycleRecord> = new Map();
  public preferences: Map<string, CustomerPreferences> = new Map();
  public tickets: Map<string, CRMTicket> = new Map();
  public feedback: Map<string, CRMFeedback> = new Map();
  public specialDates: Map<string, SpecialDate> = new Map();
  public opportunities: Map<string, Opportunity> = new Map();
  public campaigns: Map<string, CRMCampaign> = new Map();
  public automationRules: Map<string, CRMAutomationRule> = new Map();
  public productInterests: Map<string, ProductInterest> = new Map();

  private nextLeadSeq = 101;
  private nextTicketSeq = 201;
  private nextTaskSeq = 301;
  private nextInteractionSeq = 401;
  private nextOpportunitySeq = 501;

  constructor() {
    this.seedCRMData();
  }

  // ==========================================================================
  // SEED INITIAL DATA (Mirage Perfume Context)
  // ==========================================================================
  private seedCRMData() {
    // 1. Initial Tags
    const initialTags: { id: string; name: string; color: string }[] = [
      { id: 'tag_vip', name: 'VIP Customer', color: '#8b5cf6' },
      { id: 'tag_repeat', name: 'Repeat Buyer', color: '#10b981' },
      { id: 'tag_oud', name: 'Oud & Amber Lover', color: '#d97706' },
      { id: 'tag_men', name: 'Men Fragrance', color: '#3b82f6' },
      { id: 'tag_women', name: 'Women Fragrance', color: '#ec4899' },
      { id: 'tag_messenger', name: 'Messenger Customer', color: '#06b6d4' },
      { id: 'tag_walkin', name: 'Walk-in Customer', color: '#14b8a6' },
      { id: 'tag_cod', name: 'Prefers COD', color: '#64748b' },
      { id: 'tag_bkash', name: 'Prefers bKash', color: '#e11d48' },
      { id: 'tag_local', name: 'Dhaka Local Delivery', color: '#0ea5e9' },
      { id: 'tag_wholesale', name: 'Wholesale / Corporate', color: '#f59e0b' },
    ];
    for (const t of initialTags) {
      this.tags.set(t.id, {
        ...t,
        status: 'active',
        created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      });
    }

    // Attach tags to some existing customers
    const existingCustomers = Array.from(db.customers.values());
    if (existingCustomers.length > 0) {
      const c1 = existingCustomers[0];
      this.customerTags.set(c1.id, new Set(['tag_vip', 'tag_repeat', 'tag_messenger']));
      this.preferences.set(c1.id, {
        customer_id: c1.id,
        preferred_channel: 'messenger',
        preferred_contact_time: 'Evening (7pm - 10pm)',
        preferred_category: 'oriental',
        preferred_perfume_type: 'Middle Eastern',
        preferred_fulfillment: 'steadfast',
        price_sensitivity: 'luxury',
        buying_notes: 'Loves heavy sillage and projection. Buys Khadlaj and Armaf frequently.',
        updated_at: new Date().toISOString(),
      });
      this.specialDates.set(`sd_${c1.id}_1`, {
        id: `sd_${c1.id}_1`,
        customer_id: c1.id,
        type: 'birthday',
        label: 'Customer Birthday',
        date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
        notes: 'Send personalized birthday congratulations and offer complimentary tester sample with next order.',
        created_at: new Date().toISOString(),
      });
    }

    if (existingCustomers.length > 1) {
      const c2 = existingCustomers[1];
      this.customerTags.set(c2.id, new Set(['tag_walkin', 'tag_men', 'tag_bkash']));
      this.preferences.set(c2.id, {
        customer_id: c2.id,
        preferred_channel: 'phone',
        preferred_contact_time: 'Afternoon',
        preferred_category: 'fresh',
        preferred_perfume_type: 'Western',
        preferred_fulfillment: 'in_house',
        price_sensitivity: 'moderate',
        buying_notes: 'Prefers aquatic and citrus office scents. Always asks for batch maturity.',
        updated_at: new Date().toISOString(),
      });
    }

    // 2. Initial Leads
    const initialLeads: Lead[] = [
      {
        id: `LEAD-101`,
        customer_id: existingCustomers[0]?.id || null,
        name: existingCustomers[0]?.name || 'Tanvir Ahmed',
        phone: existingCustomers[0]?.phone || '01711223344',
        source: 'messenger',
        product_interest: 'Khadlaj Karus Gold Absolu EDP 100ML',
        expected_value: 2750,
        stage: 'negotiating',
        assigned_to: 'usr_mgr',
        assigned_to_name: 'Manager',
        created_by: 'usr_sales',
        created_by_name: 'Sales Staff',
        notes: 'Inquired on Facebook page about Eid discount. Wants delivery inside Banani before Friday.',
        status: 'active',
        last_contact_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        next_follow_up_at: new Date(Date.now() + 3600000 * 20).toISOString(),
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: `LEAD-102`,
        customer_id: null,
        name: 'Farhan Hossain',
        phone: '01812345678',
        source: 'walk-in',
        product_interest: 'Armaf Dunescape EDP 100ML',
        expected_value: 3400,
        stage: 'contacted',
        assigned_to: 'usr_sales',
        assigned_to_name: 'Sales Staff',
        created_by: 'usr_sales',
        created_by_name: 'Sales Staff',
        notes: 'Visited Banani showroom. Tested tester bottle, liked the dry-down. Promised to confirm via WhatsApp.',
        status: 'active',
        last_contact_at: new Date(Date.now() - 3600000 * 18).toISOString(),
        next_follow_up_at: new Date(Date.now() + 3600000 * 6).toISOString(),
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: `LEAD-103`,
        customer_id: null,
        name: 'Sadia Rahman',
        phone: '01987654321',
        source: 'referral',
        product_interest: 'Lattafa Khamrah & Yara combo',
        expected_value: 5800,
        stage: 'new',
        assigned_to: 'usr_mgr',
        assigned_to_name: 'Manager',
        created_by: 'usr_mgr',
        created_by_name: 'Manager',
        notes: 'Referred by Arif Islam. Looking for genuine Dubai import for gift package.',
        status: 'active',
        next_follow_up_at: new Date(Date.now() + 3600000 * 4).toISOString(),
        created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    for (const lead of initialLeads) {
      this.leads.set(lead.id, lead);
    }

    // 3. Initial Tasks
    const initialTasks: CRMTask[] = [
      {
        id: 'TASK-301',
        lead_id: 'LEAD-101',
        customer_id: existingCustomers[0]?.id || null,
        title: 'Follow up on Karus Gold delivery timeline',
        description: 'Confirm if customer prefers in-house direct hand delivery or Steadfast courier.',
        due_at: new Date(Date.now() + 3600000 * 5).toISOString(),
        assigned_to: 'usr_mgr',
        assigned_to_name: 'Manager',
        priority: 'high',
        status: 'open',
        created_by: 'usr_sales',
        created_by_name: 'Sales Staff',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'TASK-302',
        lead_id: 'LEAD-102',
        title: 'Send WhatsApp message with Armaf Dunescape photos',
        description: 'Customer requested batch code photo to verify Dubai origin.',
        due_at: new Date(Date.now() - 3600000 * 2).toISOString(), // overdue
        assigned_to: 'usr_sales',
        assigned_to_name: 'Sales Staff',
        priority: 'normal',
        status: 'open',
        created_by: 'usr_sales',
        created_by_name: 'Sales Staff',
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    for (const task of initialTasks) {
      this.tasks.set(task.id, task);
    }

    // 4. Initial Tickets
    if (existingCustomers.length > 0) {
      const c1 = existingCustomers[0];
      const t1: CRMTicket = {
        id: 'TCK-201',
        ticket_number: 'TCK-201',
        customer_id: c1.id,
        subject: 'Packaging box corner was slightly creased in courier transit',
        description: 'Customer noted the outer box of Dior Sauvage had minor denting. Bottle is 100% fine. Sent apology and offered ৳100 discount coupon on next order.',
        priority: 'medium',
        status: 'resolved',
        assigned_to: 'usr_mgr',
        assigned_to_name: 'Manager',
        resolution_notes: 'Customer satisfied with ৳100 store credit voucher. Confirmed perfume juice is pristine.',
        created_by: 'usr_mgr',
        created_by_name: 'Manager',
        created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
        resolved_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.tickets.set(t1.id, t1);

      // Feedback
      const f1: CRMFeedback = {
        id: 'FB-101',
        customer_id: c1.id,
        rating: 5,
        comment: 'Authentic product and exceptional customer care after the delivery inquiry. Will order again!',
        created_by: 'usr_mgr',
        created_by_name: 'Manager',
        created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      };
      this.feedback.set(f1.id, f1);
    }

    // 5. Initial Automation Rules
    const defaultRules: CRMAutomationRule[] = [
      {
        id: 'rule_new_lead',
        name: 'Auto-assign new Messenger leads to Sales Manager',
        trigger_type: 'new_lead',
        action_type: 'assign_user',
        config: { assign_user_id: 'usr_mgr' },
        active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'rule_lead_inactivity',
        name: 'Generate attention task if lead untouched for 24 hours',
        trigger_type: 'lead_inactivity',
        action_type: 'create_task',
        config: { hours_threshold: 24, task_title: 'Uncontacted lead needs urgent attention' },
        active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'rule_order_delivered',
        name: 'Create post-delivery review task 48 hours after delivery',
        trigger_type: 'order_delivered',
        action_type: 'create_task',
        config: { days_threshold: 2, task_title: 'Check customer satisfaction after parcel delivery' },
        active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'rule_customer_dormant',
        name: 'Mark customer as At Risk if no order in 60 days',
        trigger_type: 'customer_dormant',
        action_type: 'update_lifecycle',
        config: { days_threshold: 60, target_lifecycle: 'at_risk' },
        active: true,
        created_at: new Date().toISOString(),
      },
    ];
    for (const r of defaultRules) {
      this.automationRules.set(r.id, r);
    }

    // 6. Initial Opportunities
    this.opportunities.set('OPP-501', {
      id: 'OPP-501',
      title: 'Apex Bank Annual Management Eid Gift Boxes (50 sets)',
      value: 145000,
      stage: 'proposal',
      expected_close_date: new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10),
      assigned_to: 'usr_owner',
      assigned_to_name: 'Sobuj Sehk',
      type: 'corporate_gifting',
      notes: 'Custom 2-piece gift set (Rasasi Hawas + Khadlaj Karus Gold). Provided sample bottles to HR head.',
      created_by: 'usr_owner',
      created_by_name: 'Sobuj Sehk',
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 7. Initial Campaigns
    this.campaigns.set('CAMP-001', {
      id: 'CAMP-001',
      name: 'Eid-ul-Fitr VIP Exclusive Early Access',
      target_segment: 'VIP & High Spenders',
      purpose: 'Reward top customers with exclusive pre-booking for newly landed Dubai air-shipment batches',
      start_date: new Date(Date.now() - 86400000 * 10).toISOString().slice(0, 10),
      end_date: new Date(Date.now() + 86400000 * 15).toISOString().slice(0, 10),
      channel: 'messenger',
      description: 'Personalized Messenger outreach with digital brochure of niche perfumes.',
      responsible_user_id: 'usr_mgr',
      responsible_user_name: 'Manager',
      target_customer_count: 45,
      contacted_count: 32,
      converted_count: 14,
      notes: 'High conversion rate. Customers appreciate knowing batch dates beforehand.',
      status: 'active',
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    });
  }

  // ==========================================================================
  // LEADS & PIPELINE
  // ==========================================================================
  public getLeads(filter?: {
    stage?: string;
    source?: string;
    search?: string;
    assigned_to?: string;
  }): Lead[] {
    let list = Array.from(this.leads.values()).filter(l => l.status === 'active');
    if (filter?.stage && filter.stage !== 'all') {
      list = list.filter(l => l.stage === filter.stage);
    }
    if (filter?.source && filter.source !== 'all') {
      list = list.filter(l => l.source === filter.source);
    }
    if (filter?.assigned_to && filter.assigned_to !== 'all') {
      list = list.filter(l => l.assigned_to === filter.assigned_to);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        l =>
          l.name.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          l.product_interest.toLowerCase().includes(q) ||
          (l.notes && l.notes.toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  public getLeadById(id: string): Lead | undefined {
    return this.leads.get(id);
  }

  public createLead(data: Partial<Lead>, actorId: string, actorName: string): Lead {
    if (!data.name || !data.phone) {
      throw new Error('Name and Phone are mandatory for a lead.');
    }

    const normPhone = data.phone.replace(/\D/g, '');
    // Lead deduplication check: does an existing customer have this phone?
    let matchedCustomerId = data.customer_id || null;
    let customerName = data.name;
    for (const cust of db.customers.values()) {
      if (cust.phone.replace(/\D/g, '') === normPhone) {
        matchedCustomerId = cust.id;
        customerName = cust.name;
        break;
      }
    }

    const id = `LEAD-${this.nextLeadSeq++}`;
    const lead: Lead = {
      id,
      customer_id: matchedCustomerId,
      name: customerName,
      phone: data.phone,
      source: data.source || 'messenger',
      product_interest: data.product_interest || '',
      product_id: data.product_id || null,
      expected_value: Number(data.expected_value) || 0,
      stage: data.stage || 'new',
      assigned_to: data.assigned_to || 'usr_mgr',
      assigned_to_name: data.assigned_to_name || 'Manager',
      created_by: actorId,
      created_by_name: actorName,
      last_contact_at: new Date().toISOString(),
      next_follow_up_at: data.next_follow_up_at || undefined,
      notes: data.notes || '',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.leads.set(id, lead);

    // If customer exists, log initial interaction
    if (matchedCustomerId) {
      this.logInteraction(
        {
          customer_id: matchedCustomerId,
          lead_id: id,
          type: lead.source === 'messenger' ? 'messenger' : lead.source === 'walk-in' ? 'walk-in' : 'note',
          direction: 'inbound',
          summary: `New Lead created for ${lead.product_interest || 'Perfume inquiry'} (${lead.source})`,
        },
        actorId,
        actorName
      );
    }

    // Check automation rule for new lead
    const newLeadRule = Array.from(this.automationRules.values()).find(
      r => r.active && r.trigger_type === 'new_lead'
    );
    if (newLeadRule && newLeadRule.action_type === 'assign_user' && newLeadRule.config.assign_user_id) {
      const assignedUser = db.users.get(newLeadRule.config.assign_user_id);
      if (assignedUser) {
        lead.assigned_to = assignedUser.id;
        lead.assigned_to_name = assignedUser.name;
      }
    }

    db.logAudit(
      actorId,
      actorName,
      'crm_lead_created',
      'lead',
      id,
      `Created CRM lead for ${lead.name} (${lead.phone}) - Stage: ${lead.stage}`
    );

    return lead;
  }

  public updateLead(id: string, updates: Partial<Lead>, actorId: string, actorName: string): Lead {
    const lead = this.leads.get(id);
    if (!lead) throw new Error('Lead not found');

    const prevStage = lead.stage;
    Object.assign(lead, updates, { updated_at: new Date().toISOString() });

    if (updates.stage && updates.stage !== prevStage) {
      db.logAudit(
        actorId,
        actorName,
        'crm_lead_stage_changed',
        'lead',
        id,
        `Changed lead ${lead.id} stage from ${prevStage} to ${updates.stage}`
      );
    } else {
      db.logAudit(
        actorId,
        actorName,
        'crm_lead_updated',
        'lead',
        id,
        `Updated lead ${lead.id} details`
      );
    }

    return lead;
  }

  public changeLeadStage(
    id: string,
    stage: LeadStage,
    lostReason?: string,
    actorId: string = 'usr_mgr',
    actorName: string = 'Manager'
  ): Lead {
    const lead = this.leads.get(id);
    if (!lead) throw new Error('Lead not found');

    const prev = lead.stage;
    lead.stage = stage;
    if (stage === 'lost') {
      lead.lost_reason = lostReason || 'No reason specified';
    } else {
      lead.lost_reason = undefined;
    }
    lead.updated_at = new Date().toISOString();

    db.logAudit(
      actorId,
      actorName,
      'crm_lead_stage_changed',
      'lead',
      id,
      `Changed lead stage from ${prev} to ${stage}${lostReason ? ` (Reason: ${lostReason})` : ''}`
    );

    return lead;
  }

  // Convert Lead to Order (Strict single conversion rule)
  public convertLeadToOrder(
    leadId: string,
    orderPayload: any,
    actorId: string,
    actorName: string
  ): { order: Order; lead: Lead } {
    const lead = this.leads.get(leadId);
    if (!lead) throw new Error('Lead not found');

    if (lead.converted_order_id) {
      throw new Error(
        `Lead ${lead.id} has already been converted into Order #${lead.converted_order_id}. Double conversion is prevented.`
      );
    }

    // Call authoritative order creation on db
    const createdOrder = db.createOrder({
      ...orderPayload,
      customer_name: orderPayload.customer_name || lead.name,
      customer_phone: orderPayload.customer_phone || lead.phone,
      actor_id: actorId,
      actor_name: actorName,
    });

    // Mark lead won and link order
    lead.stage = 'won';
    lead.converted_order_id = createdOrder.id;
    lead.customer_id = createdOrder.customer_id;
    lead.updated_at = new Date().toISOString();

    // Log interaction
    this.logInteraction(
      {
        customer_id: createdOrder.customer_id,
        lead_id: lead.id,
        order_id: createdOrder.id,
        type: 'note',
        direction: 'outbound',
        summary: `Lead converted into Order ${createdOrder.invoice_number} (৳${createdOrder.total})`,
      },
      actorId,
      actorName
    );

    db.logAudit(
      actorId,
      actorName,
      'crm_lead_converted',
      'lead',
      lead.id,
      `Converted lead ${lead.id} into confirmed Order ${createdOrder.invoice_number}`
    );

    return { order: createdOrder, lead };
  }

  // ==========================================================================
  // INTERACTIONS (MANUAL & AUTOMATED)
  // ==========================================================================
  public logInteraction(
    data: Partial<CRMInteraction>,
    actorId: string,
    actorName: string
  ): CRMInteraction {
    if (!data.customer_id) {
      throw new Error('Customer ID is required to log an interaction.');
    }

    const id = `INT-${this.nextInteractionSeq++}`;
    const interaction: CRMInteraction = {
      id,
      customer_id: data.customer_id,
      lead_id: data.lead_id || null,
      order_id: data.order_id || null,
      type: data.type || 'note',
      direction: data.direction || 'outbound',
      summary: data.summary || '',
      next_action: data.next_action,
      follow_up_task_id: data.follow_up_task_id || null,
      source_reference: data.source_reference || null,
      created_by: actorId,
      created_by_name: actorName,
      created_at: new Date().toISOString(),
    };

    this.interactions.set(id, interaction);

    // If lead is linked, update lead's last_contact_at
    if (interaction.lead_id) {
      const lead = this.leads.get(interaction.lead_id);
      if (lead) {
        lead.last_contact_at = interaction.created_at;
        lead.updated_at = new Date().toISOString();
      }
    }

    db.logAudit(
      actorId,
      actorName,
      'crm_interaction_logged',
      'interaction',
      id,
      `Logged ${interaction.type} interaction for customer ${interaction.customer_id}: "${interaction.summary.slice(0, 60)}..."`
    );

    return interaction;
  }

  public getInteractions(customerId?: string, leadId?: string): CRMInteraction[] {
    let list = Array.from(this.interactions.values());
    if (customerId) {
      list = list.filter(i => i.customer_id === customerId);
    }
    if (leadId) {
      list = list.filter(i => i.lead_id === leadId);
    }
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  // ==========================================================================
  // TASKS & FOLLOW-UPS
  // ==========================================================================
  public getTasks(filter?: {
    status?: string;
    assigned_to?: string;
    priority?: string;
    customer_id?: string;
    lead_id?: string;
  }): CRMTask[] {
    let list = Array.from(this.tasks.values());
    if (filter?.status && filter.status !== 'all') {
      list = list.filter(t => t.status === filter.status);
    }
    if (filter?.assigned_to && filter.assigned_to !== 'all') {
      list = list.filter(t => t.assigned_to === filter.assigned_to);
    }
    if (filter?.priority && filter.priority !== 'all') {
      list = list.filter(t => t.priority === filter.priority);
    }
    if (filter?.customer_id) {
      list = list.filter(t => t.customer_id === filter.customer_id);
    }
    if (filter?.lead_id) {
      list = list.filter(t => t.lead_id === filter.lead_id);
    }
    return list.sort((a, b) => a.due_at.localeCompare(b.due_at));
  }

  public createTask(data: Partial<CRMTask>, actorId: string, actorName: string): CRMTask {
    if (!data.title || !data.due_at) {
      throw new Error('Title and Due Date/Time are required for a task.');
    }

    const id = `TASK-${this.nextTaskSeq++}`;
    const task: CRMTask = {
      id,
      customer_id: data.customer_id || null,
      lead_id: data.lead_id || null,
      order_id: data.order_id || null,
      title: data.title,
      description: data.description || '',
      due_at: data.due_at,
      assigned_to: data.assigned_to || actorId,
      assigned_to_name: data.assigned_to_name || actorName,
      priority: data.priority || 'normal',
      status: 'open',
      created_by: actorId,
      created_by_name: actorName,
      notes: data.notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.tasks.set(id, task);

    // Push in-app notification using existing notification infrastructure
    db.notifications.unshift({
      id: `notif_task_${Date.now()}_${Math.random()}`,
      type: 'crm_task_due',
      priority: task.priority === 'high' ? 'warning' : 'info',
      title: `CRM Follow-up Assigned: ${task.title}`,
      message: `Assigned to ${task.assigned_to_name}. Due: ${new Date(task.due_at).toLocaleDateString()}`,
      ref_type: 'crm_task',
      ref_id: task.id,
      action_url: '/crm/tasks',
      read: false,
      created_at: new Date().toISOString(),
    });

    db.logAudit(
      actorId,
      actorName,
      'crm_task_created',
      'task',
      id,
      `Created follow-up task "${task.title}" due ${task.due_at}`
    );

    return task;
  }

  public updateTask(id: string, updates: Partial<CRMTask>, actorId: string, actorName: string): CRMTask {
    const task = this.tasks.get(id);
    if (!task) throw new Error('Task not found');

    Object.assign(task, updates, { updated_at: new Date().toISOString() });

    db.logAudit(
      actorId,
      actorName,
      'crm_task_updated',
      'task',
      id,
      `Updated task "${task.title}" (Status: ${task.status})`
    );

    return task;
  }

  public completeTask(
    id: string,
    notes?: string,
    actorId: string = 'usr_mgr',
    actorName: string = 'Manager'
  ): CRMTask {
    const task = this.tasks.get(id);
    if (!task) throw new Error('Task not found');

    task.status = 'done';
    task.completed_at = new Date().toISOString();
    task.completed_by = actorId;
    task.completed_by_name = actorName;
    if (notes) task.notes = (task.notes ? task.notes + '\n' : '') + notes;
    task.updated_at = new Date().toISOString();

    db.logAudit(
      actorId,
      actorName,
      'crm_task_completed',
      'task',
      id,
      `Completed follow-up task "${task.title}"`
    );

    return task;
  }

  public snoozeTask(
    id: string,
    snoozedUntil: string,
    actorId: string = 'usr_mgr',
    actorName: string = 'Manager'
  ): CRMTask {
    const task = this.tasks.get(id);
    if (!task) throw new Error('Task not found');

    task.status = 'snoozed';
    task.snoozed_until = snoozedUntil;
    task.due_at = snoozedUntil;
    task.updated_at = new Date().toISOString();

    db.logAudit(
      actorId,
      actorName,
      'crm_task_snoozed',
      'task',
      id,
      `Snoozed task "${task.title}" until ${snoozedUntil}`
    );

    return task;
  }

  // ==========================================================================
  // UNIFIED CUSTOMER TIMELINE
  // ==========================================================================
  public getCustomerTimeline(customerId: string): UnifiedTimelineEvent[] {
    const events: UnifiedTimelineEvent[] = [];
    const customer = db.customers.get(customerId);
    if (!customer) return [];

    const normPhone = customer.phone.replace(/\D/g, '');

    // 1. Interactions
    for (const inter of this.interactions.values()) {
      if (inter.customer_id === customerId) {
        events.push({
          id: `ev_${inter.id}`,
          timestamp: inter.created_at,
          category: 'interaction',
          type: inter.type,
          title: `${inter.direction === 'inbound' ? 'Inbound' : 'Outbound'} ${inter.type.toUpperCase()}`,
          description: inter.summary,
          actor_name: inter.created_by_name,
          ref_id: inter.id,
          badge_color: 'blue',
        });
      }
    }

    // 2. Real Orders from existing db.orders
    for (const order of db.orders.values()) {
      const matchCust = order.customer_id === customerId || order.customer_phone.replace(/\D/g, '') === normPhone;
      if (matchCust) {
        const itemsSummary = order.items.map(i => `${i.quantity}x ${i.product_name}`).join(', ');

        // Order Created
        events.push({
          id: `ev_ord_create_${order.id}`,
          timestamp: order.created_at,
          category: 'order',
          type: 'order_created',
          title: `Order Created (${order.invoice_number})`,
          description: `Total ৳${order.total.toLocaleString()} (${order.items.length} items: ${itemsSummary}). Channel: ${order.channel.toUpperCase()}`,
          actor_name: order.created_by_name,
          ref_id: order.id,
          badge_color: 'emerald',
        });

        // Packed
        if (order.packed_at) {
          events.push({
            id: `ev_ord_packed_${order.id}`,
            timestamp: order.packed_at,
            category: 'order',
            type: 'order_packed',
            title: `Order Packed (${order.invoice_number})`,
            description: `Quality checked and packaged for ${order.fulfillment_method.toUpperCase()}`,
            actor_name: order.packed_by_name || 'Packing Staff',
            ref_id: order.id,
            badge_color: 'teal',
          });
        }

        // Dispatched
        if (order.dispatched_at) {
          events.push({
            id: `ev_ord_disp_${order.id}`,
            timestamp: order.dispatched_at,
            category: 'delivery',
            type: 'order_dispatched',
            title: `Dispatched: ${order.invoice_number}`,
            description: order.courier_consignment_id
              ? `Steadfast Consignment: ${order.courier_consignment_id} (Tracking: ${order.courier_tracking_code || 'Pending'})`
              : `Fulfilled via ${order.fulfillment_method}`,
            actor_name: order.dispatched_by_name || 'Dispatch Team',
            ref_id: order.id,
            badge_color: 'purple',
          });
        }

        // Cancelled
        if (order.status === 'cancelled' && order.cancelled_at) {
          events.push({
            id: `ev_ord_canc_${order.id}`,
            timestamp: order.cancelled_at,
            category: 'order',
            type: 'order_cancelled',
            title: `Order Cancelled (${order.invoice_number})`,
            description: `Reason: ${order.cancel_reason || 'Not specified'}`,
            actor_name: order.cancelled_by_name || 'Staff',
            ref_id: order.id,
            badge_color: 'rose',
          });
        }

        // Delivered / RTO
        if (order.status === 'delivered') {
          events.push({
            id: `ev_ord_deliv_${order.id}`,
            timestamp: order.updated_at || order.created_at,
            category: 'delivery',
            type: 'order_delivered',
            title: `Delivered Successfully (${order.invoice_number})`,
            description: `Parcel received by customer. Full payment reconciled.`,
            badge_color: 'emerald',
          });
        }

        // Payments
        if (order.payments && order.payments.length > 0) {
          for (const p of order.payments) {
            events.push({
              id: `ev_pay_${p.id}`,
              timestamp: p.created_at,
              category: 'payment',
              type: 'payment_received',
              title: `Payment Received (৳${p.amount.toLocaleString()})`,
              description: `Method: ${p.method.toUpperCase()} ${p.transaction_ref ? `(Ref: ${p.transaction_ref})` : ''}`,
              actor_name: p.received_by,
              ref_id: p.id,
              badge_color: 'emerald',
            });
          }
        }
      }
    }

    // 3. Real Customer Returns
    for (const ret of db.customerReturns.values()) {
      if (ret.customer_id === customerId || ret.customer_phone.replace(/\D/g, '') === normPhone) {
        events.push({
          id: `ev_ret_${ret.id}`,
          timestamp: ret.created_at,
          category: 'return',
          type: ret.return_type,
          title: `Return Processed: ${ret.return_number}`,
          description: `Type: ${ret.return_type.toUpperCase()}, Reason: ${ret.reason}. Refund: ৳${ret.refund_amount}`,
          actor_name: ret.inspected_by_name,
          ref_id: ret.id,
          badge_color: 'amber',
        });
      }
    }

    // 4. Tickets
    for (const t of this.tickets.values()) {
      if (t.customer_id === customerId) {
        events.push({
          id: `ev_tck_${t.id}`,
          timestamp: t.created_at,
          category: 'ticket',
          type: 'ticket_created',
          title: `Ticket #${t.ticket_number}: ${t.subject}`,
          description: `${t.description} (Status: ${t.status.toUpperCase()})`,
          actor_name: t.created_by_name,
          ref_id: t.id,
          badge_color: 'rose',
        });

        if (t.resolved_at) {
          events.push({
            id: `ev_tck_res_${t.id}`,
            timestamp: t.resolved_at,
            category: 'ticket',
            type: 'ticket_resolved',
            title: `Ticket #${t.ticket_number} Resolved`,
            description: `Resolution: ${t.resolution_notes || 'Issue resolved.'}`,
            badge_color: 'teal',
          });
        }
      }
    }

    // 5. Feedback
    for (const f of this.feedback.values()) {
      if (f.customer_id === customerId) {
        events.push({
          id: `ev_fb_${f.id}`,
          timestamp: f.created_at,
          category: 'feedback',
          type: 'feedback',
          title: `Customer Feedback: ${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)}`,
          description: f.comment || 'No comment text provided.',
          actor_name: f.created_by_name,
          ref_id: f.id,
          badge_color: 'amber',
        });
      }
    }

    // 6. Tasks
    for (const task of this.tasks.values()) {
      if (task.customer_id === customerId && task.status === 'done' && task.completed_at) {
        events.push({
          id: `ev_tsk_done_${task.id}`,
          timestamp: task.completed_at,
          category: 'task',
          type: 'task_completed',
          title: `Task Completed: ${task.title}`,
          description: task.notes || 'Follow-up completed.',
          actor_name: task.completed_by_name || 'Staff',
          ref_id: task.id,
          badge_color: 'slate',
        });
      }
    }

    // Sort descending by timestamp
    return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  // ==========================================================================
  // CUSTOMER 360 (AGGREGATED & UNIFIED)
  // ==========================================================================
  public getCustomer360(customerId: string): Customer360Data | null {
    const customer = db.customers.get(customerId);
    if (!customer) return null;

    const normPhone = customer.phone.replace(/\D/g, '');

    // Orders
    const orders = Array.from(db.orders.values())
      .filter(o => o.customer_id === customerId || o.customer_phone.replace(/\D/g, '') === normPhone)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    // Returns
    const returns = Array.from(db.customerReturns.values()).filter(
      r => r.customer_id === customerId || r.customer_phone.replace(/\D/g, '') === normPhone
    );

    // Tags
    const tagIds = this.customerTags.get(customerId) || new Set();
    const tags: CRMTag[] = [];
    for (const tid of tagIds) {
      const tag = this.tags.get(tid);
      if (tag && tag.status === 'active') tags.push(tag);
    }

    // Lifecycle
    const lifecycle = this.computeLifecycle(customerId);

    // Preferences
    const preferences = this.preferences.get(customerId) || null;

    // Special Dates
    const special_dates = Array.from(this.specialDates.values()).filter(
      sd => sd.customer_id === customerId
    );

    // Interactions
    const interactions = this.getInteractions(customerId);

    // Tasks
    const tasks = Array.from(this.tasks.values()).filter(t => t.customer_id === customerId);

    // Tickets
    const tickets = Array.from(this.tickets.values()).filter(t => t.customer_id === customerId);

    // Feedback
    const feedback = Array.from(this.feedback.values()).filter(f => f.customer_id === customerId);

    // Leads
    const leads = Array.from(this.leads.values()).filter(l => l.customer_id === customerId);

    // Opportunities
    const opportunities = Array.from(this.opportunities.values()).filter(
      o => o.customer_id === customerId
    );

    // Product Interests
    const product_interests = Array.from(this.productInterests.values()).filter(
      pi => pi.customer_id === customerId
    );

    // Timeline
    const timeline = this.getCustomerTimeline(customerId);

    // Derived stats
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const cancelled = orders.filter(o => o.status === 'cancelled').length;
    const rto = orders.filter(o => o.status === 'returned' || o.status === 'rto').length;
    const totalSpent = orders.reduce((sum, o) => (o.status !== 'cancelled' ? sum + o.total : sum), 0);
    const avgOrderVal = orders.length > 0 ? Math.round(totalSpent / orders.length) : 0;

    const firstOrderDate = orders.length > 0 ? orders[orders.length - 1].created_at : undefined;
    const lastOrderDate = orders.length > 0 ? orders[0].created_at : undefined;
    const daysSinceLast = lastOrderDate
      ? Math.floor((Date.now() - new Date(lastOrderDate).getTime()) / 86400000)
      : undefined;

    // Favorite Category
    const categoryCounts: Record<string, number> = {};
    for (const ord of orders) {
      for (const item of ord.items) {
        const prod = db.products.get(item.product_id);
        const cat = prod?.category_name || 'Fragrance';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + item.quantity;
      }
    }
    const topCat = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    return {
      customer,
      lifecycle,
      tags,
      preferences,
      special_dates,
      orders,
      returns,
      interactions,
      tasks,
      tickets,
      feedback,
      leads,
      opportunities,
      product_interests,
      timeline,
      stats: {
        total_orders: orders.length,
        delivered_orders: delivered,
        cancelled_orders: cancelled,
        rto_orders: rto,
        total_spent: totalSpent,
        avg_order_value: avgOrderVal,
        first_order_date: firstOrderDate,
        last_order_date: lastOrderDate,
        days_since_last_order: daysSinceLast,
        favorite_category: topCat,
        favorite_perfume_type: preferences?.preferred_perfume_type,
      },
    };
  }

  // ==========================================================================
  // CUSTOMER LIFECYCLE (DETERMINISTIC + MANUAL OVERRIDE)
  // ==========================================================================
  public computeLifecycle(customerId: string): CustomerLifecycleRecord {
    const existing = this.lifecycles.get(customerId);
    if (existing && existing.manual_override) {
      return existing;
    }

    const customer = db.customers.get(customerId);
    if (!customer) {
      return {
        customer_id: customerId,
        status: 'new',
        manual_override: false,
        computed_at: new Date().toISOString(),
      };
    }

    const normPhone = customer.phone.replace(/\D/g, '');
    const orders = Array.from(db.orders.values()).filter(
      o => (o.customer_id === customerId || o.customer_phone.replace(/\D/g, '') === normPhone) && o.status !== 'cancelled'
    );

    let status: CustomerLifecycleStatus = 'new';
    if (orders.length === 0) {
      status = 'new';
    } else {
      const totalSpent = orders.reduce((s, o) => s + o.total, 0);
      orders.sort((a, b) => b.created_at.localeCompare(a.created_at));
      const lastOrder = orders[0];
      const daysSince = Math.floor((Date.now() - new Date(lastOrder.created_at).getTime()) / 86400000);

      if (totalSpent >= 25000 || orders.length >= 5) {
        status = 'vip';
      } else if (daysSince <= 45) {
        status = 'active';
      } else if (daysSince <= 90) {
        status = 'at_risk';
      } else {
        status = 'dormant';
      }
    }

    const record: CustomerLifecycleRecord = {
      customer_id: customerId,
      status,
      manual_override: false,
      computed_at: new Date().toISOString(),
    };

    this.lifecycles.set(customerId, record);
    return record;
  }

  public overrideLifecycle(
    customerId: string,
    status: CustomerLifecycleStatus,
    reason: string,
    actorId: string,
    actorName: string
  ): CustomerLifecycleRecord {
    const record: CustomerLifecycleRecord = {
      customer_id: customerId,
      status,
      manual_override: true,
      override_reason: reason,
      computed_at: new Date().toISOString(),
      updated_by: actorId,
      updated_by_name: actorName,
    };
    this.lifecycles.set(customerId, record);

    db.logAudit(
      actorId,
      actorName,
      'crm_lifecycle_override',
      'customer',
      customerId,
      `Manually set lifecycle status to "${status}". Reason: ${reason}`
    );

    return record;
  }

  public clearLifecycleOverride(
    customerId: string,
    actorId: string,
    actorName: string
  ): CustomerLifecycleRecord {
    const prev = this.lifecycles.get(customerId);
    if (prev) {
      prev.manual_override = false;
      prev.override_reason = undefined;
    }
    const computed = this.computeLifecycle(customerId);

    db.logAudit(
      actorId,
      actorName,
      'crm_lifecycle_cleared',
      'customer',
      customerId,
      `Cleared manual lifecycle override. Recomputed as: "${computed.status}"`
    );

    return computed;
  }

  // ==========================================================================
  // CUSTOMER PREFERENCES
  // ==========================================================================
  public getPreferences(customerId: string): CustomerPreferences | null {
    return this.preferences.get(customerId) || null;
  }

  public updatePreferences(
    customerId: string,
    data: Partial<CustomerPreferences>,
    actorId: string,
    actorName: string
  ): CustomerPreferences {
    const existing = this.preferences.get(customerId) || {
      customer_id: customerId,
      preferred_channel: 'messenger',
      updated_at: new Date().toISOString(),
    };

    const updated: CustomerPreferences = {
      ...existing,
      ...data,
      customer_id: customerId,
      updated_at: new Date().toISOString(),
    };

    this.preferences.set(customerId, updated);

    db.logAudit(
      actorId,
      actorName,
      'crm_preferences_updated',
      'customer',
      customerId,
      `Updated CRM relationship preferences for customer ${customerId}`
    );

    return updated;
  }

  // ==========================================================================
  // TAGS & SEGMENTS
  // ==========================================================================
  public getTags(): CRMTag[] {
    return Array.from(this.tags.values()).filter(t => t.status === 'active');
  }

  public createTag(name: string, color: string, actorId: string, actorName: string): CRMTag {
    const id = `tag_${Date.now()}`;
    const tag: CRMTag = {
      id,
      name,
      color: color || '#3b82f6',
      status: 'active',
      created_at: new Date().toISOString(),
    };
    this.tags.set(id, tag);

    db.logAudit(actorId, actorName, 'crm_tag_created', 'tag', id, `Created CRM tag "${name}"`);
    return tag;
  }

  public addTagToCustomer(customerId: string, tagId: string, actorId: string, actorName: string) {
    let set = this.customerTags.get(customerId);
    if (!set) {
      set = new Set();
      this.customerTags.set(customerId, set);
    }
    set.add(tagId);

    const tag = this.tags.get(tagId);
    db.logAudit(
      actorId,
      actorName,
      'crm_tag_attached',
      'customer',
      customerId,
      `Added tag "${tag?.name || tagId}" to customer ${customerId}`
    );
  }

  public removeTagFromCustomer(customerId: string, tagId: string, actorId: string, actorName: string) {
    const set = this.customerTags.get(customerId);
    if (set) {
      set.delete(tagId);
      const tag = this.tags.get(tagId);
      db.logAudit(
        actorId,
        actorName,
        'crm_tag_removed',
        'customer',
        customerId,
        `Removed tag "${tag?.name || tagId}" from customer ${customerId}`
      );
    }
  }

  public bulkTagCustomers(customerIds: string[], tagIds: string[], actorId: string, actorName: string) {
    for (const cid of customerIds) {
      for (const tid of tagIds) {
        this.addTagToCustomer(cid, tid, actorId, actorName);
      }
    }
  }

  public filterCustomers(filter: CustomerSegmentFilter): Customer[] {
    let results = Array.from(db.customers.values());

    // Search query
    if (filter.search_query) {
      const q = filter.search_query.toLowerCase();
      results = results.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    }

    // Tag filter
    if (filter.tag_ids && filter.tag_ids.length > 0) {
      results = results.filter(c => {
        const ctags = this.customerTags.get(c.id);
        if (!ctags) return false;
        return filter.tag_ids!.some(tid => ctags.has(tid));
      });
    }

    // Lifecycle filter
    if (filter.lifecycle_status && filter.lifecycle_status.length > 0) {
      results = results.filter(c => {
        const lc = this.computeLifecycle(c.id);
        return filter.lifecycle_status!.includes(lc.status);
      });
    }

    // Risk status
    if (filter.risk_status === 'risk_only') {
      results = results.filter(c => c.risk_flag);
    } else if (filter.risk_status === 'reliable_only') {
      results = results.filter(c => !c.risk_flag);
    }

    // Min / Max orders
    if (filter.min_orders !== undefined) {
      results = results.filter(c => c.order_count >= filter.min_orders!);
    }
    if (filter.max_orders !== undefined) {
      results = results.filter(c => c.order_count <= filter.max_orders!);
    }

    // Min / Max spent
    if (filter.min_spent !== undefined) {
      results = results.filter(c => c.total_spent >= filter.min_spent!);
    }
    if (filter.max_spent !== undefined) {
      results = results.filter(c => c.total_spent <= filter.max_spent!);
    }

    // Unresolved tickets
    if (filter.has_unresolved_ticket) {
      results = results.filter(c => {
        return Array.from(this.tickets.values()).some(
          t => t.customer_id === c.id && (t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting')
        );
      });
    }

    // Open task
    if (filter.has_open_task) {
      results = results.filter(c => {
        return Array.from(this.tasks.values()).some(
          t => t.customer_id === c.id && t.status === 'open'
        );
      });
    }

    return results;
  }

  // Export filtered segment to CSV preserving Bangla characters
  public exportSegmentCSV(filter: CustomerSegmentFilter): string {
    const customers = this.filterCustomers(filter);
    const headers = ['Customer ID', 'Name', 'Phone', 'Lifecycle', 'Orders', 'Total Spent (BDT)', 'Risk Flag', 'Tags', 'Created Date'];

    const rows = customers.map(c => {
      const lc = this.computeLifecycle(c.id);
      const tagNames = Array.from(this.customerTags.get(c.id) || [])
        .map(tid => this.tags.get(tid)?.name || tid)
        .join('; ');

      return [
        `"${c.id}"`,
        `"${c.name.replace(/"/g, '""')}"`,
        `"${c.phone}"`,
        `"${lc.status.toUpperCase()}"`,
        c.order_count,
        c.total_spent,
        c.risk_flag ? 'YES' : 'NO',
        `"${tagNames.replace(/"/g, '""')}"`,
        `"${c.created_at.slice(0, 10)}"`,
      ].join(',');
    });

    // Prepend UTF-8 BOM so Excel opens Bangla text correctly
    return '\uFEFF' + [headers.join(','), ...rows].join('\n');
  }

  // ==========================================================================
  // TICKETS & CUSTOMER SERVICE
  // ==========================================================================
  public getTickets(filter?: {
    status?: string;
    priority?: string;
    customer_id?: string;
  }): CRMTicket[] {
    let list = Array.from(this.tickets.values());
    if (filter?.status && filter.status !== 'all') {
      list = list.filter(t => t.status === filter.status);
    }
    if (filter?.priority && filter.priority !== 'all') {
      list = list.filter(t => t.priority === filter.priority);
    }
    if (filter?.customer_id) {
      list = list.filter(t => t.customer_id === filter.customer_id);
    }
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  public createTicket(data: Partial<CRMTicket>, actorId: string, actorName: string): CRMTicket {
    if (!data.customer_id || !data.subject || !data.description) {
      throw new Error('Customer ID, Subject, and Description are required for a support ticket.');
    }

    const id = `TCK-${this.nextTicketSeq++}`;
    const ticket: CRMTicket = {
      id,
      ticket_number: id,
      customer_id: data.customer_id,
      order_id: data.order_id || null,
      subject: data.subject,
      description: data.description,
      priority: data.priority || 'medium',
      status: 'open',
      assigned_to: data.assigned_to || actorId,
      assigned_to_name: data.assigned_to_name || actorName,
      resolution_notes: '',
      created_by: actorId,
      created_by_name: actorName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.tickets.set(id, ticket);

    // Push notification to existing system
    db.notifications.unshift({
      id: `notif_tck_${Date.now()}`,
      type: 'crm_ticket',
      priority: ticket.priority === 'urgent' || ticket.priority === 'high' ? 'critical' : 'info',
      title: `CRM Support Ticket: #${ticket.ticket_number}`,
      message: `${ticket.subject} (Customer: ${ticket.customer_id})`,
      ref_type: 'crm_ticket',
      ref_id: ticket.id,
      action_url: '/crm/tickets',
      read: false,
      created_at: new Date().toISOString(),
    });

    db.logAudit(
      actorId,
      actorName,
      'crm_ticket_created',
      'ticket',
      id,
      `Created ticket #${ticket.ticket_number}: "${ticket.subject}" (Priority: ${ticket.priority})`
    );

    return ticket;
  }

  public updateTicket(
    id: string,
    updates: Partial<CRMTicket>,
    actorId: string,
    actorName: string
  ): CRMTicket {
    const ticket = this.tickets.get(id);
    if (!ticket) throw new Error('Ticket not found');

    Object.assign(ticket, updates, { updated_at: new Date().toISOString() });

    db.logAudit(
      actorId,
      actorName,
      'crm_ticket_updated',
      'ticket',
      id,
      `Updated ticket #${ticket.ticket_number} (Status: ${ticket.status})`
    );

    return ticket;
  }

  public resolveTicket(
    id: string,
    resolutionNotes: string,
    actorId: string,
    actorName: string
  ): CRMTicket {
    const ticket = this.tickets.get(id);
    if (!ticket) throw new Error('Ticket not found');

    ticket.status = 'resolved';
    ticket.resolution_notes = resolutionNotes;
    ticket.resolved_at = new Date().toISOString();
    ticket.updated_at = new Date().toISOString();

    db.logAudit(
      actorId,
      actorName,
      'crm_ticket_resolved',
      'ticket',
      id,
      `Resolved ticket #${ticket.ticket_number}: "${resolutionNotes.slice(0, 60)}..."`
    );

    return ticket;
  }

  // ==========================================================================
  // FEEDBACK
  // ==========================================================================
  public getFeedback(customerId?: string): CRMFeedback[] {
    let list = Array.from(this.feedback.values());
    if (customerId) {
      list = list.filter(f => f.customer_id === customerId);
    }
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  public recordFeedback(
    data: Partial<CRMFeedback>,
    actorId: string,
    actorName: string
  ): CRMFeedback {
    if (!data.customer_id || !data.rating) {
      throw new Error('Customer ID and 1-5 Rating are required.');
    }

    const id = `FB-${Date.now()}`;
    const fb: CRMFeedback = {
      id,
      customer_id: data.customer_id,
      order_id: data.order_id || null,
      rating: Math.min(5, Math.max(1, Math.round(Number(data.rating)))),
      comment: data.comment || '',
      created_by: actorId,
      created_by_name: actorName,
      created_at: new Date().toISOString(),
    };

    this.feedback.set(id, fb);

    db.logAudit(
      actorId,
      actorName,
      'crm_feedback_recorded',
      'feedback',
      id,
      `Recorded ${fb.rating}-star feedback for customer ${fb.customer_id}`
    );

    return fb;
  }

  // ==========================================================================
  // SPECIAL DATES (BIRTHDAYS, ANNIVERSARIES)
  // ==========================================================================
  public getSpecialDates(customerId?: string): SpecialDate[] {
    let list = Array.from(this.specialDates.values());
    if (customerId) {
      list = list.filter(sd => sd.customer_id === customerId);
    }
    return list.map(sd => {
      const cust = db.customers.get(sd.customer_id);
      return {
        ...sd,
        customer_name: cust ? cust.name : 'Unknown Customer',
        occasion: sd.type || sd.label,
      };
    });
  }

  public getUpcomingDates(daysThreshold: number = 30): {
    date: SpecialDate;
    customer_name: string;
    customer_phone: string;
    days_left: number;
  }[] {
    const today = new Date();
    const currentYear = today.getFullYear();
    const results: {
      date: SpecialDate;
      customer_name: string;
      customer_phone: string;
      days_left: number;
    }[] = [];

    for (const sd of this.specialDates.values()) {
      const cust = db.customers.get(sd.customer_id);
      if (!cust) continue;

      const [month, day] = sd.date.slice(5).split('-').map(Number);
      if (!month || !day) continue;

      let eventDate = new Date(currentYear, month - 1, day);
      if (eventDate.getTime() < today.getTime() - 86400000) {
        eventDate = new Date(currentYear + 1, month - 1, day);
      }

      const diffDays = Math.ceil((eventDate.getTime() - today.getTime()) / 86400000);
      if (diffDays >= 0 && diffDays <= daysThreshold) {
        results.push({
          date: sd,
          customer_name: cust.name,
          customer_phone: cust.phone,
          days_left: diffDays,
        });
      }
    }

    return results.sort((a, b) => a.days_left - b.days_left);
  }

  public addSpecialDate(data: Partial<SpecialDate>, actorId: string, actorName: string): SpecialDate {
    if (!data.customer_id || !data.date || !data.label) {
      throw new Error('Customer ID, Date (YYYY-MM-DD), and Label are required.');
    }

    const id = `SD-${Date.now()}`;
    const sd: SpecialDate = {
      id,
      customer_id: data.customer_id,
      type: data.type || 'birthday',
      label: data.label,
      date: data.date,
      notes: data.notes || '',
      created_at: new Date().toISOString(),
    };

    this.specialDates.set(id, sd);

    db.logAudit(
      actorId,
      actorName,
      'crm_special_date_added',
      'special_date',
      id,
      `Added ${sd.label} (${sd.date}) for customer ${sd.customer_id}`
    );

    return sd;
  }

  public deleteSpecialDate(id: string, actorId: string, actorName: string) {
    if (this.specialDates.has(id)) {
      this.specialDates.delete(id);
      db.logAudit(actorId, actorName, 'crm_special_date_deleted', 'special_date', id, `Deleted special date record ${id}`);
    }
  }

  // ==========================================================================
  // OPPORTUNITIES (BULK, CORPORATE GIFTING, WHOLESALE)
  // ==========================================================================
  public getOpportunities(): Opportunity[] {
    return Array.from(this.opportunities.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  public createOpportunity(data: Partial<Opportunity>, actorId: string, actorName: string): Opportunity {
    if (!data.title || data.value === undefined) {
      throw new Error('Title and Estimated Value are required.');
    }

    const id = `OPP-${this.nextOpportunitySeq++}`;
    const opp: Opportunity = {
      id,
      title: data.title,
      customer_id: data.customer_id || null,
      lead_id: data.lead_id || null,
      value: Number(data.value) || 0,
      stage: data.stage || 'discovery',
      expected_close_date: data.expected_close_date,
      assigned_to: data.assigned_to || actorId,
      assigned_to_name: data.assigned_to_name || actorName,
      type: data.type || 'corporate_gifting',
      notes: data.notes || '',
      created_by: actorId,
      created_by_name: actorName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.opportunities.set(id, opp);

    db.logAudit(
      actorId,
      actorName,
      'crm_opportunity_created',
      'opportunity',
      id,
      `Created sales opportunity "${opp.title}" (৳${opp.value.toLocaleString()})`
    );

    return opp;
  }

  public updateOpportunity(id: string, updates: Partial<Opportunity>, actorId: string, actorName: string): Opportunity {
    const opp = this.opportunities.get(id);
    if (!opp) throw new Error('Opportunity not found');

    Object.assign(opp, updates, { updated_at: new Date().toISOString() });

    db.logAudit(
      actorId,
      actorName,
      'crm_opportunity_updated',
      'opportunity',
      id,
      `Updated opportunity "${opp.title}" (Stage: ${opp.stage})`
    );

    return opp;
  }

  // ==========================================================================
  // CAMPAIGNS & OUTREACH TRACKING
  // ==========================================================================
  public getCampaigns(): CRMCampaign[] {
    return Array.from(this.campaigns.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  public createCampaign(data: Partial<CRMCampaign>, actorId: string, actorName: string): CRMCampaign {
    if (!data.name || !data.target_segment) {
      throw new Error('Campaign Name and Target Segment are required.');
    }

    const id = `CAMP-${Date.now()}`;
    const camp: CRMCampaign = {
      id,
      name: data.name,
      target_segment: data.target_segment,
      purpose: data.purpose || '',
      start_date: data.start_date || new Date().toISOString().slice(0, 10),
      end_date: data.end_date,
      channel: data.channel || 'messenger',
      description: data.description || '',
      responsible_user_id: data.responsible_user_id || actorId,
      responsible_user_name: data.responsible_user_name || actorName,
      target_customer_count: Number(data.target_customer_count) || 0,
      contacted_count: Number(data.contacted_count) || 0,
      converted_count: Number(data.converted_count) || 0,
      notes: data.notes || '',
      status: data.status || 'planning',
      created_at: new Date().toISOString(),
    };

    this.campaigns.set(id, camp);

    db.logAudit(
      actorId,
      actorName,
      'crm_campaign_created',
      'campaign',
      id,
      `Created outreach campaign "${camp.name}" targeting ${camp.target_segment}`
    );

    return camp;
  }

  public updateCampaign(id: string, updates: Partial<CRMCampaign>, actorId: string, actorName: string): CRMCampaign {
    const camp = this.campaigns.get(id);
    if (!camp) throw new Error('Campaign not found');

    Object.assign(camp, updates);

    db.logAudit(
      actorId,
      actorName,
      'crm_campaign_updated',
      'campaign',
      id,
      `Updated campaign "${camp.name}"`
    );

    return camp;
  }

  // ==========================================================================
  // REPEAT PURCHASE & REORDER INTELLIGENCE (DETERMINISTIC)
  // ==========================================================================
  public getReorderOpportunities(): ReorderOpportunity[] {
    const opps: ReorderOpportunity[] = [];
    const now = Date.now();

    for (const customer of db.customers.values()) {
      const normPhone = customer.phone.replace(/\D/g, '');
      const validOrders = Array.from(db.orders.values())
        .filter(o => (o.customer_id === customer.id || o.customer_phone.replace(/\D/g, '') === normPhone) && o.status !== 'cancelled')
        .sort((a, b) => b.created_at.localeCompare(a.created_at));

      if (validOrders.length === 0) continue;

      const lastOrder = validOrders[0];
      const daysSinceLast = Math.floor((now - new Date(lastOrder.created_at).getTime()) / 86400000);

      // If customer has >= 2 orders, calculate personal purchase cycle
      if (validOrders.length >= 2) {
        const intervals: number[] = [];
        for (let i = 0; i < validOrders.length - 1; i++) {
          const diff = Math.floor(
            (new Date(validOrders[i].created_at).getTime() - new Date(validOrders[i + 1].created_at).getTime()) / 86400000
          );
          if (diff > 0) intervals.push(diff);
        }
        const avgCycle = intervals.length > 0 ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length) : 60;

        // If they are past 80% of their average cycle or >60 days
        if (daysSinceLast >= Math.max(30, Math.floor(avgCycle * 0.85))) {
          opps.push({
            customer_id: customer.id,
            customer_name: customer.name,
            customer_phone: customer.phone,
            last_order_date: lastOrder.created_at.slice(0, 10),
            days_since_last_order: daysSinceLast,
            avg_reorder_cycle_days: avgCycle,
            predicted_category: validOrders[0].items[0]?.product_name,
            confidence_score: Math.min(95, Math.max(60, Math.round(100 - (daysSinceLast - avgCycle)))),
            reason: `Customer typically reorders every ~${avgCycle} days; ${daysSinceLast} days have elapsed since their last purchase.`,
          });
        }
      } else if (daysSinceLast >= 60 && daysSinceLast <= 150) {
        // Single order customers due for re-engagement
        opps.push({
          customer_id: customer.id,
          customer_name: customer.name,
          customer_phone: customer.phone,
          last_order_date: lastOrder.created_at.slice(0, 10),
          days_since_last_order: daysSinceLast,
          avg_reorder_cycle_days: 60,
          predicted_category: validOrders[0].items[0]?.product_name,
          confidence_score: 70,
          reason: `Customer bought ${daysSinceLast} days ago; suitable timing for replenishment or complimentary sample inquiry.`,
        });
      }
    }

    return opps.sort((a, b) => b.confidence_score - a.confidence_score);
  }

  // ==========================================================================
  // AUTOMATION ENGINE (DETERMINISTIC, INTERNAL-ONLY)
  // ==========================================================================
  public getAutomationRules(): CRMAutomationRule[] {
    return Array.from(this.automationRules.values());
  }

  public updateAutomationRule(
    id: string,
    updates: Partial<CRMAutomationRule>,
    actorId: string,
    actorName: string
  ): CRMAutomationRule {
    const rule = this.automationRules.get(id);
    if (!rule) throw new Error('Rule not found');

    Object.assign(rule, updates);

    db.logAudit(
      actorId,
      actorName,
      'crm_automation_rule_updated',
      'automation_rule',
      id,
      `Updated CRM rule "${rule.name}" (Active: ${rule.active})`
    );

    return rule;
  }

  public runAutomations(): {
    triggered: number;
    tasks_created: number;
    lifecycles_updated: number;
  } {
    let triggered = 0;
    let tasksCreated = 0;
    let lifecyclesUpdated = 0;
    const now = Date.now();

    for (const rule of this.automationRules.values()) {
      if (!rule.active) continue;

      // 1. Lead Inactivity trigger
      if (rule.trigger_type === 'lead_inactivity') {
        const thresholdHours = rule.config.hours_threshold || 24;
        for (const lead of this.leads.values()) {
          if (lead.stage === 'new' || lead.stage === 'contacted') {
            const lastContact = new Date(lead.last_contact_at || lead.created_at).getTime();
            if (now - lastContact > thresholdHours * 3600000) {
              // Check if task already exists
              const existingTask = Array.from(this.tasks.values()).find(
                t => t.lead_id === lead.id && t.status === 'open'
              );
              if (!existingTask) {
                this.createTask(
                  {
                    lead_id: lead.id,
                    customer_id: lead.customer_id,
                    title: rule.config.task_title || `Urgent: Uncontacted lead ${lead.name}`,
                    description: `Lead has had no contact for ${thresholdHours}+ hours.`,
                    due_at: new Date(now + 3600000 * 2).toISOString(),
                    assigned_to: lead.assigned_to,
                    assigned_to_name: lead.assigned_to_name,
                    priority: 'high',
                  },
                  'system',
                  'CRM Automation Engine'
                );
                triggered++;
                tasksCreated++;
              }
            }
          }
        }
      }

      // 2. Customer Dormant trigger
      if (rule.trigger_type === 'customer_dormant' && rule.action_type === 'update_lifecycle') {
        const thresholdDays = rule.config.days_threshold || 60;
        for (const cust of db.customers.values()) {
          const lc = this.lifecycles.get(cust.id);
          if (!lc || !lc.manual_override) {
            const normPhone = cust.phone.replace(/\D/g, '');
            const orders = Array.from(db.orders.values())
              .filter(o => (o.customer_id === cust.id || o.customer_phone.replace(/\D/g, '') === normPhone) && o.status !== 'cancelled')
              .sort((a, b) => b.created_at.localeCompare(a.created_at));

            if (orders.length > 0) {
              const daysSince = Math.floor((now - new Date(orders[0].created_at).getTime()) / 86400000);
              if (daysSince >= thresholdDays) {
                const updated = this.computeLifecycle(cust.id);
                if (updated.status === (rule.config.target_lifecycle || 'at_risk')) {
                  lifecyclesUpdated++;
                  triggered++;
                }
              }
            }
          }
        }
      }
    }

    return { triggered, tasks_created: tasksCreated, lifecycles_updated: lifecyclesUpdated };
  }

  // ==========================================================================
  // DASHBOARD AGGREGATES
  // ==========================================================================
  public getDashboardSummary(): CRMDashboardSummary {
    const leads = Array.from(this.leads.values()).filter(l => l.status === 'active');
    const totalLeads = leads.length;
    const wonLeads = leads.filter(l => l.stage === 'won').length;

    const leads_by_stage: Record<string, number> = {};
    for (const l of leads) {
      leads_by_stage[l.stage] = (leads_by_stage[l.stage] || 0) + 1;
    }

    const pipeline_value = leads.reduce((sum, l) => sum + (l.expected_value || 0), 0);
    const conversion_rate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

    const funnel = {
      new: leads.filter(l => l.stage === 'new').length,
      contacted: leads.filter(l => l.stage === 'contacted').length,
      qualified: leads.filter(l => l.stage === 'qualified').length,
      negotiating: leads.filter(l => l.stage === 'negotiating').length,
      won: wonLeads,
      lost: leads.filter(l => l.stage === 'lost').length,
      conversion_rate,
    };

    const todayDate = new Date().toISOString().slice(0, 10);
    const tasks = Array.from(this.tasks.values());
    const tasks_overdue = tasks.filter(t => t.status === 'open' && t.due_at.slice(0, 10) < todayDate).length;
    const tasks_due_today = tasks.filter(t => t.status === 'open' && t.due_at.slice(0, 10) === todayDate).length;
    const taskSummary = {
      overdue: tasks_overdue,
      due_today: tasks_due_today,
      upcoming: tasks.filter(t => t.status === 'open' && t.due_at.slice(0, 10) > todayDate).length,
      completed: tasks.filter(t => t.status === 'done' || (t.status as any) === 'completed').length,
    };

    // Customer Lifecycles
    const lifecycleCounts = {
      new: 0,
      active: 0,
      at_risk: 0,
      dormant: 0,
      vip: 0,
      reactivation: 0,
      loyal: 0,
    };
    for (const cust of db.customers.values()) {
      const lc = this.computeLifecycle(cust.id);
      if (lifecycleCounts[lc.status] !== undefined) {
        lifecycleCounts[lc.status]++;
      }
    }

    // Opportunities
    const opps = Array.from(this.opportunities.values()).filter(o => o.stage !== 'lost' && o.stage !== 'closed_lost');
    const opportunities = {
      count: opps.length,
      total_value: opps.reduce((sum, o) => sum + o.value, 0),
    };

    // Tickets
    const tickets = Array.from(this.tickets.values());
    const open_tickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting').length;
    const ticketSummary = {
      open: tickets.filter(t => t.status === 'open').length,
      in_progress: tickets.filter(t => t.status === 'in_progress').length,
      waiting: tickets.filter(t => t.status === 'waiting').length,
      resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
      urgent: tickets.filter(t => (t.status === 'open' || t.status === 'in_progress') && t.priority === 'urgent').length,
    };

    const raw_upcoming = this.getUpcomingDates(14);
    const upcoming_dates = raw_upcoming.map((ud) => ({
      date: ud.date,
      customer_name: ud.customer_name,
      customer_phone: ud.customer_phone,
      days_left: ud.days_left,
    }));
    const reorder_opportunities = this.getReorderOpportunities().slice(0, 8);

    const reorder_candidates = reorder_opportunities.map(ro => ({
      customer_id: ro.customer_id,
      customer_name: ro.customer_name,
      product_id: ro.predicted_category || 'PROD-TOP',
      product_name: ro.predicted_category ? `${ro.predicted_category} Fragrance` : 'Signature Fragrance',
      days_since_last_order: ro.days_since_last_order,
      suggested_product: ro.reason,
    }));

    const allFeedback = Array.from(this.feedback.values());
    const csat_avg = allFeedback.length > 0
      ? allFeedback.reduce((sum, f) => sum + f.rating, 0) / allFeedback.length
      : 4.8;

    return {
      pipeline_value,
      total_leads: totalLeads,
      conversion_rate,
      leads_by_stage,
      tasks_due_today,
      tasks_overdue,
      csat_avg,
      open_tickets,
      reorder_candidates,
      funnel,
      tasks: taskSummary,
      lifecycle: lifecycleCounts,
      opportunities,
      tickets: ticketSummary,
      upcoming_dates,
      reorder_opportunities,
    };
  }

  // ==========================================================================
  // REPORTS
  // ==========================================================================
  public getReports(): CRMAnalyticsReport {
    const leads = Array.from(this.leads.values());
    const totalLeads = leads.length;
    const wonLeads = leads.filter(l => l.stage === 'won').length;
    const lead_conversion_rate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

    const sourceMap: Record<string, { count: number; won: number; value: number }> = {};
    const lead_sources: Record<string, number> = {};

    for (const l of leads) {
      if (!sourceMap[l.source]) sourceMap[l.source] = { count: 0, won: 0, value: 0 };
      sourceMap[l.source].count++;
      lead_sources[l.source] = (lead_sources[l.source] || 0) + 1;
      if (l.stage === 'won') sourceMap[l.source].won++;
      sourceMap[l.source].value += (l.expected_value || 0);
    }

    const leads_by_source = Object.entries(sourceMap).map(([source, stats]) => ({
      source,
      count: stats.count,
      won: stats.won,
      value: stats.value,
    }));

    const lostMap: Record<string, number> = {};
    for (const l of leads) {
      if (l.stage === 'lost' && l.lost_reason) {
        lostMap[l.lost_reason] = (lostMap[l.lost_reason] || 0) + 1;
      }
    }
    const lost_reasons = Object.entries(lostMap).map(([reason, count]) => ({ reason, count }));

    // Staff performance
    const staffMap: Record<string, { name: string; leads_assigned: number; tasks_completed: number; won_count: number }> = {};
    for (const u of db.users.values()) {
      staffMap[u.id] = { name: u.name, leads_assigned: 0, tasks_completed: 0, won_count: 0 };
    }
    for (const l of leads) {
      if (staffMap[l.assigned_to]) {
        staffMap[l.assigned_to].leads_assigned++;
        if (l.stage === 'won') staffMap[l.assigned_to].won_count++;
      }
    }
    for (const t of this.tasks.values()) {
      if (t.status === 'done' && t.completed_by && staffMap[t.completed_by]) {
        staffMap[t.completed_by].tasks_completed++;
      }
    }

    const staff_performance = Object.entries(staffMap).map(([uid, data]) => ({
      user_id: uid,
      ...data,
    }));

    // Customer Retention
    const customers = Array.from(db.customers.values());
    const totalCustomers = customers.length;
    const repeatBuyers = customers.filter(c => c.order_count >= 2).length;
    const repeatRate = totalCustomers > 0 ? Math.round((repeatBuyers / totalCustomers) * 100) : 0;
    const totalSpentAll = customers.reduce((sum, c) => sum + c.total_spent, 0);
    const avgLtv = totalCustomers > 0 ? Math.round(totalSpentAll / totalCustomers) : 0;

    const lifecycle_distribution: Record<string, number> = {
      new: 0,
      active: 0,
      at_risk: 0,
      dormant: 0,
      vip: 0,
      reactivation: 0,
      loyal: 0,
    };
    for (const cust of customers) {
      const lc = this.computeLifecycle(cust.id);
      lifecycle_distribution[lc.status] = (lifecycle_distribution[lc.status] || 0) + 1;
    }

    const opps = Array.from(this.opportunities.values());
    const wonOpps = opps.filter(o => o.stage === 'won' || o.stage === 'closed_won');
    const opportunity_summary = {
      total_deals: opps.length,
      total_pipeline: opps.reduce((sum, o) => sum + (o.value || 0), 0),
      won_deals: wonOpps.length,
      won_value: wonOpps.reduce((sum, o) => sum + (o.value || 0), 0),
    };

    return {
      total_leads: totalLeads,
      won_deals: wonLeads,
      total_revenue: totalSpentAll,
      conversion_rate: lead_conversion_rate,
      lead_conversion_rate,
      opportunity_summary,
      lifecycle_distribution,
      lead_sources,
      leads_by_source,
      lost_reasons,
      staff_performance,
      retention_metrics: {
        total_customers: totalCustomers,
        repeat_buyers: repeatBuyers,
        repeat_rate: repeatRate,
        avg_ltv: avgLtv,
      },
    };
  }
}

export const crmService = new CRMService();
