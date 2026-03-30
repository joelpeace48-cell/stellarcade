/**
 * BulkSelectionToolbar Component
 *
 * Reusable toolbar for displaying bulk selection state and actions.
 * Shows selected count and provides clear-selection functionality.
 *
 * @module components/v1/BulkSelectionToolbar
 */

import React, { useCallback } from 'react';
import './BulkSelectionToolbar.css';

export interface BulkSelectionToolbarProps {
  /** Number of selected items */
  selectedCount: number;
  /** Total number of items available */
  totalCount?: number;
  /** Callback to clear selection */
  onClear: () => void;
  /** Optional additional action buttons */
  actions?: Array<{
    id: string;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    variant?: 'primary' | 'secondary' | 'danger';
  }>;
  /** Optional CSS class for styling */
  className?: string;
  /** Test identifier for component queries */
  testId?: string;
  /** Whether the toolbar is visible */
  isVisible?: boolean;
}

/**
 * BulkSelectionToolbar — bulk selection action toolbar.
 *
 * Displays the number of selected items and provides actions for bulk operations.
 * Automatically hides when no items are selected.
 *
 * @example
 * ```tsx
 * <BulkSelectionToolbar
 *   selectedCount={5}
 *   totalCount={20}
 *   onClear={() => clearSelection()}
 *   actions={[
 *     { id: 'delete', label: 'Delete', onClick: handleDelete, variant: 'danger' },
 *     { id: 'export', label: 'Export', onClick: handleExport },
 *   ]}
 * />
 * ```
 */
export const BulkSelectionToolbar: React.FC<BulkSelectionToolbarProps> = ({
  selectedCount,
  totalCount,
  onClear,
  actions = [],
  className = '',
  testId = 'bulk-selection-toolbar',
  isVisible = true,
}) => {
  const handleClear = useCallback(() => {
    onClear();
  }, [onClear]);

  // Hide toolbar when no items are selected
  if (!isVisible || selectedCount === 0) {
    return null;
  }

  const containerClass = [
    'bulk-selection-toolbar',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const selectionText = totalCount
    ? `${selectedCount} of ${totalCount} selected`
    : `${selectedCount} selected`;

  return (
    <div
      className={containerClass}
      data-testid={testId}
      role="toolbar"
      aria-label="Bulk selection actions"
    >
      <div className="bulk-selection-toolbar__info">
        <span
          className="bulk-selection-toolbar__count"
          data-testid={`${testId}-count`}
        >
          {selectionText}
        </span>
      </div>

      <div className="bulk-selection-toolbar__actions">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className={`bulk-selection-toolbar__action bulk-selection-toolbar__action--${action.variant || 'secondary'}`}
            onClick={action.onClick}
            disabled={action.disabled}
            data-testid={`${testId}-action-${action.id}`}
            aria-label={action.label}
          >
            {action.label}
          </button>
        ))}

        <button
          type="button"
          className="bulk-selection-toolbar__clear"
          onClick={handleClear}
          data-testid={`${testId}-clear`}
          aria-label="Clear selection"
          title="Clear selection"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

BulkSelectionToolbar.displayName = 'BulkSelectionToolbar';

export default BulkSelectionToolbar;
