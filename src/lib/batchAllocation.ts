import { Product, ProductBatch, OrderItemAllocation } from '../types';

export interface MaturationInfo {
  status: 'READY' | 'MATURING';
  isReady: boolean;
  readyDate?: string;
  ageDays: number;
  ageMonths: number;
  ageLabel: string;
}

/**
 * Calculates stock age, maturation status, and ready date for a given batch.
 */
export function calculateMaturationInfo(batch: Partial<ProductBatch>): MaturationInfo {
  const now = Date.now();
  const baseDateStr = batch.manufacturing_date || batch.received_at || batch.import_date || batch.created_at;
  const baseTimestamp = baseDateStr ? new Date(baseDateStr).getTime() : now;

  const ageMs = Math.max(0, now - baseTimestamp);
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  const ageMonths = Math.floor(ageDays / 30.4375);

  let ageLabel = `${ageDays}d`;
  if (ageMonths >= 12) {
    const years = (ageMonths / 12).toFixed(1).replace('.0', '');
    ageLabel = `${years}y (${ageMonths} mos)`;
  } else if (ageMonths >= 1) {
    ageLabel = `${ageMonths} mos`;
  }

  // Maturation logic
  let isReady = true;
  let readyDate: string | undefined = batch.maturation_ready_date;

  if (batch.maturation_status === 'READY') {
    isReady = true;
  } else if (batch.maturation_status === 'MATURING') {
    isReady = false;
  } else if (batch.maturation_days && batch.maturation_days > 0) {
    const readyTimestamp = baseTimestamp + batch.maturation_days * (1000 * 60 * 60 * 24);
    isReady = now >= readyTimestamp;
    readyDate = new Date(readyTimestamp).toISOString().slice(0, 10);
  } else if (batch.maturation_ready_date) {
    isReady = now >= new Date(batch.maturation_ready_date).getTime();
  }

  const status: 'READY' | 'MATURING' = isReady ? 'READY' : 'MATURING';

  return {
    status,
    isReady,
    readyDate,
    ageDays,
    ageMonths,
    ageLabel,
  };
}

export interface AllocationResult {
  allocations: OrderItemAllocation[];
  totalAmount: number;
  totalCost: number;
  effectiveUnitPrice: number;
  effectiveUnitCost: number;
  isMultiLot: boolean;
  hasMaturingStock: boolean;
}

/**
 * Allocates requested product quantity across available shipments/lots using FIFO.
 * Priority:
 * 1. READY stock first (older ready stock before newer ready stock)
 * 2. MATURING stock if needed
 */
export function allocateStockFIFO(
  product: Product,
  allBatches: ProductBatch[],
  requestedQty: number,
  warehouseId: string = 'wh_shop'
): AllocationResult {
  if (requestedQty <= 0) {
    return {
      allocations: [],
      totalAmount: 0,
      totalCost: 0,
      effectiveUnitPrice: product.selling_price || 0,
      effectiveUnitCost: product.avg_cost || 0,
      isMultiLot: false,
      hasMaturingStock: false,
    };
  }

  // Filter batches for this product with stock remaining in specified warehouse (or all warehouses if not matched)
  let candidateBatches = allBatches.filter(
    (b) => b.product_id === product.id && b.quantity_remaining > 0 && (!warehouseId || b.warehouse_id === warehouseId)
  );

  // If no warehouse-specific batches, fallback to any available batches for this product
  if (candidateBatches.length === 0) {
    candidateBatches = allBatches.filter(
      (b) => b.product_id === product.id && b.quantity_remaining > 0
    );
  }

  // Sort candidate batches:
  // 1. READY first
  // 2. FIFO by received_at / import_date / created_at (oldest first)
  // 3. ID ascending
  const sortedBatches = [...candidateBatches].sort((a, b) => {
    const matA = calculateMaturationInfo(a);
    const matB = calculateMaturationInfo(b);

    if (matA.isReady !== matB.isReady) {
      return matA.isReady ? -1 : 1; // READY first
    }

    const dateA = new Date(a.received_at || a.import_date || a.created_at).getTime();
    const dateB = new Date(b.received_at || b.import_date || b.created_at).getTime();
    if (dateA !== dateB) {
      return dateA - dateB; // Oldest first
    }

    return a.id.localeCompare(b.id);
  });

  const allocations: OrderItemAllocation[] = [];
  let remainingToAllocate = requestedQty;
  let totalAmount = 0;
  let totalCost = 0;
  let hasMaturingStock = false;

  for (const batch of sortedBatches) {
    if (remainingToAllocate <= 0) break;

    const availableInBatch = batch.quantity_remaining;
    const takeQty = Math.min(remainingToAllocate, availableInBatch);
    const mat = calculateMaturationInfo(batch);

    if (!mat.isReady) {
      hasMaturingStock = true;
    }

    const unitPrice =
      typeof batch.selling_price === 'number' && batch.selling_price > 0
        ? batch.selling_price
        : product.selling_price || 0;

    const unitCost =
      typeof batch.purchase_cost === 'number' && batch.purchase_cost > 0
        ? batch.purchase_cost
        : product.avg_cost || 0;

    allocations.push({
      batch_id: batch.id,
      batch_code: batch.batch_code || `LOT-${batch.id.slice(-4)}`,
      quantity: takeQty,
      unit_price: unitPrice,
      unit_cost: unitCost,
      warehouse_id: batch.warehouse_id,
      location: batch.location,
      maturation_status: mat.status,
      received_at: batch.received_at || batch.import_date,
    });

    totalAmount += takeQty * unitPrice;
    totalCost += takeQty * unitCost;
    remainingToAllocate -= takeQty;
  }

  // If there's still unallocated quantity (general stock without specific lot)
  if (remainingToAllocate > 0) {
    const unitPrice = product.selling_price || 0;
    const unitCost = product.avg_cost || 0;

    allocations.push({
      batch_id: 'general_stock',
      batch_code: 'Active Stock',
      quantity: remainingToAllocate,
      unit_price: unitPrice,
      unit_cost: unitCost,
      warehouse_id: warehouseId,
      maturation_status: 'READY',
    });

    totalAmount += remainingToAllocate * unitPrice;
    totalCost += remainingToAllocate * unitCost;
  }

  const effectiveUnitPrice = requestedQty > 0 ? Math.round((totalAmount / requestedQty) * 100) / 100 : product.selling_price || 0;
  const effectiveUnitCost = requestedQty > 0 ? Math.round((totalCost / requestedQty) * 100) / 100 : product.avg_cost || 0;

  return {
    allocations,
    totalAmount,
    totalCost,
    effectiveUnitPrice,
    effectiveUnitCost,
    isMultiLot: allocations.length > 1,
    hasMaturingStock,
  };
}

/**
 * Returns all active batches (remaining > 0) for a product.
 */
export function getActiveBatchesForProduct(
  allBatches: ProductBatch[],
  productId: string,
  warehouseId?: string
): ProductBatch[] {
  return allBatches
    .filter(
      (b) =>
        b.product_id === productId &&
        b.quantity_remaining > 0 &&
        (!warehouseId || b.warehouse_id === warehouseId)
    )
    .sort((a, b) => {
      const dateA = new Date(a.received_at || a.import_date || a.created_at).getTime();
      const dateB = new Date(b.received_at || b.import_date || b.created_at).getTime();
      return dateA - dateB;
    });
}
