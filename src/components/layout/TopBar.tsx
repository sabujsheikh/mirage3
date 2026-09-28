import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bell,
  RefreshCw,
  LayoutGrid,
  ChevronDown,
  Sparkles,
  AlertTriangle,
  ShoppingCart,
  Store,
  User,
  LogOut,
  Menu,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';

export const TopBar: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const {
    activePath,
    setActivePath,
    notifications,
    markNotificationsRead,
    refreshAll,
    toggleSidebar,
    sidebarOpen,
  } = useApp();
  const [showNotifMenu, setShowNotifMenu] = useState<boolean>(false);
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Live clock interval
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const priceNotifOn = currentUser?.toggles?.['notif_price_changed'] !== false;
  const visibleNotifications = notifications.filter(n => n.type !== 'price_changed' || priceNotifOn);
  const unreadCount = visibleNotifications.filter(n => !n.read).length;

  // Clean short display name without role/tier annotations (e.g. "Sobuj", "Tanvir")
  const cleanDisplayName = useMemo(() => {
    return (currentUser?.name || '').replace(/\s*\([^)]*\)/g, '').trim();
  }, [currentUser?.name]);

  const shortDisplayName = useMemo(() => {
    return cleanDisplayName.split(' ')[0] || cleanDisplayName || 'User';
  }, [cleanDisplayName]);

  const shortInitials = useMemo(() => {
    return (
      (cleanDisplayName || 'User')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w[0].toUpperCase())
        .join('') || 'U'
    );
  }, [cleanDisplayName]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notifRef.current && !notifRef.current.contains(target)) {
        setShowNotifMenu(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setShowProfileMenu(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifMenu(false);
        setShowProfileMenu(false);
      }
    };

    if (showNotifMenu || showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showNotifMenu, showProfileMenu]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshAll();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const getPageTitle = (path: string): string => {
    switch (path) {
      case '/dashboard':
        return 'Dashboard';
      case '/orders/new':
        return 'New Order';
      case '/orders/walk-in':
        return 'Walk-in Sale';
      case '/orders/today':
        return "Today's Orders";
      case '/orders':
        return 'All Orders';
      case '/orders/cancelled':
        return 'Cancelled Orders';
      case '/orders/returns':
        return 'Returns & RTO';
      case '/packing':
        return 'Packing Station';
      case '/courier/bookings':
        return 'Courier Bookings';
      case '/inventory/products':
        return 'Products';
      case '/inventory/movements':
      case '/inventory/ledger':
        return 'Stock Movements';
      case '/customers':
        return 'Customers';
      case '/accounting/ledger':
        return 'Journal Entries';
      case '/accounting/pnl':
        return 'Financial Reports';
      case '/reports':
        return 'Reports';
      case '/accounting/expenses':
        return 'Expenses';
      case '/accounting/payments':
      case '/accounting/cash-register':
        return 'Daily Till';
      case '/accounting/salary':
      case '/payroll':
        return 'Payroll';
      case '/pricing':
        return 'Pricing Engine';
      case '/settings/users':
        return 'Users & Roles';
      case '/settings/security':
        return 'System Security';
      case '/audit-log':
        return 'Audit Log';
      case '/profile':
      case '/my-profile':
        return 'My Profile';
      case '/settings':
        return 'Settings';
      default:
        return 'Dashboard';
    }
  };

  const currentSection = activePath.replace('/', '') || 'dashboard';

  // Format current date/time cleanly
  const formattedDateTime = useMemo(() => {
    try {
      return currentTime.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return currentTime.toLocaleDateString();
    }
  }, [currentTime]);

  const handleNotificationClick = (n: any) => {
    setShowNotifMenu(false);
    if (n.type === 'new_order' || n.type === 'order_status') {
      setActivePath('/orders');
    } else if (n.type === 'packing') {
      setActivePath('/packing');
    } else if (n.type === 'price_changed' || n.type === 'inventory') {
      setActivePath('/inventory/products');
    } else if (n.type === 'payment') {
      setActivePath('/accounting/payments');
    } else {
      setActivePath('/dashboard');
    }
  };

  return (
    <header className="h-14 bg-white border-b border-gray-200 px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 transition-colors shrink-0 select-none">
      {/* Left: Single Sidebar Toggle & Breadcrumb Title */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={toggleSidebar}
          className="p-1.5 -ml-1 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer shrink-0"
          aria-label={sidebarOpen ? 'Collapse navigation' : 'Expand navigation'}
          title={sidebarOpen ? 'Collapse navigation' : 'Expand navigation'}
        >
          <Menu className="w-5 h-5 text-gray-800" />
        </button>

        <div className="flex flex-col justify-center min-w-0">
          <div className="text-[10px] sm:text-[11px] text-gray-400 font-normal leading-tight truncate">
            Mirage Perfume / {currentSection}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <h1 className="text-xs sm:text-sm font-bold text-gray-900 tracking-tight leading-tight truncate max-w-[160px] xs:max-w-[220px] sm:max-w-none">
              {getPageTitle(activePath)}
            </h1>
          </div>
        </div>
      </div>

      {/* Right Controls: Live Date/Time, POS Shortcut, Refresh, Notifications, User Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Live Date & Time Display */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-gray-200 bg-gray-50 text-[11px] text-gray-700 font-mono font-medium shadow-2xs">
          <span>{formattedDateTime}</span>
        </div>

        {/* POS Shortcut Button */}
        <button
          type="button"
          onClick={() => setActivePath('/orders/walk-in')}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          title="Open Walk-in POS"
        >
          <Store className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden xs:inline">POS</span>
        </button>

        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          className="w-8 h-8 rounded-md border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors shadow-2xs cursor-pointer"
          title="Refresh live data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-gray-900' : ''}`} />
        </button>

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setShowNotifMenu(!showNotifMenu);
              if (unreadCount > 0) markNotificationsRead();
            }}
            className="w-8 h-8 rounded-md border border-transparent hover:border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-center relative"
            title="Notifications"
          >
            <Bell className="w-3.5 h-3.5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg py-2 z-50 animate-in fade-in duration-100">
              <div className="px-3.5 py-1.5 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-900">Notifications</span>
                <span className="text-[11px] text-gray-400">{visibleNotifications.length} alerts</span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                {visibleNotifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400">No notifications</div>
                ) : (
                  visibleNotifications.slice(0, 8).map(n => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className="p-2.5 hover:bg-teal-50/50 text-xs cursor-pointer transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        {n.type === 'new_order' ? (
                          <ShoppingCart className="w-3.5 h-3.5 text-teal-600 mt-0.5 shrink-0" />
                        ) : n.type === 'price_changed' ? (
                          <Sparkles className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1">
                          <p className="text-gray-900 font-medium leading-snug">{n.message}</p>
                          <span className="text-[10px] text-gray-400 mt-0.5 block">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Compact User Profile Access (Top-Right) */}
        <div className="relative ml-0.5 sm:ml-1" ref={profileRef}>
          <button
            type="button"
            onClick={() => setShowProfileMenu(prev => !prev)}
            aria-expanded={showProfileMenu}
            aria-label="User account menu"
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer shadow-2xs"
          >
            {currentUser?.profile_photo_url ? (
              <img
                src={currentUser.profile_photo_url}
                alt=""
                className="w-6 h-6 rounded-full object-cover border border-gray-200 shrink-0"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                {shortInitials}
              </div>
            )}
            <span className="text-xs font-semibold text-gray-800 truncate max-w-[100px] xs:max-w-[120px]">
              {shortDisplayName}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-150 ${
                showProfileMenu ? 'rotate-180 text-gray-700' : ''
              }`}
            />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-1.5 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50 animate-in fade-in duration-100">
              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  setActivePath('/profile');
                }}
                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-medium flex items-center gap-2 transition-colors cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-gray-500" />
                <span>My Profile</span>
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button
                type="button"
                onClick={async () => {
                  setShowProfileMenu(false);
                  await logout();
                }}
                className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 font-medium flex items-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-500" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

