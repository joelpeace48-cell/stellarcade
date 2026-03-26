import React from 'react';
import './PaginatedListController.css';

/**
 * Props for the PaginatedListController component.
 */
export interface PaginatedListControllerProps {
    /** Current page (1-indexed) */
    page: number;
    /** Number of items per page */
    pageSize: number;
    /** Total number of items across all pages */
    total: number;
    /** Total number of pages */
    totalPages: number;
    /** Callback for when the next page is requested */
    onNext: () => void;
    /** Callback for when the previous page is requested */
    onPrev: () => void;
    /** Callback for when a specific page is requested */
    onPageChange: (page: number) => void;
    /** Callback for when the page size is changed */
    onPageSizeChange: (pageSize: number) => void;
    /** Whether data is currently loading */
    isLoading?: boolean;
    /** Whether the controls should be disabled globally */
    disabled?: boolean;
    /** Optional array of page size choices */
    pageSizeOptions?: number[];
    /** Optional class name for the root container */
    className?: string;
    /** Data test ID for automation */
    testId?: string;
    /** Optional user-visible error message for fetch failures */
    errorMessage?: string | null;
    /** Optional retry callback when an error is shown */
    onRetry?: () => void;
}

/**
 * PaginatedListController component provides reusable pagination controls.
 *
 * Displays current range (e.g., "Showing 1-10 of 100"), page navigation
 * buttons (Previous, Next, and specific page numbers), and an optional
 * page size selector.
 */
export const PaginatedListController: React.FC<PaginatedListControllerProps> = ({
    page,
    pageSize,
    total,
    totalPages,
    onNext,
    onPrev,
    onPageChange,
    onPageSizeChange,
    isLoading = false,
    disabled = false,
    pageSizeOptions = [10, 25, 50, 100],
    className = '',
    testId = 'paginated-list-controller',
    errorMessage = null,
    onRetry,
}) => {
    const isFirstPage = page <= 1;
    const isLastPage = page >= totalPages;
    const isControlsDisabled = disabled || isLoading || total === 0;

    // Calculate inclusive range showing (e.g. 1-10)
    const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, total);

    /**
     * Generates an array of page numbers to display, including ellipses
     * for large ranges.
     */
    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const delta = 2; // Number of pages around current page

        for (let i = 1; i <= totalPages; i++) {
            if (
                i === 1 ||
                i === totalPages ||
                (i >= page - delta && i <= page + delta)
            ) {
                pages.push(i);
            } else if (
                (i === page - delta - 1 && i > 1) ||
                (i === page + delta + 1 && i < totalPages)
            ) {
                pages.push('...');
            }
        }

        // Filter out consecutive ellipses (shouldn't happen with above logic but good to guard)
        return pages.filter((v, i, a) => v !== '...' || a[i - 1] !== '...');
    };

    const hasError = Boolean(errorMessage);
    const shouldShowEmpty = total === 0 && !isLoading && !hasError;

    if (shouldShowEmpty) {
        return (
            <div className={`paginated-list-empty ${className}`} data-testid={testId}>
                <span className="pagination-info">No items to display</span>
            </div>
        );
    }

    return (
        <div
            className={`paginated-list-controller ${className} ${isLoading ? 'is-loading' : ''}`}
            data-testid={testId}
            role="navigation"
            aria-label="Pagination Navigation"
        >
            {hasError && (
                <div className="pagination-error" role="alert" data-testid={`${testId}-error`}>
                    <span>{errorMessage}</span>
                    {onRetry && (
                        <button
                            type="button"
                            className="pagination-btn pagination-retry-btn"
                            onClick={onRetry}
                            data-testid={`${testId}-retry`}
                        >
                            Retry
                        </button>
                    )}
                </div>
            )}
            <div className="pagination-info-section">
                <span className="pagination-info">
                    Showing <strong>{startItem}</strong> - <strong>{endItem}</strong> of <strong>{total}</strong>
                </span>
            </div>

            <div className="pagination-controls-section">
                <button
                    className="pagination-btn pagination-nav-btn"
                    onClick={onPrev}
                    disabled={isControlsDisabled || isFirstPage}
                    aria-label="Go to previous page"
                    type="button"
                >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>

                <div className="pagination-pages">
                    {getPageNumbers().map((p, idx) => (
                        <React.Fragment key={`${p}-${idx}`}>
                            {p === '...' ? (
                                <span className="pagination-ellipsis">...</span>
                            ) : (
                                <button
                                    className={`pagination-btn pagination-page-btn ${p === page ? 'is-active' : ''}`}
                                    onClick={() => onPageChange(p as number)}
                                    disabled={isControlsDisabled || p === page}
                                    aria-label={`Go to page ${p}`}
                                    aria-current={p === page ? 'page' : undefined}
                                    type="button"
                                >
                                    {p}
                                </button>
                            )}
                        </React.Fragment>
                    ))}
                </div>

                <button
                    className="pagination-btn pagination-nav-btn"
                    onClick={onNext}
                    disabled={isControlsDisabled || isLastPage}
                    aria-label="Go to next page"
                    type="button"
                >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
            </div>

            <div className="pagination-settings-section">
                <label htmlFor="pagination-page-size" className="pagination-label">
                    Show
                </label>
                <select
                    id="pagination-page-size"
                    className="pagination-select"
                    value={pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                    disabled={isControlsDisabled}
                    aria-label="Items per page"
                >
                    {pageSizeOptions.map((opt) => (
                        <option key={opt} value={opt}>
                            {opt}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};
