import { Product, ProductBatch, OrderItemAllocation } from '../types';

export interface BatchMaturationInfo {
  status: 'READY' | 'MATURING';
  ageDays: number;
  ageLabel: string;
  isMaturing: boolean;
  readyDate?: string;
  manufacturingDate?: string;
  receivedDate?: string;
  maturationDays?: number;
}

/**
 * Calculates stock age in days and readable label (e.g. '12 days', '2.5 months', '1.2 years')
 */
export function calculateStockAge(dateStr?: string): { days: number; label: string } {
  if (!dateStr) return { days: 0, label: '—' };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { days: 0, label: '—' };

  const diffMs = Date.now() - d.getTime();
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (days < 30) {
    return { days, label: `${days}d` };
  } else if (days < 365) {
    const months = (days / 30.4375).toFixed(1);
    return { days, label: `${months} mo` };
  } else {
    const years = (days / 365.25).toFixed(1);
    return { days, label: `${years} yr` };
  }
}

/**
 * Evaluates the maturation status of a stock shipment/batch
 */
export function getBatchMaturationInfo(batch: ProductBatch): BatchMaturationInfo {
  const received = batch.received_at || batch.import_date || batch.created_at;
  const { days, label } = calculateStockAge(received);

  // If explicit status is given
  if (batch.maturation_status === 'MATURING') {
    // Check if ready date has passed
    if (batch.maturation_ready_date) {
      const readyTime = new Date(batch.maturation_ready_date).getTime();
      if (!isNaN(readyTime) && Date.now() >= readyTime) {
        return {
          status: 'READY',
          ageDays: days,
          ageLabel: label,
          isMaturing: false,
          readyDate: batch.maturation_ready_date,
          manufacturingDate: batch.manufacturing_date,
          receivedDate: received,
          maturationDays: batch.maturation_days,
        };
      }
    }
    return {
      status: 'MATURING',
      ageDays: days,
      ageLabel: label,
      isMaturing: true,
      readyDate: batch.maturation_ready_date,
      manufacturingDate: batch.manufacturing_date,
      receivedDate: received,
      maturationDays: batch.maturation_days,
    };
  }

  // If maturation_ready_date is specified in future
  if (batch.maturation_ready_date) {
    const readyTime = new Date(batch.maturation_ready_date).getTime();
    if (!isNaN(readyTime) && Date.now() < readyTime) {
      return {
        status: 'MATURING',
        ageDays: days,
        ageLabel: label,
        isMaturing: true,
        readyDate: batch.maturation_ready_date,
        manufacturingDate: batch.manufacturing_date,
        receivedDate: received,
        maturationDays: batch.maturation_days,
      };
    }
  }

  // If maturation_days is set and computed from received date
  if (batch.maturation_days && batch.maturation_days > 0 && received) {
    const recTime = new Date(received).getTime();
    if (!isNaN(recTime)) {
      const readyTime = recTime + batch.maturation_days * 24 * 60 * 60 * 1000;
      if (Date.now() < readyTime) {
        return {
          status: 'MATURING',
          ageDays: days,
          ageLabel: label,
          isMaturing: true,
          readyDate: new Date(readyTime).toISOString().slice(0, 10),
          manufacturingDate: batch.manufacturing_date,
          receivedDate: received,
          maturationDays: batch.maturation_days,
        };
      }
    }
  }

  return {
    status: 'READY',
    ageDays: days,
    ageLabel: label,
    isMaturing: false,
    readyDate: batch.maturation_ready_date,
    manufacturingDate: batch.manufacturing_date,
    receivedDate: received,
    maturationDays: batch.maturation_days,
  };
}

/**
 * Returns all active batches (remaining quantity > 0) for a product, sorted FIFO (READY first, then oldest received).
 */
export function getActiveProductBatches(
  productId: string,
  batches: ProductBatch[],
  warehouseId?: string
): ProductBatch[] {
  return batches
    .filter(
      b =>
        b.product_id === productId &&
        b.quantity_remaining > 0 &&
        (!warehouseId || b.warehouse_id === warehouseId)
    )
    .sort((a, b) => {
      const matA = getBatchMaturationInfo(a);
      const matB = getBatchMaturationInfo(b);
      // Prioritize READY stock over MATURING stock
      if (matA.status !== matB.status) {
        return matA.status === 'READY' ? -1 : 1;
      }
      const dateA = new Date(a.received_at || a.import_date || a.created_at).getTime();
      const dateB = new Date(b.received_at || b.import_date || b.created_at).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return (a.batch_code || '').localeCompare(b.batch_code || '');
    });
}

export interface AllocationResult {
  allocations: OrderItemAllocation[];
  totalPrice: number;
  totalCost: number;
  effectiveUnitPrice: number;
  effectiveUnitCost: number;
  hasMaturingStock: boolean;
  isMultiBatch: boolean;
  breakdownSummary: string;
}

/**
 * Computes FIFO allocation across available active batches for an order item.
 */
export function computeFifoAllocation(
  product: Product,
  quantity: number,
  allBatches: ProductBatch[],
  warehouseId: string = 'wh_shop'
): AllocationResult {
  if (quantity <= 0) {
    return {
      allocations: [],
      totalPrice: 0,
      totalCost: 0,
      effectiveUnitPrice: product.selling_price || 0,
      effectiveUnitCost: product.avg_cost || 0,
      hasMaturingStock: false,
      isMultiBatch: false,
      breakdownSummary: '',
    };
  }

  const activeBatches = getActiveProductBatches(product.id, allBatches, warehouseId);

  const allocations: OrderItemAllocation[] = [];
  let remaining = quantity;
  let totalPrice = 0;
  let totalCost = 0;
  let hasMaturing = false;

  for (const batch of activeBatches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, batch.quantity_remaining);
    const unitPrice =
      typeof batch.selling_price === 'number' && batch.selling_price > 0
        ? batch.selling_price
        : product.selling_price || 0;
    const unitCost =
      typeof batch.purchase_cost === 'number' && batch.purchase_cost > 0
        ? batch.purchase_cost
        : product.avg_cost || 0;

    const matInfo = getBatchMaturationInfo(batch);
    if (matInfo.isMaturing) hasMaturing = true;

    allocations.push({
      batch_id: batch.id,
      batch_code: batch.batch_code || `LOT-${batch.id.slice(-4)}`,
      quantity: take,
      unit_price: unitPrice,
      unit_cost: unitCost,
      warehouse_id: batch.warehouse_id,
      location: batch.location,
      maturation_status: matInfo.status,
      received_at: batch.received_at || batch.import_date,
    });

    totalPrice += take * unitPrice;
    totalCost += take * unitCost;
    remaining -= take;
  }

  // If order exceeds tracked batch stock, fallback to general product stock
  if (remaining > 0) {
    const unitPrice = product.selling_price || 0;
    const unitCost = product.avg_cost || 0;
    allocations.push({
      batch_id: 'general_stock',
      batch_code: 'Active Stock',
      quantity: remaining,
      unit_price: unitPrice,
      unit_cost: unitCost,
      warehouse_id: warehouseId,
      maturation_status: 'READY',
    });
    totalPrice += remaining * unitPrice;
    totalCost += remaining * unitCost;
  }

  const effectiveUnitPrice = quantity > 0 ? Math.round((totalPrice / quantity) * 100) / 100 : product.selling_price || 0;
  const effectiveUnitCost = quantity > 0 ? Math.round((totalCost / quantity) * 100) / 100 : product.avg_cost || 0;

  const breakdownSummary = allocations.length > 1
    ? allocations.map(a => `${a.quantity} pcs @ ৳${a.unit_price.toLocaleString()}`).join(' + ')
    : '';

  return {
    allocations,
    totalPrice,
    totalCost,
    effectiveUnitPrice,
    effectiveUnitCost,
    hasMaturingStock: hasMaturing,
    isMultiBatch: allocations.length > 1,
    breakdownSummary,
  };
}
