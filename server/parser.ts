import { db } from './db';
import { Product } from '../src/types';
import { GoogleGenAI } from '@google/genai';

export interface ParsedItemCandidate {
  raw_line: string;
  raw_product_name?: string;
  matched_product_id?: string;
  matched_product?: Product;
  product_name: string;
  stated_amount: number;
  unit_price: number;
  quantity: number;
  confidence: 'high' | 'medium' | 'unmatched' | 'ambiguous';
  candidates?: { id: string; name: string; price: number }[];
}

export interface ParseResult {
  customer_name: string;
  phone: string;
  address: string;
  delivery_charge: number;
  stated_total: number;
  calculated_total: number;
  items: ParsedItemCandidate[];
  total_mismatch: boolean;
  total_mismatch_message?: string;
  raw_text: string;
  parser_used: 'rule_based' | 'gemini_ai';
  fulfillment_method?: 'steadfast' | 'instant_delivery' | 'in_house' | 'self_pickup';
  instant_delivery_provider?: 'pathao' | 'uber' | 'other';
  order_type?: 'direct_sale' | 'merchant_fulfillment';
  merchant_name?: string;
  merchant_id?: string;
  parcel_id?: string;
  end_customer_name?: string;
  order_timing?: 'today' | 'scheduled' | 'pre_order';
  scheduled_date?: string;
  timing_reason?: string;
}

export function detectOrderTiming(
  rawText: string,
  _items?: ParsedItemCandidate[]
): {
  order_timing: 'today' | 'scheduled' | 'pre_order';
  scheduled_date?: string;
  timing_reason?: string;
} {
  const lower = rawText.toLowerCase();

  // 1. Explicit Pre-order keywords in text (e.g. "preorder", "advance booking")
  const preOrderKeywords = [
    'preorder',
    'pre-order',
    'pre order',
    'advance booking',
    'booking only',
    'pre-booking',
    'pre booking',
  ];
  for (const kw of preOrderKeywords) {
    if (new RegExp(`\\b${kw.replace('-', '[- ]?')}\\b`, 'i').test(lower)) {
      return {
        order_timing: 'pre_order',
        timing_reason: `Detected pre-order keyword "${kw}" in message`,
      };
    }
  }

  // 2. Scheduled delivery patterns:
  // e.g. "deliver on 2026-03-25", "deliver date: 25/03/2026", "deliver on Sunday", "deliver tomorrow"
  const dateRegex = /\b(?:deliver(?:y)?|send|ship(?:ment)?|schedule(?:d)?|date)\s*(?:on|date|at|for)?\s*[-:=]?\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\b(?:tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b)/i;
  const dateMatch = rawText.match(dateRegex);

  if (dateMatch) {
    const rawDateStr = dateMatch[1].toLowerCase().trim();
    let detectedIsoDate: string | undefined;

    if (rawDateStr === 'tomorrow') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      detectedIsoDate = d.toISOString().split('T')[0];
    } else if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(rawDateStr)) {
      detectedIsoDate = rawDateStr.replace(/\//g, '-');
    } else if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(rawDateStr)) {
      const [d, m, y] = rawDateStr.split(/[-/]/);
      detectedIsoDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    if (detectedIsoDate) {
      return {
        order_timing: 'scheduled',
        scheduled_date: detectedIsoDate,
        timing_reason: `Customer requested scheduled delivery for ${detectedIsoDate}`,
      };
    }
  }

  if (/\b(?:scheduled|future\s*delivery|later\s*date)\b/i.test(lower)) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    return {
      order_timing: 'scheduled',
      scheduled_date: tomorrowStr,
      timing_reason: 'Detected request for scheduled delivery',
    };
  }

  // 4. Default is strictly 'today'
  return {
    order_timing: 'today',
  };
}

function normalizeStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function calculateFuzzyScore(target: string, query: string): number {
  const normTarget = normalizeStr(target);
  const normQuery = normalizeStr(query);

  if (normTarget === normQuery) return 100;
  if (normTarget.includes(normQuery)) return 85;

  const stopWords = new Set(['in', 'the', 'of', 'and', 'for', 'with']);
  const queryWords = normQuery.split(' ').filter(w => w.length > 1 && !stopWords.has(w));
  const targetWords = normTarget.split(' ').filter(w => w.length > 1 && !stopWords.has(w));

  if (queryWords.length === 0) return 0;

  let matchedWords = 0;
  for (const qw of queryWords) {
    if (targetWords.some(tw => tw.includes(qw) || qw.includes(tw))) {
      matchedWords++;
    }
  }

  return (matchedWords / queryWords.length) * 70;
}

function productAcronyms(product: Product): string[] {
  const aliases = new Set<string>();
  const sourceNames = [product.name, product.display_name];
  for (const source of sourceNames) {
    const parentheticalAliases = source.match(/\(([a-z0-9]+)\)/gi) || [];
    for (const alias of parentheticalAliases) aliases.add(normalizeStr(alias.slice(1, -1)));
    const baseSource = source.replace(/\([^)]*\)/g, ' ');
    const words = baseSource.match(/[a-z0-9]+/gi) || [];
    const initials = words.map(word => word[0]).join('').toLowerCase();
    if (initials.length >= 3) aliases.add(initials);
  }
  return Array.from(aliases);
}

function calculateAcronymScore(product: Product, query: string): number {
  const queryWords = normalizeStr(query).split(' ');
  const aliases = productAcronyms(product);
  const aliasMatch = aliases.some(alias => queryWords.includes(alias));
  if (!aliasMatch) return 0;
  const concentration = normalizeStr(product.concentration);
  return queryWords.includes(concentration) ? 100 : 88;
}

export function matchProduct(rawText: string, statedAmount: number): {
  matched_product?: Product;
  confidence: 'high' | 'medium' | 'unmatched' | 'ambiguous';
  candidates: { id: string; name: string; price: number }[];
  quantity: number;
  unit_price: number;
} {
  const allProds = Array.from(db.products.values()).filter(p => p.active);
  const scored: { prod: Product; score: number }[] = [];

  for (const p of allProds) {
    const nameScore = calculateFuzzyScore(p.name, rawText);
    const brandNameScore = calculateFuzzyScore(`${p.brand} ${p.name}`, rawText);
    const displayScore = calculateFuzzyScore(p.display_name, rawText);
    const skuScore = normalizeStr(p.sku) === normalizeStr(rawText) ? 95 : 0;
    const acronymScore = calculateAcronymScore(p, rawText);
    const maxScore = Math.max(nameScore, brandNameScore, displayScore, skuScore, acronymScore);

    if (maxScore > 35) {
      scored.push({ prod: p, score: maxScore });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      confidence: 'unmatched',
      candidates: [],
      quantity: 1,
      unit_price: statedAmount > 0 ? statedAmount : 0,
    };
  }

  const top = scored[0];
  const candidates = scored.slice(0, 4).map(s => ({
    id: s.prod.id,
    name: s.prod.display_name,
    price: s.prod.selling_price,
  }));

  const requestedSize = normalizeStr(rawText).match(/\b\d+\s*ml\b/)?.[0].replace(/\s+/g, '');
  const topSize = normalizeStr(top.prod.size_variant).replace(/\s+/g, '');
  if (requestedSize && topSize && requestedSize !== topSize) {
    return {
      matched_product: top.prod,
      confidence: 'ambiguous',
      candidates,
      quantity: 1,
      unit_price: top.prod.selling_price,
    };
  }

  if (scored.length > 1 && scored[1].score > 60 && Math.abs(scored[0].score - scored[1].score) < 10) {
    return {
      matched_product: top.prod,
      confidence: 'ambiguous',
      candidates,
      quantity: 1,
      unit_price: top.prod.selling_price,
    };
  }

  // Derive quantity from stated amount if amount is clean multiple
  let quantity = 1;
  const unitPrice = top.prod.selling_price;
  if (statedAmount > 0 && unitPrice > 0) {
    if (statedAmount % unitPrice === 0) {
      quantity = Math.max(1, Math.round(statedAmount / unitPrice));
    } else {
      return {
        matched_product: top.prod,
        confidence: 'ambiguous',
        candidates,
        quantity: 1,
        unit_price: unitPrice,
      };
    }
  }

  return {
    matched_product: top.prod,
    confidence: top.score >= 70 ? 'high' : 'medium',
    candidates,
    quantity,
    unit_price: unitPrice,
  };
}

function extractQuantityProductLine(line: string): { rawProd: string; quantity: number } | null {
  const prefixQuantity = line.match(/^\s*(\d+)\s*[xX]\s+(.+?)\s*$/);
  if (prefixQuantity) {
    return { rawProd: prefixQuantity[2].trim(), quantity: Number(prefixQuantity[1]) };
  }

  const suffixQuantity = line.match(/^(.+?)\s+(\d+)\s*(?:pcs?|pieces?|units?|bottles?)\s*$/i);
  if (suffixQuantity) {
    return { rawProd: suffixQuantity[1].trim(), quantity: Number(suffixQuantity[2]) };
  }

  return null;
}

export async function parseMessengerOrder(rawText: string): Promise<ParseResult> {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  let orderType: 'direct_sale' | 'merchant_fulfillment' = 'direct_sale';
  let merchantName: string | undefined = undefined;
  let merchantId: string | undefined = undefined;
  let parcelId: string | undefined = undefined;
  let endCustomerName: string | undefined = undefined;
  let fulfillmentMethod: 'steadfast' | 'instant_delivery' | 'in_house' | 'self_pickup' = 'steadfast';
  let instantDeliveryProvider: 'pathao' | 'uber' | 'other' | undefined;

  if (/\binstant\s*delivery\b|\bpathao\b|\buber\b/i.test(rawText)) {
    fulfillmentMethod = 'instant_delivery';
    instantDeliveryProvider = /\bpathao\b/i.test(rawText) ? 'pathao' : /\buber\b/i.test(rawText) ? 'uber' : 'other';
  } else if (/\bself\s*pickup\b|\bshop\s*pickup\b/i.test(rawText)) {
    fulfillmentMethod = 'self_pickup';
  } else if (/\bin[- ]?house\s*(?:delivery|staff)?\b/i.test(rawText)) {
    fulfillmentMethod = 'in_house';
  }

  let customerName = '';
  let phone = '';
  const addressParts: string[] = [];
  let deliveryCharge = 70; // default inside Dhaka
  let statedTotal = 0;
  const parsedItemLines: { line: string; rawProd: string; amount: number; quantity?: number }[] = [];

  // Regex patterns
  const phoneRegex = /(?:\+?880|0)1[3-9]\d{8}/;
  const deliveryRegex = /(?:deliv(?:e|a)ry|charge|delivery\s*charge|dc)\s*[-:]?\s*(\d+)/i;
  const totalRegex = /(?:total|grand\s*total|sum)\s*[-:]?\s*(\d+)/i;

  let phoneFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check Dropship / Merchant Fulfillment indicator line
    if (/^(?:merchant\s*fulfillment|dropship(?:\s*order)?|reseller\s*order)$/i.test(line)) {
      orderType = 'merchant_fulfillment';
      continue;
    }

    // Check Merchant / Company Name
    const merchantNameMatch = line.match(/^(?:merchant(?:\s*name|\s*company)?|reseller(?:\s*name)?|company)\s*[-:=]\s*(.+)$/i);
    if (merchantNameMatch) {
      merchantName = merchantNameMatch[1].trim();
      orderType = 'merchant_fulfillment';
      continue;
    }

    // Check Merchant ID
    const merchantIdMatch = line.match(/^(?:merchant\s*id|mid|reseller\s*id|merchant\s*code)\s*[-:=#]?\s*([a-zA-Z0-9_-]+)/i);
    if (merchantIdMatch) {
      merchantId = merchantIdMatch[1].trim();
      orderType = 'merchant_fulfillment';
      continue;
    }

    // Check Parcel ID
    const parcelIdMatch = line.match(/^(?:(?:merchant\s*|dropship\s*)?parcel(?:\s*id|\s*#|\s*code|\s*no)?)\s*[-:=#]?\s*([a-zA-Z0-9_-]+)/i);
    if (parcelIdMatch) {
      parcelId = parcelIdMatch[1].trim();
      orderType = 'merchant_fulfillment';
      continue;
    }

    // Check End Customer Name
    const endCustomerMatch = line.match(/^(?:end\s*customer(?:\s*name)?|end\s*user(?:\s*name)?|recipient(?:\s*name)?)\s*[-:=]\s*(.+)$/i);
    if (endCustomerMatch) {
      endCustomerName = endCustomerMatch[1].trim();
      customerName = endCustomerName;
      orderType = 'merchant_fulfillment';
      continue;
    }

    // Check delivery charge
    const delivMatch = line.match(deliveryRegex);
    if (delivMatch) {
      deliveryCharge = parseInt(delivMatch[1], 10);
      continue;
    }

    // Check total
    const totalMatch = line.match(totalRegex);
    if (totalMatch) {
      statedTotal = parseInt(totalMatch[1], 10);
      continue;
    }

    // Check phone
    const phoneMatch = line.match(phoneRegex);
    if (phoneMatch && !phoneFound) {
      phone = phoneMatch[0];
      phoneFound = true;
      continue;
    }

    // Check if line is "Confirm: X" or headers
    if (/^confirm\s*:\s*\d+/i.test(line) || /^order\s*#?\d+/i.test(line)) {
      continue;
    }

    // Check product line with amount e.g. "karus gold-2750 taka" or "Dunescape: 3400"
    const prodLineMatch = line.match(/^([a-zA-Z0-9\s\.\,\'\(\)\-]+?)\s*[-:=]\s*(\d+)\s*(?:taka|tk|bdt)?$/i);
    if (prodLineMatch) {
      const pName = prodLineMatch[1].trim();
      const amt = parseInt(prodLineMatch[2], 10);
      if (pName && amt > 100) {
        parsedItemLines.push({ line, rawProd: pName, amount: amt });
        continue;
      }
    }

    // Quantity-style Messenger lines, e.g. "CDNIM EDP 100ML 1 pcs"
    // or "2x CDNIM EDT". The catalog matcher remains authoritative for the
    // product assignment; this only extracts the product text and quantity.
    const quantityLine = extractQuantityProductLine(line);
    if (quantityLine && quantityLine.rawProd) {
      parsedItemLines.push({ line, rawProd: quantityLine.rawProd, amount: 0, quantity: quantityLine.quantity });
      continue;
    }

    // Some confirmations contain only a catalog-recognizable product line,
    // such as "CDNIM EDP", without price or an explicit quantity. Preserve it
    // as one unit when the existing catalog matcher is confident; unknown
    // lines continue through the normal customer/address fallback.
    if (/[a-z]/i.test(line) && !/\d{4,}/.test(line)) {
      const catalogMatch = matchProduct(line, 0);
      if (catalogMatch.confidence === 'high' || catalogMatch.confidence === 'ambiguous') {
        parsedItemLines.push({ line, rawProd: line, amount: 0 });
        continue;
      }
    }

    // Otherwise before phone is name, after phone is address
    if (!phoneFound && !customerName && line.length < 50 && !/\d{4,}/.test(line)) {
      customerName = line.replace(/^(name|customer)\s*[-:]\s*/i, '').trim();
    } else if (phoneFound && !line.toLowerCase().includes('total') && !line.toLowerCase().includes('charge')) {
      addressParts.push(line);
    }
  }

  // Cross check dropship keywords in entire text
  if (/\b(?:dropship|merchant fulfillment|reseller order)\b/i.test(rawText)) {
    orderType = 'merchant_fulfillment';
  }
  if (merchantName || merchantId || parcelId || endCustomerName) {
    orderType = 'merchant_fulfillment';
  }
  if (orderType === 'merchant_fulfillment') {
    if (!endCustomerName && customerName) {
      endCustomerName = customerName;
    }
    if (!customerName && endCustomerName) {
      customerName = endCustomerName;
    }
  }

  // If rule-based extracted at least phone or items or merchant info, assemble
  if (phone || parsedItemLines.length > 0 || merchantName || merchantId || parcelId) {
    const items: ParsedItemCandidate[] = parsedItemLines.map(pl => {
      const match = matchProduct(pl.rawProd, pl.amount);
      return {
        raw_line: pl.line,
        raw_product_name: pl.rawProd,
        matched_product_id: match.matched_product?.id,
        matched_product: match.matched_product,
        product_name: match.matched_product ? match.matched_product.display_name : pl.rawProd,
        stated_amount: pl.amount,
        unit_price: match.unit_price,
        quantity: pl.quantity ?? match.quantity,
        confidence: match.confidence,
        candidates: match.candidates,
      };
    });

    const itemSubtotal = items.reduce((sum, it) => sum + (it.unit_price * it.quantity), 0);
    const calculatedTotal = itemSubtotal + (fulfillmentMethod === 'instant_delivery' ? 0 : deliveryCharge);

    const totalMismatch = statedTotal > 0 && calculatedTotal !== statedTotal;
    const totalMismatchMessage = totalMismatch
      ? `Total amount does not match the calculated amount — expected ৳${calculatedTotal}, message states ৳${statedTotal}.`
      : undefined;

    const timing = detectOrderTiming(rawText, items);

    return {
      customer_name: customerName || endCustomerName || 'Valued Customer',
      phone: phone || '',
      address: addressParts.join(', ') || '',
      delivery_charge: deliveryCharge,
      stated_total: statedTotal || calculatedTotal,
      calculated_total: calculatedTotal,
      items,
      total_mismatch: totalMismatch,
      total_mismatch_message: totalMismatchMessage,
      raw_text: rawText,
      parser_used: 'rule_based',
      fulfillment_method: fulfillmentMethod,
      instant_delivery_provider: instantDeliveryProvider,
      order_type: orderType,
      merchant_name: merchantName,
      merchant_id: merchantId,
      parcel_id: parcelId,
      end_customer_name: endCustomerName,
      order_timing: timing.order_timing,
      scheduled_date: timing.scheduled_date,
      timing_reason: timing.timing_reason,
    };
  }

  // Fallback to Gemini Free Tier (Section 3, 30)
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `You are an order parser for a perfume store in Bangladesh.
Extract the customer order from this Messenger text into strict JSON format:
{
  "order_type": "direct_sale" or "merchant_fulfillment",
  "merchant_name": "string or null",
  "merchant_id": "string or null",
  "parcel_id": "string or null",
  "end_customer_name": "string or null",
  "customer_name": "string",
  "phone": "string",
  "address": "string",
  "delivery_charge": number,
  "fulfillment_method": "steadfast" or "instant_delivery" or "in_house" or "self_pickup",
  "instant_delivery_provider": "pathao" or "uber" or "other" or null,
  "order_timing": "today" or "scheduled" or "pre_order",
  "scheduled_date": "YYYY-MM-DD or null",
  "timing_reason": "string or null",
  "stated_total": number,
  "items": [
    { "raw_name": "string", "stated_amount": number, "quantity": number }
  ]
}

Instructions:
- If this order is from an external reseller/merchant or dropship (contains merchant name, merchant ID, parcel ID, or dropship markers), set order_type to "merchant_fulfillment".
- For merchant fulfillment orders, extract merchant_name, merchant_id, parcel_id, and end_customer_name when identifiable.
- NEVER invent missing information. If any optional field is absent, set it to null. Partial information is normal.
- If it is a normal retail sale, set order_type to "direct_sale".
- Detect Instant Delivery, Pathao, or Uber wording as fulfillment_method "instant_delivery" and identify the provider when present. Detect self-pickup or in-house delivery when explicitly stated. Otherwise use "steadfast".
- Order Timing: Default to "today". If customer requests delivery on a future date/time, set order_timing to "scheduled" and provide "scheduled_date" (in YYYY-MM-DD format). If the message indicates a pre-order, advance booking, or awaiting stock arrival, set order_timing to "pre_order".

Text to parse:
"""
${rawText}
"""
Respond with raw JSON only.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const responseText = response.text || '';
      const cleanJson = responseText.replace(/```(?:json)?/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      const items: ParsedItemCandidate[] = (parsed.items || []).map((it: any) => {
        const match = matchProduct(it.raw_name, it.stated_amount || 0);
        return {
          raw_line: `${it.raw_name} - ${it.stated_amount || ''}`,
          raw_product_name: it.raw_name,
          matched_product_id: match.matched_product?.id,
          matched_product: match.matched_product,
          product_name: match.matched_product ? match.matched_product.display_name : it.raw_name,
          stated_amount: it.stated_amount || match.unit_price,
          unit_price: match.unit_price,
          quantity: it.quantity || match.quantity,
          confidence: match.confidence,
          candidates: match.candidates,
        };
      });

      const aiOrderType = (parsed.order_type === 'merchant_fulfillment' || parsed.merchant_name || parsed.merchant_id || parsed.parcel_id)
        ? 'merchant_fulfillment'
        : 'direct_sale';
      const aiMerchantName = parsed.merchant_name ? String(parsed.merchant_name).trim() : undefined;
      const aiMerchantId = parsed.merchant_id ? String(parsed.merchant_id).trim() : undefined;
      const aiParcelId = parsed.parcel_id ? String(parsed.parcel_id).trim() : undefined;
      const aiEndCustName = parsed.end_customer_name ? String(parsed.end_customer_name).trim() : undefined;
      const aiFulfillmentMethod = parsed.fulfillment_method || (
        /\binstant\s*delivery\b|\bpathao\b|\buber\b/i.test(rawText) ? 'instant_delivery' :
        /\bself\s*pickup\b|\bshop\s*pickup\b/i.test(rawText) ? 'self_pickup' :
        /\bin[- ]?house\s*(?:delivery|staff)?\b/i.test(rawText) ? 'in_house' : 'steadfast'
      );
      const aiProvider = parsed.instant_delivery_provider || (
        /\bpathao\b/i.test(rawText) ? 'pathao' : /\buber\b/i.test(rawText) ? 'uber' : undefined
      );
      const delivCharge = parsed.delivery_charge !== undefined ? parsed.delivery_charge : 70;
      const itemSubtotal = items.reduce((sum, it) => sum + (it.unit_price * it.quantity), 0);
      const calculatedTotal = itemSubtotal + (aiFulfillmentMethod === 'instant_delivery' ? 0 : delivCharge);
      const statedTot = parsed.stated_total || calculatedTotal;
      const totalMismatch = statedTot > 0 && calculatedTotal !== statedTot;

      const ruleTiming = detectOrderTiming(rawText, items);
      const aiTiming = (parsed.order_timing === 'scheduled' || parsed.order_timing === 'pre_order' || parsed.order_timing === 'today')
        ? parsed.order_timing
        : undefined;
      const finalTiming = aiTiming || ruleTiming.order_timing;
      const finalScheduledDate = parsed.scheduled_date || ruleTiming.scheduled_date;
      const finalTimingReason = parsed.timing_reason || ruleTiming.timing_reason;

      return {
        customer_name: parsed.customer_name || aiEndCustName || 'Valued Customer',
        phone: parsed.phone || '',
        address: parsed.address || '',
        delivery_charge: delivCharge,
        stated_total: statedTot,
        calculated_total: calculatedTotal,
        items,
        total_mismatch: totalMismatch,
        total_mismatch_message: totalMismatch
          ? `Total amount does not match the calculated amount — expected ৳${calculatedTotal}, message states ৳${statedTot}.`
          : undefined,
        raw_text: rawText,
        parser_used: 'gemini_ai',
        fulfillment_method: aiFulfillmentMethod,
        instant_delivery_provider: aiProvider,
        order_type: aiOrderType,
        merchant_name: aiMerchantName,
        merchant_id: aiMerchantId,
        parcel_id: aiParcelId,
        end_customer_name: aiEndCustName,
        order_timing: finalTiming,
        scheduled_date: finalScheduledDate,
        timing_reason: finalTimingReason,
      };
    } catch (err) {
      console.warn('Gemini fallback parser error, returning manual draft:', err);
    }
  }

  // Raw manual entry fallback
  return {
    customer_name: customerName || endCustomerName || '',
    phone: '',
    address: '',
    delivery_charge: 70,
    stated_total: 0,
    calculated_total: 0,
    items: [],
    total_mismatch: false,
    raw_text: rawText,
    parser_used: 'rule_based',
    fulfillment_method: fulfillmentMethod,
    instant_delivery_provider: instantDeliveryProvider,
    order_type: orderType,
    merchant_name: merchantName,
    merchant_id: merchantId,
    parcel_id: parcelId,
    end_customer_name: endCustomerName,
    order_timing: 'today',
  };
}
