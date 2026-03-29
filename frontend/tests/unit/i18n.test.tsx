import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider, useI18n } from '../../src/i18n/provider';
import LocaleSwitcher from '../../src/components/LocaleSwitcher';
import React from 'react';

// Test component that uses the i18n hook
const TestComponent: React.FC = () => {
  const { t, locale, setLocale } = useI18n();
  
  return (
    <div>
      <div data-testid="locale">{locale}</div>
      <div data-testid="translated-text">{t('app.title')}</div>
      <div data-testid="missing-key">{t('non.existent.key', 'Fallback text')}</div>
      <button onClick={() => setLocale('es')}>Switch to Spanish</button>
    </div>
  );
};

const TestComponentNoFallback: React.FC = () => {
  const { t } = useI18n();
  return (
    <div data-testid="no-fallback">
      {t('completely.missing.key')}
    </div>
  );
};

const TestComponentInvalidLocale: React.FC = () => {
  const { setLocale } = useI18n();
  React.useEffect(() => {
    setLocale('nonexistent' as any);
  }, [setLocale]);
  return null;
};

const TestResetComponent: React.FC = () => {
  const { locale, resetLocale } = useI18n();
  return (
    <div>
      <span data-testid="current-locale">{locale}</span>
      <button onClick={resetLocale}>Reset Locale</button>
    </div>
  );
};

describe('I18n Provider', () => {
  beforeEach(() => {
    // Clear console warnings
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Prevent real browser picking 'en' from masking defaultLocale
    vi.stubGlobal('navigator', { languages: ['unsupported'] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('provides default locale context', () => {
    render(
      <I18nProvider>
        <TestComponent />
      </I18nProvider>
    );

    expect(screen.getByTestId('locale')).toHaveTextContent('en');
  });

  it('uses custom default locale', () => {
    render(
      <I18nProvider defaultLocale="es">
        <TestComponent />
      </I18nProvider>
    );

    expect(screen.getByTestId('locale')).toHaveTextContent('es');
  });

  it('translates keys correctly', async () => {
    render(
      <I18nProvider>
        <TestComponent />
      </I18nProvider>
    );

    // Wait for messages to load
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(screen.getByTestId('translated-text')).toHaveTextContent('StellarCade');
  });

  it('falls back to default locale for missing translations', async () => {
    render(
      <I18nProvider defaultLocale="es">
        <TestComponent />
      </I18nProvider>
    );

    // Wait for messages to load
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Should fall back to English for app.title if Spanish is missing
    expect(screen.getByTestId('translated-text')).toHaveTextContent('StellarCade');
  });

  it('uses fallback text for missing keys', () => {
    render(
      <I18nProvider>
        <TestComponent />
      </I18nProvider>
    );

    expect(screen.getByTestId('missing-key')).toHaveTextContent('Fallback text');
  });

  it('returns key when no fallback provided', () => {
    render(
      <I18nProvider>
        <TestComponentNoFallback />
      </I18nProvider>
    );

    expect(screen.getByTestId('no-fallback')).toHaveTextContent('completely.missing.key');
  });

  it('switches locale correctly', async () => {
    render(
      <I18nProvider>
        <TestComponent />
      </I18nProvider>
    );

    expect(screen.getByTestId('locale')).toHaveTextContent('en');

    const switchButton = screen.getByText('Switch to Spanish');
    fireEvent.click(switchButton);

    // Wait for locale change and message loading
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(screen.getByTestId('locale')).toHaveTextContent('es');
  });

  it('throws error when useI18n is used outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useI18n must be used within an I18nProvider');
    
    consoleError.mockRestore();
  });
});

describe('Locale Persistence & Fallback', () => {
  beforeEach(() => {
    localStorage.clear();
    const mockNavigator = { languages: ['fr-FR', 'fr'] };
    vi.stubGlobal('navigator', mockNavigator);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('uses browser language on first load if supported', async () => {
    const { resolveInitialLocale } = await import('../../src/i18n/provider');
    expect(resolveInitialLocale('en')).toBe('fr');
  });

  it('returns default fallback if browser language not supported', async () => {
    vi.stubGlobal('navigator', { languages: ['it-IT', 'it'] });
    const { resolveInitialLocale } = await import('../../src/i18n/provider');
    expect(resolveInitialLocale('en')).toBe('en');
  });

  it('restores locale from localStorage', async () => {
    localStorage.setItem('stellarcade_locale', 'ja');
    const { resolveInitialLocale } = await import('../../src/i18n/provider');
    expect(resolveInitialLocale('en')).toBe('ja');
  });

  it('persists locale on change', async () => {
    render(
      <I18nProvider>
        <TestComponent />
      </I18nProvider>
    );
    
    expect(localStorage.getItem('stellarcade_locale')).toBeNull();

    const switchButton = screen.getByText('Switch to Spanish');
    fireEvent.click(switchButton);

    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(localStorage.getItem('stellarcade_locale')).toBe('es');
  });

  it('resets locale to browser default and clears storage', async () => {
    vi.stubGlobal('navigator', { languages: ['de'] });
    localStorage.setItem('stellarcade_locale', 'ja');

    render(
      <I18nProvider>
        <TestResetComponent />
      </I18nProvider>
    );

    expect(screen.getByTestId('current-locale')).toHaveTextContent('ja');

    fireEvent.click(screen.getByText('Reset Locale'));
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(screen.getByTestId('current-locale')).toHaveTextContent('de');
    expect(localStorage.getItem('stellarcade_locale')).toBeNull();
  });
});

describe('Diagnostics & Fallbacks', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { languages: ['unsupported'] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('emits diagnostic for missing translations in DEV mode', async () => {
    const onMissingTranslation = vi.fn();
    render(
      <I18nProvider onMissingTranslation={onMissingTranslation}>
        <TestComponent />
      </I18nProvider>
    );

    expect(onMissingTranslation).toHaveBeenCalledWith('non.existent.key', 'en');
  });

  it('emits diagnostic when falling back to default locale', async () => {
    const onMissingTranslation = vi.fn();
    render(
      <I18nProvider defaultLocale="es" onMissingTranslation={onMissingTranslation}>
        <TestComponent />
      </I18nProvider>
    );

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(onMissingTranslation).toHaveBeenCalledWith('non.existent.key', 'es');
  });
});

describe('LocaleSwitcher', () => {
  it('renders locale options', () => {
    render(
      <I18nProvider>
        <LocaleSwitcher />
      </I18nProvider>
    );

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(5); // en, es, fr, de, ja
  });

  it('changes locale when selection changes', async () => {
    render(
      <I18nProvider>
        <LocaleSwitcher />
      </I18nProvider>
    );

    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('en');

    fireEvent.change(select, { target: { value: 'es' } });

    // Wait for locale change
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(select).toHaveValue('es');
  });
});

describe('Message Loading', () => {
  it('handles missing message files gracefully', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    render(
      <I18nProvider>
        <TestComponent />
      </I18nProvider>
    );

    // Try to switch to a locale that might not have messages loaded
    render(
      <I18nProvider>
        <TestComponentInvalidLocale />
      </I18nProvider>
    );

    // Should not crash and should show warning
    await new Promise(resolve => setTimeout(resolve, 100));
    
    consoleWarn.mockRestore();
  });
});
