import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBulkSelection } from '../../../src/hooks/v1/useBulkSelection';

describe('useBulkSelection', () => {
    it('initializes with empty selection', () => {
        const { result } = renderHook(() => useBulkSelection());
        expect(result.current.state.selectedCount).toBe(0);
        expect(result.current.state.isSomeSelected).toBe(false);
    });

    it('initializes with provided selected IDs', () => {
        const { result } = renderHook(() =>
            useBulkSelection({ initialSelectedIds: ['id-1', 'id-2'] })
        );
        expect(result.current.state.selectedCount).toBe(2);
        expect(result.current.state.isSomeSelected).toBe(true);
    });

    it('selects a single item', () => {
        const { result } = renderHook(() => useBulkSelection());

        act(() => {
            result.current.actions.select('id-1');
        });

        expect(result.current.state.selectedCount).toBe(1);
        expect(result.current.actions.isSelected('id-1')).toBe(true);
    });

    it('deselects a single item', () => {
        const { result } = renderHook(() =>
            useBulkSelection({ initialSelectedIds: ['id-1', 'id-2'] })
        );

        act(() => {
            result.current.actions.deselect('id-1');
        });

        expect(result.current.state.selectedCount).toBe(1);
        expect(result.current.actions.isSelected('id-1')).toBe(false);
        expect(result.current.actions.isSelected('id-2')).toBe(true);
    });

    it('toggles a single item', () => {
        const { result } = renderHook(() => useBulkSelection());

        act(() => {
            result.current.actions.toggle('id-1');
        });

        expect(result.current.actions.isSelected('id-1')).toBe(true);

        act(() => {
            result.current.actions.toggle('id-1');
        });

        expect(result.current.actions.isSelected('id-1')).toBe(false);
    });

    it('selects all items', () => {
        const { result } = renderHook(() => useBulkSelection());
        const itemIds = ['id-1', 'id-2', 'id-3'];

        act(() => {
            result.current.actions.selectAll(itemIds);
        });

        expect(result.current.state.selectedCount).toBe(3);
        itemIds.forEach((id) => {
            expect(result.current.actions.isSelected(id)).toBe(true);
        });
    });

    it('deselects all items', () => {
        const { result } = renderHook(() =>
            useBulkSelection({ initialSelectedIds: ['id-1', 'id-2', 'id-3'] })
        );

        act(() => {
            result.current.actions.deselectAll();
        });

        expect(result.current.state.selectedCount).toBe(0);
        expect(result.current.state.isSomeSelected).toBe(false);
    });

    it('toggles all items', () => {
        const { result } = renderHook(() =>
            useBulkSelection({ initialSelectedIds: ['id-1'] })
        );
        const itemIds = ['id-1', 'id-2', 'id-3'];

        // First toggle should select all
        act(() => {
            result.current.actions.toggleAll(itemIds);
        });

        expect(result.current.state.selectedCount).toBe(3);

        // Second toggle should deselect all
        act(() => {
            result.current.actions.toggleAll(itemIds);
        });

        expect(result.current.state.selectedCount).toBe(0);
    });

    it('selects multiple items', () => {
        const { result } = renderHook(() =>
            useBulkSelection({ initialSelectedIds: ['id-1'] })
        );

        act(() => {
            result.current.actions.selectMultiple(['id-2', 'id-3']);
        });

        expect(result.current.state.selectedCount).toBe(3);
        expect(result.current.actions.isSelected('id-1')).toBe(true);
        expect(result.current.actions.isSelected('id-2')).toBe(true);
        expect(result.current.actions.isSelected('id-3')).toBe(true);
    });

    it('deselects multiple items', () => {
        const { result } = renderHook(() =>
            useBulkSelection({ initialSelectedIds: ['id-1', 'id-2', 'id-3'] })
        );

        act(() => {
            result.current.actions.deselectMultiple(['id-1', 'id-3']);
        });

        expect(result.current.state.selectedCount).toBe(1);
        expect(result.current.actions.isSelected('id-2')).toBe(true);
    });

    it('clears all selections', () => {
        const { result } = renderHook(() =>
            useBulkSelection({ initialSelectedIds: ['id-1', 'id-2', 'id-3'] })
        );

        act(() => {
            result.current.actions.clear();
        });

        expect(result.current.state.selectedCount).toBe(0);
        expect(result.current.state.isSomeSelected).toBe(false);
    });

    it('calls onSelectionChange callback', () => {
        const onSelectionChange = vi.fn();
        const { result } = renderHook(() =>
            useBulkSelection({ onSelectionChange })
        );

        act(() => {
            result.current.actions.select('id-1');
        });

        expect(onSelectionChange).toHaveBeenCalled();
        const selectedIds = onSelectionChange.mock.calls[0][0];
        expect(selectedIds.has('id-1')).toBe(true);
    });

    it('does not duplicate selections', () => {
        const { result } = renderHook(() => useBulkSelection());

        act(() => {
            result.current.actions.select('id-1');
            result.current.actions.select('id-1');
        });

        expect(result.current.state.selectedCount).toBe(1);
    });

    it('handles deselecting non-existent items gracefully', () => {
        const { result } = renderHook(() =>
            useBulkSelection({ initialSelectedIds: ['id-1'] })
        );

        act(() => {
            result.current.actions.deselect('id-999');
        });

        expect(result.current.state.selectedCount).toBe(1);
        expect(result.current.actions.isSelected('id-1')).toBe(true);
    });

    it('maintains selection state across multiple operations', () => {
        const { result } = renderHook(() => useBulkSelection());

        act(() => {
            result.current.actions.selectMultiple(['id-1', 'id-2', 'id-3']);
            result.current.actions.deselect('id-2');
            result.current.actions.select('id-4');
        });

        expect(result.current.state.selectedCount).toBe(3);
        expect(result.current.actions.isSelected('id-1')).toBe(true);
        expect(result.current.actions.isSelected('id-2')).toBe(false);
        expect(result.current.actions.isSelected('id-3')).toBe(true);
        expect(result.current.actions.isSelected('id-4')).toBe(true);
    });
});
