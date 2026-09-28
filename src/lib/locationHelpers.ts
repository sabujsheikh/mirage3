import { Product } from '../types';

export interface ParsedLocation {
  rack: string;
  shelf: string;
  formatted: string;
  isAssigned: boolean;
}

/**
 * Normalizes and parses a location string into structured Rack & Shelf.
 * Examples handled:
 * - "Rack A / Shelf 2" -> Rack "Rack A", Shelf "Shelf 2"
 * - "A-03" -> Rack "Rack A", Shelf "Shelf 3"
 * - "B-1" -> Rack "Rack B", Shelf "Shelf 1"
 * - "R1-S2" -> Rack "Rack 1", Shelf "Shelf 2"
 * - "Shelf 4" -> Rack "General", Shelf "Shelf 4"
 * - "" / undefined -> Unassigned
 */
export function parseLocation(rawLoc?: string): ParsedLocation {
  if (!rawLoc || !rawLoc.trim()) {
    return {
      rack: 'Unassigned',
      shelf: 'Unassigned',
      formatted: 'Unassigned',
      isAssigned: false,
    };
  }

  const trimmed = rawLoc.trim();

  // Pattern: "Rack X / Shelf Y" or "Rack X, Shelf Y" or "Rack X - Shelf Y"
  const rackShelfMatch = trimmed.match(/^Rack\s*([A-Za-z0-9_-]+)[\s/,-]+Shelf\s*([A-Za-z0-9_-]+)$/i);
  if (rackShelfMatch) {
    const r = rackShelfMatch[1].toUpperCase();
    const s = rackShelfMatch[2];
    return {
      rack: `Rack ${r}`,
      shelf: `Shelf ${s}`,
      formatted: `Rack ${r} / Shelf ${s}`,
      isAssigned: true,
    };
  }

  // Pattern: "A-03" or "B-1" or "R1-S2"
  const hyphenMatch = trimmed.match(/^([A-Za-z0-9]+)-([A-Za-z0-9]+)$/);
  if (hyphenMatch) {
    const part1 = hyphenMatch[1].toUpperCase();
    const part2 = hyphenMatch[2];
    
    // Check if it's R1-S2 format
    if (part1.startsWith('R') && part2.startsWith('S')) {
      const r = part1.slice(1);
      const s = part2.slice(1);
      return {
        rack: `Rack ${r}`,
        shelf: `Shelf ${s}`,
        formatted: `Rack ${r} / Shelf ${s}`,
        isAssigned: true,
      };
    }

    // Default "A-03" -> Rack A, Shelf 3
    const shelfNum = parseInt(part2, 10);
    const shelfLabel = !isNaN(shelfNum) ? `Shelf ${shelfNum}` : `Shelf ${part2}`;
    const rackLabel = part1.length === 1 ? `Rack ${part1}` : part1.startsWith('RACK') ? part1 : `Rack ${part1}`;
    return {
      rack: rackLabel,
      shelf: shelfLabel,
      formatted: `${rackLabel} / ${shelfLabel}`,
      isAssigned: true,
    };
  }

  // Single word or non-standard format (e.g. "Rack A", "Zone 1", "Display")
  if (trimmed.toLowerCase().startsWith('rack')) {
    return {
      rack: trimmed,
      shelf: 'Shelf 1',
      formatted: `${trimmed} / Shelf 1`,
      isAssigned: true,
    };
  }

  return {
    rack: trimmed,
    shelf: 'General',
    formatted: trimmed,
    isAssigned: true,
  };
}

export function formatLocation(rack: string, shelf: string): string {
  const cleanRack = rack.trim();
  const cleanShelf = shelf.trim();

  if (!cleanRack || cleanRack.toLowerCase() === 'unassigned') {
    return '';
  }

  const r = cleanRack.toLowerCase().startsWith('rack') ? cleanRack : `Rack ${cleanRack}`;
  const s = cleanShelf && cleanShelf.toLowerCase() !== 'unassigned' && cleanShelf.toLowerCase() !== 'general'
    ? (cleanShelf.toLowerCase().startsWith('shelf') ? cleanShelf : `Shelf ${cleanShelf}`)
    : 'Shelf 1';

  return `${r} / ${s}`;
}

export function getProductLocation(product: Product, warehouseId: string): string | undefined {
  if (warehouseId === 'wh_shop') {
    return product.location_shop;
  }
  if (warehouseId === 'wh_main') {
    return product.location_main;
  }
  return undefined;
}
