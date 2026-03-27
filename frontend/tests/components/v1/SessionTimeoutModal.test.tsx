/**
 * SessionTimeoutModal -- timer and interaction tests.
 */

import { SessionTimeoutModal } from '@/components/v1/SessionTimeoutModal';
import WalletSessionService from '@/services/wallet-session-service';
import { WalletSessionState } from '@/types/wallet-session';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

const meta = {
  provider: { id: 't', name: 'Test' },
  address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  network: 'TESTNET',
  connectedAt: Date.now(),
};

describe('SessionTimeoutModal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mockConnectedService(remainingMs: number) {
    const svc = new WalletSessionService({ sessionExpiryMs: 60_000 });
    let currentRemaining = remainingMs;
    let currentExpiryTimestamp = Date.now() + remainingMs;
    vi.spyOn(svc, 'getState').mockReturnValue(WalletSessionState.CONNECTED);
    vi.spyOn(svc, 'getMeta').mockReturnValue(meta);
    vi.spyOn(svc, 'getRemainingPersistenceMs').mockImplementation(() => currentRemaining);
    vi.spyOn(svc, 'getSessionExpiryTimestampMs').mockImplementation(() => currentExpiryTimestamp);
    vi.spyOn(svc, 'subscribe').mockImplementation((fn) => {
      fn(WalletSessionState.CONNECTED, meta, null);
      return () => {};
    });
    vi.spyOn(svc, 'extendPersistedSession').mockImplementation(() => {});
    vi.spyOn(svc, 'disconnect').mockResolvedValue(undefined);
    return {
      svc,
      setRemainingMs(next: number) {
        currentRemaining = next;
        currentExpiryTimestamp = Date.now() + next;
      },
    };
  }

  it('shows warning when remaining within threshold', async () => {
    const { svc } = mockConnectedService(60_000);
    render(
      <SessionTimeoutModal
        sessionService={svc}
        warnBeforeExpiryMs={120_000}
        pollIntervalMs={1_000}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('session-timeout-modal')).toBeInTheDocument();
    });
    expect(screen.getByText(/Session expiring soon/i)).toBeInTheDocument();
  });

  it('moves focus to the primary action when the warning opens', async () => {
    const { svc } = mockConnectedService(30_000);
    render(
      <SessionTimeoutModal
        sessionService={svc}
        warnBeforeExpiryMs={120_000}
        pollIntervalMs={500}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('session-timeout-modal-extend')).toHaveFocus(),
    );
  });

  it('traps tab navigation inside the warning actions', async () => {
    const { svc } = mockConnectedService(30_000);
    render(
      <SessionTimeoutModal
        sessionService={svc}
        warnBeforeExpiryMs={120_000}
        pollIntervalMs={500}
      />,
    );

    const extendButton = await screen.findByTestId('session-timeout-modal-extend');
    const dismissButton = screen.getByTestId('session-timeout-modal-dismiss');

    dismissButton.focus();
    fireEvent.keyDown(dismissButton, { key: 'Tab' });
    expect(extendButton).toHaveFocus();

    extendButton.focus();
    fireEvent.keyDown(extendButton, { key: 'Tab', shiftKey: true });
    expect(dismissButton).toHaveFocus();
  });

  it('calls extendPersistedSession when Extend is clicked', async () => {
    const { svc } = mockConnectedService(30_000);
    render(
      <SessionTimeoutModal
        sessionService={svc}
        warnBeforeExpiryMs={120_000}
        pollIntervalMs={500}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('session-timeout-modal-extend')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('session-timeout-modal-extend'));
    expect(svc.extendPersistedSession).toHaveBeenCalled();
  });

  it('hides warning when Dismiss is clicked', async () => {
    const { svc } = mockConnectedService(20_000);
    render(
      <SessionTimeoutModal
        sessionService={svc}
        warnBeforeExpiryMs={120_000}
        pollIntervalMs={500}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('session-timeout-modal-dismiss')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('session-timeout-modal-dismiss'));
    await waitFor(() => {
      expect(screen.queryByTestId('session-timeout-modal')).not.toBeInTheDocument();
    });
  });

  it('allows Escape to dismiss the warning dialog', async () => {
    const { svc } = mockConnectedService(20_000);
    render(
      <SessionTimeoutModal
        sessionService={svc}
        warnBeforeExpiryMs={120_000}
        pollIntervalMs={500}
      />,
    );

    const dismissButton = await screen.findByTestId('session-timeout-modal-dismiss');
    fireEvent.keyDown(dismissButton, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByTestId('session-timeout-modal')).not.toBeInTheDocument();
    });
  });

  it('disconnects and shows expired when remaining is 0', async () => {
    const { svc } = mockConnectedService(0);
    render(
      <SessionTimeoutModal
        sessionService={svc}
        warnBeforeExpiryMs={300_000}
        pollIntervalMs={100}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText(/Session expired/i)).toBeInTheDocument(),
    );
    expect(svc.disconnect).toHaveBeenCalled();
  });

  it('invokes onReconnect from expired state', async () => {
    const { svc } = mockConnectedService(0);
    const onReconnect = vi.fn();
    render(
      <SessionTimeoutModal
        sessionService={svc}
        warnBeforeExpiryMs={300_000}
        pollIntervalMs={100}
        onReconnect={onReconnect}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('session-timeout-modal-reconnect')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('session-timeout-modal-reconnect'));
    expect(onReconnect).toHaveBeenCalled();
  });

  it('updates countdown over time and syncs to service updates', async () => {
    const { svc, setRemainingMs } = mockConnectedService(12_000);
    render(
      <SessionTimeoutModal
        sessionService={svc}
        warnBeforeExpiryMs={120_000}
        pollIntervalMs={1_000}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('session-timeout-modal-countdown')).toHaveTextContent('12'),
    );

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    await waitFor(() =>
      expect(screen.getByTestId('session-timeout-modal-countdown')).toHaveTextContent('10'),
    );

    setRemainingMs(45_000);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    await waitFor(() =>
      expect(screen.getByTestId('session-timeout-modal-countdown')).toHaveTextContent(/4[45]/),
    );
  });
});
