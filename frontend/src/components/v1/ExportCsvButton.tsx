import React, { useState, useCallback } from 'react';
import type { CsvColumn } from '../../utils/v1/csv';
import { serializeToCsv, downloadCsv } from '../../utils/v1/csv';

export interface ExportCsvButtonProps<T> extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  /** Rows to export. When empty, the button is still rendered but download produces no output. */
  rows: T[];
  /** Column definitions providing header labels and value accessors. */
  columns: CsvColumn<T>[];
  /** Downloaded file name. Should end in `.csv`. */
  filename: string;
  /** Visible button label. Defaults to "Export CSV". */
  children?: React.ReactNode;
  /** Test ID for automated tests. */
  testId?: string;
  /** Called after a successful download is initiated. */
  onExportSuccess?: () => void;
  /** Called when the browser does not support blob downloads. */
  onUnsupportedBrowser?: () => void;
}

/**
 * ExportCsvButton — v1
 *
 * Renders a button that serializes a typed row collection to CSV and triggers
 * a browser file download. Handles:
 * - Empty datasets: download is skipped, `onExportSuccess` is not called.
 * - Unsupported browsers (no Blob/createObjectURL): renders a disabled state
 *   and invokes `onUnsupportedBrowser` so callers can show guidance.
 */
export function ExportCsvButton<T>({
  rows,
  columns,
  filename,
  children = 'Export CSV',
  testId = 'export-csv-button',
  onExportSuccess,
  onUnsupportedBrowser,
  className = '',
  disabled,
  ...rest
}: ExportCsvButtonProps<T>) {
  const [exporting, setExporting] = useState(false);

  const handleClick = useCallback(() => {
    if (rows.length === 0) return;

    setExporting(true);

    const content = serializeToCsv({ columns, rows });
    const supported = downloadCsv({ filename, content });

    setExporting(false);

    if (!supported) {
      onUnsupportedBrowser?.();
      return;
    }

    onExportSuccess?.();
  }, [rows, columns, filename, onExportSuccess, onUnsupportedBrowser]);

  const isEmpty = rows.length === 0;
  const isDisabled = disabled || isEmpty || exporting;

  return (
    <button
      type="button"
      className={`export-csv-button ${className}`.trim()}
      onClick={handleClick}
      disabled={isDisabled}
      aria-label={isEmpty ? 'No data to export' : `Export ${filename}`}
      aria-busy={exporting}
      data-testid={testId}
      {...rest}
    >
      {children}
    </button>
  );
}

export default ExportCsvButton;
