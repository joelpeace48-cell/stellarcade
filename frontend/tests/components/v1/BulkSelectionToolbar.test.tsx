import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkSelectionToolbar } from '../../../src/components/v1/BulkSelectionToolbar';

describe('BulkSelectionToolbar', () => {
  it('renders when items are selected', () => {
    render(<BulkSelectionToolbar selectedCount={5} onClear={vi.fn()} />);
    expect(screen.getByTestId('bulk-selection-toolbar')).toBeInTheDocument();
  });

  it('hides when no items are selected', () => {
    const { container } = render(
      <BulkSelectionToolbar selectedCount={0} onClear={vi.fn()} />
    );
    expect(container.querySelector('[data-testid="bulk-selection-toolbar"]')).not.toBeInTheDocument();
  });

  it('displays selected count', () => {
    render(<BulkSelectionToolbar selectedCount={5} onClear={vi.fn()} />);
    expect(screen.getByText('5 selected')).toBeInTheDocument();
  });

  it('displays selected count with total', () => {
    render(
      <BulkSelectionToolbar selectedCount={5} totalCount={20} onClear={vi.fn()} />
    );
    expect(screen.getByText('5 of 20 selected')).toBeInTheDocument();
  });

  it('calls onClear when clear button is clicked', () => {
    const onClear = vi.fn();
    render(<BulkSelectionToolbar selectedCount={5} onClear={onClear} />);

    const clearButton = screen.getByTestId('bulk-selection-toolbar-clear');
    fireEvent.click(clearButton);

    expect(onClear).toHaveBeenCalled();
  });

  it('renders action buttons', () => {
    const actions = [
      { id: 'delete', label: 'Delete', onClick: vi.fn() },
      { id: 'export', label: 'Export', onClick: vi.fn() },
    ];

    render(
      <BulkSelectionToolbar selectedCount={5} onClear={vi.fn()} actions={actions} />
    );

    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('calls action onClick when action button is clicked', () => {
    const handleDelete = vi.fn();
    const actions = [
      { id: 'delete', label: 'Delete', onClick: handleDelete },
    ];

    render(
      <BulkSelectionToolbar selectedCount={5} onClear={vi.fn()} actions={actions} />
    );

    const deleteButton = screen.getByTestId('bulk-selection-toolbar-action-delete');
    fireEvent.click(deleteButton);

    expect(handleDelete).toHaveBeenCalled();
  });

  it('disables action buttons when disabled prop is true', () => {
    const actions = [
      { id: 'delete', label: 'Delete', onClick: vi.fn(), disabled: true },
    ];

    render(
      <BulkSelectionToolbar selectedCount={5} onClear={vi.fn()} actions={actions} />
    );

    const deleteButton = screen.getByTestId('bulk-selection-toolbar-action-delete');
    expect(deleteButton).toBeDisabled();
  });

  it('applies action variant classes', () => {
    const actions = [
      { id: 'delete', label: 'Delete', onClick: vi.fn(), variant: 'danger' as const },
      { id: 'export', label: 'Export', onClick: vi.fn(), variant: 'primary' as const },
    ];

    render(
      <BulkSelectionToolbar selectedCount={5} onClear={vi.fn()} actions={actions} />
    );

    const deleteButton = screen.getByTestId('bulk-selection-toolbar-action-delete');
    const exportButton = screen.getByTestId('bulk-selection-toolbar-action-export');

    expect(deleteButton).toHaveClass('bulk-selection-toolbar__action--danger');
    expect(exportButton).toHaveClass('bulk-selection-toolbar__action--primary');
  });

  it('applies custom className', () => {
    render(
      <BulkSelectionToolbar
        selectedCount={5}
        onClear={vi.fn()}
        className="custom-class"
      />
    );

    const toolbar = screen.getByTestId('bulk-selection-toolbar');
    expect(toolbar).toHaveClass('custom-class');
  });

  it('uses custom testId', () => {
    render(
      <BulkSelectionToolbar
        selectedCount={5}
        onClear={vi.fn()}
        testId="custom-toolbar"
      />
    );

    expect(screen.getByTestId('custom-toolbar')).toBeInTheDocument();
  });

  it('respects isVisible prop', () => {
    const { container } = render(
      <BulkSelectionToolbar
        selectedCount={5}
        onClear={vi.fn()}
        isVisible={false}
      />
    );

    expect(container.querySelector('[data-testid="bulk-selection-toolbar"]')).not.toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<BulkSelectionToolbar selectedCount={5} onClear={vi.fn()} />);

    const toolbar = screen.getByTestId('bulk-selection-toolbar');
    expect(toolbar).toHaveAttribute('role', 'toolbar');
    expect(toolbar).toHaveAttribute('aria-label', 'Bulk selection actions');
  });

  it('displays correct count text for single item', () => {
    render(<BulkSelectionToolbar selectedCount={1} onClear={vi.fn()} />);
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('handles empty actions array', () => {
    render(
      <BulkSelectionToolbar selectedCount={5} onClear={vi.fn()} actions={[]} />
    );

    const toolbar = screen.getByTestId('bulk-selection-toolbar');
    expect(toolbar).toBeInTheDocument();
    expect(screen.getByText('5 selected')).toBeInTheDocument();
  });
});
