import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExportCsvButton } from '../../../src/components/v1/ExportCsvButton';
import type { CsvColumn } from '../../../src/utils/v1/csv';

interface Row {
  label: string;
  value: number;
}

const columns: CsvColumn<Row>[] = [
  { header: 'Label', accessor: (r) => r.label },
  { header: 'Value', accessor: (r) => r.value },
];

const rows: Row[] = [
  { label: 'Alpha', value: 1 },
  { label: 'Beta', value: 2 },
];

// Stub URL.createObjectURL / revokeObjectURL for happy-dom environment.
let mockObjectUrl = 'blob:test';
let createObjectURLSpy: ReturnType<typeof vi.fn>;
let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
let appendChildSpy: ReturnType<typeof vi.spyOn>;
let removeChildSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  createObjectURLSpy = vi.fn(() => mockObjectUrl);
  revokeObjectURLSpy = vi.fn();

  URL.createObjectURL = createObjectURLSpy;
  URL.revokeObjectURL = revokeObjectURLSpy;

  appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
    const el = node as HTMLAnchorElement;
    if (el.tagName === 'A') {
      el.click = vi.fn();
    }
    return node;
  });
  removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ExportCsvButton', () => {
  it('renders with the default label', () => {
    render(<ExportCsvButton rows={rows} columns={columns} filename="test.csv" />);
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
  });

  it('renders a custom label when children are provided', () => {
    render(
      <ExportCsvButton rows={rows} columns={columns} filename="test.csv">
        Download Data
      </ExportCsvButton>,
    );
    expect(screen.getByRole('button', { name: /download data/i })).toBeInTheDocument();
  });

  it('is disabled when rows is empty', () => {
    render(<ExportCsvButton rows={[]} columns={columns} filename="empty.csv" />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('is disabled when the disabled prop is explicitly set', () => {
    render(<ExportCsvButton rows={rows} columns={columns} filename="test.csv" disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('triggers a download when clicked with non-empty rows', () => {
    render(
      <ExportCsvButton
        rows={rows}
        columns={columns}
        filename="report.csv"
        testId="csv-btn"
      />,
    );
    fireEvent.click(screen.getByTestId('csv-btn'));

    expect(createObjectURLSpy).toHaveBeenCalledOnce();
    expect(appendChildSpy).toHaveBeenCalled();
  });

  it('calls onExportSuccess after a successful download', () => {
    const onSuccess = vi.fn();
    render(
      <ExportCsvButton
        rows={rows}
        columns={columns}
        filename="report.csv"
        onExportSuccess={onSuccess}
        testId="csv-btn"
      />,
    );
    fireEvent.click(screen.getByTestId('csv-btn'));
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('calls onUnsupportedBrowser when createObjectURL is unavailable', () => {
    // @ts-expect-error intentional override
    URL.createObjectURL = undefined;

    const onUnsupported = vi.fn();
    render(
      <ExportCsvButton
        rows={rows}
        columns={columns}
        filename="report.csv"
        onUnsupportedBrowser={onUnsupported}
        testId="csv-btn"
      />,
    );
    fireEvent.click(screen.getByTestId('csv-btn'));
    expect(onUnsupported).toHaveBeenCalledOnce();
  });

  it('does not initiate download when rows is empty', () => {
    render(
      <ExportCsvButton rows={[]} columns={columns} filename="empty.csv" testId="csv-btn" />,
    );
    // The button is disabled so a real click would do nothing; verify directly
    // via the disabled attribute to avoid triggering pointer events on a disabled button.
    expect(screen.getByTestId('csv-btn')).toBeDisabled();
    expect(createObjectURLSpy).not.toHaveBeenCalled();
  });

  it('applies extra className to the button', () => {
    render(
      <ExportCsvButton
        rows={rows}
        columns={columns}
        filename="test.csv"
        className="custom-class"
        testId="csv-btn"
      />,
    );
    expect(screen.getByTestId('csv-btn').className).toContain('custom-class');
  });
});
