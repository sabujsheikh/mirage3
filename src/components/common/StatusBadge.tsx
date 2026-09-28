import React from 'react';

export type StatusType =
  | 'confirmed'
  | 'packed'
  | 'dispatched'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'rto'
  | 'pending'
  | 'completed'
  | 'active'
  | 'inactive'
  | 'low_stock'
  | 'in_stock'
  | 'out_of_stock'
  | 'risk'
  | string;

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  className = '',
  size = 'md',
}) => {
  const norm = status?.toLowerCase() || '';

  let colorClass = 'pill-gray';
  let defaultLabel = label || status;

  if (['delivered', 'completed', 'active', 'in_stock', 'paid', 'success'].includes(norm)) {
    colorClass = 'pill-green';
    if (!label) {
      if (norm === 'delivered') defaultLabel = 'Delivered';
      else if (norm === 'in_stock') defaultLabel = 'In Stock';
      else if (norm === 'completed') defaultLabel = 'Completed';
    }
  } else if (['confirmed', 'dispatched', 'in_transit', 'processing', 'packed'].includes(norm)) {
    colorClass = 'pill-teal';
    if (!label) {
      if (norm === 'confirmed') defaultLabel = 'Confirmed (Reserved)';
      else if (norm === 'packed') defaultLabel = 'Packed';
      else if (norm === 'dispatched') defaultLabel = 'Dispatched';
    }
  } else if (['pending', 'low_stock', 'awaiting', 'cod_pending'].includes(norm)) {
    colorClass = 'pill-amber';
    if (!label) {
      if (norm === 'pending') defaultLabel = 'Pending';
      else if (norm === 'low_stock') defaultLabel = 'Low Stock';
      else if (norm === 'cod_pending') defaultLabel = 'COD Pending';
    }
  } else if (['cancelled', 'failed', 'returned', 'rto', 'out_of_stock', 'damaged', 'risk'].includes(norm)) {
    colorClass = 'pill-red';
    if (!label) {
      if (norm === 'cancelled') defaultLabel = 'Cancelled';
      else if (norm === 'rto') defaultLabel = 'RTO (Failed)';
      else if (norm === 'out_of_stock') defaultLabel = 'Out of Stock';
      else if (norm === 'risk') defaultLabel = 'High Risk';
    }
  }

  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border whitespace-nowrap ${sizeClass} ${colorClass} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-75" />
      {defaultLabel}
    </span>
  );
};
