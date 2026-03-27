import React, { useRef } from 'react';
import './ActionToolbar.css';

/**
 * Visual intent variants for toolbar actions.
 */
export type ToolbarActionIntent = 'primary' | 'secondary' | 'tertiary';

/**
 * Configuration for an individual toolbar action.
 */
export interface ToolbarAction {
    /** Unique identifier for the action. */
    id: string;
    /** Label text displayed to the user. */
    label: string;
    /** Callback function invoked when the action is clicked. */
    onClick: () => void | Promise<void>;
    /** Visual intent for the action. @default 'secondary' */
    intent?: ToolbarActionIntent;
    /** Whether the action is currently in a loading state. */
    isLoading?: boolean;
    /** Whether the action is disabled. */
    isDisabled?: boolean;
    /** Optional icon component or string. */
    icon?: React.ReactNode;
}

/**
 * Props for the ActionToolbar component.
 */
export interface ActionToolbarProps {
    /** Array of actions to display in the toolbar. */
    actions: ToolbarAction[];
    /** Layout orientation. @default 'horizontal' */
    orientation?: 'horizontal' | 'vertical';
    /** Optional CSS class name for custom styling. */
    className?: string;
    /** Optional test ID for automation. @default 'action-toolbar' */
    testId?: string;
}

/**
 * ActionToolbar Component
 * 
 * A standardized component for grouping related actions with support for
 * different intents, loading states, and keyboard navigation.
 */
export const ActionToolbar: React.FC<ActionToolbarProps> = ({
    actions,
    orientation = 'horizontal',
    className = '',
    testId = 'action-toolbar'
}) => {
    const toolbarRef = useRef<HTMLDivElement>(null);

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        const total = actions.length;
        let nextIndex = index;

        switch (e.key) {
            case 'ArrowRight':
            case 'ArrowDown':
                nextIndex = (index + 1) % total;
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
                nextIndex = (index - 1 + total) % total;
                break;
            case 'Home':
                nextIndex = 0;
                break;
            case 'End':
                nextIndex = total - 1;
                break;
            default:
                return;
        }

        e.preventDefault();
        const buttons = toolbarRef.current?.querySelectorAll<HTMLButtonElement>('.stellarcade-toolbar-item');
        buttons?.[nextIndex]?.focus();
    };

    if (!actions || actions.length === 0) {
        return null; // Don't render empty toolbar
    }

    return (
        <div
            className={`stellarcade-action-toolbar stellarcade-action-toolbar--${orientation} ${className}`}
            role="toolbar"
            aria-label="Action Toolbar"
            data-testid={testId}
            ref={toolbarRef}
        >
            {actions.map((action, index) => {
                const isItemDisabled = action.isDisabled || action.isLoading;
                const intentClass = `stellarcade-toolbar-item--${action.intent || 'secondary'}`;

                return (
                    <button
                        key={action.id}
                        type="button"
                        className={`stellarcade-toolbar-item ${intentClass} ${action.isLoading ? 'stellarcade-toolbar-item--loading' : ''}`}
                        onClick={() => !isItemDisabled && action.onClick()}
                        disabled={isItemDisabled}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        tabIndex={0}
                        data-testid={`${testId}-item-${action.id}`}
                        aria-busy={action.isLoading}
                        title={action.label}
                    >
                        {action.isLoading ? (
                            <span className="stellarcade-toolbar-spinner" aria-hidden="true" />
                        ) : (
                            action.icon && <span className="stellarcade-toolbar-icon">{action.icon}</span>
                        )}
                        <span className="stellarcade-toolbar-label">{action.label}</span>
                    </button>
                )
            })}
        </div>
    );
};
