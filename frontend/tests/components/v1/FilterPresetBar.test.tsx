import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { FilterPresetBar } from '@/components/v1/FilterPresetBar';

describe('FilterPresetBar', () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows empty state when no presets exist', () => {
    render(
      <FilterPresetBar
        scope="test-delete"
        currentFilters={{}}
        onApply={vi.fn()}
      />
    );
    expect(screen.getByTestId('filter-preset-bar-empty')).toBeTruthy();
    expect(screen.getByText('No saved presets yet.')).toBeTruthy();
  });

  it('save button is disabled when input is empty', () => {
    render(
      <FilterPresetBar
        scope="test"
        currentFilters={{}}
        onApply={vi.fn()}
      />
    );
    const saveBtn = screen.getByTestId('filter-preset-bar-save-btn');
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('saving a preset name adds it to the list', () => {
    render(
      <FilterPresetBar
        scope="test"
        currentFilters={{ status: 'active' }}
        onApply={vi.fn()}
      />
    );
    const input = screen.getByTestId('filter-preset-bar-name-input');
    fireEvent.change(input, { target: { value: 'My Preset' } });

    const saveBtn = screen.getByTestId('filter-preset-bar-save-btn');
    expect((saveBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(saveBtn);

    expect(screen.getByTestId('filter-preset-bar-list')).toBeTruthy();
    expect(screen.getByText('My Preset')).toBeTruthy();
  });

  it('applying a preset calls onApply with the correct preset', () => {
    const onApply = vi.fn();
    render(
      <FilterPresetBar
        scope="test"
        currentFilters={{ status: 'active' }}
        onApply={onApply}
      />
    );
    const input = screen.getByTestId('filter-preset-bar-name-input');
    fireEvent.change(input, { target: { value: 'Active Filter' } });
    fireEvent.click(screen.getByTestId('filter-preset-bar-save-btn'));

    fireEvent.click(
      screen.getByRole('button', { name: 'Active Filter' }),
    );

    expect(onApply).toHaveBeenCalledOnce();
    const calledWith = onApply.mock.calls[0][0];
    expect(calledWith.name).toBe('Active Filter');
    expect(calledWith.filters).toEqual({ status: 'active' });
  });

  it('deleting a preset removes it from the list', () => {
    const { container } = render(
      <FilterPresetBar
        scope="test-delete"
        currentFilters={{}}
        onApply={vi.fn()}
      />
    );
    const scoped = within(container);
    const root = scoped.getByTestId('filter-preset-bar');
    const input = scoped.getByTestId('filter-preset-bar-name-input');
    fireEvent.change(input, { target: { value: 'To Delete' } });
    fireEvent.click(scoped.getByTestId('filter-preset-bar-save-btn'));

    expect(scoped.getByText('To Delete')).toBeTruthy();

    fireEvent.click(scoped.getByLabelText('Delete preset To Delete'));

    expect(scoped.queryByText('To Delete')).toBeNull();
    expect(within(root).getByTestId('filter-preset-bar-empty')).toBeTruthy();
  });

  it('Enter key saves the preset', () => {
    render(
      <FilterPresetBar
        scope="test"
        currentFilters={{}}
        onApply={vi.fn()}
      />
    );
    const input = screen.getByTestId('filter-preset-bar-name-input');
    fireEvent.change(input, { target: { value: 'Enter Preset' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByTestId('filter-preset-bar-list')).toBeTruthy();
    expect(screen.getByText('Enter Preset')).toBeTruthy();
  });
});
