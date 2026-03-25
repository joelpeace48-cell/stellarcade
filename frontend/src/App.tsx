import React, { Suspense, lazy } from 'react';
import GameLobby from './pages/GameLobby';

const DevContractCallSimulatorPanel = import.meta.env.DEV
  ? lazy(() =>
      import('./components/dev/ContractCallSimulatorPanel').then((m) => ({
        default: m.ContractCallSimulatorPanel,
      })),
    )
  : undefined;

const App: React.FC = () => {
  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">StellarCade</div>
        <nav>
          <ul>
            <li><a href="/" className="active">Lobby</a></li>
            <li><a href="/games">Games</a></li>
            <li><a href="/profile">Profile</a></li>
          </ul>
        </nav>
      </header>
      
      <main className="app-content">
        <GameLobby />
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <p>&copy; 2026 StellarCade. All rights reserved.</p>
          <div className="footer-links">
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
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

export default App;
