import React, { Suspense, lazy } from 'react';
import GameLobby from './pages/GameLobby';
import { I18nProvider, useI18n } from './i18n/provider';
import LocaleSwitcher from './components/LocaleSwitcher';

const DevContractCallSimulatorPanel = import.meta.env.DEV
  ? lazy(() =>
      import('./components/dev/ContractCallSimulatorPanel').then((m) => ({
        default: m.ContractCallSimulatorPanel,
      })),
    )
  : undefined;

const AppContent: React.FC = () => {
  const { t } = useI18n();

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">{t('app.title')}</div>
        <nav>
          <ul>
            <li><a href="/" className="active">{t('nav.lobby')}</a></li>
            <li><a href="/games">{t('nav.games')}</a></li>
            <li><a href="/profile">{t('nav.profile')}</a></li>
          </ul>
        </nav>
        <LocaleSwitcher />
      </header>
      
      <main className="app-content">
        <GameLobby />
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <p>{t('footer.copyright')}</p>
          <div className="footer-links">
            <a href="/terms">{t('footer.terms')}</a>
            <a href="/privacy">{t('footer.privacy')}</a>
          </div>
        </div>
      </footer>

      {import.meta.env.DEV && DevContractCallSimulatorPanel ? (
        <Suspense fallback={null}>
          <DevContractCallSimulatorPanel />
        </Suspense>
      ) : null}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
};

export default App;
