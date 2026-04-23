import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { PrizePoolStateCard } from '../../../src/components/v1/PrizePoolStateCard';

describe('PrizePoolStateCard', () => {
    const mockState = {
        balance: '12345.6789',
        totalReserved: '500.123',
        admin: 'GADMIN1234567890MOCKADDRESS',
    };

    it('renders expanded variant with full data', () => {
        render(<PrizePoolStateCard state={mockState} />);

        expect(screen.getByText('Prize Pool Metrics')).toBeInTheDocument();
        expect(screen.getByTestId('prizepool-state-card-balance')).toHaveTextContent('12,345.68');
        expect(screen.getByTestId('prizepool-state-card-reserved')).toHaveTextContent('500.12');
        expect(screen.getByText(/GADM...RESS/i)).toBeInTheDocument();
    });

    it('renders compact variant correctly', () => {
        render(<PrizePoolStateCard state={mockState} compact />);

        expect(screen.getByTestId('prizepool-state-card-balance')).toHaveTextContent('12,345.68');
        expect(screen.queryByTestId('prizepool-state-card-reserved')).not.toBeInTheDocument();
        expect(screen.queryByText(/Admin:/i)).not.toBeInTheDocument();
    });

    it('renders loading skeletons when state is missing and loading', () => {
        render(<PrizePoolStateCard isLoading={true} />);

        expect(screen.getAllByTestId('skeleton-base')).toHaveLength(2);
        expect(screen.getByText('Updating...')).toBeInTheDocument();
    });

    it('handles refresh callback', () => {
        const onRefresh = vi.fn();
        render(<PrizePoolStateCard onRefresh={onRefresh} />);

        const refreshBtn = screen.getByTestId('prizepool-state-card-refresh-btn');
        fireEvent.click(refreshBtn);

        expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('applies custom currency', () => {
        render(<PrizePoolStateCard state={mockState} currency="USDC" />);
        expect(screen.getAllByText('USDC')).toHaveLength(2);
    });

    it('renders default zero values when state is null', () => {
        render(<PrizePoolStateCard state={null} />);
        expect(screen.getByTestId('prizepool-state-card-balance')).toHaveTextContent('0.00');
    });

    it('animates when transitioning from empty to populated (#554)', async () => {
        const { rerender } = render(<PrizePoolStateCard state={null} />);
        const guard = screen.getByTestId('prizepool-state-card-transition');
        expect(guard).toHaveAttribute('data-populated', 'false');
        expect(guard).toHaveAttribute('data-animating', 'false');

        rerender(<PrizePoolStateCard state={mockState} />);

        await waitFor(() => {
            expect(guard).toHaveAttribute('data-populated', 'true');
            expect(guard).toHaveAttribute('data-animating', 'true');
        });
    });
});
