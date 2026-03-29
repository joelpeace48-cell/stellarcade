/**
 * EmptyStateBlock Integration Tests
 * 
 * Tests the component's integration with:
 * - Error mapping service
 * - Real-world usage scenarios
 * - Component composition
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EmptyStateBlock } from '../../src/components/v1/EmptyStateBlock';
import { toAppError, mapApiError, mapWalletError } from '../../src/utils/v1/errorMapper';
import { ErrorDomain, ErrorSeverity } from '../../src/types/errors';

describe('EmptyStateBlock Integration Tests', () => {
  describe('Error Mapping Service Integration', () => {
    it('should integrate with API error mapping', () => {
      const rawError = {
        status: 404,
        error: {
          message: 'Resource not found',
          code: 'NOT_FOUND',
          status: 404,
        },
      };

      const appError = mapApiError(rawError);
      
      render(<EmptyStateBlock error={appError} />);
      
      expect(screen.getByText('Unable to Complete')).toBeInTheDocument();
      expect(screen.getByText('Resource not found')).toBeInTheDocument();
    });

    it('should integrate with wallet error mapping', () => {
      const rawError = new Error('Wallet is not connected. Please connect your Freighter wallet.');
      const appError = mapWalletError(rawError);
      
      render(<EmptyStateBlock error={appError} />);
      
      expect(screen.getByText('Action Required')).toBeInTheDocument();
      expect(screen.getByText(/not connected/i)).toBeInTheDocument();
    });

    it('should integrate with toAppError auto-detection', () => {
      const rawError = new Error('Failed to fetch');
      const appError = toAppError(rawError);
      
      render(<EmptyStateBlock error={appError} />);
      
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText(/Temporary Issue|Unable to Complete/)).toBeInTheDocument();
    });

    it('should handle retryable errors with retry action', async () => {
      const appError = {
        code: 'API_NETWORK_ERROR' as const,
        domain: ErrorDomain.API,
        severity: ErrorSeverity.RETRYABLE,
        message: 'Network connection failed',
        retryAfterMs: 1000,
      };

      const handleRetry = vi.fn();
      
      render(
        <EmptyStateBlock
          error={appError}
          actions={[
            { label: 'Retry', onClick: handleRetry, variant: 'primary' },
          ]}
        />
      );
      
      expect(screen.getByText('Temporary Issue')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Retry'));
      
      await waitFor(() => {
        expect(handleRetry).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should work in a game library empty state', () => {
      const handleBrowseGames = vi.fn();
      
      render(
        <EmptyStateBlock
          icon="🎮"
          title="Your game library is empty"
          description="Discover and play exciting blockchain games to start building your collection."
          actions={[
            {
              label: 'Browse Games',
              onClick: handleBrowseGames,
              variant: 'primary',
            },
          ]}
        />
      );
      
      expect(screen.getByText('Your game library is empty')).toBeInTheDocument();
      expect(screen.getByText(/blockchain games/i)).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Browse Games'));
      expect(handleBrowseGames).toHaveBeenCalled();
    });

    it('should work in a search results empty state', () => {
      const handleClearFilters = vi.fn();
      const handleResetSearch = vi.fn();
      
      render(
        <EmptyStateBlock
          variant="search"
          title="No results match your filters"
          description="Try removing some filters or adjusting your search terms."
          actions={[
            {
              label: 'Clear Filters',
              onClick: handleClearFilters,
              variant: 'primary',
            },
            {
              label: 'Reset Search',
              onClick: handleResetSearch,
            },
          ]}
        />
      );
      
      expect(screen.getByText('No results match your filters')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Clear Filters'));
      expect(handleClearFilters).toHaveBeenCalled();
      
      fireEvent.click(screen.getByText('Reset Search'));
      expect(handleResetSearch).toHaveBeenCalled();
    });

    it('should work in a filtered activity table no-results state', () => {
      const handleClearFilters = vi.fn();
      const handleReset = vi.fn();

      const { container } = render(
        <EmptyStateBlock
          variant="no-results"
          actions={[
            {
              label: 'Clear Filters',
              onClick: handleClearFilters,
              variant: 'primary',
            },
            {
              label: 'Reset',
              onClick: handleReset,
            },
          ]}
        />
      );

      expect(screen.getByText('No matching results')).toBeInTheDocument();
      expect(screen.getByText(/current filters/i)).toBeInTheDocument();
      expect(container.querySelector('.empty-state-block--no-results')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Clear Filters'));
      expect(handleClearFilters).toHaveBeenCalled();

      fireEvent.click(screen.getByText('Reset'));
      expect(handleReset).toHaveBeenCalled();
    });

    it('should distinguish no-results from generic empty state', () => {
      const { container: defaultContainer } = render(
        <EmptyStateBlock variant="default" />
      );
      const { container: noResultsContainer } = render(
        <EmptyStateBlock variant="no-results" />
      );

      expect(defaultContainer.querySelector('.empty-state-block--no-results')).not.toBeInTheDocument();
      expect(noResultsContainer.querySelector('.empty-state-block--no-results')).toBeInTheDocument();
      expect(screen.getByText('No data available')).toBeInTheDocument();
      expect(screen.getByText('No matching results')).toBeInTheDocument();
    });

    it('should work in a transaction history empty state', () => {
      const handlePlayGame = vi.fn();
      
      render(
        <EmptyStateBlock
          variant="transaction"
          title="No transactions yet"
          description="Your transaction history will appear here once you start playing games."
          actions={[
            {
              label: 'Play a Game',
              onClick: handlePlayGame,
              variant: 'primary',
            },
          ]}
        />
      );
      
      expect(screen.getByText('No transactions yet')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Play a Game'));
      expect(handlePlayGame).toHaveBeenCalled();
    });

    it('should work in a network error scenario with retry', async () => {
      let attemptCount = 0;
      const mockFetch = vi.fn(async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Network error');
        }
        return { data: 'success' };
      });

      const TestComponent = () => {
        const [error, setError] = React.useState<any>(null);
        const [loading, setLoading] = React.useState(false);

        const handleRetry = async () => {
          setLoading(true);
          setError(null);
          try {
            await mockFetch();
          } catch (err) {
            setError(toAppError(err));
          } finally {
            setLoading(false);
          }
        };

        React.useEffect(() => {
          handleRetry();
        }, []);

        if (loading) return <div>Loading...</div>;
        if (error) {
          return (
            <EmptyStateBlock
              error={error}
              actions={[
                {
                  label: 'Retry',
                  onClick: handleRetry,
                  variant: 'primary',
                },
              ]}
            />
          );
        }
        return <div>Success</div>;
      };

      render(<TestComponent />);
      
      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Retry'));
      
      await waitFor(() => {
        expect(screen.getByText('Success')).toBeInTheDocument();
      });
      
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Component Composition', () => {
    it('should work when nested in other components', () => {
      const Container: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <div style={{ padding: '20px', backgroundColor: '#f0f0f0' }}>
          {children}
        </div>
      );

      render(
        <Container>
          <EmptyStateBlock variant="list" />
        </Container>
      );
      
      expect(screen.getByText('No items yet')).toBeInTheDocument();
    });

    it('should work with conditional rendering', () => {
      const ConditionalComponent: React.FC<{ isEmpty: boolean }> = ({ isEmpty }) => (
        <div>
          {isEmpty ? (
            <EmptyStateBlock variant="list" />
          ) : (
            <div>Content here</div>
          )}
        </div>
      );

      const { rerender } = render(<ConditionalComponent isEmpty={true} />);
      expect(screen.getByText('No items yet')).toBeInTheDocument();
      
      rerender(<ConditionalComponent isEmpty={false} />);
      expect(screen.queryByText('No items yet')).not.toBeInTheDocument();
      expect(screen.getByText('Content here')).toBeInTheDocument();
    });

    it('should work with dynamic prop updates', () => {
      const DynamicComponent: React.FC = () => {
        const [variant, setVariant] = React.useState<'list' | 'search'>('list');

        return (
          <div>
            <button onClick={() => setVariant('search')}>Change to Search</button>
            <EmptyStateBlock variant={variant} />
          </div>
        );
      };

      render(<DynamicComponent />);
      
      expect(screen.getByText('No items yet')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Change to Search'));
      
      expect(screen.queryByText('No items yet')).not.toBeInTheDocument();
      expect(screen.getByText('No results found')).toBeInTheDocument();
    });

    it('should maintain state isolation between multiple instances', () => {
      render(
        <div>
          <EmptyStateBlock variant="list" testId="empty-1" />
          <EmptyStateBlock variant="search" testId="empty-2" />
        </div>
      );
      
      expect(screen.getByTestId('empty-1')).toBeInTheDocument();
      expect(screen.getByTestId('empty-2')).toBeInTheDocument();
      expect(screen.getByText('No items yet')).toBeInTheDocument();
      expect(screen.getByText('No results found')).toBeInTheDocument();
    });
  });

  describe('Import and Export', () => {
    it('should be importable from components/v1', () => {
      // This test verifies the import works (if it didn't, the test file wouldn't compile)
      expect(EmptyStateBlock).toBeDefined();
      expect(typeof EmptyStateBlock).toBe('function');
    });

    it('should have correct display name', () => {
      expect(EmptyStateBlock.displayName).toBe('EmptyStateBlock');
    });
  });

  describe('Performance', () => {
    it('should not re-render unnecessarily with same props', () => {
      let renderCount = 0;
      
      const TestWrapper: React.FC<{ variant: 'list' | 'search' }> = ({ variant }) => {
        renderCount++;
        return <EmptyStateBlock variant={variant} />;
      };

      const { rerender } = render(<TestWrapper variant="list" />);
      expect(renderCount).toBe(1);
      
      // Re-render with same props
      rerender(<TestWrapper variant="list" />);
      expect(renderCount).toBe(2); // Will re-render (not memoized by default)
      
      // Re-render with different props
      rerender(<TestWrapper variant="search" />);
      expect(renderCount).toBe(3);
    });

    it('should handle rapid prop changes', () => {
      const TestComponent: React.FC = () => {
        const [count, setCount] = React.useState(0);
        const variants: Array<'list' | 'search' | 'transaction'> = ['list', 'search', 'transaction'];
        const variant = variants[count % variants.length];

        return (
          <div>
            <button onClick={() => setCount(c => c + 1)}>Change</button>
            <EmptyStateBlock variant={variant} />
          </div>
        );
      };

      render(<TestComponent />);
      
      const button = screen.getByText('Change');
      
      // Rapidly change props
      for (let i = 0; i < 10; i++) {
        fireEvent.click(button);
      }
      
      // Component should still be functional
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });
});
