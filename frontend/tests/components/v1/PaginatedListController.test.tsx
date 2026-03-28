import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PaginatedListController } from '../../../src/components/v1/PaginatedListController';

describe('PaginatedListController', () => {
    const defaultProps = {
        page: 1,
        pageSize: 10,
        total: 100,
        totalPages: 10,
        onNext: vi.fn(),
        onPrev: vi.fn(),
        onPageChange: vi.fn(),
        onPageSizeChange: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly with default props', () => {
        render(<PaginatedListController {...defaultProps} />);

        const infoSection = screen.getByText(/Showing/i).closest('.pagination-info');
        expect(infoSection).toBeInTheDocument();
        if (infoSection) {
            expect(within(infoSection as HTMLElement).getByText('1')).toBeInTheDocument();
            expect(within(infoSection as HTMLElement).getByText('10')).toBeInTheDocument();
            expect(within(infoSection as HTMLElement).getByText('100')).toBeInTheDocument();
        }

        expect(screen.getByLabelText('Go to previous page')).toBeDisabled();
        expect(screen.getByLabelText('Go to next page')).not.toBeDisabled();
        expect(screen.getByLabelText('Go to page 1')).toHaveClass('is-active');
        expect(screen.getByLabelText('Go to page 2')).toBeInTheDocument();
        expect(screen.getByText('...')).toBeInTheDocument();
        expect(screen.getByLabelText('Go to page 10')).toBeInTheDocument();
    });

    it('triggers onNext and onPrev callbacks', () => {
        const props = { ...defaultProps, page: 5 };
        render(<PaginatedListController {...props} />);

        fireEvent.click(screen.getByLabelText('Go to next page'));
        expect(defaultProps.onNext).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByLabelText('Go to previous page'));
        expect(defaultProps.onPrev).toHaveBeenCalledTimes(1);
    });

    it('triggers onPageChange when page button is clicked', () => {
        render(<PaginatedListController {...defaultProps} />);

        fireEvent.click(screen.getByLabelText('Go to page 2'));
        expect(defaultProps.onPageChange).toHaveBeenCalledWith(2);
    });

    it('triggers onPageSizeChange when selection changes', () => {
        render(<PaginatedListController {...defaultProps} />);

        fireEvent.change(screen.getByLabelText('Items per page'), {
            target: { value: '25' },
        });
        expect(defaultProps.onPageSizeChange).toHaveBeenCalledWith(25);
    });

    it('disables all controls when isLoading is true', () => {
        render(<PaginatedListController {...defaultProps} isLoading={true} />);

        expect(screen.getByLabelText('Go to next page')).toBeDisabled();
        expect(screen.getByLabelText('Go to page 2')).toBeDisabled();
        expect(screen.getByLabelText('Items per page')).toBeDisabled();
    });

    it('renders correctly on the last page', () => {
        const props = { ...defaultProps, page: 10 };
        render(<PaginatedListController {...props} />);

        expect(screen.getByLabelText('Go to next page')).toBeDisabled();
        expect(screen.getByLabelText('Go to previous page')).not.toBeDisabled();
    });

    it('renders correctly with no items', () => {
        render(<PaginatedListController {...defaultProps} total={0} totalPages={0} />);

        expect(screen.getByText('No items to display')).toBeInTheDocument();
    });

    it('handles small number of pages without ellipses', () => {
        const props = { ...defaultProps, totalPages: 3 };
        render(<PaginatedListController {...props} />);

        expect(screen.getByLabelText('Go to page 1')).toBeInTheDocument();
        expect(screen.getByLabelText('Go to page 2')).toBeInTheDocument();
        expect(screen.getByLabelText('Go to page 3')).toBeInTheDocument();
        expect(screen.queryByText('...')).not.toBeInTheDocument();
    });

    it('keeps page controls keyboard focusable', () => {
        render(<PaginatedListController {...defaultProps} />);
        const page2Button = screen.getByLabelText('Go to page 2');
        const pageSizeSelect = screen.getByLabelText('Items per page');

        page2Button.focus();
        expect(page2Button).toHaveFocus();

        pageSizeSelect.focus();
        expect(pageSizeSelect).toHaveFocus();
    });

    it('transitions from loading to empty state', () => {
        const { rerender } = render(
            <PaginatedListController
                {...defaultProps}
                total={0}
                totalPages={0}
                isLoading={true}
            />,
        );

        expect(screen.queryByText('No items to display')).not.toBeInTheDocument();

        rerender(
            <PaginatedListController
                {...defaultProps}
                total={0}
                totalPages={0}
                isLoading={false}
            />,
        );

        expect(screen.getByText('No items to display')).toBeInTheDocument();
    });

    it('keeps prior success content visible during incremental loading', () => {
        const { rerender } = render(
            <PaginatedListController {...defaultProps} page={1} total={25} totalPages={3} />,
        );
        expect(screen.getByText(/Showing/i)).toBeInTheDocument();

        rerender(
            <PaginatedListController
                {...defaultProps}
                page={2}
                total={25}
                totalPages={3}
                isLoading={true}
            />,
        );

        expect(screen.getByText(/Showing/i)).toBeInTheDocument();
        expect(screen.queryByText('No items to display')).not.toBeInTheDocument();
    });

    it('preserves prior success content when incremental fetch fails', () => {
        const onRetry = vi.fn();
        render(
            <PaginatedListController
                {...defaultProps}
                page={2}
                total={25}
                totalPages={3}
                errorMessage="Could not load page 3."
                onRetry={onRetry}
            />,
        );

        expect(screen.getByText(/Showing/i)).toBeInTheDocument();
        expect(screen.getByTestId('paginated-list-controller-error')).toHaveTextContent(
            'Could not load page 3.',
        );

        fireEvent.click(screen.getByTestId('paginated-list-controller-retry'));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });
});
