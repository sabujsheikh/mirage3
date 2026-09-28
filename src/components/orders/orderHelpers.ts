import { Order, Customer, CustomerReturn } from '../../types';

export const PAGE_SIZE_OPTIONS = [25, 50, 100, 500, 1000, 0];

export const paymentMethodLabel = (method: string): string => {
  switch (method) {
    case 'cash': return 'Cash';
    case 'bkash': return 'bKash';
    case 'nagad': return 'Nagad';
    case 'bank': return 'Bank';
    case 'card': return 'Card';
    case 'cod_pending': return 'COD (Steadfast)';
    default: return method;
  }
};

export const paymentAccountLabel = (accountId?: string): string => {
  switch (accountId) {
    case 'acc_cash': return 'Till (Cash)';
    case 'acc_bkash': return 'bKash Wallet';
    case 'acc_nagad': return 'Nagad Wallet';
    case 'acc_bank': return 'Business Bank Account';
    case 'acc_bank_personal': return 'Personal Bank Account';
    case 'acc_courier_rec': return 'Courier Receivable';
    default: return accountId ? accountId.replace('acc_', '') : '';
  }
};

export const fulfillmentLabel = (order: Order): string => {
  if (order.order_type === 'merchant_fulfillment') return 'Dropship Fulfillment';
  switch (order.fulfillment_method) {
    case 'steadfast':
      return 'Steadfast';
    case 'instant_delivery':
      return `Instant${order.instant_delivery_provider ? ` · ${order.instant_delivery_provider}` : ''}`;
    case 'in_house':
      return 'In-house Delivery';
    case 'self_pickup':
      return 'Self Pickup';
    case 'n_a_walk_in':
      return 'Walk-in';
    default:
      return 'Steadfast';
  }
};

export const orderPaymentsReceived = (order: Order): number =>
  (order.payments || []).reduce(
    (sum, p) =>
      p.status === 'completed' && p.method !== 'cod_pending'
        ? sum + (p.amount || 0)
        : sum,
    0
  );

export const orderRefunded = (order: Order, customerReturns: CustomerReturn[] = []): number => {
  const fromReturns = (customerReturns || [])
    .filter(r => r.order_id === order.id)
    .reduce((s, r) => s + (r.refund_amount || 0), 0);
  const fromPayments = (order.payments || [])
    .filter(p => p.status === 'refunded')
    .reduce((s, p) => s + (p.amount || 0), 0);
  return fromReturns + fromPayments;
};

export const orderPaymentState = (order: Order, customerReturns: CustomerReturn[] = []): {
  state: 'unpaid' | 'partial' | 'paid' | 'refunded' | 'partial_refund';
  label: string;
  received: number;
} => {
  const received = orderPaymentsReceived(order);
  const refunded = orderRefunded(order, customerReturns);
  const due = order.total || 0;

  if (refunded > 0 && refunded < Math.max(1, received)) {
    return { state: 'partial_refund', label: 'Partially Refunded', received };
  }
  if (refunded > 0 && refunded >= Math.max(1, received)) {
    return { state: 'refunded', label: 'Refunded', received };
  }
  if (received <= 0) return { state: 'unpaid', label: 'Unpaid', received };
  if (received + 0.5 < due) return { state: 'partial', label: 'Partially Paid', received };
  return { state: 'paid', label: 'Paid', received };
};

export const orderCodStatus = (order: Order, customerReturns: CustomerReturn[] = []): {
  tone: 'amber' | 'green' | 'red';
  label: string;
} => {
  const received = orderPaymentsReceived(order);
  const refunded = orderRefunded(order, customerReturns);
  const due = order.total || 0;

  if (refunded > 0 && refunded >= Math.max(1, received)) return { tone: 'red', label: 'Refunded' };
  if (order.fulfillment_method === 'steadfast' && received + 0.5 < due) {
    return { tone: 'amber', label: 'COD' };
  }
  if (received <= 0) return { tone: 'amber', label: 'Unpaid' };
  if (received + 0.5 < due) return { tone: 'amber', label: 'Partial' };
  return { tone: 'green', label: 'Paid' };
};

export const getRelativeTime = (dateStr: string): string => {
  const now = new Date();
  const past = new Date(dateStr);
  const diffMs = now.getTime() - past.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 45) return `${Math.max(1, diffSec)}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return past.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

export const getCustomerStats = (
  phone: string,
  currentOrderId: string | undefined,
  customers: Customer[],
  orders: Order[],
  customerRatings: Record<string, number> = {}
) => {
  const normalizedPhone = phone.replace(/[^0-9]/g, '');
  const cust = customers.find(
    c => c.phone === normalizedPhone || (normalizedPhone.length >= 11 && c.phone.endsWith(normalizedPhone.slice(-11)))
  );
  const customerOrders = orders.filter(
    o => {
      const oPhone = o.customer_phone.replace(/[^0-9]/g, '');
      return (oPhone && oPhone === normalizedPhone) || (cust && o.customer_id === cust.id);
    }
  );

  const total = Math.max(customerOrders.length, cust?.order_count || 1);
  const completedOrders = customerOrders.filter(o => o.status === 'delivered');
  const completed = completedOrders.length;
  const pending = customerOrders.filter(o => ['confirmed', 'packed', 'dispatched'].includes(o.status)).length;
  const cancelled = customerOrders.filter(o => o.status === 'cancelled').length;
  const refunded = cust?.rto_count || (cust?.risk_flag ? 1 : 0);

  const totalSpend = customerOrders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.total, 0);

  const avgOrderValue = total > 0 ? Math.round(totalSpend / Math.max(1, customerOrders.filter(o => o.status !== 'cancelled').length)) : 0;

  const historicalOutcomes = completed + cancelled + refunded;
  const isNew = historicalOutcomes === 0;
  const successRate = historicalOutcomes > 0 ? Math.round((completed / historicalOutcomes) * 100) : null;

  const messengerCount = customerOrders.filter(o => o.channel === 'messenger').length;
  const walkInCount = customerOrders.filter(o => o.channel === 'walk-in').length;
  const preferredChannel = messengerCount >= walkInCount ? 'Messenger (Online)' : 'Walk-in Showroom';

  const steadfastCount = customerOrders.filter(o => o.fulfillment_method === 'steadfast').length;
  const inHouseCount = customerOrders.filter(o => o.fulfillment_method === 'in_house').length;
  const pickupCount = customerOrders.filter(o => o.fulfillment_method === 'self_pickup').length;
  const preferredFulfillment =
    steadfastCount >= inHouseCount && steadfastCount >= pickupCount
      ? 'Steadfast Courier COD'
      : inHouseCount >= pickupCount
      ? 'In-House Hand Delivery'
      : 'Store Self-Pickup';

  const currentRating = customerRatings[normalizedPhone] || (cust?.risk_flag ? 2 : successRate && successRate >= 80 ? 5 : 4);

  return {
    total,
    completed,
    pending,
    cancelled,
    refunded,
    successRate,
    isNew,
    totalSpend,
    avgOrderValue,
    preferredChannel,
    preferredFulfillment,
    currentRating,
    isRisk: cust?.risk_flag || (cancelled + refunded >= 2 && (successRate ?? 0) < 50),
    rawCustomer: cust,
    allOrders: customerOrders,
  };
};
