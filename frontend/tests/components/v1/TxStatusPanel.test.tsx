
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TxStatusPanel } from '../../../src/components/v1/TxStatusPanel';
import { TxPhase } from '../../../src/types/tx-status';

describe('TxStatusPanel', () => {
    const mockHash = 'GABCDEFGHJKLMNPQRSTUVWXYZ234567GABCDEFGHJKLMNPQRSTUVW';
    const mockMeta = {
        hash: mockHash,
        phase: TxPhase.SUBMITTED,
        confirmations: 0,
        submittedAt: 1625097600000, // Fixed timestamp
    };

    it('renders in IDLE state', () => {
        render(<TxStatusPanel phase={TxPhase.IDLE} />);
        expect(screen.getByTestId('tx-status-panel-badge')).toHaveTextContent('IDLE');
        expect(screen.queryByTestId('tx-status-panel-timeline')).not.toBeInTheDocument();
    });

    it('renders timeline and metadata in SUBMITTED state', () => {
        render(<TxStatusPanel phase={TxPhase.SUBMITTED} meta={mockMeta} />);
        expect(screen.getByTestId('tx-status-panel-badge')).toHaveTextContent('SUBMITTED');
        expect(screen.getByTestId('tx-status-panel-timeline')).toBeInTheDocument();
        expect(screen.getAllByText(/GABCDEFG/).length).toBeGreaterThan(0);
    });

    it('renders error block in FAILED state', () => {
        const mockError = { code: 'tx_timeout', message: 'Timed out polling' };
        render(
            <TxStatusPanel
                phase={TxPhase.FAILED}
                meta={{ ...mockMeta, phase: TxPhase.FAILED }}
                error={mockError as any}
            />
        );
        expect(screen.getByTestId('tx-status-panel-badge')).toHaveTextContent('FAILED');
        expect(screen.getByTestId('tx-status-panel-error')).toBeInTheDocument();
        expect(screen.getByText(/tx_timeout/)).toBeInTheDocument();
        expect(screen.getByText(/Timed out polling/)).toBeInTheDocument();
    });

    it('handles compact mode by hiding metadata', () => {
        render(<TxStatusPanel phase={TxPhase.SUBMITTED} meta={mockMeta} compact={true} />);
        expect(screen.queryByTestId('tx-status-panel-meta')).not.toBeInTheDocument();
        expect(screen.getByTestId('tx-status-panel-timeline')).toBeInTheDocument();
    });

    it('triggers explorer callback when clicked', () => {
        const onExplorerLink = vi.fn();
        render(
            <TxStatusPanel
                phase={TxPhase.CONFIRMED}
                meta={{ ...mockMeta, phase: TxPhase.CONFIRMED }}
                onExplorerLink={onExplorerLink}
            />
        );

        const btn = screen.getByTestId('tx-status-panel-explorer-btn');
        fireEvent.click(btn);
        expect(onExplorerLink).toHaveBeenCalledWith(mockHash);
    });

    it('shows settled timestamp when confirmed', () => {
        const settledAt = 1625097660000;
        render(
            <TxStatusPanel
                phase={TxPhase.CONFIRMED}
                meta={{ ...mockMeta, phase: TxPhase.CONFIRMED, settledAt }}
            />
        );
        expect(screen.getByText(/Settled/)).toBeInTheDocument();
    });

    it('renders retry count when retry metadata is present', () => {
        render(
            <TxStatusPanel
                phase={TxPhase.SUBMITTED}
                meta={{ ...mockMeta, retryCount: 3, lastAttemptAt: 1625097660000 }}
            />
        );
        expect(screen.getByTestId('tx-status-panel-retry-count')).toHaveTextContent('3');
        expect(screen.getByTestId('tx-status-panel-last-attempt')).toBeInTheDocument();
    });

    it('renders last attempt timestamp', () => {
        render(
            <TxStatusPanel
                phase={TxPhase.PENDING}
                meta={{ ...mockMeta, phase: TxPhase.PENDING, retryCount: 1, lastAttemptAt: 1625097660000 }}
            />
        );
        expect(screen.getByTestId('tx-status-panel-last-attempt')).toBeInTheDocument();
        expect(screen.getByText(/Last Attempt/)).toBeInTheDocument();
    });

    it('omits retry metadata when absent', () => {
        render(
            <TxStatusPanel
                phase={TxPhase.SUBMITTED}
                meta={mockMeta}
            />
        );
        expect(screen.queryByTestId('tx-status-panel-retry-count')).not.toBeInTheDocument();
        expect(screen.queryByTestId('tx-status-panel-last-attempt')).not.toBeInTheDocument();
    });

    describe('Print Receipt', () => {
        it('shows Print Receipt button when valid transaction data exists', () => {
            render(
                <TxStatusPanel
                    phase={TxPhase.SUBMITTED}
                    meta={mockMeta}
                />
            );
            expect(screen.getByTestId('tx-status-panel-print-btn')).toBeInTheDocument();
            expect(screen.getByText('Print Receipt')).toBeInTheDocument();
        });

        it('hides Print Receipt button in IDLE state', () => {
            render(<TxStatusPanel phase={TxPhase.IDLE} />);
            expect(screen.queryByTestId('tx-status-panel-print-btn')).not.toBeInTheDocument();
        });

        it('hides Print Receipt button in compact mode', () => {
            render(
                <TxStatusPanel
                    phase={TxPhase.SUBMITTED}
                    meta={mockMeta}
                    compact={true}
                />
            );
            expect(screen.queryByTestId('tx-status-panel-print-btn')).not.toBeInTheDocument();
        });

        it('hides Print Receipt button when meta is missing', () => {
            render(<TxStatusPanel phase={TxPhase.SUBMITTED} />);
            expect(screen.queryByTestId('tx-status-panel-print-btn')).not.toBeInTheDocument();
        });

        it('calls window.print when Print Receipt button is clicked', () => {
            const printSpy = vi.fn();
            const originalPrint = window.print;
            window.print = printSpy;

            render(
                <TxStatusPanel
                    phase={TxPhase.SUBMITTED}
                    meta={mockMeta}
                />
            );

            const printBtn = screen.getByTestId('tx-status-panel-print-btn');
            fireEvent.click(printBtn);

            expect(printSpy).toHaveBeenCalled();

            window.print = originalPrint;
        });

        it('does not crash when window.print is undefined', () => {
            const originalPrint = window.print;
            // @ts-ignore - intentionally setting to undefined for testing
            window.print = undefined;

            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            render(
                <TxStatusPanel
                    phase={TxPhase.SUBMITTED}
                    meta={mockMeta}
                />
            );

            const printBtn = screen.getByTestId('tx-status-panel-print-btn');
            expect(() => fireEvent.click(printBtn)).not.toThrow();

            expect(consoleSpy).toHaveBeenCalledWith('Print functionality is not available in this environment');

            window.print = originalPrint;
            consoleSpy.mockRestore();
        });

        it('has correct aria-label for accessibility', () => {
            render(
                <TxStatusPanel
                    phase={TxPhase.SUBMITTED}
                    meta={mockMeta}
                />
            );

            const printBtn = screen.getByTestId('tx-status-panel-print-btn');
            expect(printBtn).toHaveAttribute('aria-label', 'Print transaction receipt');
        });
    });

    describe('Receipt View', () => {
        it('renders receipt content when transaction data exists', () => {
            render(
                <TxStatusPanel
                    phase={TxPhase.SUBMITTED}
                    meta={mockMeta}
                />
            );
            expect(screen.getByTestId('tx-status-panel-receipt')).toBeInTheDocument();
            expect(screen.getByText('Transaction Receipt')).toBeInTheDocument();
        });

        it('does not render receipt in IDLE state', () => {
            render(<TxStatusPanel phase={TxPhase.IDLE} />);
            expect(screen.queryByTestId('tx-status-panel-receipt')).not.toBeInTheDocument();
        });

        it('displays transaction hash in receipt', () => {
            render(
                <TxStatusPanel
                    phase={TxPhase.SUBMITTED}
                    meta={mockMeta}
                />
            );
            expect(screen.getByTestId('tx-status-panel-receipt-hash')).toBeInTheDocument();
        });

        it('displays status in receipt', () => {
            render(
                <TxStatusPanel
                    phase={TxPhase.CONFIRMED}
                    meta={{ ...mockMeta, phase: TxPhase.CONFIRMED }}
                />
            );
            expect(screen.getByTestId('tx-status-panel-receipt-status')).toHaveTextContent('CONFIRMED');
        });

        it('displays timestamp in receipt', () => {
            render(
                <TxStatusPanel
                    phase={TxPhase.SUBMITTED}
                    meta={mockMeta}
                />
            );
            expect(screen.getByTestId('tx-status-panel-receipt-timestamp')).toBeInTheDocument();
        });

        it('displays amount when provided', () => {
            render(
                <TxStatusPanel
                    phase={TxPhase.SUBMITTED}
                    meta={mockMeta}
                    amount={100}
                    asset="XLM"
                />
            );
            expect(screen.getByTestId('tx-status-panel-receipt-amount')).toHaveTextContent('100 XLM');
        });

        it('displays sender when provided', () => {
            const senderAddress = 'GABCDEFGHJKLMNPQRSTUVWXYZ234567GABCDEFGHJKLMNPQRSTUVW';
            render(
                <TxStatusPanel
                    phase={TxPhase.SUBMITTED}
                    meta={mockMeta}
                    sender={senderAddress}
                />
            );
            expect(screen.getByTestId('tx-status-panel-receipt-sender')).toBeInTheDocument();
        });

        it('displays recipient when provided', () => {
            const recipientAddress = 'GABCDEFGHJKLMNPQRSTUVWXYZ234567GABCDEFGHJKLMNPQRSTUVW';
            render(
                <TxStatusPanel
                    phase={TxPhase.SUBMITTED}
                    meta={mockMeta}
                    recipient={recipientAddress}
                />
            );
            expect(screen.getByTestId('tx-status-panel-receipt-recipient')).toBeInTheDocument();
        });

        it('displays network when provided', () => {
            render(
                <TxStatusPanel
                    phase={TxPhase.SUBMITTED}
                    meta={mockMeta}
                    network="Testnet"
                />
            );
            expect(screen.getByTestId('tx-status-panel-receipt-network')).toHaveTextContent('Testnet');
        });

        it('handles missing optional fields gracefully', () => {
            render(
                <TxStatusPanel
                    phase={TxPhase.SUBMITTED}
                    meta={mockMeta}
                />
            );
            expect(screen.getByTestId('tx-status-panel-receipt')).toBeInTheDocument();
            expect(screen.queryByTestId('tx-status-panel-receipt-amount')).not.toBeInTheDocument();
            expect(screen.queryByTestId('tx-status-panel-receipt-sender')).not.toBeInTheDocument();
            expect(screen.queryByTestId('tx-status-panel-receipt-recipient')).not.toBeInTheDocument();
            expect(screen.queryByTestId('tx-status-panel-receipt-network')).not.toBeInTheDocument();
        });
    });

    describe('Copy Feedback (#476)', () => {
        it('shows success feedback after successful copy', async () => {
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: vi.fn().mockResolvedValue(undefined) },
                writable: true,
                configurable: true,
            });

            render(
                <TxStatusPanel
                    phase={TxPhase.SUBMITTED}
                    meta={mockMeta}
                />
            );

            const copyBtn = screen.getByTestId('tx-status-panel-copy-btn');
            expect(copyBtn).toHaveAttribute('aria-label', 'Copy transaction hash');

            await act(async () => {
                fireEvent.click(copyBtn);
            });

            expect(copyBtn).toHaveTextContent('✓');
            expect(copyBtn).toHaveAttribute('aria-label', 'Copied!');
        });

        it('shows error feedback when copy fails', async () => {
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
                writable: true,
                configurable: true,
            });
            // happy-dom may not have execCommand; define it so fallback also fails
            if (!document.execCommand) {
                (document as any).execCommand = vi.fn().mockReturnValue(false);
            } else {
                vi.spyOn(document, 'execCommand').mockReturnValue(false);
            }

            render(
                <TxStatusPanel
                    phase={TxPhase.SUBMITTED}
                    meta={mockMeta}
                />
            );

            const copyBtn = screen.getByTestId('tx-status-panel-copy-btn');
            await act(async () => {
                fireEvent.click(copyBtn);
            });

            expect(copyBtn).toHaveTextContent('✗');
            expect(copyBtn).toHaveAttribute('aria-label', 'Copy failed');
        });

        it('reverts feedback state to idle after timeout', async () => {
            vi.useFakeTimers();
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: vi.fn().mockResolvedValue(undefined) },
                writable: true,
                configurable: true,
            });

            render(
                <TxStatusPanel
                    phase={TxPhase.SUBMITTED}
                    meta={mockMeta}
                />
            );

            const copyBtn = screen.getByTestId('tx-status-panel-copy-btn');
            await act(async () => {
                fireEvent.click(copyBtn);
            });

            expect(copyBtn).toHaveTextContent('✓');

            act(() => {
                vi.advanceTimersByTime(2500);
            });

            expect(copyBtn).toHaveTextContent('📋');
            expect(copyBtn).toHaveAttribute('aria-label', 'Copy transaction hash');
            vi.useRealTimers();
        });

        it('handles repeated copy interactions correctly', async () => {
            const writeTextMock = vi.fn().mockResolvedValue(undefined);
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: writeTextMock },
                writable: true,
                configurable: true,
            });

            render(
                <TxStatusPanel
                    phase={TxPhase.SUBMITTED}
                    meta={mockMeta}
                />
            );

            const copyBtn = screen.getByTestId('tx-status-panel-copy-btn');

            // First copy
            await act(async () => {
                fireEvent.click(copyBtn);
            });
            expect(copyBtn).toHaveTextContent('✓');

            // Second copy immediately
            await act(async () => {
                fireEvent.click(copyBtn);
            });
            expect(copyBtn).toHaveTextContent('✓');
            expect(writeTextMock).toHaveBeenCalledTimes(2);
        });

        it('has aria-live polite on copy button for screen readers', () => {
            render(
                <TxStatusPanel
                    phase={TxPhase.SUBMITTED}
                    meta={mockMeta}
                />
            );
            const copyBtn = screen.getByTestId('tx-status-panel-copy-btn');
            expect(copyBtn).toHaveAttribute('aria-live', 'polite');
        });
    });
});
