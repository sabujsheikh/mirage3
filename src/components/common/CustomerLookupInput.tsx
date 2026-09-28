import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, Phone, MapPin, CheckCircle2, Search, X, Sparkles, AlertCircle } from 'lucide-react';
import { Customer } from '../../types';
import { useApp } from '../../context/AppContext';

export interface CustomerLookupInputProps {
  customerName: string;
  onCustomerNameChange: (name: string) => void;
  customerPhone: string;
  onCustomerPhoneChange: (phone: string) => void;
  deliveryAddress?: string;
  onDeliveryAddressChange?: (address: string) => void;
  showAddress?: boolean;
  nameRequired?: boolean;
  phoneRequired?: boolean;
  addressRequired?: boolean;
  errors?: {
    customerName?: string;
    customerPhone?: string;
    deliveryAddress?: string;
  };
  layout?: 'grid' | 'pos' | 'stacked';
  onCustomerSelected?: (customer: Customer) => void;
}

export const CustomerLookupInput: React.FC<CustomerLookupInputProps> = ({
  customerName,
  onCustomerNameChange,
  customerPhone,
  onCustomerPhoneChange,
  deliveryAddress = '',
  onDeliveryAddressChange,
  showAddress = true,
  nameRequired = false,
  phoneRequired = false,
  addressRequired = false,
  errors,
  layout = 'grid',
  onCustomerSelected,
}) => {
  const { customers } = useApp();
  const [activeField, setActiveField] = useState<'name' | 'phone' | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [matchedCustomer, setMatchedCustomer] = useState<Customer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveField(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check if current phone already matches an existing customer exactly
  useEffect(() => {
    const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.length >= 10) {
      const exact = customers.find(c => {
        const cPhone = (c.phone || '').replace(/[^0-9]/g, '');
        return cPhone && (cPhone === cleanPhone || cPhone.endsWith(cleanPhone) || cleanPhone.endsWith(cPhone));
      });
      if (exact) {
        setMatchedCustomer(exact);
      } else if (matchedCustomer && matchedCustomer.phone.replace(/[^0-9]/g, '') !== cleanPhone) {
        setMatchedCustomer(null);
      }
    } else if (!customerPhone && !customerName) {
      setMatchedCustomer(null);
    }
  }, [customerPhone, customerName, customers]);

  // Compute matches based on either phone or name input
  const matches = useMemo(() => {
    const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
    const cleanName = customerName.trim().toLowerCase();

    if (cleanPhone.length < 3 && cleanName.length < 2) {
      return [];
    }

    const scored = customers
      .map(c => {
        const cPhone = (c.phone || '').replace(/[^0-9]/g, '');
        const cName = (c.name || '').toLowerCase();
        let score = 0;

        // Phone matching (highest priority identifier)
        if (cleanPhone.length >= 3 && cPhone) {
          if (cPhone === cleanPhone) score += 100;
          else if (cPhone.startsWith(cleanPhone)) score += 80;
          else if (cPhone.includes(cleanPhone)) score += 60;
        }

        // Name matching
        if (cleanName.length >= 2 && cName) {
          if (cName === cleanName) score += 50;
          else if (cName.startsWith(cleanName)) score += 40;
          else if (cName.includes(cleanName)) score += 30;
        }

        return { customer: c, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(item => item.customer);

    return scored;
  }, [customers, customerPhone, customerName]);

  const handleSelectCustomer = (cust: Customer) => {
    setMatchedCustomer(cust);
    onCustomerNameChange(cust.name || '');
    onCustomerPhoneChange(cust.phone || '');
    if (onDeliveryAddressChange) {
      const addr = cust.addresses && cust.addresses[0]?.address_text ? cust.addresses[0].address_text : '';
      if (addr) onDeliveryAddressChange(addr);
    }
    if (onCustomerSelected) {
      onCustomerSelected(cust);
    }
    setIsOpen(false);
    setActiveField(null);
  };

  const handleClearMatched = () => {
    setMatchedCustomer(null);
    onCustomerNameChange('');
    onCustomerPhoneChange('');
    if (onDeliveryAddressChange) onDeliveryAddressChange('');
  };

  const showDropdown = isOpen && (activeField === 'name' || activeField === 'phone');

  return (
    <div ref={containerRef} className="relative space-y-2">
      {/* Recognized Customer Badge / Indicator */}
      {matchedCustomer && (
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[11px] animate-fadeIn">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="flex items-center gap-1 font-semibold text-[var(--accent-secondary)] shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--status-green)]" />
              Recognized Customer:
            </span>
            <span className="font-medium text-[var(--text)] truncate">{matchedCustomer.name}</span>
            <span className="text-[var(--text-secondary)] font-mono text-[10px] shrink-0">({matchedCustomer.phone})</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] shrink-0">
              {matchedCustomer.order_count || 0} orders · ৳{(matchedCustomer.total_spent || 0).toLocaleString()}
            </span>
          </div>
          <button
            type="button"
            onClick={handleClearMatched}
            className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--status-red)] hover:underline ml-2 shrink-0 cursor-pointer"
          >
            Clear / Change
          </button>
        </div>
      )}

      {/* Inputs Layout */}
      {layout === 'pos' ? (
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div className="relative">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-0.5">
              Customer Name {nameRequired && <span className="text-[var(--status-red)]">*</span>}
            </label>
            <div className="relative">
              <input
                type="text"
                value={customerName}
                onChange={e => {
                  onCustomerNameChange(e.target.value);
                  setIsOpen(true);
                  setActiveField('name');
                }}
                onFocus={() => {
                  setIsOpen(true);
                  setActiveField('name');
                }}
                placeholder="e.g. Arif Islam"
                className={`w-full px-2.5 py-1.5 bg-[var(--surface-sunken)] border rounded-xl text-[12px] text-[var(--text)] ${
                  errors?.customerName ? 'border-[var(--status-red)]' : 'border-[var(--border)]'
                }`}
              />
            </div>
            {errors?.customerName && <p className="text-[10px] text-[var(--status-red)] mt-0.5">{errors.customerName}</p>}
          </div>

          <div className="relative">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-0.5">
              Phone Number {phoneRequired && <span className="text-[var(--status-red)]">*</span>}
            </label>
            <div className="relative">
              <input
                type="text"
                value={customerPhone}
                onChange={e => {
                  onCustomerPhoneChange(e.target.value);
                  setIsOpen(true);
                  setActiveField('phone');
                }}
                onFocus={() => {
                  setIsOpen(true);
                  setActiveField('phone');
                }}
                placeholder="01XXXXXXXXX"
                className={`w-full px-2.5 py-1.5 bg-[var(--surface-sunken)] border rounded-xl text-[12px] text-[var(--text)] font-mono tabular-nums ${
                  errors?.customerPhone ? 'border-[var(--status-red)]' : 'border-[var(--border)]'
                }`}
              />
            </div>
            {errors?.customerPhone && <p className="text-[10px] text-[var(--status-red)] mt-0.5">{errors.customerPhone}</p>}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-[11px]">
          <div className="sm:col-span-6 relative">
            <label className="block text-[10px] font-medium text-[var(--text-secondary)] mb-0.5">
              Customer Name {nameRequired && <span className="text-[var(--status-red)]">*</span>}
            </label>
            <input
              type="text"
              value={customerName}
              onChange={e => {
                onCustomerNameChange(e.target.value);
                setIsOpen(true);
                setActiveField('name');
              }}
              onFocus={() => {
                setIsOpen(true);
                setActiveField('name');
              }}
              placeholder="e.g. Arif Islam"
              className={`w-full px-2.5 py-1.5 bg-[var(--surface-sunken)] border rounded-lg text-[12px] text-[var(--text)] ${
                errors?.customerName ? 'border-[var(--status-red)]' : 'border-[var(--border)]'
              }`}
            />
            {errors?.customerName && <p className="text-[10px] text-[var(--status-red)] mt-0.5">{errors.customerName}</p>}
          </div>

          <div className="sm:col-span-6 relative">
            <label className="block text-[10px] font-medium text-[var(--text-secondary)] mb-0.5">
              Mobile Number {phoneRequired && <span className="text-[var(--status-red)]">*</span>}
            </label>
            <input
              type="text"
              value={customerPhone}
              onChange={e => {
                onCustomerPhoneChange(e.target.value);
                setIsOpen(true);
                setActiveField('phone');
              }}
              onFocus={() => {
                setIsOpen(true);
                setActiveField('phone');
              }}
              placeholder="01XXXXXXXXX"
              className={`w-full px-2.5 py-1.5 bg-[var(--surface-sunken)] border rounded-lg text-[12px] text-[var(--text)] font-mono tabular-nums ${
                errors?.customerPhone ? 'border-[var(--status-red)]' : 'border-[var(--border)]'
              }`}
            />
            {errors?.customerPhone && <p className="text-[10px] text-[var(--status-red)] mt-0.5">{errors.customerPhone}</p>}
          </div>

          {showAddress && onDeliveryAddressChange && (
            <div className="sm:col-span-12">
              <label className="block text-[10px] font-medium text-[var(--text-secondary)] mb-0.5">
                Delivery Address {addressRequired && <span className="text-[var(--status-red)]">*</span>}
              </label>
              <input
                type="text"
                value={deliveryAddress}
                onChange={e => onDeliveryAddressChange(e.target.value)}
                placeholder="House, Road, Area, Dhaka / District"
                className={`w-full px-2.5 py-1.5 bg-[var(--surface-sunken)] border rounded-lg text-[12px] text-[var(--text)] ${
                  errors?.deliveryAddress ? 'border-[var(--status-red)]' : 'border-[var(--border)]'
                }`}
              />
              {errors?.deliveryAddress && <p className="text-[10px] text-[var(--status-red)] mt-0.5">{errors.deliveryAddress}</p>}
            </div>
          )}
        </div>
      )}

      {/* Floating Suggestions Dropdown */}
      {showDropdown && matches.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto animate-in fade-in duration-150">
          <div className="px-3 py-1.5 bg-[var(--surface-sunken)] border-b border-[var(--border)] flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
            <span className="font-semibold flex items-center gap-1">
              <Search className="w-3 h-3 text-[var(--accent-secondary)]" />
              Existing Customer Master ({matches.length} found)
            </span>
            <span className="text-[9px]">Tap to auto-fill</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {matches.map(cust => (
              <button
                key={cust.id}
                type="button"
                onClick={() => handleSelectCustomer(cust)}
                className="w-full text-left px-3 py-2 hover:bg-[var(--surface-sunken)] transition-colors flex items-center justify-between group cursor-pointer"
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[12px] text-[var(--text)] group-hover:text-[var(--accent-secondary)]">
                      {cust.name}
                    </span>
                    <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                      {cust.phone}
                    </span>
                    {cust.order_count && cust.order_count > 0 ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[var(--surface-sunken)] text-[var(--text)] border border-[var(--border)]">
                        {cust.order_count} orders
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold text-[var(--text-secondary)]">New</span>
                    )}
                  </div>
                  {cust.addresses && cust.addresses[0]?.address_text && (
                    <p className="text-[11px] text-[var(--text-secondary)] truncate flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 shrink-0 opacity-70" />
                      <span className="truncate">{cust.addresses[0].address_text}</span>
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-[11px] font-semibold font-mono text-[var(--text)]">
                    ৳{(cust.total_spent || 0).toLocaleString()}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No match indicator when query is typed */}
      {showDropdown && matches.length === 0 && (customerPhone.length >= 4 || customerName.trim().length >= 3) && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg p-2.5 text-[11px] text-[var(--text-secondary)] flex items-center justify-between animate-in fade-in duration-100">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent-secondary)] shrink-0" />
            <span>No existing customer matches — will be saved to Customer Master.</span>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-[10px] text-[var(--text-secondary)] hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};
