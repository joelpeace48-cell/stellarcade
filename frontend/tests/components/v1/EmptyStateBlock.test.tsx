/**
 * EmptyStateBlock Component Tests
 * 
 * Unit tests for the EmptyStateBlock component covering:
 * - Rendering with different variants
 * - Custom prop overrides
 * - Action button functionality
 * - Error integration
 * - Edge cases and error handling
 */


import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EmptyStateBlock } from '../../../src/components/v1/EmptyStateBlock';
import type { AppError } from '../../../src/types/errors';
import { ErrorDomain, ErrorSeverity } from '../../../src/types/errors';

describe('EmptyStateBlock', () => {
  describe('Rendering with minimal props', () => {
    it('should render without crashing with no props', () => {
      render(<EmptyStateBlock />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should use default variant when no variant specified', () => {
      render(<EmptyStateBlock />);
      expect(screen.getByText('No data available')).toBeInTheDocument();
      expect(screen.getByText('There is currently no data to display.')).toBeInTheDocument();
    });

    it('should have correct test id', () => {
      render(<EmptyStateBlock />);
      expect(screen.getByTestId('empty-state-block')).toBeInTheDocument();
    });

    it('should accept custom test id', () => {
      render(<EmptyStateBlock testId="custom-test-id" />);
      expect(screen.getByTestId('custom-test-id')).toBeInTheDocument();
    });
  });

  describe('Variant rendering', () => {
    it('should render list variant correctly', () => {
      render(<EmptyStateBlock variant="list" />);
      expect(screen.getByText('No items yet')).toBeInTheDocument();
      expect(screen.getByText('Items will appear here once they are added.')).toBeInTheDocument();
    });

    it('should render search variant correctly', () => {
      render(<EmptyStateBlock variant="search" />);
      expect(screen.getByText('No results found')).toBeInTheDocument();
      expect(screen.getByText('Try adjusting your search terms or filters.')).toBeInTheDocument();
    });

    it('should render transaction variant correctly', () => {
      render(<EmptyStateBlock variant="transaction" />);
      expect(screen.getByText('No transactions')).toBeInTheDocument();
      expect(screen.getByText('Your transaction history will appear here.')).toBeInTheDocument();
    });

    it('should render error variant correctly', () => {
      render(<EmptyStateBlock variant="error" />);
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('An error occurred while loading this content.')).toBeInTheDocument();
    });

    it('should render default variant correctly', () => {
      render(<EmptyStateBlock variant="default" />);
      expect(screen.getByText('No data available')).toBeInTheDocument();
      expect(screen.getByText('There is currently no data to display.')).toBeInTheDocument();
    });

    it('should render no-results variant correctly', () => {
      render(<EmptyStateBlock variant="no-results" />);
      expect(screen.getByText('No matching results')).toBeInTheDocument();
      expect(screen.getByText('Your current filters or search did not match any items. Try adjusting or resetting them.')).toBeInTheDocument();
    });

    it('should apply no-results CSS modifier class for no-results variant', () => {
      const { container } = render(<EmptyStateBlock variant="no-results" />);
      expect(container.querySelector('.empty-state-block--no-results')).toBeInTheDocument();
    });

    it('should not apply no-results CSS modifier class for other variants', () => {
      const { container } = render(<EmptyStateBlock variant="list" />);
      expect(container.querySelector('.empty-state-block--no-results')).not.toBeInTheDocument();
    });

    it('should not apply no-results CSS modifier class for default variant', () => {
      const { container } = render(<EmptyStateBlock variant="default" />);
      expect(container.querySelector('.empty-state-block--no-results')).not.toBeInTheDocument();
    });
  });

  describe('Custom prop overrides', () => {
    it('should override title with custom value', () => {
      render(<EmptyStateBlock variant="list" title="Custom Title" />);
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
      expect(screen.queryByText('No items yet')).not.toBeInTheDocument();
    });

    it('should override description with custom value', () => {
      render(<EmptyStateBlock variant="list" description="Custom description" />);
      expect(screen.getByText('Custom description')).toBeInTheDocument();
      expect(screen.queryByText('Items will appear here once they are added.')).not.toBeInTheDocument();
    });

    it('should override icon with custom string', () => {
      render(<EmptyStateBlock variant="list" icon="🎮" />);
      expect(screen.getByText('🎮')).toBeInTheDocument();
    });

    it('should hide description when set to null', () => {
      render(<EmptyStateBlock variant="list" description={null} />);
      expect(screen.queryByText('Items will appear here once they are added.')).not.toBeInTheDocument();
    });

    it('should hide icon when set to null', () => {
      const { container } = render(<EmptyStateBlock variant="list" icon={null} />);
      expect(container.querySelector('.empty-state-block__icon')).not.toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(<EmptyStateBlock variant="list" className="custom-class" />);
      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
  });

  describe('Action button functionality', () => {
    it('should render no actions when actions prop is undefined', () => {
      const { container } = render(<EmptyStateBlock variant="list" />);
      expect(container.querySelector('.empty-state-block__actions')).not.toBeInTheDocument();
    });

    it('should render no actions when actions array is empty', () => {
      const { container } = render(<EmptyStateBlock variant="list" actions={[]} />);
      expect(container.querySelector('.empty-state-block__actions')).not.toBeInTheDocument();
    });

    it('should render single action button', () => {
      const handleClick = vi.fn();
      render(
        <EmptyStateBlock
          variant="list"
          actions={[{ label: 'Add Item', onClick: handleClick }]}
        />
      );
      expect(screen.getByText('Add Item')).toBeInTheDocument();
    });

    it('should render multiple action buttons', () => {
      const handleClick1 = vi.fn();
      const handleClick2 = vi.fn();
      render(
        <EmptyStateBlock
          variant="list"
          actions={[
            { label: 'Action 1', onClick: handleClick1 },
            { label: 'Action 2', onClick: handleClick2 },
          ]}
        />
      );
      expect(screen.getByText('Action 1')).toBeInTheDocument();
      expect(screen.getByText('Action 2')).toBeInTheDocument();
    });

    it('should call onClick handler when action button is clicked', () => {
      const handleClick = vi.fn();
      render(
        <EmptyStateBlock
          variant="list"
          actions={[{ label: 'Click Me', onClick: handleClick }]}
        />
      );
      fireEvent.click(screen.getByText('Click Me'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should handle async onClick handlers', async () => {
      const handleClick = vi.fn().mockResolvedValue(undefined);
      render(
        <EmptyStateBlock
          variant="list"
          actions={[{ label: 'Async Action', onClick: handleClick }]}
        />
      );
      fireEvent.click(screen.getByText('Async Action'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should apply primary variant class to primary buttons', () => {
      const handleClick = vi.fn();
      const { container } = render(
        <EmptyStateBlock
          variant="list"
          actions={[{ label: 'Primary', onClick: handleClick, variant: 'primary' }]}
        />
      );
      const button = container.querySelector('.empty-state-block__action-button--primary');
      expect(button).toBeInTheDocument();
    });

    it('should apply secondary variant class to secondary buttons', () => {
      const handleClick = vi.fn();
      const { container } = render(
        <EmptyStateBlock
          variant="list"
          actions={[{ label: 'Secondary', onClick: handleClick, variant: 'secondary' }]}
        />
      );
      const button = container.querySelector('.empty-state-block__action-button--secondary');
      expect(button).toBeInTheDocument();
    });

    it('should default to secondary variant when not specified', () => {
      const handleClick = vi.fn();
      const { container } = render(
        <EmptyStateBlock
          variant="list"
          actions={[{ label: 'Default', onClick: handleClick }]}
        />
      );
      const button = container.querySelector('.empty-state-block__action-button--secondary');
      expect(button).toBeInTheDocument();
    });

    it('should disable button when disabled prop is true', () => {
      const handleClick = vi.fn();
      render(
        <EmptyStateBlock
          variant="list"
          actions={[{ label: 'Disabled', onClick: handleClick, disabled: true }]}
        />
      );
      const button = screen.getByText('Disabled') as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it('should not call onClick when button is disabled', () => {
      const handleClick = vi.fn();
      render(
        <EmptyStateBlock
          variant="list"
          actions={[{ label: 'Disabled', onClick: handleClick, disabled: true }]}
        />
      );
      fireEvent.click(screen.getByText('Disabled'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Error prop integration', () => {
    it('should render error with RETRYABLE severity', () => {
      const error: AppError = {
        code: 'API_NETWORK_ERROR',
        domain: ErrorDomain.API,
        severity: ErrorSeverity.RETRYABLE,
        message: 'Network error occurred',
      };
      render(<EmptyStateBlock error={error} />);
      expect(screen.getByText('Temporary Issue')).toBeInTheDocument();
      expect(screen.getByText('Network error occurred')).toBeInTheDocument();
    });

    it('should render error with USER_ACTIONABLE severity', () => {
      const error: AppError = {
        code: 'WALLET_NOT_CONNECTED',
        domain: ErrorDomain.WALLET,
        severity: ErrorSeverity.USER_ACTIONABLE,
        message: 'Please connect your wallet',
      };
      render(<EmptyStateBlock error={error} />);
      expect(screen.getByText('Action Required')).toBeInTheDocument();
      expect(screen.getByText('Please connect your wallet')).toBeInTheDocument();
    });

    it('should render error with TERMINAL severity', () => {
      const error: AppError = {
        code: 'CONTRACT_NOT_INITIALIZED',
        domain: ErrorDomain.CONTRACT,
        severity: ErrorSeverity.TERMINAL,
        message: 'Contract not initialized',
      };
      render(<EmptyStateBlock error={error} />);
      expect(screen.getByText('Unable to Complete')).toBeInTheDocument();
      expect(screen.getByText('Contract not initialized')).toBeInTheDocument();
    });

    it('should allow custom title to override error title', () => {
      const error: AppError = {
        code: 'API_NETWORK_ERROR',
        domain: ErrorDomain.API,
        severity: ErrorSeverity.RETRYABLE,
        message: 'Network error occurred',
      };
      render(<EmptyStateBlock error={error} title="Custom Error Title" />);
      expect(screen.getByText('Custom Error Title')).toBeInTheDocument();
      expect(screen.queryByText('Temporary Issue')).not.toBeInTheDocument();
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle undefined optional props gracefully', () => {
      render(
        <EmptyStateBlock
          variant="list"
          icon={undefined}
          title={undefined}
          description={undefined}
          actions={undefined}
        />
      );
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should sanitize title with script tags', () => {
      render(<EmptyStateBlock title="<script>alert('xss')</script>Safe Title" />);
      expect(screen.getByText(/Safe Title/)).toBeInTheDocument();
      expect(screen.queryByText(/script/)).not.toBeInTheDocument();
    });

    it('should sanitize description with script tags', () => {
      render(<EmptyStateBlock description="<script>alert('xss')</script>Safe Description" />);
      expect(screen.getByText(/Safe Description/)).toBeInTheDocument();
    });

    it('should handle empty string title', () => {
      render(<EmptyStateBlock title="" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should handle empty string description', () => {
      render(<EmptyStateBlock description="" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should filter out actions with invalid callbacks', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const validAction = { label: 'Valid', onClick: vi.fn() };
      const invalidAction = { label: 'Invalid', onClick: 'not a function' as any };
      
      render(
        <EmptyStateBlock
          variant="list"
          actions={[validAction, invalidAction]}
        />
      );
      
      expect(screen.getByText('Valid')).toBeInTheDocument();
      expect(screen.queryByText('Invalid')).not.toBeInTheDocument();
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });

    it('should filter out actions with missing labels', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const validAction = { label: 'Valid', onClick: vi.fn() };
      const invalidAction = { label: '', onClick: vi.fn() };
      
      render(
        <EmptyStateBlock
          variant="list"
          actions={[validAction, invalidAction as any]}
        />
      );
      
      expect(screen.getByText('Valid')).toBeInTheDocument();
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });

    it('should not crash when action callback throws error', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handleClick = vi.fn(() => {
        throw new Error('Action error');
      });
      
      render(
        <EmptyStateBlock
          variant="list"
          actions={[{ label: 'Throw Error', onClick: handleClick }]}
        />
      );
      
      fireEvent.click(screen.getByText('Throw Error'));
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(screen.getByRole('status')).toBeInTheDocument();
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('No-results variant with reset action', () => {
    it('should render reset filter action button', () => {
      const handleReset = vi.fn();
      render(
        <EmptyStateBlock
          variant="no-results"
          actions={[
            { label: 'Reset Filters', onClick: handleReset, variant: 'primary' },
          ]}
        />
      );
      expect(screen.getByText('Reset Filters')).toBeInTheDocument();
    });

    it('should call reset handler when reset button is clicked', () => {
      const handleReset = vi.fn();
      render(
        <EmptyStateBlock
          variant="no-results"
          actions={[
            { label: 'Reset Filters', onClick: handleReset, variant: 'primary' },
          ]}
        />
      );
      fireEvent.click(screen.getByText('Reset Filters'));
      expect(handleReset).toHaveBeenCalledTimes(1);
    });

    it('should render both reset and secondary actions', () => {
      const handleReset = vi.fn();
      const handleGoBack = vi.fn();
      render(
        <EmptyStateBlock
          variant="no-results"
          actions={[
            { label: 'Reset Filters', onClick: handleReset, variant: 'primary' },
            { label: 'Go Back', onClick: handleGoBack },
          ]}
        />
      );
      expect(screen.getByText('Reset Filters')).toBeInTheDocument();
      expect(screen.getByText('Go Back')).toBeInTheDocument();
    });

    it('should allow custom title and description overrides for no-results', () => {
      render(
        <EmptyStateBlock
          variant="no-results"
          title="No events matched"
          description="Try broadening your date range."
        />
      );
      expect(screen.getByText('No events matched')).toBeInTheDocument();
      expect(screen.getByText('Try broadening your date range.')).toBeInTheDocument();
      expect(screen.queryByText('No matching results')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have role="status"', () => {
      render(<EmptyStateBlock variant="list" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should have aria-live="polite"', () => {
      const { container } = render(<EmptyStateBlock variant="list" />);
      const section = container.querySelector('[aria-live="polite"]');
      expect(section).toBeInTheDocument();
    });

    it('should have aria-hidden on icon', () => {
      const { container } = render(<EmptyStateBlock variant="list" />);
      const icon = container.querySelector('.empty-state-block__icon');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('should use semantic heading for title', () => {
      render(<EmptyStateBlock variant="list" />);
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('No items yet');
    });

    it('should use button elements for actions', () => {
      render(
        <EmptyStateBlock
          variant="list"
          actions={[{ label: 'Action', onClick: vi.fn() }]}
        />
      );
      const button = screen.getByRole('button', { name: 'Action' });
      expect(button).toBeInTheDocument();
      expect(button.tagName).toBe('BUTTON');
    });
  });
});
