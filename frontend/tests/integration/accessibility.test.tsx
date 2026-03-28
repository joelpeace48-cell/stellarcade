import { fireEvent, render, screen } from '@testing-library/react';
import { ActionToolbar } from '@/components/v1/ActionToolbar';
import { ContractActionButton } from '@/components/v1/ContractActionButton';
import { PaginatedListController } from '@/components/v1/PaginatedListController';
import { SessionTimeoutModal } from '@/components/v1/SessionTimeoutModal';
import WalletSessionService from '@/services/wallet-session-service';
import { WalletSessionState } from '@/types/wallet-session';

const sessionMeta = {
  provider: { id: 't', name: 'Test' },
  address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  network: 'TESTNET',
  connectedAt: Date.now(),
};

function createWarnSessionService() {
  const service = new WalletSessionService({ sessionExpiryMs: 60_000 });
  vi.spyOn(service, 'getState').mockReturnValue(WalletSessionState.CONNECTED);
  vi.spyOn(service, 'getMeta').mockReturnValue(sessionMeta);
  vi.spyOn(service, 'getRemainingPersistenceMs').mockReturnValue(20_000);
  vi.spyOn(service, 'getSessionExpiryTimestampMs').mockReturnValue(Date.now() + 20_000);
  vi.spyOn(service, 'subscribe').mockImplementation((fn) => {
    fn(WalletSessionState.CONNECTED, sessionMeta, null);
    return () => {};
  });
  vi.spyOn(service, 'extendPersistedSession').mockImplementation(() => {});
  vi.spyOn(service, 'disconnect').mockResolvedValue(undefined);
  return service;
}

describe('v1 accessibility matrix', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps interactive controls reachable in a predictable tab order', async () => {
    const toolbarAction = vi.fn();
    const contractAction = vi.fn().mockResolvedValue({ ok: true });

    render(
      <div>
        <ActionToolbar
          actions={[
            { id: 'play', label: 'Play', onClick: toolbarAction },
            { id: 'history', label: 'History', onClick: vi.fn() },
          ]}
        />
        <ContractActionButton
          label="Execute"
          action={contractAction}
          walletConnected={true}
          networkSupported={true}
        />
        <PaginatedListController
          page={2}
          pageSize={10}
          total={50}
          totalPages={5}
          onNext={vi.fn()}
          onPrev={vi.fn()}
          onPageChange={vi.fn()}
          onPageSizeChange={vi.fn()}
        />
        <SessionTimeoutModal
          sessionService={createWarnSessionService()}
          warnBeforeExpiryMs={30_000}
          pollIntervalMs={500}
        />
      </div>,
    );

    const tabStops = [
      screen.getByRole('button', { name: 'Play' }),
      screen.getByRole('button', { name: 'History' }),
      screen.getByTestId('contract-action-button'),
      screen.getByLabelText('Go to previous page'),
      screen.getByLabelText('Go to page 1'),
      screen.getByLabelText('Go to page 3'),
      screen.getByLabelText('Go to next page'),
      screen.getByLabelText('Items per page'),
      await screen.findByTestId('session-timeout-modal-extend'),
      screen.getByTestId('session-timeout-modal-dismiss'),
    ];

    tabStops.forEach((element) => {
      element.focus();
      expect(element).toHaveFocus();
    });
  });

  it('supports keyboard-triggered intent via native button semantics and toolbar navigation', () => {
    const toolbarAction = vi.fn();
    const pageChange = vi.fn();

    render(
      <>
        <ActionToolbar
          actions={[
            { id: 'play', label: 'Play', onClick: toolbarAction },
            { id: 'history', label: 'History', onClick: vi.fn() },
          ]}
        />
        <PaginatedListController
          page={1}
          pageSize={10}
          total={30}
          totalPages={3}
          onNext={vi.fn()}
          onPrev={vi.fn()}
          onPageChange={pageChange}
          onPageSizeChange={vi.fn()}
        />
      </>,
    );

    const playButton = screen.getByRole('button', { name: 'Play' });
    const historyButton = screen.getByRole('button', { name: 'History' });
    playButton.focus();
    fireEvent.keyDown(playButton, { key: 'ArrowRight' });
    expect(historyButton).toHaveFocus();

    fireEvent.click(playButton);
    expect(toolbarAction).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Go to page 2'));
    expect(pageChange).toHaveBeenCalledWith(2);
  });

  it('preserves semantic dialog markup for timeout recovery', async () => {
    render(
      <SessionTimeoutModal
        sessionService={createWarnSessionService()}
        warnBeforeExpiryMs={30_000}
        pollIntervalMs={500}
      />,
    );

    const dialog = await screen.findByRole('alertdialog', { name: 'Session expiring soon' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByTestId('session-timeout-modal-extend')).toHaveFocus();
  });
});
