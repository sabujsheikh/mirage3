import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemePreset } from '../types';

export type FontFamilyPreset =
  | 'inter'
  | 'helvetica'
  | 'calibri'
  | 'sans-serif'
  | 'roboto'
  | 'open-sans';

export type ResolvedTheme = 'light' | 'dark';

export interface FontOption {
  id: FontFamilyPreset;
  name: string;
  fontFamilyCss: string;
  preview: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: 'inter',
    name: 'Default (Inter)',
    fontFamilyCss: "'Inter', system-ui, -apple-system, sans-serif",
    preview: 'Clean modern enterprise sans-serif',
  },
  {
    id: 'helvetica',
    name: 'Helvetica',
    fontFamilyCss: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    preview: 'Classic timeless Swiss typography',
  },
  {
    id: 'calibri',
    name: 'Calibri',
    fontFamilyCss: "'Calibri', 'Segoe UI', Candara, Arial, sans-serif",
    preview: 'Corporate clear office typography',
  },
  {
    id: 'sans-serif',
    name: 'System Sans-Serif',
    fontFamilyCss: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    preview: 'Native operating system typography',
  },
  {
    id: 'roboto',
    name: 'Roboto',
    fontFamilyCss: "'Roboto', -apple-system, BlinkMacSystemFont, sans-serif",
    preview: 'Geometric modern structured font',
  },
  {
    id: 'open-sans',
    name: 'Open Sans',
    fontFamilyCss: "'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    preview: 'Friendly open high-legibility font',
  },
];

/**
 * Theme configurations for the Light / Dark / System mode selector.
 * `light` reflects the deep navy + warm gold "premium software" palette
 * (AGENTS.md Section 36.1), `dark` is its professional eye-comfort dark
 * counterpart. The swatches drive the preview pills in Settings.
 */
export interface ThemeConfig {
  id: ThemePreset;
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  bgColor: string;
  cardColor: string;
  isDark: boolean;
}

export const THEME_CONFIGS: ThemeConfig[] = [
  {
    id: 'light',
    name: 'Light',
    description: 'Warm off-white canvas, white surfaces, deep navy primary, muted gold accent \u2014 the default premium look.',
    primaryColor: '#16324F',
    secondaryColor: '#B8860B',
    bgColor: '#F9F8F7',
    cardColor: '#FFFFFF',
    isDark: false,
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Eye-comfort obsidian surfaces with navy-tinted accents and warm gold highlights.',
    primaryColor: '#4A7BA6',
    secondaryColor: '#D4A017',
    bgColor: '#1A1D23',
    cardColor: '#22262E',
    isDark: true,
  },
  {
    id: 'system',
    name: 'System',
    description: 'Automatically follows your operating system / browser preference (light or dark).',
    primaryColor: '#16324F',
    secondaryColor: '#B8860B',
    bgColor: '#F9F8F7',
    cardColor: '#FFFFFF',
    isDark: false,
  },
];

interface ThemeContextType {
  theme: ThemePreset;
  setTheme: (theme: ThemePreset) => void;
  resolvedTheme: ResolvedTheme;
  fontFamily: FontFamilyPreset;
  setFontFamily: (font: FontFamilyPreset) => void;
  fontOptions: FontOption[];
  activeFont: FontOption;
  activeConfig: ThemeConfig;
  themeConfigs: ThemeConfig[];
  isSettingsModalOpen: boolean;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

function preferredResolvedTheme(): ResolvedTheme {
  try {
    return typeof window !== 'undefined' && window.matchMedia(SYSTEM_DARK_QUERY).matches
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Theme mode state: 'light' | 'dark' | 'system' (user's explicit preference)
  const [theme, setThemeState] = useState<ThemePreset>(() => {
    try {
      const saved = localStorage.getItem('mirage_erp_theme_preset') as ThemePreset;
      if (saved && ['light', 'dark', 'system'].includes(saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'system';
  });

  // The "system" preference is resolved to a concrete light/dark at runtime
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia(SYSTEM_DARK_QUERY).matches
  );

  // Font family state
  const [fontFamily, setFontFamilyState] = useState<FontFamilyPreset>(() => {
    try {
      const saved = localStorage.getItem('mirage_erp_font_family') as FontFamilyPreset;
      if (saved && FONT_OPTIONS.some((f) => f.id === saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'inter';
  });

  useEffect(() => {
    // React to OS/browser dark-mode changes while in System mode
    const mq = window.matchMedia(SYSTEM_DARK_QUERY);
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    // Older Safari uses addListener
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    try {
      mq.addListener(handler as any);
      return () => mq.removeListener(handler as any);
    } catch {
      return undefined;
    }
  }, []);

  const resolvedTheme: ResolvedTheme =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  const setTheme = (newTheme: ThemePreset) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('mirage_erp_theme_preset', newTheme);
    } catch {
      // ignore
    }
  };

  const setFontFamily = (newFont: FontFamilyPreset) => {
    setFontFamilyState(newFont);
    try {
      localStorage.setItem('mirage_erp_font_family', newFont);
    } catch {
      // ignore
    }
  };

  // Apply the resolved theme attribute (drives CSS tokens in index.css)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    // Also mirror the chosen format onto the html element so the Settings UI
    // and any future consumers can read the raw preference.
    document.documentElement.setAttribute('data-theme-mode', theme);
  }, [resolvedTheme, theme]);

  // Apply font family globally (Surface/body base + --app-font-family token,
  // which Tailwind's font-sans resolves through via the @theme override).
  useEffect(() => {
    const matched = FONT_OPTIONS.find((f) => f.id === fontFamily) || FONT_OPTIONS[0];
    document.documentElement.style.setProperty('--app-font-family', matched.fontFamilyCss);
  }, [fontFamily]);

  const activeConfig = THEME_CONFIGS.find((t) => t.id === theme) || THEME_CONFIGS[0];
  const activeFont = FONT_OPTIONS.find((f) => f.id === fontFamily) || FONT_OPTIONS[0];

  // Settings modal state (retained for compatibility; currently unmounted)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const openSettingsModal = () => setIsSettingsModalOpen(true);
  const closeSettingsModal = () => setIsSettingsModalOpen(false);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        resolvedTheme,
        fontFamily,
        setFontFamily,
        fontOptions: FONT_OPTIONS,
        activeFont,
        activeConfig,
        themeConfigs: THEME_CONFIGS,
        isSettingsModalOpen,
        openSettingsModal,
        closeSettingsModal,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};