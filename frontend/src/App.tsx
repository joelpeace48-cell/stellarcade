import React, { Suspense, lazy } from 'react';
import GameLobby from './pages/GameLobby';
import { RouteErrorBoundary } from './components/v1/RouteErrorBoundary';
import ProfileSettings from './pages/ProfileSettings';
import { I18nProvider, useI18n } from './i18n/provider';
import LocaleSwitcher from './components/LocaleSwitcher';
import Breadcrumbs from './components/BreadCrumbs';
import AppSidebar from './components/v1/AppSidebar';

import { ModalStackProvider } from './components/v1/modal-stack';
import { FeatureFlagsProvider } from './services/feature-flags';
import CommandPalette, { type Command } from './components/v1/CommandPalette';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { useErrorStore } from './store/errorStore';

const DevContractCallSimulatorPanel = import.meta.env.DEV
  ? lazy(() =>
      import('./components/dev/ContractCallSimulatorPanel').then((m) => ({
        default: m.ContractCallSimulatorPanel,
      })),
    )
  : undefined;

const toneLabelMap = {
  success: 'Success',
  info: 'Info',
  warning: 'Warning',
  error: 'Error',
} as const;

const MAIN_CONTENT_ID = 'main-content';

/* ───────────────── Notification Center ───────────────── */

function NotificationCenter(): React.JSX.Element | null {
  const toasts = useErrorStore((state) => state.toasts);
  const toastHistory = useErrorStore((state) => state.toastHistory);
  const dismissToast = useErrorStore((state) => state.dismissToast);
  const clearToastHistory = useErrorStore((state) => state.clearToastHistory);
  const [historyOpen, setHistoryOpen] = React.useState(false);

  if (toasts.length === 0 && toastHistory.length === 0) {
    return null;
  }

  return (
    <aside className="toast-center" aria-label="Notifications">
      <div className="toast-center__stack">
        {toasts.map((toast) => (
          <section
            key={toast.id}
            className={`toast-center__toast toast-center__toast--${toast.tone}`}
            role="status"
            aria-live="polite"
          >
            <div className="toast-center__toast-header">
              <span className="toast-center__tone">{toneLabelMap[toast.tone]}</span>

              <button
                type="button"
                className="toast-center__dismiss"
                aria-label={`Dismiss ${toast.title}`}
                onClick={() => dismissToast(toast.id)}
              >
                Dismiss
              </button>
            </div>

            <strong className="toast-center__title">{toast.title}</strong>
            <p className="toast-center__message">{toast.message}</p>
          </section>
        ))}
      </div>

      {toastHistory.length > 0 && (
        <div className="toast-center__history">
          <button
            type="button"
            className="toast-center__history-toggle"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((c) => !c)}
          >
            {historyOpen ? 'Hide recent notifications' : 'Show recent notifications'}
          </button>

          {historyOpen && (
            <div className="toast-center__history-panel">
              <div className="toast-center__history-header">
                <strong>Recent notifications</strong>

                <button
                  type="button"
                  className="toast-center__history-clear"
                  onClick={clearToastHistory}
                >
                  Clear
                </button>
              </div>

              <ul className="toast-center__history-list">
                {toastHistory.map((toast) => (
                  <li key={toast.id} className="toast-center__history-item">
                    <span>{toast.title}</span>
                    <span>{toast.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

/* ───────────────── App Content ───────────────── */

type AppRoute = 'lobby' | 'games' | 'profile';

const AppContent: React.FC = () => {
  const { t } = useI18n();
  const [route, setRoute] = React.useState<AppRoute>('lobby');
  const navigate = useNavigate();

  const commands: Command[] = [
    {
      id: 'go-lobby',
      label: 'Go to Lobby',
      description: 'Open the game lobby',
      action: () => navigate('/'),
    },
    {
      id: 'go-games',
      label: 'Go to Games',
      description: 'Open the games section',
      action: () => setRoute('games'),
    },
    {
      id: 'go-profile',
      label: 'Go to Profile Settings',
      description: 'Open the profile settings page',
      action: () => navigate('/profile'),
    },
  ];

  return (
    <div className="app-container">
      <CommandPalette commands={commands} />
      <NotificationCenter />

      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="skip-link"
        onClick={(event) => {
          const mainContent = document.getElementById(MAIN_CONTENT_ID);
          if (!mainContent) return;

          event.preventDefault();
          mainContent.focus();
          mainContent.scrollIntoView?.({ block: 'start' });
        }}
      >
        Skip to main content
      </a>

      <AppSidebar currentRoute={route} onNavigate={setRoute} />

      <div className="app-main-layout">
        <header className="app-header">
          <div className="logo">{t('app.title')}</div>
          <LocaleSwitcher />
        </header>

        <Breadcrumbs />

        <main className="app-content" id={MAIN_CONTENT_ID} tabIndex={-1}>
          <RouteErrorBoundary>
            {route === 'profile' ? <ProfileSettings /> : <GameLobby />}
          </RouteErrorBoundary>
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
      </div>

      {import.meta.env.DEV && DevContractCallSimulatorPanel ? (
        <Suspense fallback={null}>
          <DevContractCallSimulatorPanel />
        </Suspense>
      ) : null}
    </div>
  );
};

/* ───────────────── App Root ───────────────── */

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <FeatureFlagsProvider>
        <I18nProvider>
          <ModalStackProvider>
            <AppContent />
          </ModalStackProvider>
        </I18nProvider>
      </FeatureFlagsProvider>
    </BrowserRouter>
  );
};

export { Drawer } from './components/v1/Drawer';

export default App;

