/**
 * QuestProgressRing Component
 *
 * Circular progress indicator for displaying quest completion status.
 * Features smooth animation on mount, size variants, and color themes.
 *
 * @module components/v1/QuestProgressRing
 */

import React, { useEffect, useState } from 'react';
import type { QuestProgressRingProps } from '../../types/v1/quest';
import './QuestProgressRing.css';

const SIZE_MAP = {
  small: 64,
  medium: 96,
  large: 128,
};

const STROKE_WIDTH_MAP = {
  small: 4,
  medium: 6,
  large: 8,
};

const COLOR_VARIANT_MAP = {
  primary: {
    track: 'rgba(255, 255, 255, 0.1)',
    fill: '#00ffcc',
    fillGradientStart: '#00d4aa',
    fillGradientEnd: '#00ffcc',
  },
  success: {
    track: 'rgba(255, 255, 255, 0.1)',
    fill: '#00ff88',
    fillGradientStart: '#00ff88',
    fillGradientEnd: '#00ffcc',
  },
  warning: {
    track: 'rgba(255, 255, 255, 0.1)',
    fill: '#ffcc00',
    fillGradientStart: '#ffaa00',
    fillGradientEnd: '#ffcc00',
  },
};

const DEFAULT_ANIMATION_DURATION = 1500;

/**
 * QuestProgressRing — circular progress indicator.
 *
 * Displays a ring-shaped progress indicator with optional percentage text.
 * The ring animates from 0% to the target percentage when first rendered.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <QuestProgressRing percentage={75} />
 *
 * // Large ring with label
 * <QuestProgressRing
 *   percentage={100}
 *   size="large"
 *   color="success"
 *   label="Quest Complete!"
 *   showPercentage={true}
 * />
 * ```
 */
export const QuestProgressRing: React.FC<QuestProgressRingProps> = ({
  percentage,
  size = 'large',
  strokeWidth,
  showPercentage = true,
  animate = true,
  animationDuration = DEFAULT_ANIMATION_DURATION,
  color = 'primary',
  label,
  subtitle,
}) => {
  const [displayPercentage, setDisplayPercentage] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  // Resolve size and stroke width
  const resolvedSize = typeof size === 'number' ? size : SIZE_MAP[size];
  const resolvedStrokeWidth =
    strokeWidth ?? (typeof size === 'number' ? 6 : STROKE_WIDTH_MAP[size]);

  // Calculate circle dimensions
  const center = resolvedSize / 2;
  const radius = center - resolvedStrokeWidth;
  const circumference = 2 * Math.PI * radius;

  // Clamp percentage between 0 and 100
  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  // Calculate stroke dasharray and dashoffset
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (displayPercentage / 100) * circumference;

  // Determine color variant
  const colors = COLOR_VARIANT_MAP[color];

  // Use success color when 100% complete
  const effectiveColors = clampedPercentage >= 100 ? COLOR_VARIANT_MAP.success : colors;

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

  return (
    <div
      className="quest-progress-ring"
      data-testid="quest-progress-ring"
      style={{ '--ring-size': `${resolvedSize}px` } as React.CSSProperties}
    >
      <svg
        className="quest-progress-ring__svg"
        width={resolvedSize}
        height={resolvedSize}
        viewBox={`0 0 ${resolvedSize} ${resolvedSize}`}
        role="progressbar"
        aria-valuenow={Math.round(displayPercentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Quest progress'}
      >
        {/* Background track circle */}
        <circle
          className="quest-progress-ring__track"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={effectiveColors.track}
          strokeWidth={resolvedStrokeWidth}
        />

        {/* Foreground progress circle with gradient */}
        <defs>
          <linearGradient
            id={`gradient-${color}-${resolvedSize}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop
              offset="0%"
              stopColor={effectiveColors.fillGradientStart}
            />
            <stop
              offset="100%"
              stopColor={effectiveColors.fillGradientEnd}
            />
          </linearGradient>
        </defs>

        <circle
          className="quest-progress-ring__fill"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#gradient-${color}-${resolvedSize})`}
          strokeWidth={resolvedStrokeWidth}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />

        {/* Optional percentage text in center */}
        {showPercentage && (
          <text
            className="quest-progress-ring__percentage"
            x={center}
            y={center}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={resolvedSize * 0.25}
            fontWeight="700"
            fill="#ffffff"
          >
            {Math.round(displayPercentage)}%
          </text>
        )}
      </svg>

      {/* Optional label and subtitle below ring */}
      {(label || subtitle) && (
        <div className="quest-progress-ring__info">
          {label && (
            <div
              className="quest-progress-ring__label"
              data-testid="quest-progress-ring-label"
            >
              {label}
            </div>
          )}
          {subtitle && (
            <div
              className="quest-progress-ring__subtitle"
              data-testid="quest-progress-ring-subtitle"
            >
              {subtitle}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

QuestProgressRing.displayName = 'QuestProgressRing';

export default QuestProgressRing;
