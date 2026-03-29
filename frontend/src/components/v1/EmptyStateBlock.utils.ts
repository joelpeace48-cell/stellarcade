/**
 * Utility functions for EmptyStateBlock component.
 * 
 * This module contains helper functions for:
 * - Variant configuration management
 * - Config resolution and merging
 * - Input sanitization
 * - Callback safety wrappers
 * - Error integration
 */

import type { AppError } from '../../types/errors';
import { ErrorSeverity } from '../../types/errors';
import type {
  EmptyStateBlockProps,
  VariantConfig,
  ResolvedConfig,
  EmptyStateVariant,
} from './EmptyStateBlock.types';

/**
 * Predefined configurations for each variant.
 * These provide sensible defaults that can be overridden by props.
 */
export const VARIANT_CONFIGS: Record<EmptyStateVariant, VariantConfig> = {
  list: {
    icon: '📋',
    title: 'No items yet',
    description: 'Items will appear here once they are added.',
  },
  search: {
    icon: '🔍',
    title: 'No results found',
    description: 'Try adjusting your search terms or filters.',
  },
  'no-results': {
    icon: '🔎',
    title: 'No matching results',
    description: 'Your current filters or search did not match any items. Try adjusting or resetting them.',
  },
  transaction: {
    icon: '🧾',
    title: 'No transactions',
    description: 'Your transaction history will appear here.',
  },
  error: {
    icon: '⚠️',
    title: 'Something went wrong',
    description: 'An error occurred while loading this content.',
  },
  default: {
    icon: 'ℹ️',
    title: 'No data available',
    description: 'There is currently no data to display.',
  },
};

/**
 * Sanitize string input to prevent XSS attacks.
 * 
 * Removes script tags and other potentially dangerous HTML.
 * React's JSX automatically escapes strings, but we add an extra layer
 * of protection for defense in depth.
 * 
 * @param input - String to sanitize (can be undefined or null)
 * @returns Sanitized string, or empty string if input is falsy
 */
export function sanitizeString(input: string | undefined | null): string {
  if (!input) return '';
  
  // Remove script tags (case-insensitive, handles various formats)
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  
  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  return sanitized;
}

/**
 * Wrap an action callback to prevent uncaught errors from crashing the component.
 * 
 * Errors are logged to console but don't propagate to the component.
 * This ensures a single failing action doesn't break the entire UI.
 * 
 * @param callback - The original callback function
 * @param actionLabel - Label of the action (for error logging)
 * @returns Wrapped callback that handles errors safely
 */
export function safeCallback(
  callback: () => void | Promise<void>,
  actionLabel: string
): () => Promise<void> {
  return async () => {
    try {
      await callback();
    } catch (error) {
      console.error(`[EmptyStateBlock] Action "${actionLabel}" callback error:`, error);
      // Optionally integrate with global error handler here
    }
  };
}

/**
 * Validate that a value is a valid function.
 * Used for runtime type checking when component is used from JavaScript.
 * 
 * @param value - Value to check
 * @returns True if value is a function
 */
export function isValidCallback(value: unknown): value is () => void | Promise<void> {
  return typeof value === 'function';
}

/**
 * Get error-specific configuration from an AppError object.
 * 
 * Maps error severity to appropriate icons and generates user-friendly titles.
 * 
 * @param error - AppError object from error-mapping service
 * @returns Partial variant config with error-specific values
 */
export function getErrorConfig(error: AppError): Partial<VariantConfig> {
  const severityIcons: Record<string, string> = {
    [ErrorSeverity.RETRYABLE]: '🔄',
    [ErrorSeverity.USER_ACTIONABLE]: '⚠️',
    [ErrorSeverity.TERMINAL]: '❌',
    [ErrorSeverity.FATAL]: '❌',
  };

  return {
    icon: severityIcons[error.severity] || "⚠️",
    title: getErrorTitle(error),
    description: error.message,
  };
}

/**
 * Generate a user-friendly title from an AppError object.
 *
 * Provides context-appropriate titles based on error domain and severity.
 *
 * @param error - AppError object
 * @returns User-friendly error title
 */
export function getErrorTitle(error: AppError): string {
  // For retryable errors, emphasize that it's temporary
  if (error.severity === ErrorSeverity.RETRYABLE) {
    return "Temporary Issue";
  }

  // For user-actionable errors, emphasize that user can fix it
  if (error.severity === ErrorSeverity.USER_ACTIONABLE) {
    return "Action Required";
  }
  // For terminal or fatal errors, be clear but not alarming
  if (error.severity === ErrorSeverity.TERMINAL || error.severity === ErrorSeverity.FATAL) {
    return 'Unable to Complete';
  }

  // Fallback
  return 'Something went wrong';
}

/**
 * Resolve final configuration by merging variant defaults with custom props.
 * 
 * Resolution order (highest to lowest priority):
 * 1. Explicit props (icon, title, description)
 * 2. Error-derived config (if error prop provided)
 * 3. Variant config (if variant prop provided)
 * 4. Default variant config
 * 
 * @param props - Component props
 * @returns Resolved configuration ready for rendering
 */
export function resolveConfig(props: EmptyStateBlockProps): ResolvedConfig {
  // Start with base config from variant or default
  const variantKey = props.variant ?? 'default';
  let baseConfig: VariantConfig = VARIANT_CONFIGS[variantKey] || VARIANT_CONFIGS.default;
  
  // If error prop is provided, override with error-specific config
  if (props.error) {
    const errorConfig = getErrorConfig(props.error);
    baseConfig = {
      icon: errorConfig.icon ?? baseConfig.icon,
      title: errorConfig.title ?? baseConfig.title,
      description: errorConfig.description ?? baseConfig.description,
    };
  }
  
  // Apply explicit prop overrides (highest priority)
  const resolved: ResolvedConfig = {
    icon: props.icon !== undefined ? props.icon : baseConfig.icon,
    title: props.title !== undefined ? sanitizeString(props.title) : sanitizeString(baseConfig.title),
    description: props.description !== undefined 
      ? (props.description === null ? null : sanitizeString(props.description))
      : sanitizeString(baseConfig.description),
  };
  
  return resolved;
}

/**
 * Validate and normalize action objects.
 * 
 * Ensures actions have required fields and valid callbacks.
 * Invalid actions are filtered out with a console warning.
 * 
 * @param actions - Array of action objects (may be undefined)
 * @returns Validated and normalized actions array
 */
export function validateActions(
  actions: EmptyStateBlockProps['actions']
): NonNullable<EmptyStateBlockProps['actions']> {
  if (!actions || !Array.isArray(actions)) {
    return [];
  }
  
  return actions.filter((action, index) => {
    // Check for required label
    if (!action.label || typeof action.label !== 'string') {
      console.warn(`[EmptyStateBlock] Action at index ${index} missing valid label`);
      return false;
    }
    
    // Check for valid callback
    if (!isValidCallback(action.onClick)) {
      console.warn(`[EmptyStateBlock] Action "${action.label}" has invalid onClick callback`);
      return false;
    }
    
    return true;
  });
}
