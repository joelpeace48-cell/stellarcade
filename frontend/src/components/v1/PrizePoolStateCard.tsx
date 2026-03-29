import React from 'react';
import { PrizePoolState } from '../../types/contracts/prizePool';
import { SkeletonBase } from './LoadingSkeletonSet';
import './PrizePoolStateCard.css';

export interface PrizePoolStateCardProps {
    /** The current state of the prize pool */
    state?: PrizePoolState | null;
    /** Whether the card is in a loading state */
    isLoading?: boolean;
    /** Whether to render the compact version for dashboards */
    compact?: boolean;
    /** Callback to trigger a manual refresh */
    onRefresh?: () => void;
    /** Optional class name for custom styling */
    className?: string;
    /** Test ID for automation */
    testId?: string;
    /** Currency symbol or code to display */
    currency?: string;
    /** Optional status label override */
    statusLabel?: string;
    /** Optional helper copy when state is unavailable */
    emptyMessage?: string;
    /** Optional footer metadata for compact summaries */
    footerMeta?: string | null;
}

/**
 * PrizePoolStateCard Component
 * 
 * Displays key metrics for the prize pool, including total balance and reserved funds.
 * Designed for both dedicated status pages and dashboard widgets.
 */
export const PrizePoolStateCard: React.FC<PrizePoolStateCardProps> = ({
    state,
    isLoading = false,
    compact = false,
    onRefresh,
    className = '',
    testId = 'prizepool-state-card',
    currency = 'XLM',
    statusLabel,
    emptyMessage = 'Waiting for prize-pool metrics.',
    footerMeta,
}) => {
    const containerClasses = [
        'prizepool-state-card',
        compact ? 'prizepool-state-card--compact' : '',
        className
    ].join(' ');

    const formatValue = (val: string) => {
        const num = parseFloat(val);
        return isNaN(num) ? '0.00' : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <div className={containerClasses} data-testid={testId}>
            <div className="prizepool-state-card__header">
                <h3 className="prizepool-state-card__title">Prize Pool Metrics</h3>
                {onRefresh && (
                    <button
                        className={`prizepool-state-card__refresh ${isLoading ? 'rotate-animation' : ''}`}
                        onClick={onRefresh}
                        disabled={isLoading}
                        aria-label="Refresh metrics"
                        data-testid={`${testId}-refresh-btn`}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
                        </svg>
                    </button>
                )}
            </div>

            <div className="prizepool-state-card__metrics">
                <div className="prizepool-state-card__metric">
                    <span className="prizepool-state-card__metric-label">Total Balance</span>
                    <div className="prizepool-state-card__metric-value">
                        {isLoading && !state ? (
                            <SkeletonBase width="100px" height="2rem" />
                        ) : (
                            <>
                                <span data-testid={`${testId}-balance`}>{formatValue(state?.balance || '0')}</span>
                                <span className="prizepool-state-card__currency">{currency}</span>
                            </>
                        )}
                    </div>
                </div>

                {!compact && (
                    <div className="prizepool-state-card__metric">
                        <span className="prizepool-state-card__metric-label">Reserved Funds</span>
                        <div className="prizepool-state-card__metric-value">
                            {isLoading && !state ? (
                                <SkeletonBase width="100px" height="2rem" />
                            ) : (
                                <>
                                    <span data-testid={`${testId}-reserved`}>{formatValue(state?.totalReserved || '0')}</span>
                                    <span className="prizepool-state-card__currency">{currency}</span>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {!isLoading && !state && (
                <p className="prizepool-state-card__empty" data-testid={`${testId}-empty`}>
                    {emptyMessage}
                </p>
            )}

            <div className="prizepool-state-card__footer">
                <div className="prizepool-state-card__status">
                    <span className="prizepool-state-card__status-dot" />
                    <span>{statusLabel ?? (isLoading ? 'Updating...' : 'Live Data')}</span>
                </div>
                {footerMeta ? (
                    <div className="prizepool-state-card__admin">{footerMeta}</div>
                ) : (
                    !compact && state?.admin ? (
                        <div className="prizepool-state-card__admin">
                            Admin: {state.admin.slice(0, 4)}...{state.admin.slice(-4)}
                        </div>
                    ) : null
                )}
            </div>
        </div>
    );
};

PrizePoolStateCard.displayName = 'PrizePoolStateCard';

export default PrizePoolStateCard;
