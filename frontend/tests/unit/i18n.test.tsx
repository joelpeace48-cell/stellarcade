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

describe('I18n Provider', () => {
  beforeEach(() => {
    // Clear console warnings
    vi.spyOn(console, 'warn').mockImplementation(() => {});
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
