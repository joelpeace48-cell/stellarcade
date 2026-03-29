/**
 * CSV serialization helpers for typed row collections.
 *
 * Stable header order is guaranteed by the `columns` array passed by the
 * caller. All values are escaped per RFC 4180: fields containing a comma,
 * double-quote, or newline are wrapped in double-quotes; literal double-quotes
 * inside a field are doubled ("").
 *
 * @module utils/v1/csv
 */

export interface CsvColumn<T> {
  /** Column header label rendered in the first row. */
  header: string;
  /** Extract the cell value for a given row. Return undefined to render an empty cell. */
  accessor: (row: T) => string | number | boolean | null | undefined;
}

export interface SerializeCsvOptions<T> {
  columns: CsvColumn<T>[];
  rows: T[];
}

/**
 * Escape a single cell value according to RFC 4180.
 *
 * - Numbers and booleans are coerced to string without quoting.
 * - null / undefined becomes an empty string.
 * - Strings containing commas, double-quotes, or newlines are wrapped in
 *   double-quotes; any literal `"` inside is doubled to `""`.
 */
export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Serialize a typed row collection to a CSV string.
 *
 * Returns an empty string (no header row) when `rows` is empty, so callers
 * can detect the empty-dataset case without parsing output.
 */
export function serializeToCsv<T>(options: SerializeCsvOptions<T>): string {
  const { columns, rows } = options;

  if (rows.length === 0) return '';

  const header = columns.map((c) => escapeCsvCell(c.header)).join(',');
  const body = rows.map((row) =>
    columns.map((c) => escapeCsvCell(c.accessor(row))).join(','),
  );

  return [header, ...body].join('\r\n');
}

export interface DownloadCsvOptions {
  /** File name including the .csv extension. */
  filename: string;
  /** The serialized CSV string returned by `serializeToCsv`. */
  content: string;
}

/**
 * Trigger a browser download of a CSV string.
 *
 * Returns `false` when the browser does not support `Blob` + object URLs
 * (very old or sandboxed environments), allowing callers to degrade
 * gracefully. Returns `true` when the download was successfully initiated.
 */
export function downloadCsv(options: DownloadCsvOptions): boolean {
  const { filename, content } = options;

  if (typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return false;
  }

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Release the object URL after the browser has had a tick to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 100);

  return true;
}
