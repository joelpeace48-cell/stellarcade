/**
 * EmptyStateBlock Component
 * 
 * A reusable component for displaying empty states across the application.
 * Provides standardized UI for scenarios like empty lists, no search results,
 * missing data, and error states.
 * 
 * @module components/v1/EmptyStateBlock
 */

import React from 'react';
import type { EmptyStateBlockProps } from './EmptyStateBlock.types';
import {
  resolveConfig,
  validateActions,
  safeCallback,
  sanitizeString,
} from './EmptyStateBlock.utils';
import './EmptyStateBlock.css';

/**
 * EmptyStateBlock - Stateless component for empty state UI.
 * 
 * Displays an icon, title, description, and optional action buttons when
 * data is absent or unavailable. Supports multiple context variants and
 * integrates with the application's error handling system.
 * 
 * @example
 * ```tsx
 * // Basic usage with variant
 * <EmptyStateBlock variant="list" />
 * 
 * // Custom content
 * <EmptyStateBlock
 *   icon="🎮"
 *   title="No games available"
 *   description="Check back later for new games!"
 * />
 * 
 * // With actions
 * <EmptyStateBlock
 *   variant="search"
 *   actions={[
 *     { label: 'Clear Filters', onClick: handleClearFilters, variant: 'primary' },
 *     { label: 'Go Back', onClick: handleGoBack }
 *   ]}
 * />
 * 
 * // Error state
 * <EmptyStateBlock
 *   error={appError}
 *   actions={[{ label: 'Retry', onClick: handleRetry, variant: 'primary' }]}
 * />
 * ```
 * 
 * @param props - Component props
 * @returns React element
 */
export const EmptyStateBlock: React.FC<EmptyStateBlockProps> = (props) => {
  const {
    className,
    testId = 'empty-state-block',
    actions,
  } = props;
  
  // Resolve final configuration from props and variants
  const config = resolveConfig(props);
  const variant = props.variant ?? 'default';
  
  // Validate and normalize actions
  const validActions = validateActions(actions);
  
  // Build CSS classes
  const containerClasses = [
    'empty-state-block',
    variant === 'no-results' ? 'empty-state-block--no-results' : null,
    className,
  ].filter(Boolean).join(' ');
  
  return (
    <section
      className={containerClasses}
      data-testid={testId}
      role="status"
      aria-live="polite"
    >
      {/* Icon */}
      {config.icon !== null && (
        <div className="empty-state-block__icon" aria-hidden="true">
          {typeof config.icon === 'string' ? (
            <span className="empty-state-block__icon-text">{config.icon}</span>
          ) : (
            config.icon
          )}
        </div>
      )}
      
      {/* Title */}
      <h2 className="empty-state-block__title">
        {config.title}
      </h2>
      
      {/* Description */}
      {config.description !== null && (
        <p className="empty-state-block__description">
          {config.description}
        </p>
      )}
      
      {/* Actions */}
      {validActions.length > 0 && (
        <div className="empty-state-block__actions">
          {validActions.map((action, index) => {
            const buttonVariant = action.variant || 'secondary';
            const buttonClasses = [
              'empty-state-block__action-button',
              `empty-state-block__action-button--${buttonVariant}`,
            ].join(' ');
            
            return (
              <button
                key={`${sanitizeString(action.label)}-${index}`}
                type="button"
                className={buttonClasses}
                onClick={safeCallback(action.onClick, action.label)}
                disabled={action.disabled}
                data-testid={`${testId}-action-${index}`}
              >
                {sanitizeString(action.label)}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

// Display name for debugging
EmptyStateBlock.displayName = 'EmptyStateBlock';

// Default export
export default EmptyStateBlock;
