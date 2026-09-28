import React from 'react';
import {
  Clock,
  PlusCircle,
  Store,
  Package,
  Menu,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

export const MobileBottomNav: React.FC = () => {
  const { activePath, setActivePath, toggleSidebar, orders } = useApp();
  const { tier } = useAuth();

  // Active counts
  const pendingPacking = orders.filter(o => o.status === 'confirmed').length;
  const activeToday = orders.filter(
    o => o.status === 'confirmed' || o.status === 'packed' || o.status === 'dispatched'
  ).length;

  const isPackingStaff = tier === 4;

  return (
    <nav
      id="mobile-bottom-nav"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface)] border-t border-[var(--border)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-2 py-1 flex items-center justify-around select-none safe-area-pb"
      aria-label="Mobile Bottom Navigation"
    >
      {/* 1. Today's Queue */}
      <button
        type="button"
        onClick={() => setActivePath('/orders/today')}
        className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors cursor-pointer min-w-[56px] ${
          activePath === '/orders/today'
            ? 'text-[var(--accent)] font-bold'
            : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
        }`}
      >
        <div className="relative">
          <Clock className="w-5 h-5" />
          {activeToday > 0 && (
            <span className="absolute -top-1 -right-2 min-w-[15px] h-[15px] px-1 bg-[var(--accent-secondary)] text-white text-[9px] font-bold rounded-full flex items-center justify-center font-mono">
              {activeToday > 99 ? '99+' : activeToday}
            </span>
          )}
        </div>
        <span className="text-[10px] mt-0.5 leading-tight">Today</span>
      </button>

      {/* 2. New Order (Messenger AI) */}
      <button
        type="button"
        onClick={() => setActivePath('/orders/new')}
        className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors cursor-pointer min-w-[56px] ${
          activePath === '/orders/new'
            ? 'text-[var(--accent)] font-bold'
            : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
        }`}
      >
        <div className="relative">
          <PlusCircle className="w-5 h-5" />
        </div>
        <span className="text-[10px] mt-0.5 leading-tight">New Order</span>
      </button>

      {/* 3. Walk-in POS */}
      <button
        type="button"
        onClick={() => setActivePath('/orders/walk-in')}
        className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors cursor-pointer min-w-[56px] ${
          activePath === '/orders/walk-in'
            ? 'text-[var(--accent)] font-bold'
            : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
        }`}
      >
        <Store className="w-5 h-5" />
        <span className="text-[10px] mt-0.5 leading-tight">POS</span>
      </button>

      {/* 4. Packing / Station */}
      <button
        type="button"
        onClick={() => setActivePath(isPackingStaff ? '/packing' : '/inventory/products')}
        className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors cursor-pointer min-w-[56px] ${
          activePath === '/packing' || activePath === '/inventory/products'
            ? 'text-[var(--accent)] font-bold'
            : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
        }`}
      >
        <div className="relative">
          <Package className="w-5 h-5" />
          {pendingPacking > 0 && (
            <span className="absolute -top-1 -right-2 min-w-[15px] h-[15px] px-1 bg-[var(--status-amber)] text-white text-[9px] font-bold rounded-full flex items-center justify-center font-mono">
              {pendingPacking > 99 ? '99+' : pendingPacking}
            </span>
          )}
        </div>
        <span className="text-[10px] mt-0.5 leading-tight">
          {isPackingStaff ? 'Packing' : 'Products'}
        </span>
      </button>

      {/* 5. Menu / All Modules Drawer */}
      <button
        type="button"
        onClick={toggleSidebar}
        className="flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors cursor-pointer min-w-[56px]"
        aria-label="Open ERP Navigation Menu"
      >
        <Menu className="w-5 h-5" />
        <span className="text-[10px] mt-0.5 leading-tight">Menu</span>
      </button>
    </nav>
  );
};
