/**
 * Type definitions for EmptyStateBlock component.
 * 
 * This module exports all TypeScript interfaces and types used by the
 * EmptyStateBlock component, providing a clean contract for consumers.
 */

import type { AppError } from '../../types/errors';

/**
 * Context variant that provides default icon, title, and description.
 * 
 * - `list`: Empty list states (e.g., no items in a collection)
 * - `search`: No search results found
 * - `no-results`: Filtered or searched list/table returned zero results
 * - `transaction`: Empty transaction history
 * - `error`: Error states with appropriate messaging
 * - `default`: Generic empty state fallback
 */
export type EmptyStateVariant = 'list' | 'search' | 'no-results' | 'transaction' | 'error' | 'default';

/**
 * Action button variant for visual styling.
 * 
 * - `primary`: Primary action (e.g., "Try Again", "Add Item")
 * - `secondary`: Secondary action (e.g., "Cancel", "Go Back")
 */
export type ActionVariant = 'primary' | 'secondary';

/**
 * Configuration for an action button in the empty state.
 */
export interface EmptyStateAction {
  /**
   * Button label text displayed to the user.
   */
  label: string;
  
  /**
   * Callback function invoked when the button is clicked.
   * Can be synchronous or asynchronous.
   */
  onClick: () => void | Promise<void>;
  
  /**
   * Visual variant for the button.
   * @default 'secondary'
   */
  variant?: ActionVariant;
  
  /**
   * Whether the button is disabled.
   * @default false
   */
  disabled?: boolean;
}

/**
 * Props for the EmptyStateBlock component.
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
 * // Error state with AppError integration
 * <EmptyStateBlock
 *   error={appError}
 *   actions={[
 *     { label: 'Retry', onClick: handleRetry, variant: 'primary' }
 *   ]}
 * />
 * ```
 */
export interface EmptyStateBlockProps {
  /**
   * Context variant that provides default icon, title, and description.
   * Can be overridden by explicit props.
   * 
   * @default 'default'
   */
  variant?: EmptyStateVariant;
  
  /**
   * Custom icon to display. Overrides variant default.
   * 
   * - React component: Any valid React node (e.g., SVG, icon component)
   * - String: Icon name or emoji
   * - null: Hide the icon entirely
   * 
   * @default Variant-specific icon
   */
  icon?: React.ReactNode | string | null;
  
  /**
   * Title text to display. Overrides variant default.
   * 
   * @default Variant-specific title
   */
  title?: string;
  
  /**
   * Description text to display. Overrides variant default.
   * Set to null to hide the description.
   * 
   * @default Variant-specific description
   */
  description?: string | null;
  
  /**
   * Optional array of action buttons to display.
   * Each action has a label and callback.
   * 
   * @default undefined (no actions)
   */
  actions?: EmptyStateAction[];
  
  /**
   * Optional AppError object for error context.
   * When provided, integrates with error-mapping service to display
   * error-specific messaging and icons.
   * 
   * @default undefined
   */
  error?: AppError;
  
  /**
   * Optional CSS class name for custom styling.
   * 
   * @default undefined
   */
  className?: string;
  
  /**
   * Optional test ID for testing.
   * 
   * @default 'empty-state-block'
   */
  testId?: string;
}

/**
 * Internal configuration shape for variant presets.
 * @internal
 */
export interface VariantConfig {
  icon: string;
  title: string;
  description: string;
}

/**
 * Resolved configuration after merging variant defaults with custom props.
 * @internal
 */
export interface ResolvedConfig {
  icon: React.ReactNode | string | null;
  title: string;
  description: string | null;
}
