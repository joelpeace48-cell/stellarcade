/**
 * EnvironmentBadge Component
 *
 * Reusable badge component for displaying network environment (testnet, mainnet, unsupported).
 * Provides consistent visual distinction across wallet and transaction surfaces.
 *
 * @module components/v1/EnvironmentBadge
 */

import React, { useMemo } from 'react';
import './EnvironmentBadge.css';

export type EnvironmentType = 'testnet' | 'mainnet' | 'unsupported';

export interface EnvironmentBadgeProps {
  /** The environment type to display */
  environment: EnvironmentType | string;
  /** Optional custom label override */
  label?: string;
  /** Optional CSS class for styling */
  className?: string;
  /** Test identifier for component queries */
  testId?: string;
  /** Optional size variant */
  size?: 'small' | 'medium' | 'large';
  /** Whether to show an icon indicator */
  showIcon?: boolean;
}

/**
 * Maps environment strings to normalized types and labels
 */
function normalizeEnvironment(env: string): { type: EnvironmentType; label: string } {
  const normalized = env?.toLowerCase().trim() || 'unsupported';

  if (normalized.includes('testnet') || normalized === 'test') {
    return { type: 'testnet', label: 'Testnet' };
  }
  if (normalized.includes('mainnet') || normalized === 'public') {
    return { type: 'mainnet', label: 'Mainnet' };
  }

  return { type: 'unsupported', label: 'Unsupported' };
}

/**
 * EnvironmentBadge — compact environment indicator.
 *
 * Renders a visually distinct badge showing the current network environment.
 * Supports testnet, mainnet, and unsupported states with consistent styling.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <EnvironmentBadge environment="testnet" />
 *
 * // With custom label
 * <EnvironmentBadge environment="mainnet" label="Production" />
 *
 * // With icon
 * <EnvironmentBadge environment="unsupported" showIcon />
 * ```
 */
export const EnvironmentBadge: React.FC<EnvironmentBadgeProps> = ({
  environment,
  label: customLabel,
  className = '',
  testId = 'environment-badge',
  size = 'medium',
  showIcon = true,
}) => {
  const { type, label: defaultLabel } = useMemo(
    () => normalizeEnvironment(environment),
    [environment],
  );

  const displayLabel = customLabel || defaultLabel;

  const containerClass = [
    'environment-badge',
    `environment-badge--${type}`,
    `environment-badge--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={containerClass}
      data-testid={testId}
      data-environment={type}
      role="status"
      aria-label={`Network environment: ${displayLabel}`}
    >
      {showIcon && (
        <span
          className="environment-badge__icon"
          aria-hidden="true"
        />
      )}
      <span className="environment-badge__label">{displayLabel}</span>
    </span>
  );
};

EnvironmentBadge.displayName = 'EnvironmentBadge';

export default EnvironmentBadge;
