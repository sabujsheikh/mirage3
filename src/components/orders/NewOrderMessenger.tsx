import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Sparkles,
  AlertCircle,
  Plus,
  Trash2,
  CheckCircle2,
  Send,
  User,
  Phone,
  MapPin,
  Search,
  Tag,
  Package,
  Printer,
  Edit3,
  Copy,
  Check,
  Clock,
  X,
  RotateCcw,
  CornerDownLeft,
  Building,
  DollarSign,
  Layers,
  ChevronDown,
  Gift,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Product, FulfillmentMethod, OrderType, OrderTiming } from '../../types';
import { InvoiceModal } from './InvoiceModal';
import { MerchantStickerModal } from '../packing/MerchantStickerModal';
import { CustomerLookupInput } from '../common/CustomerLookupInput';
import { Modal } from '../common/Modal';
import { OFFICIAL_TESTERS, TesterItem } from '../../lib/testerTypes';

export const NewOrderMessenger: React.FC<{ onOrderCreated?: (order: any) => void }> = ({
  onOrderCreated,
}) => {
  const { products, parseMessenger, createOrder, setActivePath, customers, settings } = useApp();
  const { currentUser } = useAuth();

  // Search & Auto-Add Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const itemsScrollContainerRef = useRef<HTMLDivElement>(null);
  const lastItemRef = useRef<HTMLTableRowElement>(null);
  const autoAddTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoAddIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const parserModalRef = useRef<HTMLDivElement>(null);
  const parserTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Order Parser Modal State
  const [isParserModalOpen, setIsParserModalOpen] = useState<boolean>(false);
  const [parserRawText, setParserRawText] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parserError, setParserError] = useState<string | null>(null);
  const [parserSuccessNotice, setParserSuccessNotice] = useState<string | null>(null);
  const [sourceAuditText, setSourceAuditText] = useState<string>('');

  // Form Field Validation Errors
  const [fieldErrors, setFieldErrors] = useState<{
    customerName?: string;
    customerPhone?: string;
    deliveryAddress?: string;
    parcelId?: string;
    items?: string;
  }>({});

  // Order Configuration
  const [orderType, setOrderType] = useState<OrderType>('direct_sale'); // 'direct_sale' | 'merchant_fulfillment'
  const [saleType, setSaleType] = useState<'retail' | 'wholesale'>('retail'); // Wholesale / Retail support

  // Dropship / Merchant Details
  const [merchantName, setMerchantName] = useState<string>('');
  const [merchantId, setMerchantId] = useState<string>('');
  const [parcelId, setParcelId] = useState<string>('');
  const [endCustomerName, setEndCustomerName] = useState<string>('');

  // Customer Contact & Shipping Destination
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>('steadfast');
  const [instantDeliveryProvider, setInstantDeliveryProvider] = useState<'pathao' | 'uber' | 'other'>('pathao');
  const [deliveredByStaff, setDeliveredByStaff] = useState<string>('');
  const [deliveryCharge, setDeliveryCharge] = useState<number>(settings?.inside_dhaka_delivery ?? 70);
  const [orderDiscount, setOrderDiscount] = useState<number>(0);

  // Mismatch & Audit warnings
  const [parsedStatedTotal, setParsedStatedTotal] = useState<number>(0);
  const [parserUsed, setParserUsed] = useState<string | null>(null);

  // Payment State
  const [paymentState, setPaymentState] = useState<'cod' | 'prepaid'>('cod');
  const [prepaidAmount, setPrepaidAmount] = useState<number>(0);
  const [advanceMethod, setAdvanceMethod] = useState<'cash' | 'bkash' | 'nagad' | 'bank' | 'card'>('bkash');
  const [advanceAccount, setAdvanceAccount] = useState<string>('acc_bkash');
  const [paymentRef, setPaymentRef] = useState<string>('');

  // Invoice Notes
  const [invoiceNoteType, setInvoiceNoteType] = useState<'cod' | 'prepaid' | 'none'>('none');
  const [invoiceNoteText, setInvoiceNoteText] = useState<string>('');
  const [isNoteOpen, setIsNoteOpen] = useState<boolean>(false);

  // Internal Packing Note (For Packing Team only, not printed on invoice)
  const [packingNote, setPackingNote] = useState<string>('');
  const [isPackingNoteOpen, setIsPackingNoteOpen] = useState<boolean>(false);

  // Timing
  const [orderTiming, setOrderTiming] = useState<OrderTiming>('today');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [timingReason, setTimingReason] = useState<string | null>(null);

  // Cart / Line Items with Mixed Pricing support
  const [items, setItems] = useState<
    {
      product_id: string;
      product_name: string;
      quantity: number;
      price_type: 'retail' | 'wholesale' | 'custom';
      unit_price: number;
      retail_price: number;
      wholesale_price: number;
      discount_amount: number;
      confidence?: string;
      candidates?: { id: string; name: string; price: number }[];
      raw_line?: string;
      stated_amount?: number;
    }[]
  >([]);

  // Free Testers / Samples Support (Multiple testers, ৳0 selling price, stored on order)
  const [selectedTesters, setSelectedTesters] = useState<
    {
      product_id: string;
      product_name: string;
      sku?: string;
      barcode?: string;
      quantity: number;
    }[]
  >([]);
  const [isTesterModalOpen, setIsTesterModalOpen] = useState<boolean>(false);
  const [testerSearch, setTesterSearch] = useState<string>('');
  const testerSearchInputRef = useRef<HTMLInputElement>(null);

  // Submissions & Modals
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successOrder, setSuccessOrder] = useState<any | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState<boolean>(false);
  const [showStickerModal, setShowStickerModal] = useState<boolean>(false);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  // Catalog Search & Auto-Add State
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [autoAddCountdown, setAutoAddCountdown] = useState<{
    product: Product;
    secondsRemaining: number;
  } | null>(null);

  // Wholesale pricing logic from POS (Product Master prices remain untouched)
  const getProductWholesalePrice = useCallback((prod: Product): number => {
    if (
      prod.wholesale_type === 'separate' ||
      (prod.wholesale_type === undefined &&
        typeof prod.wholesale_price === 'number' &&
        prod.wholesale_price > 0 &&
        prod.wholesale_price !== (prod.selling_price ?? 0))
    ) {
      return typeof prod.wholesale_price === 'number' ? prod.wholesale_price : prod.selling_price;
    }
    return prod.selling_price;
  }, []);

  // Focus search input on initial mount
  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Focus modal textarea when modal opens
  useEffect(() => {
    if (isParserModalOpen) {
      const timer = setTimeout(() => {
        parserTextareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isParserModalOpen]);

  // Filter products based on search input
  const matchingProducts = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase();
    if (!query) return [];

    return products.filter(p => {
      const displayName = (p.display_name || '').toLowerCase();
      const name = (p.name || '').toLowerCase();
      const brand = (p.brand || '').toLowerCase();
      const sku = (p.sku || '').toLowerCase();
      const barcode = (p.barcode || '').toLowerCase();

      if (barcode === query) return true;
      if (sku === query || sku.includes(query)) return true;
      if (displayName.includes(query)) return true;
      if (name.includes(query)) return true;
      if (brand.includes(query)) return true;
      if (`${brand} ${name}`.includes(query)) return true;
      return false;
    });
  }, [products, catalogSearch]);

  // Filter only the 3 official tester types
  const matchingTesterProducts = useMemo(() => {
    const query = testerSearch.trim().toLowerCase();
    if (!query) return OFFICIAL_TESTERS;

    return OFFICIAL_TESTERS.filter(t => {
      const name = t.name.toLowerCase();
      const sku = (t.sku || '').toLowerCase();
      const brand = (t.brand || '').toLowerCase();

      return name.includes(query) || sku.includes(query) || brand.includes(query);
    });
  }, [testerSearch]);

  const handleAddTester = useCallback((tester: TesterItem) => {
    setSelectedTesters(prev => {
      const existingIdx = prev.findIndex(t => t.product_id === tester.id || t.product_name === tester.name);
      if (existingIdx >= 0) {
        return prev.map((t, idx) =>
          idx === existingIdx ? { ...t, quantity: t.quantity + 1 } : t
        );
      }
      return [
        ...prev,
        {
          product_id: tester.id,
          product_name: tester.name,
          sku: tester.sku,
          quantity: 1,
        },
      ];
    });
    setTesterSearch('');
    setIsTesterModalOpen(false);
  }, []);

  const handleUpdateTesterQty = useCallback((idx: number, delta: number) => {
    setSelectedTesters(prev =>
      prev
        .map((t, i) => {
          if (i === idx) {
            const nextQty = t.quantity + delta;
            return nextQty > 0 ? { ...t, quantity: nextQty } : null;
          }
          return t;
        })
        .filter((t): t is NonNullable<typeof t> => t !== null)
    );
  }, []);

  const handleRemoveTester = useCallback((idx: number) => {
    setSelectedTesters(prev => prev.filter((_, i) => i !== idx));
  }, []);

  // Add Product Action (Never alters the Product Master)
  const handleAddItem = useCallback(
    (prod: Product) => {
      const retailPrice = prod.selling_price || 0;
      const wholesalePrice = getProductWholesalePrice(prod);
      // Default item price type based on current order saleType
      const initialPriceType: 'retail' | 'wholesale' = saleType === 'wholesale' ? 'wholesale' : 'retail';
      const initialUnitPrice = initialPriceType === 'wholesale' ? wholesalePrice : retailPrice;

      setItems(prev => {
        const existingIndex = prev.findIndex(i => i.product_id === prod.id);
        if (existingIndex >= 0) {
          return prev.map((it, idx) =>
            idx === existingIndex ? { ...it, quantity: it.quantity + 1 } : it
          );
        }
        return [
          ...prev,
          {
            product_id: prod.id,
            product_name: prod.display_name,
            quantity: 1,
            price_type: initialPriceType,
            unit_price: initialUnitPrice,
            retail_price: retailPrice,
            wholesale_price: wholesalePrice,
            discount_amount: 0,
            confidence: 'high',
          },
        ];
      });

      setFieldErrors(prev => ({ ...prev, items: undefined }));
      setHighlightedItemId(prod.id);
      setTimeout(() => setHighlightedItemId(null), 1200);
    },
    [getProductWholesalePrice, saleType]
  );

  // Safe wrapper that adds product, clears timers, clears search, and refocuses input
  const addProductToOrder = useCallback(
    (prod: Product) => {
      if (autoAddTimeoutRef.current) {
        clearTimeout(autoAddTimeoutRef.current);
        autoAddTimeoutRef.current = null;
      }
      if (autoAddIntervalRef.current) {
        clearInterval(autoAddIntervalRef.current);
        autoAddIntervalRef.current = null;
      }
      setAutoAddCountdown(null);

      handleAddItem(prod);

      // Clear search and immediately re-focus for rapid consecutive entry
      setCatalogSearch('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 20);
    },
    [handleAddItem]
  );

  // Cancel any active auto-add countdown
  const cancelAutoAdd = useCallback(() => {
    if (autoAddTimeoutRef.current) {
      clearTimeout(autoAddTimeoutRef.current);
      autoAddTimeoutRef.current = null;
    }
    if (autoAddIntervalRef.current) {
      clearInterval(autoAddIntervalRef.current);
      autoAddIntervalRef.current = null;
    }
    setAutoAddCountdown(null);
  }, []);

  // Auto-Add Countdown Effect:
  // If exactly ONE unique product matches, automatically add after 1.0 second.
  // If multiple products match, do not auto-add.
  useEffect(() => {
    if (autoAddTimeoutRef.current) {
      clearTimeout(autoAddTimeoutRef.current);
      autoAddTimeoutRef.current = null;
    }
    if (autoAddIntervalRef.current) {
      clearInterval(autoAddIntervalRef.current);
      autoAddIntervalRef.current = null;
    }

    const query = catalogSearch.trim();
    if (!query) {
      setAutoAddCountdown(null);
      return;
    }

    if (matchingProducts.length === 1) {
      const uniqueMatch = matchingProducts[0];
      const initialDelay = 1.0; // 1 second auto-add
      let remaining = initialDelay;

      setAutoAddCountdown({
        product: uniqueMatch,
        secondsRemaining: initialDelay,
      });

      autoAddIntervalRef.current = setInterval(() => {
        remaining = Math.max(0, +(remaining - 0.2).toFixed(1));
        setAutoAddCountdown(prev => (prev ? { ...prev, secondsRemaining: remaining } : null));
      }, 200);

      autoAddTimeoutRef.current = setTimeout(() => {
        addProductToOrder(uniqueMatch);
      }, initialDelay * 1000);
    } else {
      // 0 or >1 matches: do not auto-add
      setAutoAddCountdown(null);
    }

    return () => {
      if (autoAddTimeoutRef.current) clearTimeout(autoAddTimeoutRef.current);
      if (autoAddIntervalRef.current) clearInterval(autoAddIntervalRef.current);
    };
  }, [catalogSearch, matchingProducts, addProductToOrder]);

  // Auto-scroll the added-products container to the latest item whenever items change
  useEffect(() => {
    if (items.length > 0 && itemsScrollContainerRef.current) {
      itemsScrollContainerRef.current.scrollTo({
        top: itemsScrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
      lastItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [items.length]);

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateItemQty = (index: number, delta: number) => {
    setItems(prev =>
      prev
        .map((it, idx) => {
          if (idx === index) {
            const next = it.quantity + delta;
            return next > 0 ? { ...it, quantity: next } : null;
          }
          return it;
        })
        .filter(Boolean) as any
    );
  };

  // Mixed Pricing Handler: Switch item price between Retail and Wholesale
  const handleSetItemPriceType = (index: number, type: 'retail' | 'wholesale') => {
    setItems(prev =>
      prev.map((it, idx) => {
        if (idx !== index) return it;
        const targetPrice = type === 'wholesale' ? it.wholesale_price : it.retail_price;
        return {
          ...it,
          price_type: type,
          unit_price: targetPrice,
        };
      })
    );
  };

  // Mixed Pricing Handler: Direct unit price entry (Sets to 'custom' if differs from master retail & wholesale)
  const handleUpdateItemUnitPrice = (index: number, newPrice: number) => {
    const price = Math.max(0, newPrice);
    setItems(prev =>
      prev.map((it, idx) => {
        if (idx !== index) return it;
        let determinedType: 'retail' | 'wholesale' | 'custom' = 'custom';
        if (price === it.retail_price) determinedType = 'retail';
        else if (price === it.wholesale_price) determinedType = 'wholesale';
        return {
          ...it,
          price_type: determinedType,
          unit_price: price,
        };
      })
    );
  };

  // Batch toggle: Apply order-level pricing to all existing items
  const handleApplyOrderPricingToAllItems = (type: 'retail' | 'wholesale') => {
    setSaleType(type);
    setItems(prev =>
      prev.map(it => ({
        ...it,
        price_type: type,
        unit_price: type === 'wholesale' ? it.wholesale_price : it.retail_price,
      }))
    );
  };

  // Calculated totals
  const calculatedSubtotal = items.reduce(
    (sum, it) => sum + (it.unit_price || 0) * (it.quantity || 1),
    0
  );
  const calculatedItemDiscount = items.reduce((sum, it) => sum + (it.discount_amount || 0), 0);

  const calculatedTotal = Math.max(
    0,
    calculatedSubtotal -
      calculatedItemDiscount +
      (fulfillmentMethod === 'instant_delivery' ? 0 : Number(deliveryCharge || 0)) -
      Number(orderDiscount || 0)
  );

  // Partial Payment calculations
  const effectivePrepaidAmount =
    paymentState === 'prepaid' ? Math.min(calculatedTotal, Math.max(0, prepaidAmount)) : 0;
  const remainingDueAmount = Math.max(0, calculatedTotal - effectivePrepaidAmount);

  const reviewMismatchWarning =
    parsedStatedTotal > 0 &&
    items.some(it => it.product_id && it.confidence !== 'unmatched') &&
    calculatedTotal !== parsedStatedTotal
      ? `Total amount does not match the parsed message — expected ৳${calculatedTotal.toLocaleString()}, message states ৳${parsedStatedTotal.toLocaleString()}.`
      : null;

  const defaultCodTemplate =
    settings?.invoice_note_cod ||
    'Cash on Delivery: Please verify your parcel upon arrival and pay the due amount to the delivery agent. Authentic Mirage Fragrance guaranteed.';
  const defaultPrepaidTemplate =
    settings?.invoice_note_prepaid ||
    'Prepaid Order: Payment verified. Thank you for shopping with Mirage Perfumes.';

  // Update invoice note template when payment condition changes (only when note is active)
  useEffect(() => {
    if (invoiceNoteType === 'none') {
      setInvoiceNoteText('');
    } else if (paymentState === 'prepaid') {
      if (remainingDueAmount > 0) {
        setInvoiceNoteText(
          `Partial Prepaid: ৳${effectivePrepaidAmount.toLocaleString()} received. Remaining ৳${remainingDueAmount.toLocaleString()} due on delivery.`
        );
      } else {
        setInvoiceNoteText(defaultPrepaidTemplate);
      }
    } else {
      setInvoiceNoteText(defaultCodTemplate);
    }
  }, [invoiceNoteType, paymentState, remainingDueAmount, effectivePrepaidAmount, defaultCodTemplate, defaultPrepaidTemplate]);

  // Keep prepaid amount in sync with total when in full prepaid mode
  const handlePaymentStateChange = (state: 'cod' | 'prepaid') => {
    setPaymentState(state);
    if (state === 'prepaid') {
      setPrepaidAmount(calculatedTotal);
      if (invoiceNoteType !== 'none') {
        setInvoiceNoteType('prepaid');
      }
    } else {
      setPrepaidAmount(0);
      if (invoiceNoteType !== 'none') {
        setInvoiceNoteType('cod');
      }
    }
  };

  useEffect(() => {
    if (!successOrder) return;
    const dismissTimer = window.setTimeout(() => {
      setSuccessOrder(null);
    }, 4500);
    return () => window.clearTimeout(dismissTimer);
  }, [successOrder]);

  const existingCustomer =
    customerPhone.trim().length >= 10
      ? customers.find(
          c =>
            c.phone === customerPhone.replace(/[^0-9]/g, '') ||
            c.phone.endsWith(customerPhone.replace(/[^0-9]/g, '').slice(-11))
        )
      : null;

  // Order Parser execution: Parses text, applies extracted data, closes modal, and resets input
  const handleExecuteParser = async () => {
    if (!parserRawText.trim()) return;
    setIsParsing(true);
    setParserError(null);
    setFieldErrors({});

    try {
      const res = await parseMessenger(parserRawText);

      // Save audit text
      setSourceAuditText(parserRawText.trim());

      const parsedType = res.order_type || 'direct_sale';
      setOrderType(parsedType);
      if (res.merchant_name) setMerchantName(res.merchant_name);
      if (res.merchant_id) setMerchantId(res.merchant_id);
      if (res.parcel_id) setParcelId(res.parcel_id);
      if (res.end_customer_name) setEndCustomerName(res.end_customer_name);

      setCustomerName(res.customer_name || res.end_customer_name || '');
      setCustomerPhone(res.phone || '');
      setDeliveryAddress(res.address || '');
      setDeliveryCharge(res.delivery_charge !== undefined ? res.delivery_charge : 70);
      setParsedStatedTotal(res.stated_total || 0);
      setParserUsed(res.parser_used);
      setFulfillmentMethod(res.fulfillment_method || 'steadfast');
      setInstantDeliveryProvider(res.instant_delivery_provider || 'pathao');

      if (res.order_timing === 'pre_order' || res.order_timing === 'scheduled') {
        setOrderTiming(res.order_timing);
        setScheduledDate(res.scheduled_date || '');
        setTimingReason(res.timing_reason || null);
      } else {
        setOrderTiming('today');
        setScheduledDate('');
        setTimingReason(null);
      }

      // Detect payment keywords
      const lower = parserRawText.toLowerCase();
      if (
        lower.includes('paid') ||
        lower.includes('prepaid') ||
        lower.includes('bkash paid') ||
        lower.includes('nagad paid') ||
        lower.includes('advance paid')
      ) {
        handlePaymentStateChange('prepaid');
      } else {
        handlePaymentStateChange('cod');
      }

      // Map parsed items
      const mappedItems = (res.items || []).map((it: any) => {
        const isConfidentMatch = it.confidence === 'high' || it.confidence === 'medium';
        const matchedProd = isConfidentMatch ? products.find(p => p.id === it.matched_product_id) : null;
        const retailPrice = matchedProd?.selling_price || it.unit_price || 0;
        const wholesalePrice = matchedProd ? getProductWholesalePrice(matchedProd) : retailPrice;
        const initialPriceType = saleType === 'wholesale' ? 'wholesale' : 'retail';
        const effectiveUnit =
          isConfidentMatch && it.unit_price !== undefined
            ? it.unit_price
            : initialPriceType === 'wholesale'
            ? wholesalePrice
            : retailPrice;

        return {
          product_id: isConfidentMatch ? it.matched_product_id || '' : '',
          product_name: isConfidentMatch
            ? it.product_name || matchedProd?.display_name || 'Matched Item'
            : it.raw_product_name || it.product_name || 'Unmatched Item',
          quantity: it.quantity || 1,
          price_type: (it.unit_price === wholesalePrice ? 'wholesale' : 'retail') as 'retail' | 'wholesale' | 'custom',
          unit_price: effectiveUnit,
          retail_price: retailPrice,
          wholesale_price: wholesalePrice,
          discount_amount: 0,
          confidence: it.confidence,
          candidates: it.candidates || [],
          raw_line: it.raw_line,
          stated_amount: it.stated_amount,
        };
      });

      setItems(mappedItems);

      // Close modal and reset textarea for next order
      setParserRawText('');
      setIsParserModalOpen(false);
      setParserSuccessNotice('Order parsed & applied successfully.');
      setTimeout(() => setParserSuccessNotice(null), 3000);
      searchInputRef.current?.focus();
    } catch (err: any) {
      setParserError(err.message || 'Failed to parse text. Please review manually.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleResetForm = () => {
    cancelAutoAdd();
    setParserRawText('');
    setSourceAuditText('');
    setOrderType('direct_sale');
    setSaleType('retail');
    setMerchantName('');
    setMerchantId('');
    setParcelId('');
    setEndCustomerName('');
    setCustomerName('');
    setCustomerPhone('');
    setDeliveryAddress('');
    setFulfillmentMethod('steadfast');
    setInstantDeliveryProvider('pathao');
    setDeliveredByStaff('');
    setDeliveryCharge(settings?.inside_dhaka_delivery !== undefined ? settings.inside_dhaka_delivery : 70);
    setOrderDiscount(0);
    setParsedStatedTotal(0);
    setParserUsed(null);
    setPaymentState('cod');
    setPrepaidAmount(0);
    setPaymentRef('');
    setInvoiceNoteType('none');
    setInvoiceNoteText('');
    setIsNoteOpen(false);
    setOrderTiming('today');
    setScheduledDate('');
    setTimingReason(null);
    setItems([]);
    setSelectedTesters([]);
    setIsTesterModalOpen(false);
    setIsPackingNoteOpen(false);
    setTesterSearch('');
    setPackingNote('');
    setCatalogSearch('');
    setFieldErrors({});
    setSuccessOrder(null);
    setParserError(null);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const handleCopyOrderSummary = () => {
    const currentDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const itemsText = items
      .map((it, idx) => {
        const itemFinal = Math.max(
          0,
          (it.unit_price || 0) * (it.quantity || 1) - (it.discount_amount || 0)
        );
        const hasDiscount = (it.discount_amount || 0) > 0;
        const priceLabel = it.price_type === 'wholesale' ? ' (Wholesale)' : '';
        return `${idx + 1}. ${it.product_name} × ${it.quantity} — ৳${itemFinal.toLocaleString()}${priceLabel}${
          hasDiscount ? ` (Unit: ৳${it.unit_price.toLocaleString()}, Disc: ৳${it.discount_amount})` : ''
        }`;
      })
      .join('\n');

    const totalDiscount = (orderDiscount || 0) + calculatedItemDiscount;
    const custName =
      customerName ||
      (orderType === 'merchant_fulfillment'
        ? endCustomerName || merchantName || 'Merchant Customer'
        : 'Valued Customer');
    const custPhone = customerPhone || 'N/A';
    const custAddress = deliveryAddress || 'N/A';

    const lines = [
      'Mirage Perfumes — Order Confirmation',
      '',
      currentDate,
      '',
      `Customer Name: ${custName}`,
      `Phone: ${custPhone}`,
      `Address: ${custAddress}`,
      '',
      'Products:',
      itemsText || '1. No products selected',
    ];

    if (selectedTesters.length > 0) {
      lines.push('');
      lines.push('Free Testers / Samples:');
      selectedTesters.forEach((t, i) => {
        lines.push(`${i + 1}. ${t.product_name} × ${t.quantity} — Free Sample (৳0)`);
      });
    }

    lines.push('');
    lines.push(`Subtotal: ৳${calculatedSubtotal.toLocaleString()}`);

    if (deliveryCharge > 0) {
      lines.push(`Delivery Charge: ৳${deliveryCharge.toLocaleString()}`);
    }

    if (totalDiscount > 0) {
      lines.push(`Total Discount: -৳${totalDiscount.toLocaleString()}`);
    }

    lines.push(`Total: ৳${calculatedTotal.toLocaleString()}`);

    if (paymentState === 'prepaid') {
      lines.push(`Prepaid: ৳${effectivePrepaidAmount.toLocaleString()}`);
      if (remainingDueAmount > 0) {
        lines.push(`Balance Due on Delivery: ৳${remainingDueAmount.toLocaleString()}`);
      } else {
        lines.push('Payment Status: Paid in Full');
      }
    } else {
      lines.push(`Payment: Cash on Delivery (Due: ৳${calculatedTotal.toLocaleString()})`);
    }

    lines.push('');
    lines.push('Thank you for choosing Mirage Perfumes.');

    const summary = lines.join('\n');

    navigator.clipboard
      .writeText(summary)
      .then(() => {
        setCopiedSummary(true);
        setTimeout(() => setCopiedSummary(false), 2500);
      })
      .catch(() => {});
  };

  const handleCreateOrder = async () => {
    const errors: {
      customerName?: string;
      customerPhone?: string;
      deliveryAddress?: string;
      parcelId?: string;
      items?: string;
    } = {};

    if (orderType === 'direct_sale') {
      if (!customerName.trim()) errors.customerName = 'Customer name is required.';
      if (!customerPhone.trim()) errors.customerPhone = 'Mobile number is required.';
      if (!deliveryAddress.trim()) errors.deliveryAddress = 'Delivery address is required.';
    } else {
      if (!parcelId.trim()) errors.parcelId = 'Parcel ID is mandatory for dropship orders.';
    }

    if (items.length === 0) {
      errors.items = 'Please add at least one item to the order.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const paymentInfo: any[] = [];
      if (paymentState === 'prepaid' && effectivePrepaidAmount > 0) {
        let accId = 'acc_bkash';
        if (advanceMethod === 'nagad') accId = 'acc_nagad';
        else if (advanceMethod === 'cash') accId = 'acc_cash';
        else if (advanceMethod === 'bank' || advanceMethod === 'card') accId = advanceAccount;

        paymentInfo.push({
          method: advanceMethod,
          amount: Math.round(effectivePrepaidAmount),
          account_id: accId,
          transaction_ref: paymentRef.trim() || undefined,
        });
      }

      const orderPayload: any = {
        channel: 'messenger',
        order_type: orderType,
        sale_type: saleType, // wholesale | retail
        source_text: sourceAuditText || undefined,
        discount_amount: orderDiscount,
        fulfillment_method: fulfillmentMethod,
        instant_delivery_provider: fulfillmentMethod === 'instant_delivery' ? instantDeliveryProvider : undefined,
        rider_delivery_charge: fulfillmentMethod === 'instant_delivery' ? deliveryCharge : undefined,
        delivery_charge: fulfillmentMethod === 'instant_delivery' ? 0 : deliveryCharge,
        order_timing: orderTiming,
        scheduled_date: orderTiming === 'scheduled' ? scheduledDate || undefined : undefined,
        payment_info: paymentInfo.length > 0 ? paymentInfo : undefined,
        packing_note: packingNote.trim() || undefined,
        testers: selectedTesters.length > 0 ? selectedTesters : undefined,
        items: items.map(it => ({
          product_id: it.product_id,
          product_name: it.product_name,
          quantity: it.quantity,
          unit_price: it.unit_price, // Transaction-level selling price override
          discount_amount: it.discount_amount || 0,
        })),
      };

      if (orderType === 'direct_sale') {
        orderPayload.customer_name = customerName.trim();
        orderPayload.customer_phone = customerPhone.trim();
        orderPayload.delivery_address = deliveryAddress.trim();
        orderPayload.invoice_note_type = invoiceNoteType;
        orderPayload.invoice_note = invoiceNoteType === 'none' ? undefined : invoiceNoteText;
        if (fulfillmentMethod === 'in_house') {
          orderPayload.delivered_by_staff = deliveredByStaff.trim() || currentUser?.name || 'Staff';
        }
      } else {
        orderPayload.parcel_id = parcelId.trim();
        orderPayload.merchant_id = merchantId.trim() || undefined;
        orderPayload.merchant_name = merchantName.trim() || undefined;
        orderPayload.end_customer_name = endCustomerName.trim() || undefined;
        orderPayload.customer_name = endCustomerName.trim() || merchantName.trim() || 'Merchant Customer';
        orderPayload.customer_phone = customerPhone.trim() || '';
        orderPayload.delivery_address = deliveryAddress.trim() || '';
      }

      const created = await createOrder(orderPayload);
      handleResetForm();
      setSuccessOrder(created);
      if (onOrderCreated) {
        onOrderCreated(created);
      }
    } catch (err: any) {
      alert(`Error creating order: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[1580px] mx-auto px-2 sm:px-3 space-y-2.5 font-sans" id="new-order-messenger-view">
      {/* Success Notification Toast */}
      {successOrder && (
        <div className="fixed bottom-4 right-4 z-50 w-[min(420px,calc(100vw-2rem))] p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl flex items-start justify-between gap-3 shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-[12px] font-semibold text-[var(--text)]">
                {successOrder.order_type === 'merchant_fulfillment'
                  ? 'Dropship Order Confirmed'
                  : 'Order Confirmed & Stock Reserved'}
              </h4>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                {successOrder.order_type === 'merchant_fulfillment' ? (
                  <>
                    Parcel <strong>{successOrder.parcel_id}</strong> (#{successOrder.invoice_number}) · {successOrder.merchant_name || 'Reseller'}
                  </>
                ) : (
                  <>
                    Invoice <strong>#{successOrder.invoice_number}</strong> for {successOrder.customer_name} · ৳
                    <span className="tabular-nums font-mono">{successOrder.total.toLocaleString()}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {successOrder.order_type !== 'merchant_fulfillment' && (
              <button
                type="button"
                onClick={() => setShowInvoiceModal(true)}
                className="p-1.5 text-[11px] font-medium rounded-lg bg-[var(--accent)] text-white hover:opacity-90 cursor-pointer flex items-center gap-1"
                title="Print invoice"
              >
                <Printer className="w-3.5 h-3.5" />
              </button>
            )}
            {successOrder.order_type === 'merchant_fulfillment' && (
              <button
                type="button"
                onClick={() => setShowStickerModal(true)}
                className="p-1.5 text-[11px] font-medium rounded-lg bg-[var(--accent)] text-white hover:opacity-90 cursor-pointer flex items-center gap-1"
                title="Print merchant sticker"
              >
                <Tag className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setActivePath('/orders')}
              className="p-1.5 text-[11px] font-medium rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer"
              title="View all orders"
            >
              <Package className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetForm}
              className="p-1.5 text-[11px] font-medium rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer"
              title="Create another order"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Temporary Success Notice from Parser */}
      {parserSuccessNotice && (
        <div className="p-2 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg flex items-center gap-2 text-[11px] text-[var(--text)] animate-in fade-in">
          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--status-green)] shrink-0" />
          <span>{parserSuccessNotice}</span>
        </div>
      )}

      {/* Header Bar: Clean, Compact, Professional */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-bold tracking-tight text-[var(--text)]">New Order</h2>
            <span className="text-[11px] text-[var(--text-secondary)]">·</span>
            <span className="text-[11px] font-semibold text-[var(--text)] tracking-tight">
              {orderType === 'direct_sale' ? 'Direct' : 'Dropship'} · {saleType === 'wholesale' ? 'Wholesale' : 'Retail'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* === REVERSIBLE UI EXPERIMENT: Compact Order Type & Pricing Selectors === */}
          {/* Compact Order Type Selector */}
          <div className="relative inline-flex items-center">
            <select
              value={orderType}
              onChange={e => {
                setOrderType(e.target.value as OrderType);
                setFieldErrors({});
              }}
              className="appearance-none bg-[var(--surface-sunken)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] text-[11px] font-medium rounded-lg pl-2.5 pr-6 py-1 cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              title="Order Type"
            >
              <option value="direct_sale">Direct</option>
              <option value="merchant_fulfillment">Dropship</option>
            </select>
            <ChevronDown className="w-3 h-3 text-[var(--text-secondary)] absolute right-2 pointer-events-none" />
          </div>

          {/* Compact Pricing Mode Selector */}
          <div className="relative inline-flex items-center">
            <select
              value={saleType}
              onChange={e => {
                handleApplyOrderPricingToAllItems(e.target.value as 'retail' | 'wholesale');
              }}
              className="appearance-none bg-[var(--surface-sunken)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] text-[11px] font-medium rounded-lg pl-2.5 pr-6 py-1 cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              title="Pricing Mode"
            >
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
            </select>
            <ChevronDown className="w-3 h-3 text-[var(--text-secondary)] absolute right-2 pointer-events-none" />
          </div>

          {/* PREVIOUS UI IMPLEMENTATION (Preserved for clean reversibility if experiment is reverted):
          <div className="inline-flex p-0.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[11px]">
            <button
              type="button"
              onClick={() => {
                setOrderType('direct_sale');
                setFieldErrors({});
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                orderType === 'direct_sale'
                  ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
            >
              Direct
            </button>
            <button
              type="button"
              onClick={() => {
                setOrderType('merchant_fulfillment');
                setFieldErrors({});
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                orderType === 'merchant_fulfillment'
                  ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
            >
              Dropship
            </button>
          </div>

          <div className="inline-flex p-0.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[11px]">
            <button
              type="button"
              onClick={() => handleApplyOrderPricingToAllItems('retail')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                saleType === 'retail'
                  ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
              title="Standard retail pricing"
            >
              Retail
            </button>
            <button
              type="button"
              onClick={() => handleApplyOrderPricingToAllItems('wholesale')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                saleType === 'wholesale'
                  ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
              title="Wholesale prices for wholesale / reseller orders"
            >
              Wholesale
            </button>
          </div>
          */}

          {/* Reset button */}
          <button
            type="button"
            onClick={handleResetForm}
            className="px-2 py-1 text-[11px] font-medium rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] flex items-center gap-1 cursor-pointer"
            title="Clear all fields"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>

          {/* Order Parser Modal Trigger */}
          <button
            type="button"
            onClick={() => {
              setIsParserModalOpen(true);
              setParserError(null);
            }}
            className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] hover:bg-[var(--surface-hover)] flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Order Parser</span>
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout (Desktop Compact Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-start">
        {/* Left Column: Customer & Product Actions */}
        <div className="lg:col-span-7 space-y-2.5">
          {/* Customer Details Form: Compact & Clean */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-2xs space-y-2">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-1.5">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text)]">
                <User className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                <span>Customer & Destination</span>
              </div>
              {existingCustomer && (
                <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-green)]" />
                  <span>Returning: {existingCustomer.order_count} orders (৳{existingCustomer.total_spent.toLocaleString()})</span>
                </div>
              )}
            </div>

            {/* Dropship-Only Fields */}
            {orderType === 'merchant_fulfillment' && (
              <div className="p-2 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-secondary)] mb-0.5">
                    Parcel ID <span className="text-[var(--status-red)]">*</span>
                  </label>
                  <input
                    type="text"
                    value={parcelId}
                    onChange={e => {
                      setParcelId(e.target.value);
                      if (fieldErrors.parcelId) setFieldErrors(prev => ({ ...prev, parcelId: undefined }));
                    }}
                    placeholder="e.g. ALR-78219"
                    className={`w-full px-2 py-1 bg-[var(--surface)] border rounded-md text-[11px] text-[var(--text)] font-mono ${
                      fieldErrors.parcelId ? 'border-[var(--status-red)]' : 'border-[var(--border)]'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-secondary)] mb-0.5">Merchant Name</label>
                  <input
                    type="text"
                    value={merchantName}
                    onChange={e => setMerchantName(e.target.value)}
                    placeholder="e.g. Aroma Luxe"
                    className="w-full px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[11px] text-[var(--text)]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-secondary)] mb-0.5">Merchant ID</label>
                  <input
                    type="text"
                    value={merchantId}
                    onChange={e => setMerchantId(e.target.value)}
                    placeholder="e.g. MER-4409"
                    className="w-full px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[11px] text-[var(--text)] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-secondary)] mb-0.5">End Customer</label>
                  <input
                    type="text"
                    value={endCustomerName}
                    onChange={e => {
                      setEndCustomerName(e.target.value);
                      if (!customerName) setCustomerName(e.target.value);
                    }}
                    placeholder="Recipient name"
                    className="w-full px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[11px] text-[var(--text)]"
                  />
                </div>
              </div>
            )}

            {/* Direct Sale & Contact Details with Shared Customer Recognition */}
            <CustomerLookupInput
              customerName={customerName}
              onCustomerNameChange={val => {
                setCustomerName(val);
                if (fieldErrors.customerName) setFieldErrors(prev => ({ ...prev, customerName: undefined }));
              }}
              customerPhone={customerPhone}
              onCustomerPhoneChange={val => {
                setCustomerPhone(val);
                if (fieldErrors.customerPhone) setFieldErrors(prev => ({ ...prev, customerPhone: undefined }));
              }}
              deliveryAddress={deliveryAddress}
              onDeliveryAddressChange={val => {
                setDeliveryAddress(val);
                if (fieldErrors.deliveryAddress) setFieldErrors(prev => ({ ...prev, deliveryAddress: undefined }));
              }}
              showAddress={true}
              nameRequired={orderType === 'direct_sale'}
              phoneRequired={orderType === 'direct_sale'}
              addressRequired={orderType === 'direct_sale'}
              errors={fieldErrors}
            />
          </div>

          {/* Product Search & Itemized Table Section (Primary Interaction Area) */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-2xs space-y-2.5">
            {/* Header: Title and Search Area */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <Package className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  <h3 className="text-[13px] font-bold text-[var(--text)]">Order Items</h3>
                  <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                    ({items.length} items{selectedTesters.length > 0 ? ` + ${selectedTesters.reduce((s, t) => s + t.quantity, 0)} tester` : ''})
                  </span>
                  {saleType === 'wholesale' && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)]">
                      Wholesale Mode
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsTesterModalOpen(true);
                      setTimeout(() => testerSearchInputRef.current?.focus(), 80);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-md border border-[var(--border)] bg-[var(--surface-sunken)] hover:bg-[var(--surface-hover)] text-[var(--text)] cursor-pointer transition-colors"
                    title="Add free tester / sample vial"
                  >
                    <Plus className="w-3 h-3 text-[var(--accent)]" />
                    <span>Tester</span>
                  </button>
                  {fieldErrors.items && (
                    <span className="text-[11px] font-medium text-[var(--status-red)]">{fieldErrors.items}</span>
                  )}
                </div>
              </div>

              {/* Primary Product Search Input Bar */}
              <div className="relative">
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={catalogSearch}
                    onChange={e => setCatalogSearch(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        if (autoAddCountdown) {
                          e.preventDefault();
                          addProductToOrder(autoAddCountdown.product);
                        } else if (matchingProducts.length === 1) {
                          e.preventDefault();
                          addProductToOrder(matchingProducts[0]);
                        } else if (matchingProducts.length > 1) {
                          e.preventDefault();
                          addProductToOrder(matchingProducts[0]);
                        }
                      } else if (e.key === 'Escape') {
                        cancelAutoAdd();
                        setCatalogSearch('');
                      }
                    }}
                    placeholder="Search product by name, brand, SKU or barcode to add..."
                    className="w-full pl-9 pr-8 py-1.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[12px] text-[var(--text)] placeholder:text-[var(--text-secondary)] focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)]"
                  />
                  {catalogSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        cancelAutoAdd();
                        setCatalogSearch('');
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-2.5 text-[var(--text-secondary)] hover:text-[var(--text)] cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Single Unique Match: 1-Second Auto-Add Notification Bar */}
                {autoAddCountdown && (
                  <div className="mt-1.5 p-2 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg flex items-center justify-between gap-2 text-[11px] animate-in fade-in">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0 animate-pulse" />
                      <span className="truncate text-[var(--text)]">
                        Auto-adding: <strong>{autoAddCountdown.product.display_name}</strong>
                      </span>
                      <span className="text-[var(--text-secondary)] font-mono tabular-nums shrink-0">
                        ({autoAddCountdown.secondsRemaining}s)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => addProductToOrder(autoAddCountdown.product)}
                        className="px-2 py-0.5 text-[10px] font-semibold rounded bg-[var(--text)] text-[var(--surface)] hover:opacity-90 cursor-pointer flex items-center gap-1"
                      >
                        Add Now <CornerDownLeft className="w-2.5 h-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelAutoAdd}
                        className="px-2 py-0.5 text-[10px] font-medium rounded text-[var(--text-secondary)] hover:text-[var(--text)] cursor-pointer"
                      >
                        Cancel (Esc)
                      </button>
                    </div>
                  </div>
                )}

                {/* Multiple Matches: Compact Selection List (Do Not Auto-Add) */}
                {catalogSearch.trim() && !autoAddCountdown && matchingProducts.length > 1 && (
                  <div className="mt-1.5 border border-[var(--border)] rounded-lg bg-[var(--surface)] shadow-md overflow-hidden z-20">
                    <div className="px-2.5 py-1 bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[10px] text-[var(--text-secondary)] font-medium flex items-center justify-between">
                      <span>{matchingProducts.length} matching products found — select one:</span>
                      <span className="font-mono">Press Enter to select first</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y divide-[var(--border)]">
                      {matchingProducts.slice(0, 7).map(prod => {
                        const wsPrice = getProductWholesalePrice(prod);
                        return (
                          <div
                            key={prod.id}
                            onClick={() => addProductToOrder(prod)}
                            className="px-3 py-1.5 hover:bg-[var(--surface-hover)] flex items-center justify-between gap-2 text-[11px] cursor-pointer transition-colors"
                          >
                            <div className="truncate pr-2">
                              <span className="font-semibold text-[var(--text)]">{prod.display_name}</span>
                              <span className="text-[var(--text-secondary)] ml-2 text-[10px]">
                                SKU: {prod.sku || 'N/A'} · Avail: <span className="tabular-nums font-mono font-medium">{prod.stock_available ?? 0}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-[var(--text-secondary)]">
                                R: <strong className="font-mono tabular-nums text-[var(--text)]">৳{prod.selling_price.toLocaleString()}</strong>
                              </span>
                              <span className="text-[10px] text-[var(--text-secondary)]">
                                W: <strong className="font-mono tabular-nums text-[var(--text)]">৳{wsPrice.toLocaleString()}</strong>
                              </span>
                              <button
                                type="button"
                                className="px-1.5 py-0.5 text-[10px] font-medium rounded border border-[var(--border)] hover:bg-[var(--surface)]"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Added Items Table with Dedicated Scroll Container */}
            {items.length === 0 && selectedTesters.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-[var(--border)] rounded-xl text-[var(--text-secondary)] text-[11px] space-y-1">
                <Package className="w-5 h-5 mx-auto opacity-40 text-[var(--text-secondary)]" />
                <p className="font-medium text-[var(--text)]">No items added to this order yet</p>
                <p className="text-[10px]">Type above to search products or click "+ Tester" to add complimentary sample vials.</p>
              </div>
            ) : (
              <div
                ref={itemsScrollContainerRef}
                className="max-h-[260px] xl:max-h-[300px] overflow-y-auto border border-[var(--border)] rounded-xl scrollbar-thin divide-y divide-[var(--border)]"
              >
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="py-1.5 px-2.5">Product</th>
                      <th className="py-1.5 px-2 text-center w-20">Qty</th>
                      <th className="py-1.5 px-2 text-left min-w-[155px]">Unit Price (Mixed Pricing)</th>
                      <th className="py-1.5 px-2 text-right w-20">Discount</th>
                      <th className="py-1.5 px-2.5 text-right w-24">Total</th>
                      <th className="py-1.5 px-1.5 text-center w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
                    {items.map((it, idx) => {
                      const matchedProd = products.find(p => p.id === it.product_id);
                      const isAvailable = (matchedProd?.stock_available ?? 0) >= it.quantity;
                      const isHighlighted = highlightedItemId === it.product_id;
                      const isLastItem = idx === items.length - 1 && selectedTesters.length === 0;
                      const lineTotal = Math.max(0, it.unit_price * it.quantity - (it.discount_amount || 0));

                      return (
                        <tr
                          key={`${it.product_id}-${idx}`}
                          ref={isLastItem ? lastItemRef : undefined}
                          className={`transition-colors ${
                            isHighlighted
                              ? 'bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]'
                              : 'hover:bg-[var(--surface-hover)]'
                          }`}
                        >
                          {/* Product Info */}
                          <td className="py-1.5 px-2.5">
                            <div className="font-semibold text-[var(--text)] line-clamp-1">{it.product_name}</div>
                            <div className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1.5">
                              <span>Stock:</span>
                              <span
                                className={`tabular-nums font-mono font-medium ${
                                  isAvailable ? 'text-[var(--text)]' : 'text-[var(--status-red)]'
                                }`}
                              >
                                {matchedProd?.stock_available ?? 0}
                              </span>
                              <span>·</span>
                              <span className="font-mono text-[9px]">
                                Master: R ৳{it.retail_price.toLocaleString()} / W ৳{it.wholesale_price.toLocaleString()}
                              </span>
                              {it.raw_line && (
                                <>
                                  <span>·</span>
                                  <span className="font-mono text-[9px] text-[var(--text-secondary)] truncate max-w-[110px]">
                                    {it.raw_line}
                                  </span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Quantity */}
                          <td className="py-1.5 px-2 text-center">
                            <div className="inline-flex items-center border border-[var(--border)] rounded bg-[var(--surface)] text-[11px]">
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(idx, -1)}
                                className="w-5 h-5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text)] active:bg-[var(--surface-hover)] cursor-pointer"
                                aria-label="Decrease quantity"
                              >
                                -
                              </button>
                              <span className="w-6 text-center tabular-nums font-mono font-semibold">{it.quantity}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(idx, 1)}
                                className="w-5 h-5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text)] active:bg-[var(--surface-hover)] cursor-pointer"
                                aria-label="Increase quantity"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          {/* Mixed Pricing Control (Per Item: Retail vs Wholesale vs Custom Override) */}
                          <td className="py-1.5 px-2 text-left">
                            <div className="flex items-center gap-1.5">
                              {/* R / W toggle */}
                              <div className="inline-flex p-0.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => handleSetItemPriceType(idx, 'retail')}
                                  className={`px-1.5 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                                    it.price_type === 'retail'
                                      ? 'bg-[var(--surface)] text-[var(--text)] font-semibold shadow-xs'
                                      : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                                  }`}
                                  title={`Standard Retail Price: ৳${it.retail_price.toLocaleString()}`}
                                >
                                  R
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetItemPriceType(idx, 'wholesale')}
                                  className={`px-1.5 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                                    it.price_type === 'wholesale'
                                      ? 'bg-[var(--surface)] text-[var(--text)] font-semibold shadow-xs'
                                      : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                                  }`}
                                  title={`Standard Wholesale Price: ৳${it.wholesale_price.toLocaleString()}`}
                                >
                                  W
                                </button>
                              </div>

                              {/* Editable Price Input (Transaction override, protects product master) */}
                              <div className="relative">
                                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-secondary)]">৳</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={it.unit_price}
                                  onChange={e => handleUpdateItemUnitPrice(idx, Number(e.target.value) || 0)}
                                  className="w-18 pl-4 pr-1 py-0.5 text-right font-mono tabular-nums text-[11px] bg-[var(--surface-sunken)] border border-[var(--border)] rounded focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)]"
                                  title="Transaction unit price (Product master price is protected)"
                                />
                              </div>

                              {it.price_type === 'custom' && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-[var(--surface-sunken)] text-[var(--text-secondary)] border border-[var(--border)]" title="Custom transaction price">
                                  Custom
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Item Discount */}
                          <td className="py-1.5 px-2 text-right">
                            <input
                              type="number"
                              min="0"
                              value={it.discount_amount || 0}
                              onChange={e => {
                                const val = Math.max(0, Number(e.target.value) || 0);
                                setItems(prev =>
                                  prev.map((item, i) =>
                                    i === idx
                                      ? { ...item, discount_amount: Math.min(val, item.unit_price * item.quantity) }
                                      : item
                                  )
                                );
                              }}
                              className="w-16 px-1 py-0.5 text-right tabular-nums font-mono bg-[var(--surface-sunken)] border border-[var(--border)] rounded text-[11px]"
                            />
                          </td>

                          {/* Line Total */}
                          <td className="py-1.5 px-2.5 text-right tabular-nums font-mono font-semibold text-[var(--text)]">
                            ৳{lineTotal.toLocaleString()}
                          </td>

                          {/* Remove Item */}
                          <td className="py-1.5 px-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-[var(--text-secondary)] hover:text-[var(--status-red)] cursor-pointer p-0.5"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Free Tester Rows in Order Items List */}
                    {selectedTesters.map((tester, tIdx) => (
                      <tr
                        key={`tester-${tester.product_id}-${tIdx}`}
                        className="bg-[color-mix(in_srgb,var(--status-green)_4%,var(--surface))] hover:bg-[color-mix(in_srgb,var(--status-green)_8%,var(--surface))] transition-colors"
                      >
                        {/* Tester Fragrance Info with Prominent Tag */}
                        <td className="py-1.5 px-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-[var(--text)] line-clamp-1">{tester.product_name}</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[color-mix(in_srgb,var(--status-green)_15%,var(--surface))] text-[var(--status-green)] border border-[color-mix(in_srgb,var(--status-green)_30%,transparent)]">
                              FREE TESTER
                            </span>
                          </div>
                          <div className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1.5 font-mono mt-0.5">
                            {tester.sku && <span>SKU: {tester.sku}</span>}
                            {tester.sku && <span>·</span>}
                            <span>Complimentary Vial (No scan required)</span>
                          </div>
                        </td>

                        {/* Tester Quantity */}
                        <td className="py-1.5 px-2 text-center">
                          <div className="inline-flex items-center border border-[color-mix(in_srgb,var(--status-green)_30%,var(--border))] rounded bg-[var(--surface)] text-[11px]">
                            <button
                              type="button"
                              onClick={() => handleUpdateTesterQty(tIdx, -1)}
                              className="w-5 h-5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text)] active:bg-[var(--surface-hover)] cursor-pointer"
                              aria-label="Decrease tester quantity"
                            >
                              -
                            </button>
                            <span className="w-6 text-center tabular-nums font-mono font-semibold text-[var(--text)]">{tester.quantity}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateTesterQty(tIdx, 1)}
                              className="w-5 h-5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text)] active:bg-[var(--surface-hover)] cursor-pointer"
                              aria-label="Increase tester quantity"
                            >
                              +
                            </button>
                          </div>
                        </td>

                        {/* Unit Price (৳0) */}
                        <td className="py-1.5 px-2 text-left">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-[var(--status-green)] bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)]">
                            Free (৳0)
                          </span>
                        </td>

                        {/* Discount */}
                        <td className="py-1.5 px-2 text-right">
                          <span className="text-[11px] text-[var(--text-secondary)] font-mono">—</span>
                        </td>

                        {/* Line Total */}
                        <td className="py-1.5 px-2.5 text-right tabular-nums font-mono font-bold text-[var(--status-green)] text-[11px]">
                          ৳0
                        </td>

                        {/* Remove Tester */}
                        <td className="py-1.5 px-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveTester(tIdx)}
                            className="text-[var(--text-secondary)] hover:text-[var(--status-red)] cursor-pointer p-0.5"
                            title="Remove tester"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Fulfillment, Payment, Summary & Submit */}
        <div className="lg:col-span-5 space-y-2.5">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-2xs space-y-2.5">
            <div className="border-b border-[var(--border)] pb-1.5 flex items-center justify-between">
              <h3 className="text-[12px] font-semibold text-[var(--text)]">Fulfillment & Payment</h3>
              {parserUsed && (
                <span className="text-[10px] px-1.5 py-0.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded font-mono text-[var(--text-secondary)]">
                  Parsed via {parserUsed === 'gemini_ai' ? 'Gemini AI' : 'Rule Engine'}
                </span>
              )}
            </div>

            {reviewMismatchWarning && (
              <div className="p-2 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg flex items-start gap-1.5 text-[11px] text-[var(--text)]">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--text-secondary)]" />
                <span>{reviewMismatchWarning}</span>
              </div>
            )}

            {/* Fulfillment & Payment Mode Selectors */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <label className="block text-[10px] font-medium text-[var(--text-secondary)] mb-0.5">Fulfillment</label>
                <select
                  value={fulfillmentMethod}
                  onChange={e => setFulfillmentMethod(e.target.value as FulfillmentMethod)}
                  className="w-full px-2 py-1 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[11px] text-[var(--text)]"
                >
                  <option value="steadfast">Steadfast Courier</option>
                  <option value="instant_delivery">Instant Delivery (Rider)</option>
                  <option value="in_house">In-House Local Delivery</option>
                  <option value="self_pickup">Self-Pickup (Walk-in)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-[var(--text-secondary)] mb-0.5">Payment State</label>
                <div className="inline-flex w-full p-0.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[11px]">
                  <button
                    type="button"
                    onClick={() => handlePaymentStateChange('cod')}
                    className={`flex-1 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      paymentState === 'cod'
                        ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs font-semibold'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                    }`}
                  >
                    COD
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePaymentStateChange('prepaid')}
                    className={`flex-1 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      paymentState === 'prepaid'
                        ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs font-semibold'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                    }`}
                  >
                    Prepaid
                  </button>
                </div>
              </div>
            </div>

            {/* In-House Delivery Staff Selector */}
            {fulfillmentMethod === 'in_house' && (
              <div className="text-[11px]">
                <label className="block text-[10px] font-medium text-[var(--text-secondary)] mb-0.5">Delivered By Staff</label>
                <input
                  type="text"
                  value={deliveredByStaff}
                  onChange={e => setDeliveredByStaff(e.target.value)}
                  placeholder={currentUser?.name || 'Staff Member Name'}
                  className="w-full px-2 py-1 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[11px]"
                />
              </div>
            )}

            {/* Instant Delivery Rider Service Selector */}
            {fulfillmentMethod === 'instant_delivery' && (
              <div className="text-[11px]">
                <label className="block text-[10px] font-medium text-[var(--text-secondary)] mb-0.5">Delivery Partner</label>
                <select
                  value={instantDeliveryProvider}
                  onChange={e => setInstantDeliveryProvider(e.target.value as any)}
                  className="w-full px-2 py-1 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[11px]"
                >
                  <option value="pathao">Pathao Parcel / Express</option>
                  <option value="uber">Uber Moto / Courier</option>
                  <option value="other">Other On-Demand Rider</option>
                </select>
              </div>
            )}

            {/* Compact Partial/Full Prepaid Controls */}
            {paymentState === 'prepaid' && (
              <div className="p-2 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-[var(--text)]">Prepaid Amount</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPrepaidAmount(calculatedTotal)}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] font-mono"
                    >
                      Full (৳{calculatedTotal.toLocaleString()})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrepaidAmount(Math.round(calculatedTotal / 2))}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] font-mono"
                    >
                      50%
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="number"
                      min="0"
                      max={calculatedTotal}
                      value={prepaidAmount}
                      onChange={e => setPrepaidAmount(Math.max(0, Number(e.target.value) || 0))}
                      placeholder="Amount (৳)"
                      className="w-full px-2 py-1 font-mono text-[11px] bg-[var(--surface)] border border-[var(--border)] rounded-md"
                    />
                  </div>
                  <div>
                    <select
                      value={advanceMethod}
                      onChange={e => {
                        const m = e.target.value as any;
                        setAdvanceMethod(m);
                        if (m === 'bkash') setAdvanceAccount('acc_bkash');
                        else if (m === 'nagad') setAdvanceAccount('acc_nagad');
                        else if (m === 'cash') setAdvanceAccount('acc_cash');
                        else setAdvanceAccount('acc_bank');
                      }}
                      className="w-full px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[11px]"
                    >
                      <option value="bkash">bKash</option>
                      <option value="nagad">Nagad</option>
                      <option value="cash">Cash</option>
                      <option value="bank">Bank</option>
                      <option value="card">Card</option>
                    </select>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between text-[10px] border-t border-[var(--border)] font-mono text-[var(--text-secondary)]">
                  <span>Paid: ৳{effectivePrepaidAmount.toLocaleString()}</span>
                  <span>
                    {remainingDueAmount > 0 ? (
                      <span className="text-[var(--text)] font-semibold">Due on Delivery: ৳{remainingDueAmount.toLocaleString()}</span>
                    ) : (
                      <span className="text-[var(--status-green)] font-semibold">Paid in Full (৳0 Due)</span>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Order Timing: Compact Segmented Tab */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[10px] font-medium text-[var(--text-secondary)]">Order Timing:</span>
              <div className="inline-flex p-0.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setOrderTiming('today');
                    setScheduledDate('');
                    setTimingReason(null);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer ${
                    orderTiming === 'today' ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs font-semibold' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrderTiming('scheduled');
                    if (!scheduledDate) {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      setScheduledDate(d.toISOString().slice(0, 10));
                    }
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer ${
                    orderTiming === 'scheduled' ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs font-semibold' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  Scheduled
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrderTiming('pre_order');
                    setScheduledDate('');
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer ${
                    orderTiming === 'pre_order' ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs font-semibold' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  Pre-Order
                </button>
              </div>
            </div>

            {orderTiming === 'scheduled' && (
              <div className="p-2 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg space-y-1 text-[11px]">
                <label className="block text-[10px] font-medium text-[var(--text-secondary)]">Dispatch Date</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={e => setScheduledDate(e.target.value)}
                  className="w-full px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[11px]"
                />
              </div>
            )}

            {/* === REVERSIBLE UI EXPERIMENT: Compact + Note Action === */}
            {orderType === 'direct_sale' && (
              <div>
                {!isNoteOpen ? (
                  <div className="flex items-center justify-between text-[11px] py-0.5">
                    <span className="text-[10px] font-medium text-[var(--text-secondary)]">Invoice Note:</span>
                    {invoiceNoteType !== 'none' && invoiceNoteText.trim() ? (
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-[10px] font-medium text-[var(--text-secondary)] bg-[var(--surface-sunken)] px-1.5 py-0.5 rounded border border-[var(--border)] max-w-[130px] truncate"
                          title={invoiceNoteText}
                        >
                          {invoiceNoteType === 'cod' ? 'COD Note' : invoiceNoteType === 'prepaid' ? 'Prepaid Note' : 'Custom Note'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsNoteOpen(true)}
                          className="text-[10px] font-medium text-[var(--accent)] hover:underline cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setInvoiceNoteType('none');
                            setInvoiceNoteText('');
                          }}
                          className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--status-red)] cursor-pointer p-0.5"
                          title="Remove note"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsNoteOpen(true);
                          if (invoiceNoteType === 'none' || !invoiceNoteText.trim()) {
                            const targetType = paymentState === 'prepaid' ? 'prepaid' : 'cod';
                            setInvoiceNoteType(targetType);
                            setInvoiceNoteText(targetType === 'prepaid' ? defaultPrepaidTemplate : defaultCodTemplate);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md border border-[var(--border)] bg-[var(--surface-sunken)] hover:bg-[var(--surface-hover)] text-[var(--text)] cursor-pointer transition-colors"
                        title="Add invoice note for this order"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Note</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-2 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg space-y-1.5 text-[11px] animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-semibold text-[var(--text)]">Invoice Note</label>
                      <div className="flex items-center gap-1.5">
                        <div className="inline-flex p-0.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[10px]">
                          <button
                            type="button"
                            onClick={() => {
                              setInvoiceNoteType('cod');
                              setInvoiceNoteText(defaultCodTemplate);
                            }}
                            className={`px-1.5 py-0.5 rounded cursor-pointer ${
                              invoiceNoteType === 'cod'
                                ? 'bg-[var(--text)] text-[var(--surface)] font-semibold'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                            }`}
                          >
                            COD
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setInvoiceNoteType('prepaid');
                              setInvoiceNoteText(defaultPrepaidTemplate);
                            }}
                            className={`px-1.5 py-0.5 rounded cursor-pointer ${
                              invoiceNoteType === 'prepaid'
                                ? 'bg-[var(--text)] text-[var(--surface)] font-semibold'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                            }`}
                          >
                            Prepaid
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setInvoiceNoteType('none');
                              setInvoiceNoteText('');
                              setIsNoteOpen(false);
                            }}
                            className="px-1.5 py-0.5 rounded cursor-pointer text-[var(--text-secondary)] hover:text-[var(--status-red)]"
                            title="Remove note and close"
                          >
                            None
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsNoteOpen(false)}
                          className="p-0.5 text-[var(--text-secondary)] hover:text-[var(--text)] rounded cursor-pointer"
                          title="Done"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={2}
                      value={invoiceNoteText}
                      onChange={e => {
                        setInvoiceNoteText(e.target.value);
                        if (invoiceNoteType === 'none') {
                          setInvoiceNoteType(paymentState === 'prepaid' ? 'prepaid' : 'cod');
                        }
                      }}
                      placeholder="Write invoice note or select preset above..."
                      className="w-full p-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[10px] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                    <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
                      <span>Printed on customer invoice</span>
                      <button
                        type="button"
                        onClick={() => setIsNoteOpen(false)}
                        className="font-medium text-[var(--accent)] hover:underline cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PREVIOUS UI IMPLEMENTATION (Preserved for clean reversibility if experiment is reverted):
            {orderType === 'direct_sale' && (
              <div className="p-2 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-medium text-[var(--text-secondary)]">Invoice Note</label>
                  <div className="inline-flex p-0.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[10px]">
                    <button
                      type="button"
                      onClick={() => setInvoiceNoteType('cod')}
                      className={`px-1.5 py-0.5 rounded cursor-pointer ${
                        invoiceNoteType === 'cod' ? 'bg-[var(--text)] text-[var(--surface)] font-semibold' : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      COD
                    </button>
                    <button
                      type="button"
                      onClick={() => setInvoiceNoteType('prepaid')}
                      className={`px-1.5 py-0.5 rounded cursor-pointer ${
                        invoiceNoteType === 'prepaid' ? 'bg-[var(--text)] text-[var(--surface)] font-semibold' : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      Prepaid
                    </button>
                    <button
                      type="button"
                      onClick={() => setInvoiceNoteType('none')}
                      className={`px-1.5 py-0.5 rounded cursor-pointer ${
                        invoiceNoteType === 'none' ? 'bg-[var(--text)] text-[var(--surface)] font-semibold' : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      None
                    </button>
                  </div>
                </div>
                {invoiceNoteType !== 'none' && (
                  <textarea
                    rows={2}
                    value={invoiceNoteText}
                    onChange={e => setInvoiceNoteText(e.target.value)}
                    className="w-full p-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[10px] text-[var(--text)]"
                  />
                )}
              </div>
            )}
            */}

            {/* === Internal Packing Note: Compact + Note Action === */}
            <div>
              {!isPackingNoteOpen ? (
                <div className="flex items-center justify-between text-[11px] py-0.5">
                  <span className="text-[10px] font-medium text-[var(--text-secondary)]">Packing Note:</span>
                  {packingNote.trim() ? (
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-[10px] font-medium text-[var(--status-amber)] bg-[color-mix(in_srgb,var(--status-amber)_12%,var(--surface))] px-1.5 py-0.5 rounded border border-[color-mix(in_srgb,var(--status-amber)_30%,transparent)] max-w-[130px] truncate"
                        title={packingNote}
                      >
                        {packingNote}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsPackingNoteOpen(true)}
                        className="text-[10px] font-medium text-[var(--accent)] hover:underline cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPackingNote('');
                        }}
                        className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--status-red)] cursor-pointer p-0.5"
                        title="Remove note"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsPackingNoteOpen(true)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md border border-[var(--border)] bg-[var(--surface-sunken)] hover:bg-[var(--surface-hover)] text-[var(--text)] cursor-pointer transition-colors"
                      title="Add internal packing note for packing team"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Note</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-2 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg space-y-1.5 text-[11px] animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-semibold text-[var(--text)] flex items-center gap-1">
                      <Package className="w-3 h-3 text-[var(--accent)]" />
                      <span>Packing Note</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      {packingNote.trim() && (
                        <button
                          type="button"
                          onClick={() => setPackingNote('')}
                          className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--status-red)] cursor-pointer px-1"
                        >
                          Clear
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsPackingNoteOpen(false)}
                        className="p-0.5 text-[var(--text-secondary)] hover:text-[var(--text)] rounded cursor-pointer"
                        title="Done"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={2}
                    value={packingNote}
                    onChange={e => setPackingNote(e.target.value)}
                    placeholder="Instructions for packing team (e.g. extra bubble wrap, fragile care)..."
                    className="w-full p-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[10px] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                  <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
                    <span className="text-[9px] text-[var(--status-amber)] font-medium">Internal — not on customer invoice</span>
                    <button
                      type="button"
                      onClick={() => setIsPackingNoteOpen(false)}
                      className="font-medium text-[var(--accent)] hover:underline cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Financial Calculations Summary Box */}
            <div className="p-2.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl space-y-1.5 text-[11px]">
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Subtotal ({items.length} items)</span>
                <span className="font-mono tabular-nums text-[var(--text)]">৳{calculatedSubtotal.toLocaleString()}</span>
              </div>

              {selectedTesters.length > 0 && (
                <div className="flex justify-between text-[var(--status-green)] text-[11px]">
                  <span className="flex items-center gap-1">
                    <Gift className="w-3 h-3" />
                    <span>Free Samples ({selectedTesters.reduce((s, t) => s + t.quantity, 0)} vials)</span>
                  </span>
                  <span className="font-mono tabular-nums font-semibold">৳0</span>
                </div>
              )}

              {calculatedItemDiscount > 0 && (
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>Item Discounts</span>
                  <span className="font-mono tabular-nums text-[var(--text)]">-৳{calculatedItemDiscount.toLocaleString()}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-[var(--text-secondary)]">
                <span>Delivery Charge</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[10px]">৳</span>
                  <input
                    type="number"
                    min="0"
                    value={deliveryCharge}
                    onChange={e => setDeliveryCharge(Number(e.target.value) || 0)}
                    disabled={fulfillmentMethod === 'instant_delivery'}
                    className="w-16 px-1.5 py-0.5 text-right font-mono tabular-nums text-[11px] bg-[var(--surface)] border border-[var(--border)] rounded-md"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[var(--text-secondary)]">
                <span>Order Discount</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[10px]">৳</span>
                  <input
                    type="number"
                    min="0"
                    value={orderDiscount}
                    onChange={e => setOrderDiscount(Number(e.target.value) || 0)}
                    className="w-16 px-1.5 py-0.5 text-right font-mono tabular-nums text-[11px] bg-[var(--surface)] border border-[var(--border)] rounded-md"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--border)] flex justify-between items-baseline font-bold text-[13px] text-[var(--text)]">
                <span>Net Total</span>
                <span className="font-mono tabular-nums">৳{calculatedTotal.toLocaleString()}</span>
              </div>

              {paymentState === 'prepaid' && (
                <div className="pt-1 flex justify-between text-[11px] font-mono text-[var(--text-secondary)]">
                  <span>Balance Due (COD)</span>
                  <span className="font-semibold text-[var(--text)]">৳{remainingDueAmount.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Actions: Copy Summary & Confirm Order */}
            <div className="space-y-1.5 pt-1">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopyOrderSummary}
                  disabled={items.length === 0}
                  className="flex-1 py-1.5 px-2 text-[11px] font-medium rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-hover)] disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedSummary ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSummary ? 'Copied' : 'Copy Summary'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={isSubmitting || items.length === 0}
                className="w-full py-2 px-3 text-[12px] font-semibold rounded-lg bg-[var(--text)] text-[var(--surface)] hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
              >
                {isSubmitting ? (
                  <span>Reserving Stock & Creating...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Create Order (৳{calculatedTotal.toLocaleString()})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Order Parser Modal: Practical Large Dialog for Real-World Orders */}
      {isParserModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in overflow-hidden"
          onClick={e => {
            if (e.target === e.currentTarget) {
              setIsParserModalOpen(false);
            }
          }}
        >
          <div
            ref={parserModalRef}
            className="w-[94vw] sm:w-[85vw] md:w-[75vw] lg:w-[68vw] max-w-[1080px] h-[72vh] max-h-[75vh] min-h-[480px] bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 sm:p-5 shadow-2xl flex flex-col animate-in zoom-in-95 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                <h3 className="text-[13px] font-bold text-[var(--text)]">Order Parser</h3>
                <span className="text-[11px] text-[var(--text-secondary)] font-normal hidden sm:inline">
                  · Paste Messenger, WhatsApp, or Facebook order text
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsParserModalOpen(false)}
                className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Instruction */}
            <div className="py-2 shrink-0">
              <p className="text-[11px] text-[var(--text-secondary)]">
                Paste customer order text from Messenger, Facebook, or WhatsApp. The parser will extract name, phone, address, items, and totals.
              </p>
            </div>

            {/* Substantially Expanded Textarea Area with Internal Scrolling */}
            <div className="flex-1 min-h-0 flex flex-col relative my-1">
              <textarea
                ref={parserTextareaRef}
                value={parserRawText}
                onChange={e => setParserRawText(e.target.value)}
                placeholder="e.g.&#10;Confirm: 9&#10;Arif Islam&#10;01999033027&#10;House 47, Road 27, Opposite of Banani Graveyard main gate.&#10;Building Name: Millennium Castle, lift-4, Banani, Dhaka&#10;&#10;karus gold - 2750 taka&#10;Dunescape - 3400 taka&#10;Delivery charge - 70 taka&#10;Total - 6220 taka"
                className="w-full flex-1 min-h-0 p-3 font-mono text-[12px] leading-relaxed text-[var(--text)] bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg focus:ring-1 focus:ring-[var(--accent)] focus:outline-hidden resize-none overflow-y-auto"
                onKeyDown={e => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleExecuteParser();
                  } else if (e.key === 'Escape') {
                    setIsParserModalOpen(false);
                  }
                }}
              />
            </div>

            {/* Error notice */}
            {parserError && (
              <div className="mt-2 p-2 bg-[var(--surface-sunken)] border border-[var(--status-red)] rounded-lg text-[11px] text-[var(--status-red)] flex items-start gap-1.5 shrink-0">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{parserError}</span>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--border)] mt-2 shrink-0">
              <span className="text-[10px] text-[var(--text-secondary)] font-mono">Press Ctrl+Enter to parse</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setParserRawText('');
                    setParserError(null);
                    parserTextareaRef.current?.focus();
                  }}
                  className="px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] rounded-lg cursor-pointer transition-colors"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setIsParserModalOpen(false)}
                  className="px-3 py-1.5 text-[11px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteParser}
                  disabled={!parserRawText.trim() || isParsing}
                  className="px-4 py-1.5 text-[11px] font-semibold rounded-lg bg-[var(--text)] text-[var(--surface)] hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-2xs transition-opacity"
                >
                  {isParsing ? (
                    <span>Extracting...</span>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 text-[var(--accent)]" />
                      <span>Extract & Apply</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Free Tester / Sample Vial Selection Modal */}
      {isTesterModalOpen && (
        <Modal
          open={isTesterModalOpen}
          onClose={() => {
            setIsTesterModalOpen(false);
            setTesterSearch('');
          }}
          title={
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-[var(--status-green)]" />
              <span>Add Free Tester / Sample</span>
            </div>
          }
          subtitle="Search and select fragrance for complimentary sample vial (৳0 — no scan required)"
          size="md"
        >
          <div className="p-4 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={testerSearchInputRef}
                type="text"
                value={testerSearch}
                onChange={e => setTesterSearch(e.target.value)}
                placeholder="Search tester by fragrance name, brand, SKU or barcode..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder:text-[var(--text-secondary)] focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)]"
                autoFocus
              />
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-[var(--border)] border border-[var(--border)] rounded-lg bg-[var(--surface)]">
              {matchingTesterProducts.length === 0 ? (
                <div className="p-4 text-center text-xs text-[var(--text-secondary)]">
                  {testerSearch.trim() ? `No products found matching "${testerSearch}"` : 'No fragrances available in catalog.'}
                </div>
              ) : (
                matchingTesterProducts.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleAddTester(t)}
                    className="w-full text-left p-2.5 hover:bg-[var(--surface-hover)] flex items-center justify-between text-xs cursor-pointer transition-colors"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="font-bold text-[var(--text)] truncate">{t.name}</div>
                      <div className="text-[10px] text-[var(--text-secondary)] flex items-center gap-2 mt-0.5 font-mono">
                        {t.sku && <span>SKU: {t.sku}</span>}
                        {t.brand && <span>· Brand: {t.brand}</span>}
                      </div>
                    </div>
                    <span className="shrink-0 px-2 py-1 text-[10px] font-bold rounded bg-[color-mix(in_srgb,var(--status-green)_15%,var(--surface))] text-[var(--status-green)] border border-[color-mix(in_srgb,var(--status-green)_30%,transparent)]">
                      + Add Tester
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="flex justify-between items-center text-[11px] text-[var(--text-secondary)] pt-1">
              <span>Free tester vials have ৳0 selling price and do not affect order total</span>
              <button
                type="button"
                onClick={() => {
                  setIsTesterModalOpen(false);
                  setTesterSearch('');
                }}
                className="px-3 py-1 text-xs font-semibold rounded-md border border-[var(--border)] bg-[var(--surface-sunken)] hover:bg-[var(--surface-hover)] text-[var(--text)] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Invoice Modal for Direct Sale Orders */}
      {showInvoiceModal && successOrder && (
        <InvoiceModal order={successOrder} isOpen={showInvoiceModal} onClose={() => setShowInvoiceModal(false)} />
      )}

      {/* Merchant Sticker Modal for Dropship Orders */}
      {showStickerModal && successOrder && (
        <MerchantStickerModal order={successOrder} isOpen={showStickerModal} onClose={() => setShowStickerModal(false)} />
      )}
    </div>
  );
};
