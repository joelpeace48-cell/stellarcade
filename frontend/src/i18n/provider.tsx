import React, { createContext, useContext, useState, ReactNode } from 'react';
import deMessages from './messages/de.json';
import enMessages from './messages/en.json';
import esMessages from './messages/es.json';
import frMessages from './messages/fr.json';
import jaMessages from './messages/ja.json';

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

export const LOCALE_STORAGE_KEY = 'stellarcade_locale';

interface I18nContextType {
  locale: Locale;
  intlLocale: string;
  setLocale: (locale: Locale) => void;
  resetLocale: () => void;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const STATIC_MESSAGES: Record<Locale, Record<string, string>> = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
  de: deMessages,
  ja: jaMessages,
};

const messages: Record<Locale, Record<string, string>> = {
  en: STATIC_MESSAGES.en,
  es: STATIC_MESSAGES.es,
  fr: STATIC_MESSAGES.fr,
  de: STATIC_MESSAGES.de,
  ja: STATIC_MESSAGES.ja,
};

const loadMessages = async (locale: Locale): Promise<Record<string, string>> => {
  try {
    return STATIC_MESSAGES[locale] ?? {};
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

export function resolveInitialLocale(defaultFallback: Locale = DEFAULT_LOCALE): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isSupportedLocale(saved)) {
      return saved;
    }
  } catch {
    // ignore
  }

  if (typeof navigator !== 'undefined') {
    const browserLangs = navigator.languages || [navigator.language];
    for (const lang of browserLangs) {
      if (!lang) continue;
      if (isSupportedLocale(lang)) return lang;
      
      const base = lang.split('-')[0];
      if (isSupportedLocale(base)) return base;
    }
  }

  return defaultFallback;
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
  onMissingTranslation?: (key: string, locale: Locale) => void;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({
  children,
  defaultLocale = DEFAULT_LOCALE,
  onMissingTranslation,
}) => {
  const [locale, setLocaleState] = useState<Locale>(() => resolveInitialLocale(defaultLocale));
  const [messageRegistry, setMessageRegistry] = useState(messages);

  const applyLocaleUpdate = async (newLocale: Locale, persist: boolean) => {
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

    if (persist) {
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
      } catch {
        // ignore
      }
    }

    setLocaleState(newLocale);
  };

  const changeLocale = async (newLocale: Locale) => {
    await applyLocaleUpdate(newLocale, true);
  };

  const resetLocale = async () => {
    try {
      localStorage.removeItem(LOCALE_STORAGE_KEY);
    } catch {
      // ignore
    }
    const initial = resolveInitialLocale(defaultLocale);
    await applyLocaleUpdate(initial, false);
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
      if (import.meta.env.DEV && locale !== DEFAULT_LOCALE) {
        if (onMissingTranslation) {
          onMissingTranslation(key, locale);
        } else {
          console.warn(`[i18n] Missing translation for key "${key}" in locale "${locale}"`);
        }
      }
      return defaultValue;
    }

    if (import.meta.env.DEV) {
      if (onMissingTranslation) {
        onMissingTranslation(key, locale);
      } else {
        console.warn(`[i18n] Missing translation for key "${key}" in all locales`);
      }
    }

    return fallback || key;
  };

  React.useEffect(() => {
    const initializeMessages = async () => {
      const defaultMessages = await loadMessages(DEFAULT_LOCALE);
      
      const currentMessages = locale !== DEFAULT_LOCALE 
        ? await loadMessages(locale) 
        : defaultMessages;

      setMessageRegistry((prev) => ({
        ...prev,
        [DEFAULT_LOCALE]: defaultMessages,
        [locale]: currentMessages,
      }));
    };

    void initializeMessages();
  }, [defaultLocale, locale]);

  React.useEffect(() => {
    document.documentElement.lang = resolveIntlLocale(locale);
  }, [locale]);

  const value: I18nContextType = {
    locale,
    intlLocale: resolveIntlLocale(locale),
    setLocale: changeLocale,
    resetLocale,
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
