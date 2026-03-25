import React from 'react';
import { useI18n, Locale } from '../i18n/provider';

const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
};

export const LocaleSwitcher: React.FC = () => {
  const { locale, setLocale } = useI18n();

  const handleLocaleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLocale = event.target.value as Locale;
    setLocale(newLocale);
  };

  return (
    <div className="locale-switcher">
      <select 
        value={locale} 
        onChange={handleLocaleChange}
        className="locale-select"
      >
        {Object.entries(localeNames).map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LocaleSwitcher;
