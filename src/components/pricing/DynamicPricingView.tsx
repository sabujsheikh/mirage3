import { PageHeader } from '../common/PageHeader';
import React, { useState } from 'react';
import {
  Tag,
  TrendingDown,
  TrendingUp,
  Percent,
  Plus,
  Search,
  Sliders,
  DollarSign,
  ShieldCheck,
  Building,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Trash2,
  Clock,
  Calendar,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  CompetitorPriceRecord,
  PricingRule,
  PricingCampaign,
  RepricingSuggestion,
} from '../../types';

export const DynamicPricingView: React.FC = () => {
  const {
    products,
    competitorPrices,
    pricingRules,
    pricingCampaigns,
    repricingSuggestions,
    recordCompetitorPrice,
    deleteCompetitorPrice,
    savePricingRule,
    createPricingCampaign,
    togglePricingCampaign,
    applyRepricing,
    refreshAll,
  } = useApp();
  const { can } = useAuth();

  const [activeTab, setActiveTab] = useState<'engine' | 'competitors' | 'campaigns'>('engine');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Rule Configuration Modal / State
  const activeRule = pricingRules[0] || {
    id: 'rule_default',
    name: 'Dynamic Market Undercut & Cost-Plus Guardrail',
    strategy: 'competitor_undercut',
    minimum_margin_percent: 20,
    target_margin_percent: 35,
    max_discount_percent: 15,
    undercut_amount: 50,
    active: true,
  };

  const [showRuleModal, setShowRuleModal] = useState(false);
  const [minMargin, setMinMargin] = useState<number>(activeRule.minimum_margin_percent);
  const [targetMargin, setTargetMargin] = useState<number>(activeRule.target_margin_percent);
  const [maxDiscount, setMaxDiscount] = useState<number>(activeRule.max_discount_percent);
  const [undercutAmount, setUndercutAmount] = useState<number>(activeRule.undercut_amount);
  const [strategy, setStrategy] = useState<any>(activeRule.strategy);

  // Competitor Price Modal
  const [showCompModal, setShowCompModal] = useState(false);
  const [compProductId, setCompProductId] = useState(products[0]?.id || '');
  const [compName, setCompName] = useState('Sundora');
  const [compPrice, setCompPrice] = useState<number>(0);
  const [compUrl, setCompUrl] = useState('');
  const [compNotes, setCompNotes] = useState('');

  // Campaign Modal
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed_amount'>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(10);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [targetType, setTargetType] = useState<'all' | 'category' | 'brand' | 'sku'>('category');
  const [targetValue, setTargetValue] = useState('Amber Gourmand');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applyingProductId, setApplyingProductId] = useState<string | null>(null);

  // Filtered Repricing Suggestions
  const filteredSuggestions = repricingSuggestions.filter((s) => {
    const matchesSearch =
      s.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' ? true : s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredCompetitors = competitorPrices.filter((cp) => {
    return (
      cp.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cp.competitor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cp.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await savePricingRule({
        ...activeRule,
        strategy,
        minimum_margin_percent: Number(minMargin),
        target_margin_percent: Number(targetMargin),
        max_discount_percent: Number(maxDiscount),
        undercut_amount: Number(undercutAmount),
      });
      setShowRuleModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save pricing rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogCompetitorPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (compPrice <= 0) {
      alert('Competitor price must be greater than 0');
      return;
    }
    setIsSubmitting(true);
    try {
      await recordCompetitorPrice({
        product_id: compProductId,
        competitor_name: compName,
        competitor_price: Number(compPrice),
        competitor_url: compUrl,
        notes: compNotes,
      });
      setShowCompModal(false);
      setCompPrice(0);
      setCompUrl('');
      setCompNotes('');
    } catch (err: any) {
      alert(err.message || 'Failed to log competitor price');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName.trim() || discountValue <= 0) {
      alert('Please provide campaign name and valid discount value');
      return;
    }
    setIsSubmitting(true);
    try {
      await createPricingCampaign({
        name: campaignName,
        discount_type: discountType,
        discount_value: Number(discountValue),
        start_date: startDate,
        end_date: endDate,
        target_type: targetType,
        target_value: targetValue,
      });
      setShowCampaignModal(false);
      setCampaignName('');
      setDiscountValue(10);
    } catch (err: any) {
      alert(err.message || 'Failed to create campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyReprice = async (s: RepricingSuggestion) => {
    setApplyingProductId(s.product_id);
    try {
      await applyRepricing(s.product_id, s.suggested_price, s.recommendation_reason);
    } catch (err: any) {
      alert(err.message || 'Failed to apply repricing');
    } finally {
      setApplyingProductId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto" id="dynamic-pricing-view">
      {/* Top Header */}
      <PageHeader
        eyebrow="Pricing"
        title="Pricing Engine & Market Data"
        desc="Weighted-average landed cost margins, competitor price tracking, and margin protection rules"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-medium">Margin Floor Guardrail</span>
            <ShieldCheck className="w-4 h-4 text-[var(--status-green)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--text)]">
            {activeRule.minimum_margin_percent}% Min
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            Target: <span className="font-bold text-[var(--accent)]">{activeRule.target_margin_percent}%</span> &#8226; Max Staff Disc: {activeRule.max_discount_percent}%
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-medium">Competitor Data Points</span>
            <Building className="w-4 h-4 text-[var(--status-teal)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--status-teal)]">{competitorPrices.length} tracked</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Sundora, Perfume BD, Scentsation, etc.</div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-medium">Repricing Opportunities</span>
            <Zap className="w-4 h-4 text-[var(--status-amber)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--status-amber)]">
            {repricingSuggestions.filter((s) => s.status !== 'optimal').length} SKUs
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Overpriced or undervalued in market</div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-medium">Active Flash Campaigns</span>
            <Percent className="w-4 h-4 text-[var(--accent-secondary)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--accent-secondary)]">
            {pricingCampaigns.filter((c) => c.active).length} active
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Seasonal & category promotions</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] gap-2">
        <button
          onClick={() => setActiveTab('engine')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'engine'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <Zap className="w-4 h-4" />
          Dynamic Repricing Matrix ({repricingSuggestions.length} SKUs)
        </button>

        <button
          onClick={() => setActiveTab('competitors')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'competitors'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <Building className="w-4 h-4" />
          Competitor Price Tracker ({competitorPrices.length})
        </button>

        <button
          onClick={() => setActiveTab('campaigns')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'campaigns'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <Percent className="w-4 h-4" />
          Promotional Campaigns ({pricingCampaigns.length})
        </button>
      </div>

      {/* TAB 1: DYNAMIC REPRICING MATRIX */}
      {activeTab === 'engine' && (
        <div className="space-y-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search SKU or perfume name..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-[var(--border)] rounded-lg bg-[var(--surface-sunken)] text-[var(--text)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-semibold"
              >
                <option value="all">All Market Statuses</option>
                <option value="optimal">Optimal (Aligned)</option>
                <option value="overpriced">Overpriced vs Competitors</option>
                <option value="undervalued">Undervalued</option>
                <option value="below_floor">Below Margin Floor</option>
              </select>
            </div>
          </div>

          <div className="dense-table-container">
            <div className="overflow-x-auto">
              <table className="dense-table">
                <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[11px] text-[var(--text-muted)] uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-3">SKU & Perfume</th>
                    <th className="px-4 py-3 text-right">Landed Cost</th>
                    <th className="px-4 py-3 text-right">Floor Price</th>
                    <th className="px-4 py-3 text-right">Current Price</th>
                    <th className="px-4 py-3 text-right">Lowest Competitor</th>
                    <th className="px-4 py-3 text-right">Suggested Price</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredSuggestions.map((s) => (
                    <tr key={s.product_id} className="hover:bg-[var(--surface-hover)] transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-[var(--text)]">{s.product_name}</div>
                        <div className="text-[10px] text-[var(--text-muted)] font-mono">{s.sku} &#8226; {s.category_name}</div>
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-[var(--text-muted)]">
                        &#2547;{s.cost_price.toLocaleString()}
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-[var(--status-red)] font-bold">
                        &#2547;{s.floor_price.toLocaleString()}
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-black text-[var(--text)] text-sm">
                        &#2547;{s.current_price.toLocaleString()}
                      </td>

                      <td className="px-4 py-3 text-right font-mono">
                        {s.lowest_competitor_price ? (
                          <div>
                            <span className="font-bold text-[var(--status-teal)]">&#2547;{s.lowest_competitor_price.toLocaleString()}</span>
                            <span className="block text-[9px] text-[var(--text-muted)]">{s.lowest_competitor_name}</span>
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)]">&#8212;</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-black text-[var(--status-green)] text-sm">
                        &#2547;{s.suggested_price.toLocaleString()}
                        <span className="block text-[9px] text-[var(--status-green)] font-bold font-sans">
                          {s.projected_margin_percent.toFixed(0)}% Margin
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        {s.status === 'optimal' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] text-[var(--status-green)]">
                            OPTIMAL
                          </span>
                        ) : s.status === 'overpriced' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[color-mix(in_srgb,var(--status-amber)_10%,transparent)] text-[var(--status-amber)]">
                            OVERPRICED
                          </span>
                        ) : s.status === 'below_floor' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] text-[var(--status-red)]">
                            BELOW FLOOR
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[color-mix(in_srgb,var(--status-teal)_10%,transparent)] text-[var(--status-teal)]">
                            UNDERVALUED
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {s.current_price !== s.suggested_price && can('create_edit_products') ? (
                          <button
                            onClick={() => handleApplyReprice(s)}
                            disabled={applyingProductId === s.product_id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                          >
                            <Zap className="w-3 h-3" />
                            {applyingProductId === s.product_id ? 'Applying...' : 'Reprice'}
                          </button>
                        ) : (
                          <span className="text-[10px] text-[var(--text-muted)] font-semibold">In Sync</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COMPETITOR PRICE TRACKER */}
      {activeTab === 'competitors' && (
        <div className="space-y-4">
          <div className="dense-table-container">
            <div className="overflow-x-auto">
              <table className="dense-table">
                <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[11px] text-[var(--text-muted)] uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Perfume & SKU</th>
                    <th className="px-4 py-3">Competitor Retailer</th>
                    <th className="px-4 py-3 text-right">Competitor Price</th>
                    <th className="px-4 py-3 text-right">Our Current Price</th>
                    <th className="px-4 py-3 text-right">Price Variance</th>
                    <th className="px-4 py-3">Notes & Reference</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredCompetitors.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-xs text-[var(--text-muted)]">
                        No competitor price records logged yet.
                      </td>
                    </tr>
                  ) : (
                    filteredCompetitors.map((cp) => {
                      const prod = products.find((p) => p.id === cp.product_id);
                      const ourPrice = prod ? prod.regular_price : 0;
                      const diff = ourPrice - cp.competitor_price;

                      return (
                        <tr key={cp.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-bold text-[var(--text)]">{cp.product_name}</div>
                            <div className="text-[10px] text-[var(--text-muted)] font-mono">{cp.sku}</div>
                          </td>

                          <td className="px-4 py-3 font-semibold text-[var(--text)]">
                            {cp.competitor_name}
                          </td>

                          <td className="px-4 py-3 text-right font-mono font-bold text-[var(--status-teal)] text-sm">
                            &#2547;{cp.competitor_price.toLocaleString()}
                          </td>

                          <td className="px-4 py-3 text-right font-mono font-bold text-[var(--text)] text-sm">
                            &#2547;{ourPrice.toLocaleString()}
                          </td>

                          <td className={`px-4 py-3 text-right font-mono font-bold ${diff > 0 ? 'text-[var(--status-red)]' : diff < 0 ? 'text-[var(--status-green)]' : 'text-[var(--text)]'}`}>
                            {diff > 0 ? `+\u09F3${diff} (Higher)` : diff < 0 ? `-\u09F3${Math.abs(diff)} (Lower)` : 'Matching (\u09F30)'}
                          </td>

                          <td className="px-4 py-3 text-[var(--text-muted)] text-[11px] max-w-xs truncate">
                            {cp.notes || '\u2014'}
                            {cp.competitor_url && (
                              <a
                                href={cp.competitor_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-0.5 ml-2 text-[var(--accent)] hover:underline font-bold"
                              >
                                Link <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            {can('create_edit_products') && (
                              <button
                                onClick={() => deleteCompetitorPrice(cp.id)}
                                className="p-1.5 text-[var(--status-red)] hover:bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] rounded transition-colors cursor-pointer"
                                title="Delete Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PROMOTIONAL CAMPAIGNS */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            {can('create_edit_products') && (
              <button
                onClick={() => setShowCampaignModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-[var(--accent)] text-white hover:opacity-90 shadow-sm transition-opacity cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                New Promotional Campaign
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pricingCampaigns.map((cmp) => (
              <div key={cmp.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--border)]">
                      {cmp.discount_type === 'percentage' ? `${cmp.discount_value}% OFF` : `\u09F3${cmp.discount_value} OFF`}
                    </span>
                    <h3 className="font-bold text-sm text-[var(--text)] mt-2">{cmp.name}</h3>
                  </div>

                  <button
                    onClick={() => togglePricingCampaign(cmp.id, !cmp.active)}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                      cmp.active
                        ? 'bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] text-[var(--status-green)] border border-[color-mix(in_srgb,var(--status-green)_30%,transparent)]'
                        : 'bg-[color-mix(in_srgb,var(--status-gray)_12%,transparent)] text-[var(--text-secondary)] border border-[color-mix(in_srgb,var(--status-gray)_30%,transparent)]'
                    }`}
                  >
                    {cmp.active ? 'ACTIVE' : 'PAUSED'}
                  </button>
                </div>

                <div className="p-3 bg-[var(--surface-sunken)] rounded-lg text-xs space-y-1">
                  <p className="text-[var(--text-muted)]">
                    Target: <strong className="text-[var(--text)]">{cmp.target_type.toUpperCase()}</strong> ({cmp.target_value || 'All'})
                  </p>
                  <p className="text-[var(--text-muted)] font-mono text-[11px]">
                    Valid: {cmp.start_date} to {cmp.end_date}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- MODAL: Configure Margin Rules --- */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[var(--accent)]" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)]">Configure Margin & Repricing Rules</h3>
                  <p className="text-xs text-[var(--text-muted)]">Automated guardrails protecting business profitability</p>
                </div>
              </div>
              <button onClick={() => setShowRuleModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="p-6 space-y-4">
              <div>
                <label className="block font-bold text-[var(--text)] mb-1">Repricing Strategy</label>
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-semibold"
                >
                  <option value="competitor_undercut">Competitor Undercut (Undercut lowest competitor)</option>
                  <option value="market_match">Market Average Match</option>
                  <option value="cost_plus">Cost-Plus Margin Target</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Minimum Margin Floor (%)</label>
                  <input
                    type="number"
                    min="5"
                    max="50"
                    value={minMargin}
                    onChange={(e) => setMinMargin(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--status-red)] font-mono font-bold"
                  />
                  <span className="text-[10px] text-[var(--text-muted)]">Absolute profit safeguard</span>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Target Margin (%)</label>
                  <input
                    type="number"
                    min="10"
                    max="80"
                    value={targetMargin}
                    onChange={(e) => setTargetMargin(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--status-green)] font-mono font-bold"
                  />
                  <span className="text-[10px] text-[var(--text-muted)]">Standard target markup</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Undercut Amount (&#2547;)</label>
                  <input
                    type="number"
                    min="10"
                    value={undercutAmount}
                    onChange={(e) => setUndercutAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Max Staff Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--accent)] font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-xs font-bold rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-lg hover:opacity-90 shadow-sm transition-all cursor-pointer"
                >
                  Save Rules
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: Log Competitor Price --- */}
      {showCompModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-[var(--accent)]" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)]">Log Competitor Fragrance Price</h3>
                  <p className="text-xs text-[var(--text-muted)]">Track market pricing in Bangladesh</p>
                </div>
              </div>
              <button onClick={() => setShowCompModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLogCompetitorPrice} className="p-6 space-y-4">
              <div>
                <label className="block font-bold text-[var(--text)] mb-1">Select Product *</label>
                <select
                  value={compProductId}
                  onChange={(e) => setCompProductId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-semibold"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Competitor Name *</label>
                  <select
                    value={compName}
                    onChange={(e) => setCompName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-semibold"
                  >
                    <option value="Sundora">Sundora</option>
                    <option value="Perfume BD">Perfume BD</option>
                    <option value="Bangla Shoppers">Bangla Shoppers</option>
                    <option value="Scentsation">Scentsation</option>
                    <option value="Buy Perfume in BD">Buy Perfume in BD</option>
                    <option value="Other">Other Retailer</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Competitor Price (&#2547;) *</label>
                  <input
                    type="number"
                    min="1"
                    value={compPrice}
                    onChange={(e) => setCompPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--status-teal)] font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[var(--text)] mb-1">Competitor Product URL</label>
                <input
                  type="url"
                  placeholder="https://sundora.com.bd/lattafa-khamrah..."
                  value={compUrl}
                  onChange={(e) => setCompUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-bold text-[var(--text)] mb-1">Notes / Batch Details</label>
                <input
                  type="text"
                  placeholder="e.g. Flash sale price, In-store discount only..."
                  value={compNotes}
                  onChange={(e) => setCompNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowCompModal(false)}
                  className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-xs font-bold rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-lg hover:opacity-90 shadow-sm transition-all cursor-pointer"
                >
                  Log Price
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: New Promotional Campaign --- */}
      {showCampaignModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-[var(--accent)]" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)]">Create Promotional Flash Campaign</h3>
                  <p className="text-xs text-[var(--text-muted)]">Configure seasonal discounts and sales triggers</p>
                </div>
              </div>
              <button onClick={() => setShowCampaignModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="p-6 space-y-4">
              <div>
                <label className="block font-bold text-[var(--text)] mb-1">Campaign Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Eid Al-Fitr Fragrance Special..."
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Discount Type</label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-semibold"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed_amount">Fixed Amount (&#2547;)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Discount Value *</label>
                  <input
                    type="number"
                    min="1"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--accent)] font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowCampaignModal(false)}
                  className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-xs font-bold rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-lg hover:opacity-90 shadow-sm transition-all cursor-pointer"
                >
                  Launch Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
