/**
 * QuestProgressBar Component
 *
 * Animated progress bar for displaying quest completion status.
 * Features smooth animation on mount and size variants.
 *
 * @module components/v1/QuestProgressBar
 */

import React, { useEffect, useState } from 'react';
import type { QuestProgressBarProps } from '../../types/v1/quest';
import './QuestProgressBar.css';

const SIZE_HEIGHT_MAP = {
  small: '4px',
  medium: '8px',
  large: '12px',
};

const DEFAULT_ANIMATION_DURATION = 1000; // 1 second

/**
 * QuestProgressBar — animated progress indicator.
 *
 * Displays a horizontal progress bar with optional animation on mount.
 * The bar animates from 0% to the target percentage when first rendered.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <QuestProgressBar percentage={75} />
 *
 * // With label and custom size
 * <QuestProgressBar
 *   percentage={60}
 *   label="3/5 milestones completed"
 *   size="large"
 *   animate={true}
 * />
 * ```
 */
export const QuestProgressBar: React.FC<QuestProgressBarProps> = ({
  percentage,
  label,
  animate = true,
  animationDuration = DEFAULT_ANIMATION_DURATION,
  size = 'medium',
}) => {
  const [displayPercentage, setDisplayPercentage] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  // Clamp percentage between 0 and 100
  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  useEffect(() => {
    if (animate && !hasAnimated) {
      // Animate from 0 to target percentage
      const startTime = Date.now();
      const duration = animationDuration;

      const animateProgress = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function for smooth animation (ease-out-cubic)
        const easedProgress = 1 - Math.pow(1 - progress, 3);

        setDisplayPercentage(easedProgress * clampedPercentage);

        if (progress < 1) {
          requestAnimationFrame(animateProgress);
        } else {
          setHasAnimated(true);
        }
      };

      requestAnimationFrame(animateProgress);
    } else {
      // No animation - jump directly to target
      setDisplayPercentage(clampedPercentage);
    }
  }, [animate, animationDuration, clampedPercentage, hasAnimated]);

  const height = SIZE_HEIGHT_MAP[size];

  return (
    <div className="quest-progress-bar" data-testid="quest-progress-bar">
      {/* Track (background) */}
      <div
        className="quest-progress-bar__track"
        style={{ height }}
        role="progressbar"
        aria-valuenow={Math.round(displayPercentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Quest progress'}
      >
        {/* Fill (animated foreground) */}
        <div
          className="quest-progress-bar__fill"
          style={{
            width: `${displayPercentage}%`,
            height: '100%',
          }}
          data-testid="quest-progress-bar-fill"
        />
      </div>

      {/* Optional label */}
      {label && (
        <div className="quest-progress-bar__label" data-testid="quest-progress-bar-label">
          {label}
        </div>
      )}
    </div>
  );
};

QuestProgressBar.displayName = 'QuestProgressBar';

export default QuestProgressBar;
