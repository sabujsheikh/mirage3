import React, { useMemo, useState } from 'react';
import { Search, X, StickyNote, RotateCcw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product, PerfumeConcentration, PerfumeType } from '../../types';

const PERFUME_TYPES: PerfumeType[] = ['Middle Eastern', 'Western', 'Niche'];
const CONCENTRATIONS: PerfumeConcentration[] = ['EDP', 'EDT', 'Extrait', 'Parfum', 'Cologne', 'Attar', 'Concentrated Oil'];

const NoteChips: React.FC<{ values?: string[] }> = ({ values }) =>
  values && values.length ? (
    <div className="flex flex-wrap gap-1">
      {values.map((n, i) => (
        <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-[var(--surface-sunken)] text-[10px] font-medium text-[var(--text-secondary)]">
          {n}
        </span>
      ))}
    </div>
  ) : (
    <span className="text-[10px] text-[var(--text-muted)]">&#8212;</span>
  );

export const FragranceNotesView: React.FC = () => {
  const { products } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [concentrationFilter, setConcentrationFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter(p => {
      if (typeFilter !== 'all' && p.perfume_type !== typeFilter) return false;
      if (concentrationFilter !== 'all' && p.concentration !== concentrationFilter) return false;
      if (!q) return true;
      const notes = [...(p.top_notes || []), ...(p.heart_notes || []), ...(p.base_notes || []), ...(p.main_accords || [])].join(' ').toLowerCase();
      const hay = `${p.name} ${p.brand} ${p.sku} ${p.barcode} ${p.display_name} ${p.category_name || ''} ${p.perfume_type || ''} ${notes}`.toLowerCase();
      return hay.includes(q);
    });
  }, [products, typeFilter, concentrationFilter, searchQuery]);

  const reset = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setConcentrationFilter('all');
  };

  const chipGroups: { label: string; values?: string[] }[] = [
    { label: 'Top Notes', values: selected?.top_notes },
    { label: 'Heart Notes', values: selected?.heart_notes },
    { label: 'Base Notes', values: selected?.base_notes },
    { label: 'Main Accords', values: selected?.main_accords },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[300px]">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name, brand, SKU, note, or accord..."
              className="erp-input pl-8 w-full"
            />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="erp-select">
            <option value="all">All Types</option>
            {PERFUME_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={concentrationFilter} onChange={e => setConcentrationFilter(e.target.value)} className="erp-select">
            <option value="all">All Concentrations</option>
            {CONCENTRATIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 text-[12px] text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer"
            title="Reset all filters"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
        <div className="text-[11px] text-[var(--text-muted)]">
          {filtered.length} of {products.length} SKUs with notes
        </div>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dense-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Type</th>
                <th>Concentration</th>
                <th>Top</th>
                <th>Heart</th>
                <th>Base</th>
                <th>Accords</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[var(--text-muted)]">
                    No products match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id} className="dense-table-row-clickable" onClick={() => setSelected(p)}>
                    <td>
                      <div className="font-semibold text-[var(--text)]">{p.display_name}</div>
                      <div className="text-[10px] text-[var(--text-muted)] font-num">{p.sku}</div>
                    </td>
                    <td>
                      {p.perfume_type ? (
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border whitespace-nowrap"
                          style={{
                            color: 'var(--accent)',
                            borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)',
                            background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
                          }}
                        >
                          {p.perfume_type}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)] opacity-50">&#8212;</span>
                      )}
                    </td>
                    <td className="text-[var(--text-secondary)] text-[11px]">{p.concentration}</td>
                    <td className="max-w-[140px]"><NoteChips values={p.top_notes} /></td>
                    <td className="max-w-[140px]"><NoteChips values={p.heart_notes} /></td>
                    <td className="max-w-[140px]"><NoteChips values={p.base_notes} /></td>
                    <td className="max-w-[120px]"><NoteChips values={p.main_accords} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div className="bg-[var(--card)] w-full max-w-md rounded-xl shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <h2 className="text-base font-semibold text-[var(--text)]">Fragrance Notes</h2>
              <button onClick={() => setSelected(null)} className="text-[var(--text-secondary)] hover:text-[var(--text)]"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--surface-sunken)] flex items-center justify-center shrink-0">
                  <StickyNote className="w-5 h-5 text-[var(--text-muted)]" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-[var(--text)] break-words">{selected.display_name}</div>
                  <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    {selected.perfume_type || '\u2014'} &#183; {selected.concentration}
                    <span className="text-[var(--text-muted)] font-num"> &#183; {selected.sku}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {chipGroups.map(g => (
                  <div key={g.label}>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">{g.label}</div>
                    <div className="flex flex-wrap gap-1.5"><NoteChips values={g.values} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};