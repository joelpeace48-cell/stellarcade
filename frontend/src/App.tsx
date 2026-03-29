import React, { Suspense, lazy } from 'react';
import GameLobby from './pages/GameLobby';
import { RouteErrorBoundary } from './components/v1/RouteErrorBoundary';
import ProfileSettings from './pages/ProfileSettings';
import { I18nProvider, useI18n } from './i18n/provider';
import LocaleSwitcher from './components/LocaleSwitcher';
import { ModalStackProvider } from './components/v1/modal-stack';
import { FeatureFlagsProvider } from './services/feature-flags';
import CommandPalette, { type Command } from './components/v1/CommandPalette';

const DevContractCallSimulatorPanel = import.meta.env.DEV
  ? lazy(() =>
      import('./components/dev/ContractCallSimulatorPanel').then((m) => ({
        default: m.ContractCallSimulatorPanel,
      })),
    )
  : undefined;

const AppContent: React.FC = () => {
  const { t } = useI18n();
  const [route, setRoute] = React.useState<'lobby' | 'profile' | 'games'>('lobby');

  const commands: Command[] = [
    {
      id: 'go-lobby',
      label: 'Go to Lobby',
      description: 'Open the game lobby',
      action: () => setRoute('lobby'),
    },
    {
      id: 'go-profile',
      label: 'Go to Profile Settings',
      description: 'Open the profile settings page',
      action: () => setRoute('profile'),
    },
  ];

  return (
    <div className="app-container">
      <CommandPalette commands={commands} />
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="app-header" role="banner">
        <div className="logo">{t('app.title')}</div>
        <nav aria-label="Main navigation">
          <ul>
            <li>
              <button type="button" onClick={() => setRoute('lobby')} className={route === 'lobby' ? 'active' : ''}>
                {t('nav.lobby')}
              </button>
            </li>
            <li>
              <button type="button" onClick={() => setRoute('games')} className={route === 'games' ? 'active' : ''}>
                {t('nav.games')}
              </button>
            </li>
            <li>
              <button type="button" onClick={() => setRoute('profile')} className={route === 'profile' ? 'active' : ''}>
                {t('nav.profile')}
              </button>
            </li>
          </ul>
        </nav>
        <LocaleSwitcher />
      </header>
      
      <main className="app-content" id="main-content">
        <RouteErrorBoundary>
          {route === 'profile' ? <ProfileSettings /> : <GameLobby />}
        </RouteErrorBoundary>
      </main>

      <footer className="app-footer" role="contentinfo">
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
    <FeatureFlagsProvider>
      <I18nProvider>
        <ModalStackProvider>
          <AppContent />
        </ModalStackProvider>
      </I18nProvider>
    </FeatureFlagsProvider>
  );
};

export default App;
