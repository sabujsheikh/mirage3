export interface TesterItem {
  id: string;
  name: string;
  sku: string;
  brand: string;
  initialStock: number;
  lastStockReceivedDate: string;
  lastStockReceivedQty: number;
  linkedProductId?: string;
}

export const OFFICIAL_TESTERS: TesterItem[] = [
  {
    id: 'tester-amber-oud-gold',
    name: 'Al Haramain Amber Oud Gold Edition',
    sku: 'TST-AOG',
    brand: 'Al Haramain',
    initialStock: 25,
    lastStockReceivedDate: '2026-09-20',
    lastStockReceivedQty: 30,
  },
  {
    id: 'tester-laventure',
    name: "Al Haramain L'Aventure",
    sku: 'TST-LAV',
    brand: 'Al Haramain',
    initialStock: 18,
    lastStockReceivedDate: '2026-09-18',
    lastStockReceivedQty: 25,
  },
  {
    id: 'tester-marwa',
    name: 'Al Haramain Marwa',
    sku: 'TST-MRW',
    brand: 'Al Haramain',
    initialStock: 12,
    lastStockReceivedDate: '2026-09-15',
    lastStockReceivedQty: 20,
  },
];
