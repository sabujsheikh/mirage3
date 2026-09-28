import React, { useState, useEffect } from 'react';
import {
  X,
  Palette,
  Sliders,
  Link2,
  CheckCircle2,
  Type,
  Sun,
  Moon,
  Monitor,
  Building,
  Phone,
  MapPin,
  Truck,
  Key,
  ShieldCheck,
  Save,
  RefreshCw,
} from 'lucide-react';
import { useTheme, FONT_OPTIONS, FontFamilyPreset } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';

export const SettingsModal: React.FC = () => {
  const {
    isSettingsModalOpen,
    closeSettingsModal,
    theme,
    setTheme,
    fontFamily,
    setFontFamily,
  } = useTheme();

  const {
    settings,
    updateSettings,
    updateCourierApiConfig,
    testCourierApiConnection,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'appearance' | 'system' | 'integrations'>('appearance');

  // Appearance Local State
  const [selectedFont, setSelectedFont] = useState<FontFamilyPreset>(fontFamily);
  const [selectedTheme, setSelectedTheme] = useState(theme);

  // System Local State
  const [businessName, setBusinessName] = useState<string>('');
  const [businessPhone, setBusinessPhone] = useState<string>('');
  const [businessAddress, setBusinessAddress] = useState<string>('');
  const [insideDhaka, setInsideDhaka] = useState<number>(70);
  const [outsideDhaka, setOutsideDhaka] = useState<number>(120);
  const [invoiceNoteCod, setInvoiceNoteCod] = useState<string>('');
  const [invoiceNotePrepaid, setInvoiceNotePrepaid] = useState<string>('');

  // Integrations Local State
  const [courierApiKey, setCourierApiKey] = useState<string>('');
  const [courierSecretKey, setCourierSecretKey] = useState<string>('');
  const [courierBaseUrl, setCourierBaseUrl] = useState<string>('https://portal.steadfast.com.bd/api/v1');
  const [isTestingApi, setIsTestingApi] = useState<boolean>(false);
  const [apiTestResult, setApiTestResult] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');

  useEffect(() => {
    if (isSettingsModalOpen) {
      setSelectedFont(fontFamily);
      setSelectedTheme(theme);
      setBusinessName(settings?.business_name || 'MIRAGE PERFUME BANGLADESH');
      setBusinessPhone(settings?.phone || '+8801999033027');
      setBusinessAddress(settings?.address || 'House 47, Road 27, Banani, Dhaka, Bangladesh');
      setInsideDhaka(settings?.inside_dhaka_delivery !== undefined ? settings.inside_dhaka_delivery : 70);
      setOutsideDhaka(settings?.outside_dhaka_delivery !== undefined ? settings.outside_dhaka_delivery : 120);
      setInvoiceNoteCod(
        settings?.invoice_note_cod ||
          'Cash on Delivery: Please verify your parcel upon arrival and pay the due amount in cash to the delivery agent. Authentic Mirage Fragrance guaranteed.'
      );
      setInvoiceNotePrepaid(
        settings?.invoice_note_prepaid ||
          'Prepaid Order: Payment already verified in full. No payment required at delivery. Thank you for shopping with Mirage Perfume.'
      );
      setCourierApiKey(settings?.courier_api_key || 'stdf_live_key_9981247');
      setCourierSecretKey(settings?.courier_secret_key || 'sec_live_mirage_88419');
      setCourierBaseUrl(settings?.courier_base_url || 'https://portal.steadfast.com.bd/api/v1');
      setSaveSuccessMsg('');
      setApiTestResult(null);
    }
  }, [isSettingsModalOpen, settings, fontFamily, theme]);

  if (!isSettingsModalOpen) return null;

  // Handle instant font preview/change
  const handleFontChange = (newFont: FontFamilyPreset) => {
    setSelectedFont(newFont);
    setFontFamily(newFont); // Apply instantly globally
  };

  const handleThemeChange = (newTheme: any) => {
    setSelectedTheme(newTheme);
    setTheme(newTheme); // Apply instantly
  };

  const handleTestCourier = async () => {
    setIsTestingApi(true);
    setApiTestResult(null);
    try {
      const res = await testCourierApiConnection();
      setApiTestResult(res?.message || 'Steadfast Courier API connected successfully (Status: Active).');
    } catch (err: any) {
      setApiTestResult(`Error: ${err.message || 'Connection failed'}`);
    } finally {
      setIsTestingApi(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await updateSettings({
        business_name: businessName,
        phone: businessPhone,
        address: businessAddress,
        inside_dhaka_delivery: Number(insideDhaka),
        outside_dhaka_delivery: Number(outsideDhaka),
        invoice_note_cod: invoiceNoteCod,
        invoice_note_prepaid: invoiceNotePrepaid,
        courier_api_key: courierApiKey,
        courier_secret_key: courierSecretKey,
        courier_base_url: courierBaseUrl,
      });

      if (courierApiKey || courierSecretKey) {
        await updateCourierApiConfig({
          api_key: courierApiKey,
          secret_key: courierSecretKey,
          base_url: courierBaseUrl,
        });
      }

      setSaveSuccessMsg('Settings saved successfully.');
      setTimeout(() => {
        setSaveSuccessMsg('');
        closeSettingsModal();
      }, 700);
    } catch (err: any) {
      alert(err.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="h-14 px-5 border-b border-[var(--border)] bg-[var(--surface-sunken)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-[14px] font-semibold text-[var(--text)]">Settings</h2>
          </div>
          <button
            onClick={closeSettingsModal}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Left Tab Nav & Right Content Panel */}
        <div className="flex flex-1 min-h-[380px] overflow-hidden">
          {/* Left Tab Navigation */}
          <div className="w-48 bg-[var(--surface-sunken)] border-r border-[var(--border)] p-3 space-y-1 shrink-0">
            <button
              onClick={() => setActiveTab('appearance')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all text-left cursor-pointer ${
                activeTab === 'appearance'
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              <Palette className="w-4 h-4 shrink-0" />
              <span>Appearance</span>
            </button>

            <button
              onClick={() => setActiveTab('system')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all text-left cursor-pointer ${
                activeTab === 'system'
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              <Building className="w-4 h-4 shrink-0" />
              <span>System</span>
            </button>

            <button
              onClick={() => setActiveTab('integrations')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all text-left cursor-pointer ${
                activeTab === 'integrations'
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              <Link2 className="w-4 h-4 shrink-0" />
              <span>Integrations</span>
            </button>
          </div>

          {/* Right Content Panel */}
          <div className="flex-1 p-5 overflow-y-auto bg-[var(--surface)] text-[13px]">
            {saveSuccessMsg && (
              <div className="mb-4 p-2.5 bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-green)_30%,transparent)] text-[var(--status-green)] rounded-xl text-[12px] font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {/* TAB 1: APPEARANCE */}
            {activeTab === 'appearance' && (
              <div className="space-y-5">
                {/* Font Family Dropdown */}
                <div className="space-y-2">
                  <label className="block text-[13px] font-semibold text-[var(--text)]">
                    Font Family
                  </label>
                  <select
                    value={selectedFont}
                    onChange={(e) => handleFontChange(e.target.value as FontFamilyPreset)}
                    className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[13px] font-medium text-[var(--text)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-hidden"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} &#8212; {f.preview}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Changes apply instantly across all navigation, tables, forms, and cards.
                  </p>
                </div>

                {/* Theme Selector (Light / Dark / System) */}
                <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                  <label className="block text-[13px] font-semibold text-[var(--text)]">
                    Appearance Mode
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => handleThemeChange('light')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        selectedTheme === 'light'
                          ? 'border-[var(--accent)] bg-[var(--accent)]/5 ring-1 ring-[var(--accent)]'
                          : 'border-[var(--border)] hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Sun className="w-4 h-4 text-[var(--status-amber)]" />
                        <div className="font-semibold text-[13px] text-[var(--text)]">Light</div>
                      </div>
                      <span className="w-3.5 h-3.5 rounded-full bg-[var(--surface-sunken)] border border-[var(--border)]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleThemeChange('dark')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        selectedTheme === 'dark'
                          ? 'border-[var(--accent)] bg-[var(--accent)]/5 ring-1 ring-[var(--accent)]'
                          : 'border-[var(--border)] hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Moon className="w-4 h-4 text-indigo-400" />
                        <div className="font-semibold text-[13px] text-[var(--text)]">Dark</div>
                      </div>
                      <span className="w-3.5 h-3.5 rounded-full bg-[#1A1D23] border border-gray-600" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleThemeChange('system')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        selectedTheme === 'system'
                          ? 'border-[var(--accent)] bg-[var(--accent)]/5 ring-1 ring-[var(--accent)]'
                          : 'border-[var(--border)] hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Monitor className="w-4 h-4 text-[var(--accent-secondary)]" />
                        <div className="font-semibold text-[13px] text-[var(--text)]">System</div>
                      </div>
                      <span className="w-3.5 h-3.5 rounded-full bg-[#4A7BA6] border border-[var(--border)]" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SYSTEM */}
            {activeTab === 'system' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-[var(--text)] mb-1">
                    Business Name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[13px] text-[var(--text)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-[var(--text)] mb-1">
                      Official Phone
                    </label>
                    <input
                      type="text"
                      value={businessPhone}
                      onChange={(e) => setBusinessPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[13px] text-[var(--text)] font-mono focus:ring-1 focus:ring-[var(--accent)] focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-[var(--text)] mb-1">
                      Showroom Address
                    </label>
                    <input
                      type="text"
                      value={businessAddress}
                      onChange={(e) => setBusinessAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[13px] text-[var(--text)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border)]">
                  <div>
                    <label className="block text-[12px] font-semibold text-[var(--text)] mb-1">
                      Inside Dhaka Delivery (&#2547;)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={insideDhaka}
                      onChange={(e) => setInsideDhaka(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[13px] tabular-nums font-bold text-[var(--text)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-[var(--text)] mb-1">
                      Outside Dhaka Delivery (&#2547;)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={outsideDhaka}
                      onChange={(e) => setOutsideDhaka(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[13px] tabular-nums font-bold text-[var(--text)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--border)] space-y-2.5">
                  <label className="block text-[12px] font-semibold text-[var(--text)]">
                    Default Customer Invoice Notes (Direct Orders)
                  </label>
                  <div>
                    <label className="block text-[11px] text-[var(--text-secondary)] mb-1">
                      COD Note Template
                    </label>
                    <textarea
                      rows={2}
                      value={invoiceNoteCod}
                      onChange={(e) => setInvoiceNoteCod(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[12px] text-[var(--text)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--text-secondary)] mb-1">
                      Prepaid Note Template
                    </label>
                    <textarea
                      rows={2}
                      value={invoiceNotePrepaid}
                      onChange={(e) => setInvoiceNotePrepaid(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[12px] text-[var(--text)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: INTEGRATIONS */}
            {activeTab === 'integrations' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-[var(--text)] mb-1">
                    Steadfast API Base URL
                  </label>
                  <input
                    type="text"
                    value={courierBaseUrl}
                    onChange={(e) => setCourierBaseUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[13px] font-mono text-[var(--text)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-[var(--text)] mb-1">
                    Steadfast API Key
                  </label>
                  <input
                    type="text"
                    value={courierApiKey}
                    onChange={(e) => setCourierApiKey(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[13px] font-mono text-[var(--text)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-[var(--text)] mb-1">
                    Steadfast Secret Key
                  </label>
                  <input
                    type="password"
                    value={courierSecretKey}
                    onChange={(e) => setCourierSecretKey(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[13px] font-mono text-[var(--text)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-hidden"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleTestCourier}
                    disabled={isTestingApi}
                    className="px-3 py-1.5 bg-[var(--surface-sunken)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] rounded-xl text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingApi ? 'animate-spin' : ''}`} />
                    <span>{isTestingApi ? 'Testing...' : 'Test Connection'}</span>
                  </button>

                  {apiTestResult && (
                    <span className="text-[11px] text-[var(--status-green)] font-medium">
                      {apiTestResult}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="h-14 px-5 border-t border-[var(--border)] bg-[var(--surface-sunken)] flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={closeSettingsModal}
            className="px-4 py-2 border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] rounded-xl text-[12px] font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="px-5 py-2 bg-[var(--accent)] text-white rounded-xl text-[12px] font-semibold hover:opacity-90 shadow-xs transition-opacity cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
