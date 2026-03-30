/**
 * MultiStepProgressIndicator Component
 *
 * Reusable multi-step progress indicator for displaying orchestrated transaction steps.
 * Maps transaction phases into user-facing progress states with optional labels.
 *
 * @module components/v1/MultiStepProgressIndicator
 */

import React, { useMemo } from 'react';
import './MultiStepProgressIndicator.css';

export interface ProgressStep {
  /** Unique identifier for the step */
  id: string;
  /** Display label for the step */
  label: string;
  /** Optional description for the step */
  description?: string;
}

export type StepStatus = 'pending' | 'active' | 'completed' | 'error';

export interface MultiStepProgressIndicatorProps {
  /** Array of steps to display */
  steps: ProgressStep[];
  /** Current active step index (0-based) */
  currentStepIndex: number;
  /** Optional error state */
  hasError?: boolean;
  /** Optional CSS class for styling */
  className?: string;
  /** Test identifier for component queries */
  testId?: string;
  /** Optional size variant */
  size?: 'small' | 'medium' | 'large';
  /** Whether to show step descriptions */
  showDescriptions?: boolean;
  /** Optional callback when a step is clicked (for completed steps) */
  onStepClick?: (stepIndex: number) => void;
  /** Whether to show step numbers */
  showStepNumbers?: boolean;
}

/**
 * Determines the status of a step based on its position relative to current step
 */
function getStepStatus(
  stepIndex: number,
  currentStepIndex: number,
  hasError: boolean,
): StepStatus {
  if (hasError && stepIndex === currentStepIndex) {
    return 'error';
  }
  if (stepIndex < currentStepIndex) {
    return 'completed';
  }
  if (stepIndex === currentStepIndex) {
    return 'active';
  }
  return 'pending';
}

/**
 * MultiStepProgressIndicator — multi-step progress display.
 *
 * Renders a visual progression through multiple steps with status indicators.
 * Supports pending, active, completed, and error states.
 *
 * @example
 * ```tsx
 * // Basic usage
 * const steps = [
 *   { id: 'validate', label: 'Validate' },
 *   { id: 'submit', label: 'Submit' },
 *   { id: 'confirm', label: 'Confirm' },
 * ];
 * <MultiStepProgressIndicator steps={steps} currentStepIndex={1} />
 *
 * // With descriptions and error state
 * <MultiStepProgressIndicator
 *   steps={steps}
 *   currentStepIndex={1}
 *   hasError={true}
 *   showDescriptions={true}
 * />
 * ```
 */
export const MultiStepProgressIndicator: React.FC<MultiStepProgressIndicatorProps> = ({
  steps,
  currentStepIndex,
  hasError = false,
  className = '',
  testId = 'multi-step-progress',
  size = 'medium',
  showDescriptions = false,
  onStepClick,
  showStepNumbers = true,
}) => {
  const clampedCurrentIndex = useMemo(
    () => Math.max(0, Math.min(currentStepIndex, steps.length - 1)),
    [currentStepIndex, steps.length],
  );

  const containerClass = [
    'multi-step-progress',
    `multi-step-progress--${size}`,
    hasError ? 'multi-step-progress--error' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const handleStepClick = (index: number) => {
    if (index < clampedCurrentIndex && onStepClick) {
      onStepClick(index);
    }
  };

  return (
    <div
      className={containerClass}
      data-testid={testId}
      role="progressbar"
      aria-valuenow={clampedCurrentIndex + 1}
      aria-valuemin={1}
      aria-valuemax={steps.length}
      aria-label={`Progress: Step ${clampedCurrentIndex + 1} of ${steps.length}`}
    >
      <div className="multi-step-progress__track">
        {steps.map((step, index) => {
          const status = getStepStatus(index, clampedCurrentIndex, hasError);
          const isClickable = index < clampedCurrentIndex && onStepClick;

          return (
            <div
              key={step.id}
              className={`multi-step-progress__step multi-step-progress__step--${status} ${
                isClickable ? 'multi-step-progress__step--clickable' : ''
              }`}
              data-testid={`${testId}-step-${index}`}
              data-step-id={step.id}
              data-step-status={status}
              onClick={() => handleStepClick(index)}
              role="button"
              tabIndex={isClickable ? 0 : -1}
              aria-label={`${step.label}: ${status}`}
              onKeyDown={(e) => {
                if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  handleStepClick(index);
                }
              }}
            >
              <div className="multi-step-progress__step-indicator">
                {status === 'completed' ? (
                  <span className="multi-step-progress__step-icon" aria-hidden="true">
                    ✓
                  </span>
                ) : status === 'error' ? (
                  <span className="multi-step-progress__step-icon" aria-hidden="true">
                    ✕
                  </span>
                ) : showStepNumbers ? (
                  <span className="multi-step-progress__step-number">{index + 1}</span>
                ) : (
                  <span className="multi-step-progress__step-dot" aria-hidden="true" />
                )}
              </div>

              <div className="multi-step-progress__step-content">
                <span className="multi-step-progress__step-label">{step.label}</span>
                {showDescriptions && step.description && (
                  <span className="multi-step-progress__step-description">
                    {step.description}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Connector lines between steps */}
      <div className="multi-step-progress__connectors">
        {steps.map((_, index) => {
          if (index === steps.length - 1) return null;

          const isCompleted = index < clampedCurrentIndex;
          const isActive = index === clampedCurrentIndex;

          return (
            <div
              key={`connector-${index}`}
              className={`multi-step-progress__connector ${
                isCompleted ? 'multi-step-progress__connector--completed' : ''
              } ${isActive ? 'multi-step-progress__connector--active' : ''}`}
              data-testid={`${testId}-connector-${index}`}
              aria-hidden="true"
            />
          );
        })}
      </div>
    </div>
  );
};

MultiStepProgressIndicator.displayName = 'MultiStepProgressIndicator';

export default MultiStepProgressIndicator;
