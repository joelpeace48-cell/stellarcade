/**
 * SplitPaneLayout Component
 *
 * Flexible split-pane layout for side-by-side content display.
 * Supports horizontal and vertical splits with resizable dividers.
 * Automatically stacks on smaller screens.
 *
 * @module components/v1/SplitPaneLayout
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import './SplitPaneLayout.css';

export type SplitDirection = 'horizontal' | 'vertical';

export interface SplitPaneLayoutProps {
  /** Left/top pane content */
  leftPane: React.ReactNode;
  /** Right/bottom pane content */
  rightPane: React.ReactNode;
  /** Split direction */
  direction?: SplitDirection;
  /** Initial split ratio (0-1, where 0.5 = 50/50) */
  initialRatio?: number;
  /** Minimum pane size in pixels */
  minPaneSize?: number;
  /** Whether the layout is resizable */
  resizable?: boolean;
  /** Optional CSS class for styling */
  className?: string;
  /** Test identifier for component queries */
  testId?: string;
  /** Callback when split ratio changes */
  onRatioChange?: (ratio: number) => void;
  /** Whether to persist split ratio to localStorage */
  persistRatio?: boolean;
  /** Key for persisting ratio to localStorage */
  persistKey?: string;
}

/**
 * SplitPaneLayout — flexible split-pane layout.
 *
 * Renders two panes side-by-side (or stacked) with optional resizable divider.
 * Automatically adapts to smaller screens by stacking vertically.
 *
 * @example
 * ```tsx
 * <SplitPaneLayout
 *   leftPane={<SimulatorPanel />}
 *   rightPane={<EventFeed />}
 *   direction="horizontal"
 *   initialRatio={0.4}
 *   resizable={true}
 *   persistRatio={true}
 *   persistKey="dev-layout-ratio"
 * />
 * ```
 */
export const SplitPaneLayout: React.FC<SplitPaneLayoutProps> = ({
  leftPane,
  rightPane,
  direction = 'horizontal',
  initialRatio = 0.5,
  minPaneSize = 200,
  resizable = true,
  className = '',
  testId = 'split-pane-layout',
  onRatioChange,
  persistRatio = false,
  persistKey = 'split-pane-ratio',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState<number>(() => {
    if (persistRatio && typeof window !== 'undefined') {
      const stored = localStorage.getItem(persistKey);
      if (stored) {
        const parsed = parseFloat(stored);
        if (!Number.isNaN(parsed) && parsed > 0 && parsed < 1) {
          return parsed;
        }
      }
    }
    return initialRatio;
  });

  const [isDragging, setIsDragging] = useState(false);

  // ── Persist ratio to localStorage ──────────────────────────────────────────

  useEffect(() => {
    if (persistRatio && typeof window !== 'undefined') {
      localStorage.setItem(persistKey, ratio.toString());
    }
  }, [ratio, persistRatio, persistKey]);

  // ── Notify parent of ratio changes ─────────────────────────────────────────

  useEffect(() => {
    onRatioChange?.(ratio);
  }, [ratio, onRatioChange]);

  // ── Handle resize ──────────────────────────────────────────────────────────

  const handleMouseDown = useCallback(() => {
    if (!resizable) return;
    setIsDragging(true);
  }, [resizable]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const isHorizontal = direction === 'horizontal';

      let newRatio: number;
      if (isHorizontal) {
        const offset = e.clientX - rect.left;
        newRatio = offset / rect.width;
      } else {
        const offset = e.clientY - rect.top;
        newRatio = offset / rect.height;
      }

      // Clamp ratio based on min pane size
      const containerSize = isHorizontal ? rect.width : rect.height;
      const minRatio = minPaneSize / containerSize;
      const maxRatio = 1 - minRatio;

      newRatio = Math.max(minRatio, Math.min(maxRatio, newRatio));
      setRatio(newRatio);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, direction, minPaneSize]);

  const containerClass = [
    'split-pane-layout',
    `split-pane-layout--${direction}`,
    isDragging ? 'split-pane-layout--dragging' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const leftPercentage = `${ratio * 100}%`;
  const rightPercentage = `${(1 - ratio) * 100}%`;

  return (
    <div
      ref={containerRef}
      className={containerClass}
      data-testid={testId}
      data-direction={direction}
      data-ratio={ratio.toFixed(2)}
    >
      <div
        className="split-pane-layout__pane split-pane-layout__pane--left"
        style={
          direction === 'horizontal'
            ? { width: leftPercentage }
            : { height: leftPercentage }
        }
        data-testid={`${testId}-left`}
      >
        {leftPane}
      </div>

      {resizable && (
        <div
          className={`split-pane-layout__divider split-pane-layout__divider--${direction}`}
          onMouseDown={handleMouseDown}
          role="separator"
          aria-orientation={direction === 'horizontal' ? 'vertical' : 'horizontal'}
          aria-label="Resize panes"
          data-testid={`${testId}-divider`}
        />
      )}

      <div
        className="split-pane-layout__pane split-pane-layout__pane--right"
        style={
          direction === 'horizontal'
            ? { width: rightPercentage }
            : { height: rightPercentage }
        }
        data-testid={`${testId}-right`}
      >
        {rightPane}
      </div>
    </div>
  );
};

SplitPaneLayout.displayName = 'SplitPaneLayout';

export default SplitPaneLayout;
