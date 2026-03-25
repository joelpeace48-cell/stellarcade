import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Locale = 'en' | 'es' | 'fr' | 'de' | 'ja';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

// Default locale fallback
const DEFAULT_LOCALE: Locale = 'en';

// Message registry
const messages: Record<Locale, Record<string, string>> = {
  en: {},
  es: {},
  fr: {},
  de: {},
  ja: {},
};

// Load messages dynamically
const loadMessages = async (locale: Locale): Promise<Record<string, string>> => {
  try {
    const module = await import(`./messages/${locale}.json`);
    return module.default;
  } catch (error) {
    console.warn(`Failed to load messages for locale: ${locale}`);
    return {};
  }
};

interface I18nProviderProps {
  children: ReactNode;
  defaultLocale?: Locale;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ 
  children, 
  defaultLocale = DEFAULT_LOCALE 
}) => {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [messageRegistry, setMessageRegistry] = useState(messages);

  const changeLocale = async (newLocale: Locale) => {
    if (newLocale === locale) return;
    
    // Load messages for new locale if not already loaded
    if (!messageRegistry[newLocale] || Object.keys(messageRegistry[newLocale]).length === 0) {
      const newMessages = await loadMessages(newLocale);
      setMessageRegistry(prev => ({
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
    
    // Fallback to default locale
    const defaultMessages = messageRegistry[DEFAULT_LOCALE];
    const defaultValue = defaultMessages[key];
    
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    
    // Return fallback or key if no translation found
    return fallback || key;
  };

  // Load default locale messages on mount
  React.useEffect(() => {
    const initializeMessages = async () => {
      const defaultMessages = await loadMessages(defaultLocale);
      setMessageRegistry(prev => ({
        ...prev,
        [defaultLocale]: defaultMessages,
      }));
    };
    
    initializeMessages();
  }, [defaultLocale]);

  const value: I18nContextType = {
    locale,
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
