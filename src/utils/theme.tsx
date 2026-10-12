import React, { createContext, useContext, useState, useEffect } from 'react';
import { safeStorage } from './safeStorage';

export type DesignStyle = 'default' | 'apple';
export type ColorTheme = 'teal' | 'ocean' | 'autumn' | 'charcoal';

interface ThemeContextType {
  designStyle: DesignStyle;
  setDesignStyle: (style: DesignStyle) => void;
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [designStyle, setDesignStyleState] = useState<DesignStyle>(() => {
    try {
      const saved = safeStorage.getItem('uper-design-style') as DesignStyle;
      return saved === 'apple' || saved === 'default' ? saved : 'default';
    } catch {
      return 'default';
    }
  });

  const [colorTheme, setColorThemeState] = useState<ColorTheme>(() => {
    try {
      const saved = safeStorage.getItem('uper-color-theme') as ColorTheme;
      return (saved === 'teal' || saved === 'ocean' || saved === 'autumn' || saved === 'charcoal') ? saved : 'teal';
    } catch {
      return 'teal';
    }
  });

  const setDesignStyle = (style: DesignStyle) => {
    setDesignStyleState(style);
    try {
      safeStorage.setItem('uper-design-style', style);
      if (typeof document !== 'undefined') {
        const root = document.documentElement;
        if (style === 'default') {
          root.removeAttribute('data-design-style');
        } else {
          root.setAttribute('data-design-style', style);
        }
      }
    } catch (e) {
      console.warn('[Theme] Could not persist designStyle:', e);
    }
  };

  const setColorTheme = (theme: ColorTheme) => {
    setColorThemeState(theme);
    try {
      safeStorage.setItem('uper-color-theme', theme);
      if (typeof document !== 'undefined') {
        const root = document.documentElement;
        if (theme === 'teal') {
          root.removeAttribute('data-color-theme');
        } else {
          root.setAttribute('data-color-theme', theme);
        }
      }
    } catch (e) {
      console.warn('[Theme] Could not persist colorTheme:', e);
    }
  };

  // Keep in sync with index.html applied values and potential cross-tab changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const currentStyle = root.getAttribute('data-design-style') as DesignStyle || 'default';
    const currentTheme = root.getAttribute('data-color-theme') as ColorTheme || 'teal';

    setDesignStyleState(currentStyle);
    setColorThemeState(currentTheme);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'uper-design-style') {
        const val = e.newValue as DesignStyle;
        if (val === 'apple' || val === 'default') {
          setDesignStyleState(val);
        }
      }
      if (e.key === 'uper-color-theme') {
        const val = e.newValue as ColorTheme;
        if (val === 'teal' || val === 'ocean' || val === 'autumn' || val === 'charcoal') {
          setColorThemeState(val);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return (
    <ThemeContext.Provider value={{ designStyle, setDesignStyle, colorTheme, setColorTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useDesignStyle() {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fallback if rendered outside ThemeProvider
    return {
      designStyle: 'default' as DesignStyle,
      setDesignStyle: () => {},
      isApple: false,
    };
  }
  return {
    designStyle: context.designStyle,
    setDesignStyle: context.setDesignStyle,
    isApple: context.designStyle === 'apple',
  };
}

export function useColorTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fallback if rendered outside ThemeProvider
    return {
      colorTheme: 'teal' as ColorTheme,
      setColorTheme: () => {},
    };
  }
  return {
    colorTheme: context.colorTheme,
    setColorTheme: context.setColorTheme,
  };
}

