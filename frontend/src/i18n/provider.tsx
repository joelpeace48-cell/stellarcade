import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Locale = 'en' | 'es' | 'fr' | 'de' | 'ja';

export const DEFAULT_LOCALE: Locale = 'en';
export const DEFAULT_INTL_LOCALE = 'en-US';
export const LOCALE_TO_INTL: Record<Locale, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  ja: 'ja-JP',
};

interface I18nContextType {
  locale: Locale;
  intlLocale: string;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const messages: Record<Locale, Record<string, string>> = {
  en: {},
  es: {},
  fr: {},
  de: {},
  ja: {},
};

const loadMessages = async (locale: Locale): Promise<Record<string, string>> => {
  try {
    const module = await import(`./messages/${locale}.json`);
    return module.default;
  } catch {
    console.warn(`Failed to load messages for locale: ${locale}`);
    return {};
  }
};

export function isSupportedLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(LOCALE_TO_INTL, value)
  );
}

export function resolveIntlLocale(locale?: string | null): string {
  if (!locale) {
    return DEFAULT_INTL_LOCALE;
  }

  if (isSupportedLocale(locale)) {
    return LOCALE_TO_INTL[locale];
  }

  try {
    const [canonical] = Intl.getCanonicalLocales(locale);
    return canonical ?? DEFAULT_INTL_LOCALE;
  } catch {
    return DEFAULT_INTL_LOCALE;
  }
}

interface I18nProviderProps {
  children: ReactNode;
  defaultLocale?: Locale;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({
  children,
  defaultLocale = DEFAULT_LOCALE,
}) => {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [messageRegistry, setMessageRegistry] = useState(messages);

  const changeLocale = async (newLocale: Locale) => {
    if (newLocale === locale) return;

    if (
      !messageRegistry[newLocale] ||
      Object.keys(messageRegistry[newLocale]).length === 0
    ) {
      const newMessages = await loadMessages(newLocale);
      setMessageRegistry((prev) => ({
        ...prev,
        [newLocale]: newMessages,
      }));
    }

    setLocale(newLocale);
  };

  const t = (key: string, fallback?: string): string => {
    const localeMessages = messageRegistry[locale];
    const value = localeMessages[key];

    if (value !== undefined) {
      return value;
    }

    const defaultMessages = messageRegistry[DEFAULT_LOCALE];
    const defaultValue = defaultMessages[key];

    if (defaultValue !== undefined) {
      return defaultValue;
    }

    return fallback || key;
  };

  React.useEffect(() => {
    const initializeMessages = async () => {
      const defaultMessages = await loadMessages(defaultLocale);
      setMessageRegistry((prev) => ({
        ...prev,
        [defaultLocale]: defaultMessages,
      }));
    };

    void initializeMessages();
  }, [defaultLocale]);

  const value: I18nContextType = {
    locale,
    intlLocale: resolveIntlLocale(locale),
    setLocale: changeLocale,
    t,
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

export default I18nProvider;
