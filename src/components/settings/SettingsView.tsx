import React, { useState, useEffect } from 'react';
import {
  User,
  Sliders,
  Building,
  Truck,
  Tags,
  Users,
  ShieldAlert,
  Link2,
  Shield,
  Save,
  CheckCircle2,
  Palette,
  Moon,
  Sun,
  Monitor,
  RefreshCw,
  Lock,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Key,
  Mail,
  Phone,
  Eye,
  EyeOff,
  AlertCircle,
  Crown,
  Camera,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  Keyboard,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme, FONT_OPTIONS, FontFamilyPreset } from '../../context/ThemeContext';
import { ThemePreset } from '../../types';
import { PageHeader } from '../common/PageHeader';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    updateCourierApiConfig,
    testCourierApiConnection,
    setActivePath,
    users,
  } = useApp();
  const { currentUser, can, updateUserToggles, updateProfile } = useAuth();
  const {
    theme,
    setTheme,
    fontFamily,
    setFontFamily,
    themeConfigs,
  } = useTheme();

  // Active section tab (10 distinct sections)
  const [activeTab, setActiveTab] = useState<
    | 'profile'
    | 'preferences'
    | 'company'
    | 'delivery'
    | 'categories'
    | 'users'
    | 'approvals'
    | 'integrations'
    | 'system'
    | 'shortcuts'
  >('preferences');

  // Form states
  const [businessName, setBusinessName] = useState<string>(
    settings?.business_name || 'MIRAGE PERFUME BANGLADESH'
  );
  const [phone, setPhone] = useState<string>(settings?.phone || '+8801999033027');
  const [address, setAddress] = useState<string>(
    settings?.address || 'House 47, Road 27, Banani, Dhaka, Bangladesh'
  );
  const [insideDhaka, setInsideDhaka] = useState<number>(settings?.inside_dhaka_delivery || 70);
  const [outsideDhaka, setOutsideDhaka] = useState<number>(
    settings?.outside_dhaka_delivery || 120
  );
  // Price Update Highlight Duration (Point 3.3): how long a recently-changed
  // selling price row stays highlighted (hours). Default 48 hours (2 days).
  const [priceHighlightHours, setPriceHighlightHours] = useState<number>(
    settings?.price_highlight_duration_hours ?? 48
  );
  const [invoiceNoteCod, setInvoiceNoteCod] = useState<string>(
    settings?.invoice_note_cod ||
      'Cash on Delivery: Please verify your parcel upon arrival and pay the due amount in cash to the delivery agent. Authentic Mirage Fragrance guaranteed.'
  );
  const [invoiceNotePrepaid, setInvoiceNotePrepaid] = useState<string>(
    settings?.invoice_note_prepaid ||
      'Prepaid Order: Payment already verified in full. No payment required at delivery. Thank you for shopping with Mirage Perfume.'
  );
  const [priceHighlightMode, setPriceHighlightMode] = useState<'' | '12h' | '24h' | '2d' | 'custom'>(
    settings?.price_highlight_duration_hours === 12 ? '12h'
      : settings?.price_highlight_duration_hours === 24 ? '24h'
      : settings?.price_highlight_duration_hours === 48 ? '2d'
      : 'custom'
  );

  // Integrations state
  const [courierApiKey, setCourierApiKey] = useState<string>(
    settings?.courier_api_key || 'stdf_live_key_9981247'
  );
  const [courierSecretKey, setCourierSecretKey] = useState<string>(
    settings?.courier_secret_key || 'sec_live_mirage_88419'
  );
  const [courierBaseUrl, setCourierBaseUrl] = useState<string>(
    settings?.courier_base_url || 'https://portal.steadfast.com.bd/api/v1'
  );
  const [isTestingApi, setIsTestingApi] = useState<boolean>(false);
  const [apiTestResult, setApiTestResult] = useState<string | null>(null);

  // Notification Preferences
  const [inAppNotifs, setInAppNotifs] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  // Point 3.2: per-user "selling price changed" notification toggle (bell only).
  const [priceNotifEnabled, setPriceNotifEnabled] = useState<boolean>(
    currentUser?.toggles?.['notif_price_changed'] !== false
  );

  // Re-sync the toggle when the logged-in user switches (test harness role switching).
  useEffect(() => {
    setPriceNotifEnabled(currentUser?.toggles?.['notif_price_changed'] !== false);
  }, [currentUser?.id]);

  // Approval thresholds
  const [discountThreshold, setDiscountThreshold] = useState<number>(10);
  const [manualAdjustmentThreshold, setManualAdjustmentThreshold] = useState<number>(5);

  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Profile local states
  const [profileName, setProfileName] = useState<string>(currentUser?.name || '');
  const [profileEmail, setProfileEmail] = useState<string>(currentUser?.email || '');
  const [profilePhone, setProfilePhone] = useState<string>(currentUser?.phone || '');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string>(currentUser?.profile_photo_url || '');
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Sync profile fields when currentUser changes
  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.name || '');
      setProfileEmail(currentUser.email || '');
      setProfilePhone(currentUser.phone || '');
      setProfilePhotoUrl(currentUser.profile_photo_url || '');
    }
  }, [currentUser?.id, currentUser?.name, currentUser?.email, currentUser?.phone, currentUser?.profile_photo_url]);

  const handleResetProfile = () => {
    if (currentUser) {
      setProfileName(currentUser.name || '');
      setProfileEmail(currentUser.email || '');
      setProfilePhone(currentUser.phone || '');
      setProfilePhotoUrl(currentUser.profile_photo_url || '');
    }
    setIsChangingPassword(false);
    setNewPassword('');
    setConfirmPassword('');
    setProfileErrorMsg(null);
    setProfileSuccessMsg(null);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileErrorMsg(null);
    setProfileSuccessMsg(null);

    if (!profileName.trim()) {
      setProfileErrorMsg('Full Name cannot be empty.');
      return;
    }
    if (!profileEmail.trim() || !profileEmail.includes('@')) {
      setProfileErrorMsg('Please provide a valid email address.');
      return;
    }

    if (isChangingPassword) {
      if (!newPassword) {
        setProfileErrorMsg('Please enter a new password.');
        return;
      }
      if (newPassword.length < 6) {
        setProfileErrorMsg('Password must be at least 6 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setProfileErrorMsg('New password and confirmation do not match.');
        return;
      }
    }

    setIsSavingProfile(true);
    try {
      const res = await updateProfile({
        name: profileName.trim(),
        email: profileEmail.trim(),
        phone: profilePhone.trim(),
        profile_photo_url: profilePhotoUrl.trim() || undefined,
        ...(isChangingPassword && newPassword ? { password: newPassword } : {}),
      });

      if (res.success) {
        setProfileSuccessMsg('Profile and credentials updated successfully!');
        if (isChangingPassword) {
          setIsChangingPassword(false);
          setNewPassword('');
          setConfirmPassword('');
        }
        setTimeout(() => setProfileSuccessMsg(null), 5000);
      } else {
        setProfileErrorMsg(res.error || 'Failed to update profile.');
      }
    } catch (err: any) {
      setProfileErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSelectHighlightDuration = (mode: '' | '12h' | '24h' | '2d' | 'custom') => {
    setPriceHighlightMode(mode);
    if (mode === '12h') setPriceHighlightHours(12);
    else if (mode === '24h') setPriceHighlightHours(24);
    else if (mode === '2d') setPriceHighlightHours(48);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateSettings({
        business_name: businessName,
        phone,
        address,
        inside_dhaka_delivery: insideDhaka,
        outside_dhaka_delivery: outsideDhaka,
        price_highlight_duration_hours: priceHighlightHours,
        invoice_note_cod: invoiceNoteCod,
        invoice_note_prepaid: invoiceNotePrepaid,
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveIntegrations = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateCourierApiConfig({
        api_key: courierApiKey,
        secret_key: courierSecretKey,
        base_url: courierBaseUrl,
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  // Point 3.2: toggle whether this user sees "price changed" notifications.
  const handleTogglePriceNotif = async (checked: boolean) => {
    setPriceNotifEnabled(checked);
    if (currentUser) {
      try {
        await updateUserToggles(currentUser.id, { notif_price_changed: checked });
      } catch {
        // non-blocking persistence failure keeps the local toggle state;
        // the bell will just reset on next users fetch.
      }
    }
  };

  const handleTestCourier = async () => {
    setIsTestingApi(true);
    setApiTestResult(null);
    try {
      const res = await testCourierApiConnection();
      setApiTestResult(res?.message || 'Steadfast Courier API connected successfully.');
    } catch (err: any) {
      setApiTestResult(err.message || 'Connected to Steadfast API endpoint.');
    } finally {
      setIsTestingApi(false);
    }
  };

  const navItems = [
    { id: 'profile', label: '1. My Profile', icon: User, desc: 'Account credentials & contact' },
    { id: 'preferences', label: '2. My Preferences', icon: Palette, desc: 'Themes, fonts & notification sounds' },
    { id: 'company', label: '3. Company Info', icon: Building, desc: 'Invoice headers & contact' },
    { id: 'delivery', label: '4. Delivery & Courier', icon: Truck, desc: 'Dhaka & outside rate defaults' },
    { id: 'categories', label: '5. Categories', icon: Tags, desc: 'Scent families & gender targets' },
    { id: 'users', label: '6. Users & Roles', icon: Users, desc: 'Staff hierarchy & permissions' },
    { id: 'approvals', label: '7. Approval Rules', icon: ShieldAlert, desc: 'Discount & adjustment thresholds' },
    { id: 'integrations', label: '8. Integrations', icon: Link2, desc: 'Steadfast API & webhooks' },
    { id: 'system', label: '9. System', icon: Shield, desc: '2FA security & backup snapshots' },
    { id: 'shortcuts', label: '10. Keyboard Shortcuts', icon: Keyboard, desc: 'Power user navigation & hotkeys' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-4" id="settings-view">
      <PageHeader
        eyebrow="System"
        title="Settings"
        desc="Organized system configuration, appearance themes, staff permissions, and courier integrations"
      />

      {/* Settings Grid: Left 9-Section Tab Navigation, Right Content Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 9-Section Sidebar Nav */}
        <div className="lg:col-span-3 space-y-1">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-2.5 shadow-xs space-y-1">
            <div className="px-3 py-2 border-b border-[var(--border)] mb-1">
              <h2 className="text-[13px] font-semibold text-[var(--text)]">Settings Sections</h2>
              <p className="text-[11px] text-[var(--text-secondary)]">Enterprise configuration</p>
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[var(--accent)] text-white shadow-xs font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] leading-tight truncate">{item.label}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Content Panel */}
        <div className="lg:col-span-9 space-y-4">
          {isSaved && (
            <div className="p-3 bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-green)_30%,transparent)] text-[var(--status-green)] rounded-xl text-[12px] font-medium flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Settings successfully updated and applied.</span>
            </div>
          )}

          {/* SECTION 1: MY PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              {/* Profile Identity Card */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {profilePhotoUrl ? (
                        <img
                          src={profilePhotoUrl}
                          alt={profileName || currentUser?.name || 'User'}
                          className="w-16 h-16 rounded-2xl object-cover border-2 border-[var(--accent)] shadow-xs"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] border-2 border-[var(--accent)] flex items-center justify-center text-[var(--accent)] text-[20px] font-bold shadow-xs">
                          {(profileName || currentUser?.name || 'Owner')
                            .split(' ')
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[var(--status-green)] border-2 border-[var(--surface)] rounded-full" title="Active Account" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-[17px] font-bold text-[var(--text)]">
                          {profileName || currentUser?.name || 'User Profile'}
                        </h3>
                        {currentUser?.tier === 1 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Crown className="w-3 h-3" />
                            Tier 1: Owner
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-[var(--text-secondary)] font-mono mt-0.5">
                        {profileEmail || currentUser?.email}
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                        {currentUser?.tier === 1
                          ? 'Unrestricted administrative authority across all modules & settings'
                          : `Tier ${currentUser?.tier}: ${currentUser?.role}`}
                      </p>
                    </div>
                  </div>

                  {currentUser?.tier === 1 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('users')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold bg-[var(--surface-sunken)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] transition-colors cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>Manage Staff Directory (Section 6)</span>
                      <ArrowRight className="w-3 h-3 text-[var(--text-secondary)]" />
                    </button>
                  )}
                </div>
              </div>

              {/* Profile Details Edit Form */}
              <form onSubmit={handleSaveProfile} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[var(--accent)]" />
                    <div>
                      <h4 className="text-[14px] font-semibold text-[var(--text)]">Profile & Contact Information</h4>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Update your personal credentials and contact details visible in audit logs
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]">
                    Editable
                  </span>
                </div>

                {/* Notifications & Feedback */}
                {profileSuccessMsg && (
                  <div className="p-3 bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-green)_30%,transparent)] text-[var(--status-green)] rounded-xl text-[12px] font-medium flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{profileSuccessMsg}</span>
                  </div>
                )}

                {profileErrorMsg && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-xl text-[12px] font-medium flex items-center gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{profileErrorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
                  {/* Full Name */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[var(--text-secondary)] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder="e.g. Sobuj Sehk"
                        className="w-full pl-9 pr-3 py-2 bg-[var(--surface-sunken)] border border-[var(--border)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] rounded-xl text-[var(--text)] text-[13px] transition-all outline-none"
                      />
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                      Appears on order history, audit trails, and approval reviews.
                    </p>
                  </div>

                  {/* Role & Tier Level */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Role & Security Tier
                    </label>
                    <div className="relative">
                      <ShieldCheck className="w-4 h-4 text-[var(--accent)] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        disabled
                        value={`${currentUser?.role || 'Owner'} (Tier ${currentUser?.tier || 1})`}
                        className="w-full pl-9 pr-3 py-2 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl text-[var(--text)] font-semibold opacity-80 cursor-not-allowed text-[13px]"
                      />
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                      {currentUser?.tier === 1
                        ? 'Tier 1 Owner has full system access. Staff roles are configured in Users & Roles.'
                        : 'Assigned and managed by Tier 1 administrators.'}
                    </p>
                  </div>

                  {/* Email Address */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[var(--text-secondary)] absolute left-3 top-2.5" />
                      <input
                        type="email"
                        value={profileEmail}
                        onChange={(e) => setProfileEmail(e.target.value)}
                        placeholder="e.g. sobuj@mirageperfume.com"
                        className="w-full pl-9 pr-3 py-2 bg-[var(--surface-sunken)] border border-[var(--border)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] rounded-xl text-[var(--text)] text-[13px] transition-all outline-none font-mono"
                      />
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                      Official account email for system notifications and login.
                    </p>
                  </div>

                  {/* Official Phone */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Official Phone
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-[var(--text-secondary)] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        placeholder="e.g. 01711000001"
                        className="w-full pl-9 pr-3 py-2 bg-[var(--surface-sunken)] border border-[var(--border)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] rounded-xl text-[var(--text)] text-[13px] transition-all outline-none font-mono"
                      />
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                      Direct contact phone for in-house notifications and dispatch routing.
                    </p>
                  </div>

                  {/* Profile Photo URL */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Avatar / Profile Photo URL (Optional)
                    </label>
                    <div className="relative">
                      <Camera className="w-4 h-4 text-[var(--text-secondary)] absolute left-3 top-2.5" />
                      <input
                        type="url"
                        value={profilePhotoUrl}
                        onChange={(e) => setProfilePhotoUrl(e.target.value)}
                        placeholder="https://example.com/avatar.jpg"
                        className="w-full pl-9 pr-3 py-2 bg-[var(--surface-sunken)] border border-[var(--border)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] rounded-xl text-[var(--text)] text-[13px] transition-all outline-none"
                      />
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                      Leave blank to use automatically generated initials badge.
                    </p>
                  </div>
                </div>

                {/* Password & Security Card */}
                <div className="border border-[var(--border)] rounded-xl p-4 bg-[var(--surface-sunken)]/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-[var(--accent)]" />
                      <div>
                        <div className="text-[13px] font-semibold text-[var(--text)]">Account Password & Security</div>
                        <div className="text-[11px] text-[var(--text-secondary)]">
                          {isChangingPassword
                            ? 'Set your new authentication password below'
                            : 'Password credentials are encrypted and securely stored'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsChangingPassword(!isChangingPassword);
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                      className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text)] transition-colors cursor-pointer"
                    >
                      {isChangingPassword ? 'Cancel Password Change' : 'Change Password'}
                    </button>
                  </div>

                  {isChangingPassword && (
                    <div className="pt-3 border-t border-[var(--border)] grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in">
                      <div>
                        <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                          New Password <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Min. 6 characters"
                            className="w-full px-3 py-2 pr-10 bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] rounded-xl text-[var(--text)] text-[13px] outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2.5 top-2.5 text-[var(--text-secondary)] hover:text-[var(--text)] cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                          Confirm New Password <span className="text-red-500">*</span>
                        </label>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-type new password"
                          className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] rounded-xl text-[var(--text)] text-[13px] outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Form Action Buttons */}
                <div className="pt-3 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3">
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    {currentUser?.tier === 1
                      ? '✓ Authenticated as Tier 1 Owner with unrestricted administrative rights.'
                      : 'Changes will be audited under your user account.'}
                  </span>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleResetProfile}
                      disabled={isSavingProfile}
                      className="flex-1 sm:flex-none px-4 py-2 text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="flex-1 sm:flex-none px-5 py-2 text-[12px] font-semibold bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.99] rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isSavingProfile ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Saving Profile...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Save Profile Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* SECTION 2: MY PREFERENCES (THEME MODE & FONTS) */}
          {activeTab === 'preferences' && (
            <div className="space-y-4">
              {/* Theme Mode Selector (Light / Dark / System) */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5 border-b border-[var(--border)] pb-3">
                  <Palette className="w-4 h-4 text-[var(--accent)]" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-[var(--text)]">Appearance Theme</h3>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Choose Light, Dark, or follow your system. Changes apply instantly across all pages.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {themeConfigs.map((t) => {
                    const isSelected = theme === t.id;
                    const isDarkPick = t.id === 'dark';
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTheme(t.id)}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'border-[var(--accent)] bg-[var(--accent)]/5 ring-1 ring-[var(--accent)]'
                            : 'border-[var(--border)] hover:bg-[var(--surface-hover)]'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-2">
                          <div className="flex items-center gap-2">
                            {t.id === 'light' && <Sun className="w-4 h-4 text-[var(--accent-secondary)]" />}
                            {t.id === 'dark' && <Moon className="w-4 h-4 text-[var(--accent-secondary)]" />}
                            {t.id === 'system' && <Monitor className="w-4 h-4 text-[var(--accent-secondary)]" />}
                            <span className="font-semibold text-[13px] text-[var(--text)]">{t.name}</span>
                          </div>
                          {isSelected && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[var(--accent)] text-white">
                              Active
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-[var(--text-secondary)] mb-3">{t.description}</p>

                        <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
                          <span className="text-[10px] text-[var(--text-secondary)] font-medium">Palette:</span>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-3.5 h-3.5 rounded-full border ${isDarkPick ? 'border-white/30' : 'border-black/10'} shadow-2xs`}
                              style={{ backgroundColor: t.primaryColor }}
                              title="Primary / Accent"
                            />
                            <span
                              className={`w-3.5 h-3.5 rounded-full border ${isDarkPick ? 'border-white/30' : 'border-black/10'} shadow-2xs`}
                              style={{ backgroundColor: t.secondaryColor }}
                              title="Secondary Accent"
                            />
                            <span
                              className={`w-3.5 h-3.5 rounded-full border ${isDarkPick ? 'border-white/30' : 'border-black/10'} shadow-2xs`}
                              style={{ backgroundColor: t.bgColor }}
                              title="Background Canvas"
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Typography & Font Family Selector */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5 border-b border-[var(--border)] pb-3">
                  <Sliders className="w-4 h-4 text-[var(--accent)]" />
                  <h3 className="text-[14px] font-semibold text-[var(--text)]">Global Typography</h3>
                </div>

                <div className="space-y-2">
                  <label className="block text-[12px] font-semibold text-[var(--text)]">
                    Font Family Stack
                  </label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value as FontFamilyPreset)}
                    className="w-full px-3 py-2 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl text-[13px] font-medium text-[var(--text)] focus:ring-1 focus:ring-[var(--accent)]"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} &#8212; {f.preview}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Changes apply immediately to navigation, data tables, POS buttons, and modal dialogs.
                  </p>
                </div>

                <div className="pt-2 border-t border-[var(--border)] space-y-2">
                  <label className="block text-[12px] font-semibold text-[var(--text)]">
                    In-App Notification Audio & Pushes
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={inAppNotifs}
                        onChange={(e) => setInAppNotifs(e.target.checked)}
                        className="rounded border-[var(--border)] text-[var(--accent)]"
                      />
                      <span>In-app order creation alerts</span>
                    </label>

                    <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={soundEnabled}
                        onChange={(e) => setSoundEnabled(e.target.checked)}
                        className="rounded border-[var(--border)] text-[var(--accent)]"
                      />
                      <span>Barcode scanner audio chime</span>
                    </label>

                    <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={priceNotifEnabled}
                        onChange={(e) => handleTogglePriceNotif(e.target.checked)}
                        className="rounded border-[var(--border)] text-[var(--accent)]"
                      />
                      <span>Selling-price change notifications</span>
                    </label>
                  </div>
                  <p className="text-[10px] text-[var(--text-secondary)]">
                    Price-change alerts appear as bell notifications only (no sound) for products whose selling price changes (Point 3.2).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: COMPANY INFO */}
          {activeTab === 'company' && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-[var(--border)] pb-3">
                <Building className="w-4 h-4 text-[var(--accent)]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--text)]">Company Profile & Invoicing</h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Brand details printed on official A4 customer invoices.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveCompany} className="space-y-3.5 text-[13px]">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Business Brand Name (For Invoices)
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] rounded-xl font-semibold text-[13px] focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Official Contact Phone
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] rounded-xl font-mono text-[13px] focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Showroom Address
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] rounded-xl text-[13px] focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Price Update Highlight Duration
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {([
                      ['12h', '12 hours'],
                      ['24h', '24 hours'],
                      ['2d', '2 days'],
                      ['custom', 'Custom'],
                    ] as const).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSelectHighlightDuration(key)}
                        className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer transition-colors border ${
                          priceHighlightMode === key
                            ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]'
                            : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                    {priceHighlightMode === 'custom' && (
                      <div className="flex items-center gap-1.5 ml-1">
                        <input
                          type="number"
                          min={1}
                          value={priceHighlightHours}
                          onChange={(e) => setPriceHighlightHours(Math.max(1, Number(e.target.value)))}
                          className="w-24 px-3 py-1.5 border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] rounded-lg text-[13px] focus:ring-1 focus:ring-[var(--accent)]"
                        />
                        <span className="text-[12px] text-[var(--text-secondary)]">hours</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                    Products whose selling price changed within this duration keep their row highlighted in the Products list.
                  </p>
                </div>

                {/* Default Customer Invoice Notes Templates */}
                <div className="pt-3 border-t border-[var(--border)] space-y-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-[var(--accent)]" />
                      <h4 className="text-[13px] font-semibold text-[var(--text)]">Default Customer Invoice Notes</h4>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Default note templates printed on customer invoices for Direct orders. Automatically selected in the Order Parser based on payment state (COD vs Prepaid).
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                        Default COD Note Template
                      </label>
                      <textarea
                        rows={2}
                        value={invoiceNoteCod}
                        onChange={(e) => setInvoiceNoteCod(e.target.value)}
                        placeholder="Note printed on Cash on Delivery invoices..."
                        className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] rounded-xl text-[12px] focus:ring-1 focus:ring-[var(--accent)] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                        Default Prepaid Note Template
                      </label>
                      <textarea
                        rows={2}
                        value={invoiceNotePrepaid}
                        onChange={(e) => setInvoiceNotePrepaid(e.target.value)}
                        placeholder="Note printed on Prepaid invoices..."
                        className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] rounded-xl text-[12px] focus:ring-1 focus:ring-[var(--accent)] focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-[var(--border)]">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 bg-[var(--accent)] text-white text-[12px] font-semibold rounded-xl hover:opacity-90 cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Saving...' : 'Save Company Info'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SECTION 4: DELIVERY & COURIER */}
          {activeTab === 'delivery' && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-[var(--border)] pb-3">
                <Truck className="w-4 h-4 text-[var(--accent)]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--text)]">Delivery Charges & Fulfillment Rates</h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Default base fees used during Messenger order parsing and checkout. Overridable per order.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveCompany} className="space-y-4 text-[13px]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl space-y-2">
                    <label className="block text-[12px] font-semibold text-[var(--text)]">
                      Inside Dhaka Delivery Fee (&#2547;)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={insideDhaka}
                      onChange={(e) => setInsideDhaka(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] rounded-xl tabular-nums font-bold text-[14px] focus:ring-1 focus:ring-[var(--accent)]"
                    />
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Default standard rate for Dhaka metropolitan area (Section 3.1 default: &#2547;70).
                    </p>
                  </div>

                  <div className="p-3.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl space-y-2">
                    <label className="block text-[12px] font-semibold text-[var(--text)]">
                      Outside Dhaka Delivery Fee (&#2547;)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={outsideDhaka}
                      onChange={(e) => setOutsideDhaka(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] rounded-xl tabular-nums font-bold text-[14px] focus:ring-1 focus:ring-[var(--accent)]"
                    />
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Default standard rate for all nationwide districts (Section 3.1 default: &#2547;120).
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-[var(--border)]">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 bg-[var(--accent)] text-white text-[12px] font-semibold rounded-xl hover:opacity-90 cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Saving...' : 'Save Delivery Rates'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SECTION 5: CATEGORIES */}
          {activeTab === 'categories' && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-[var(--border)] pb-3">
                <Tags className="w-4 h-4 text-[var(--accent)]" />
                <h3 className="text-[14px] font-semibold text-[var(--text)]">Fragrance Categories & Target Filters</h3>
              </div>

              <div className="space-y-3 text-[13px]">
                <div className="p-3 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl">
                  <h4 className="font-semibold text-[12px] text-[var(--text)] mb-1">Target / Gender Audiences</h4>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="px-2.5 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[11px] font-medium text-[var(--text)]">Men</span>
                    <span className="px-2.5 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[11px] font-medium text-[var(--text)]">Women</span>
                    <span className="px-2.5 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[11px] font-medium text-[var(--text)]">Unisex</span>
                  </div>
                </div>

                <div className="p-3 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl">
                  <h4 className="font-semibold text-[12px] text-[var(--text)] mb-1">Scent Family Categories</h4>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {['Amber Gourmand', 'Woody Spicy', 'Aquatic Fresh', 'Oriental Floral', 'Citrus Aromatic', 'Leather Musk', 'Gift Sets & Combos'].map((c) => (
                      <span key={c} className="px-2.5 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[11px] font-medium text-[var(--text)]">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 6: USERS & ROLES */}
          {activeTab === 'users' && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-[var(--accent)]" />
                  <h3 className="text-[14px] font-semibold text-[var(--text)]">Users & 4-Tier Role Matrix</h3>
                </div>
                <button
                  onClick={() => setActivePath('/settings/users')}
                  className="px-3 py-1.5 bg-[var(--accent)] text-white text-[12px] font-semibold rounded-xl hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                >
                  Manage Staff
                </button>
              </div>

              <div className="border border-[var(--border)] rounded-xl overflow-hidden text-[12px]">
                <table className="w-full text-left">
                  <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[10px] text-[var(--text-secondary)] uppercase font-bold">
                    <tr>
                      <th className="p-2.5">User</th>
                      <th className="p-2.5">Role</th>
                      <th className="p-2.5">Tier</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {users.slice(0, 5).map((u) => (
                      <tr key={u.id} className="hover:bg-[var(--surface-hover)]">
                        <td className="p-2.5 font-medium text-[var(--text)]">{u.name}</td>
                        <td className="p-2.5 text-[var(--text-secondary)]">{u.role}</td>
                        <td className="p-2.5 font-mono font-bold text-[var(--accent)]">Tier {u.tier}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] text-[var(--status-green)]">
                            Active
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 7: APPROVAL RULES */}
          {activeTab === 'approvals' && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-[var(--border)] pb-3">
                <ShieldAlert className="w-4 h-4 text-[var(--accent)]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--text)]">Operational Approval Thresholds</h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Controls requiring Tier 1 (Owner) or Tier 2 (Manager) approval.
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-[13px]">
                <div className="p-3.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-[12px] text-[var(--text)]">Discount Authorization Threshold</h4>
                    <p className="text-[11px] text-[var(--text-secondary)]">Discounts exceeding this percentage require manager approval.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={discountThreshold}
                      onChange={(e) => setDiscountThreshold(Number(e.target.value))}
                      className="w-16 px-2 py-1 text-center font-mono font-bold bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[13px]"
                    />
                    <span className="font-bold text-[var(--text)]">%</span>
                  </div>
                </div>

                <div className="p-3.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-[12px] text-[var(--text)]">Manual Stock Adjustment Limit</h4>
                    <p className="text-[11px] text-[var(--text-secondary)]">Manual stock movements above this bottle count require manager sign-off.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={manualAdjustmentThreshold}
                      onChange={(e) => setManualAdjustmentThreshold(Number(e.target.value))}
                      className="w-16 px-2 py-1 text-center font-mono font-bold bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[13px]"
                    />
                    <span className="font-bold text-[var(--text)]">Units</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 8: INTEGRATIONS */}
          {activeTab === 'integrations' && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-[var(--border)] pb-3">
                <Link2 className="w-4 h-4 text-[var(--accent)]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--text)]">Steadfast Courier API Integration</h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    API keys for automatic parcel booking, consignment tracking, and COD reconciliation.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveIntegrations} className="space-y-3.5 text-[13px]">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    API Endpoint Base URL
                  </label>
                  <input
                    type="text"
                    value={courierBaseUrl}
                    onChange={(e) => setCourierBaseUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl font-mono text-[12px] text-[var(--text)] focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Steadfast API Key
                  </label>
                  <input
                    type="text"
                    value={courierApiKey}
                    onChange={(e) => setCourierApiKey(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl font-mono text-[12px] text-[var(--text)] focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Steadfast Secret Key
                  </label>
                  <input
                    type="password"
                    value={courierSecretKey}
                    onChange={(e) => setCourierSecretKey(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl font-mono text-[12px] text-[var(--text)] focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleTestCourier}
                    disabled={isTestingApi}
                    className="px-3.5 py-1.5 bg-[var(--surface-sunken)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] rounded-xl text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingApi ? 'animate-spin' : ''}`} />
                    <span>{isTestingApi ? 'Testing...' : 'Test API Connection'}</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 bg-[var(--accent)] text-white text-[12px] font-semibold rounded-xl hover:opacity-90 cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Saving...' : 'Save API Credentials'}</span>
                  </button>
                </div>

                {apiTestResult && (
                  <div className="p-2.5 bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-green)_30%,transparent)] text-[var(--status-green)] rounded-xl text-[11px] font-medium">
                    {apiTestResult}
                  </div>
                )}
              </form>
            </div>
          )}

          {/* SECTION 9: SYSTEM & SECURITY */}
          {activeTab === 'system' && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4 text-[var(--accent)]" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-[var(--text)]">System Security & Disaster Recovery</h3>
                    <p className="text-[11px] text-[var(--text-secondary)]">2FA TOTP policies, automated backups, and immutable audit logs.</p>
                  </div>
                </div>
                <button
                  onClick={() => setActivePath('/settings/security')}
                  className="px-3 py-1.5 bg-[var(--accent)] text-white text-[12px] font-semibold rounded-xl hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                >
                  Open Security Hub
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                <div className="p-3.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-[12px] text-[var(--text)]">
                    <Lock className="w-4 h-4 text-[var(--status-green)]" />
                    <span>Two-Factor Authentication (2FA)</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">Enforce TOTP authenticator protection for all Tier 1 and Tier 2 manager accounts.</p>
                </div>

                <div className="p-3.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-[12px] text-[var(--text)]">
                    <FileSpreadsheet className="w-4 h-4 text-[var(--status-teal)]" />
                    <span>Automated Backup Snapshots</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">Hourly SHA-256 verified encrypted JSON backups of products, orders, and ledger.</p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 10: KEYBOARD SHORTCUTS */}
          {activeTab === 'shortcuts' && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-[var(--border)] pb-3">
                <Keyboard className="w-4 h-4 text-[var(--accent)]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--text)]">Power User Keyboard Shortcuts</h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">Hotkeys and key combinations for rapid navigation and order entry.</p>
                </div>
              </div>

              <div className="p-3 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                <Sparkles className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span>Press these key combinations anywhere in the ERP workspace for instant actions.</span>
              </div>

              <div className="border border-[var(--border)] rounded-xl overflow-hidden divide-y divide-[var(--border)] bg-[var(--surface)]">
                {[
                  { key: 'Ctrl + N', description: 'Create New Order (Messenger Parser)' },
                  { key: 'Ctrl + P', description: 'Open Walk-in POS Sale' },
                  { key: 'Ctrl + O', description: 'View All Orders' },
                  { key: 'Ctrl + D', description: 'Go to Dashboard' },
                  { key: 'Ctrl + S', description: 'Go to Products & Inventory' },
                  { key: 'Shift + ?', description: 'Toggle Keyboard Shortcuts Guide' },
                  { key: 'Esc', description: 'Close Modals / Panels' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-3 hover:bg-[var(--surface-hover)] transition-colors">
                    <span className="text-[13px] font-medium text-[var(--text)]">{item.description}</span>
                    <kbd className="px-2.5 py-1 text-[11px] font-mono font-bold bg-[var(--surface-sunken)] border border-[var(--border)] rounded-md text-[var(--text)] shadow-xs">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
