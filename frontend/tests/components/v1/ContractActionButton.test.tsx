import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ContractActionButton } from '../../../src/components/v1/ContractActionButton';

describe('ContractActionButton', () => {
  it('runs action and calls onSuccess', async () => {
    const action = vi.fn().mockResolvedValue({ tx: 'abc' });
    const onSuccess = vi.fn();

    render(
      <ContractActionButton
        label="Execute"
        action={action}
        walletConnected={true}
        networkSupported={true}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.click(screen.getByTestId('contract-action-button'));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it('blocks when wallet is not connected and exposes the precondition description', () => {
    const action = vi.fn().mockResolvedValue({});

    render(
      <ContractActionButton
        label="Execute"
        action={action}
        walletConnected={false}
        networkSupported={true}
      />,
    );

    expect(screen.getByTestId('contract-action-button')).toBeDisabled();
    expect(screen.getByTestId('contract-action-button-precondition')).toHaveTextContent('Connect wallet');
    expect(screen.getByTestId('contract-action-button')).toHaveAttribute(
      'aria-describedby',
      'contract-action-button-precondition',
    );
  });

  it('blocks duplicate triggers while in-flight', async () => {
    let resolveAction: (() => void) | undefined;
    const action = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveAction = resolve;
        }),
    );

    render(
      <ContractActionButton
        label="Execute"
        action={action}
        walletConnected={true}
        networkSupported={true}
      />,
    );

    const button = screen.getByTestId('contract-action-button');
    fireEvent.click(button);
    fireEvent.click(button);

    expect(action).toHaveBeenCalledTimes(1);
    resolveAction?.();
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it('maps failures and calls onError', async () => {
    const action = vi.fn().mockRejectedValue(new Error('contract failed'));
    const onError = vi.fn();

    render(
      <ContractActionButton
        label="Execute"
        action={action}
        walletConnected={true}
        networkSupported={true}
        onError={onError}
      />,
    );

    fireEvent.click(screen.getByTestId('contract-action-button'));

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('contract-action-button-error')).toBeInTheDocument();
    expect(screen.getByTestId('contract-action-button')).toHaveAttribute(
      'aria-describedby',
      'contract-action-button-error-region',
    );
  });

  it('is keyboard focusable as a native button', () => {
    const action = vi.fn().mockResolvedValue({});

    render(
      <ContractActionButton
        label="Execute"
        action={action}
        walletConnected={true}
        networkSupported={true}
      />,
    );

    const button = screen.getByTestId('contract-action-button');
    button.focus();

    expect(button).toHaveFocus();
  });
});
