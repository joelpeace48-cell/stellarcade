/**
 * useBulkSelection Hook
 *
 * Reusable hook for managing bulk row selection state in table-like components.
 * Provides deterministic selection behavior with keyboard-friendly interactions.
 *
 * @module hooks/v1/useBulkSelection
 */

import { useCallback, useMemo, useState } from 'react';

export interface BulkSelectionState {
    /** Set of selected item IDs */
    selectedIds: Set<string>;
    /** Number of selected items */
    selectedCount: number;
    /** Whether all items are selected */
    isAllSelected: boolean;
    /** Whether some (but not all) items are selected */
    isSomeSelected: boolean;
}

export interface BulkSelectionActions {
    /** Select a single item */
    select: (id: string) => void;
    /** Deselect a single item */
    deselect: (id: string) => void;
    /** Toggle selection of a single item */
    toggle: (id: string) => void;
    /** Select all items */
    selectAll: (itemIds: string[]) => void;
    /** Deselect all items */
    deselectAll: () => void;
    /** Toggle all items */
    toggleAll: (itemIds: string[]) => void;
    /** Select multiple items */
    selectMultiple: (ids: string[]) => void;
    /** Deselect multiple items */
    deselectMultiple: (ids: string[]) => void;
    /** Clear all selections */
    clear: () => void;
    /** Check if an item is selected */
    isSelected: (id: string) => boolean;
}

export interface UseBulkSelectionOptions {
    /** Initial selected IDs */
    initialSelectedIds?: string[];
    /** Callback when selection changes */
    onSelectionChange?: (selectedIds: Set<string>) => void;
}

/**
 * useBulkSelection — bulk row selection state management.
 *
 * Provides a deterministic, keyboard-friendly selection model for table-like components.
 * Tracks selected items and provides utilities for bulk operations.
 *
 * @example
 * ```tsx
 * const { state, actions } = useBulkSelection({
 *   initialSelectedIds: [],
 *   onSelectionChange: (ids) => console.log('Selected:', ids),
 * });
 *
 * // Select/deselect items
 * actions.toggle('item-1');
 * actions.selectAll(['item-1', 'item-2', 'item-3']);
 *
 * // Check state
 * console.log(state.selectedCount); // 3
 * console.log(state.isAllSelected); // true
 * ```
 */
export function useBulkSelection(
    options: UseBulkSelectionOptions = {},
): { state: BulkSelectionState; actions: BulkSelectionActions } {
    const { initialSelectedIds = [], onSelectionChange } = options;

    const [selectedIds, setSelectedIds] = useState<Set<string>>(
        new Set(initialSelectedIds),
    );

    // ── Selection state ────────────────────────────────────────────────────────

    const state = useMemo<BulkSelectionState>(
        () => ({
            selectedIds,
            selectedCount: selectedIds.size,
            isAllSelected: false, // Will be computed by caller with full item list
            isSomeSelected: selectedIds.size > 0,
        }),
        [selectedIds],
    );

    // ── Selection actions ──────────────────────────────────────────────────────

    const select = useCallback(
        (id: string) => {
            setSelectedIds((prev) => {
                if (prev.has(id)) return prev;
                const next = new Set(prev);
                next.add(id);
                onSelectionChange?.(next);
                return next;
            });
        },
        [onSelectionChange],
    );

    const deselect = useCallback(
        (id: string) => {
            setSelectedIds((prev) => {
                if (!prev.has(id)) return prev;
                const next = new Set(prev);
                next.delete(id);
                onSelectionChange?.(next);
                return next;
            });
        },
        [onSelectionChange],
    );

    const toggle = useCallback(
        (id: string) => {
            setSelectedIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) {
                    next.delete(id);
                } else {
                    next.add(id);
                }
                onSelectionChange?.(next);
                return next;
            });
        },
        [onSelectionChange],
    );

    const selectAll = useCallback(
        (itemIds: string[]) => {
            const next = new Set(itemIds);
            setSelectedIds(next);
            onSelectionChange?.(next);
        },
        [onSelectionChange],
    );

    const deselectAll = useCallback(() => {
        const next = new Set<string>();
        setSelectedIds(next);
        onSelectionChange?.(next);
    }, [onSelectionChange]);

    const toggleAll = useCallback(
        (itemIds: string[]) => {
            setSelectedIds((prev) => {
                const allSelected = itemIds.every((id) => prev.has(id));
                const next = allSelected ? new Set<string>() : new Set(itemIds);
                onSelectionChange?.(next);
                return next;
            });
        },
        [onSelectionChange],
    );

    const selectMultiple = useCallback(
        (ids: string[]) => {
            setSelectedIds((prev) => {
                const next = new Set(prev);
                ids.forEach((id) => next.add(id));
                onSelectionChange?.(next);
                return next;
            });
        },
        [onSelectionChange],
    );

    const deselectMultiple = useCallback(
        (ids: string[]) => {
            setSelectedIds((prev) => {
                const next = new Set(prev);
                ids.forEach((id) => next.delete(id));
                onSelectionChange?.(next);
                return next;
            });
        },
        [onSelectionChange],
    );

    const clear = useCallback(() => {
        const next = new Set<string>();
        setSelectedIds(next);
        onSelectionChange?.(next);
    }, [onSelectionChange]);

    const isSelected = useCallback(
        (id: string) => selectedIds.has(id),
        [selectedIds],
    );

    const actions: BulkSelectionActions = {
        select,
        deselect,
        toggle,
        selectAll,
        deselectAll,
        toggleAll,
        selectMultiple,
        deselectMultiple,
        clear,
        isSelected,
    };

    return { state, actions };
}

export default useBulkSelection;
