import { describe, it, expect } from 'vitest';
import { escapeCsvCell, serializeToCsv, downloadCsv } from '../../../src/utils/v1/csv';
import type { CsvColumn } from '../../../src/utils/v1/csv';

// ---------------------------------------------------------------------------
// escapeCsvCell
// ---------------------------------------------------------------------------

describe('escapeCsvCell', () => {
  it('returns empty string for null', () => {
    expect(escapeCsvCell(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escapeCsvCell(undefined)).toBe('');
  });

  it('passes through plain strings unchanged', () => {
    expect(escapeCsvCell('hello')).toBe('hello');
  });

  it('coerces numbers to string without quoting', () => {
    expect(escapeCsvCell(42)).toBe('42');
    expect(escapeCsvCell(3.14)).toBe('3.14');
  });

  it('coerces booleans to string without quoting', () => {
    expect(escapeCsvCell(true)).toBe('true');
    expect(escapeCsvCell(false)).toBe('false');
  });

  it('wraps strings containing commas in double-quotes', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
  });

  it('wraps strings containing double-quotes and doubles the inner quote', () => {
    expect(escapeCsvCell('say "hello"')).toBe('"say ""hello"""');
  });

  it('wraps strings containing newlines in double-quotes', () => {
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('wraps strings containing carriage-return in double-quotes', () => {
    expect(escapeCsvCell('line1\rline2')).toBe('"line1\rline2"');
  });

  it('handles the zero number correctly', () => {
    expect(escapeCsvCell(0)).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// serializeToCsv
// ---------------------------------------------------------------------------

interface Row {
  name: string;
  score: number;
  active: boolean;
}

const columns: CsvColumn<Row>[] = [
  { header: 'Name', accessor: (r) => r.name },
  { header: 'Score', accessor: (r) => r.score },
  { header: 'Active', accessor: (r) => r.active },
];

describe('serializeToCsv', () => {
  it('returns empty string for an empty rows array', () => {
    expect(serializeToCsv({ columns, rows: [] })).toBe('');
  });

  it('produces a header row followed by data rows', () => {
    const rows: Row[] = [{ name: 'Alice', score: 100, active: true }];
    const result = serializeToCsv({ columns, rows });
    expect(result).toBe('Name,Score,Active\r\nAlice,100,true');
  });

  it('produces multiple data rows separated by CRLF', () => {
    const rows: Row[] = [
      { name: 'Alice', score: 100, active: true },
      { name: 'Bob', score: 80, active: false },
    ];
    const result = serializeToCsv({ columns, rows });
    const lines = result.split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('Name,Score,Active');
    expect(lines[1]).toBe('Alice,100,true');
    expect(lines[2]).toBe('Bob,80,false');
  });

  it('escapes cells with commas in values', () => {
    const rows: Row[] = [{ name: 'Smith, John', score: 90, active: true }];
    const result = serializeToCsv({ columns, rows });
    expect(result).toContain('"Smith, John"');
  });

  it('escapes cells with double-quotes in values', () => {
    const rows: Row[] = [{ name: 'The "Pro"', score: 50, active: false }];
    const result = serializeToCsv({ columns, rows });
    expect(result).toContain('"The ""Pro"""');
  });

  it('renders null/undefined accessors as empty cells', () => {
    const nullCols: CsvColumn<Record<string, unknown>>[] = [
      { header: 'A', accessor: () => null },
      { header: 'B', accessor: () => undefined },
    ];
    const result = serializeToCsv({ columns: nullCols, rows: [{}] });
    expect(result).toBe('A,B\r\n,');
  });

  it('produces stable column ordering matching the columns array', () => {
    const reversedCols: CsvColumn<Row>[] = [
      { header: 'Active', accessor: (r) => r.active },
      { header: 'Score', accessor: (r) => r.score },
      { header: 'Name', accessor: (r) => r.name },
    ];
    const rows: Row[] = [{ name: 'Alice', score: 99, active: true }];
    const [header] = serializeToCsv({ columns: reversedCols, rows }).split('\r\n');
    expect(header).toBe('Active,Score,Name');
  });
});

// ---------------------------------------------------------------------------
// downloadCsv
// ---------------------------------------------------------------------------

describe('downloadCsv', () => {
  it('returns false when Blob is not available', () => {
    const originalBlob = global.Blob;
    // @ts-expect-error intentional removal for test
    delete global.Blob;

    const result = downloadCsv({ filename: 'test.csv', content: 'a,b' });
    expect(result).toBe(false);

    global.Blob = originalBlob;
  });

  it('returns false when URL.createObjectURL is not a function', () => {
    const originalCreate = URL.createObjectURL;
    // @ts-expect-error intentional override for test
    URL.createObjectURL = undefined;

    const result = downloadCsv({ filename: 'test.csv', content: 'a,b' });
    expect(result).toBe(false);

    URL.createObjectURL = originalCreate;
  });

  it('returns true and triggers a download anchor click when supported', () => {
    const clicks: string[] = [];

    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    URL.createObjectURL = () => 'blob:test-url';
    URL.revokeObjectURL = () => {};

    const originalAppendChild = document.body.appendChild.bind(document.body);
    const originalRemoveChild = document.body.removeChild.bind(document.body);

    document.body.appendChild = (node: Node) => {
      const el = node as HTMLAnchorElement;
      if (el.tagName === 'A') {
        clicks.push(el.download);
        el.click = () => {};
      }
      return originalAppendChild(node);
    };
    document.body.removeChild = (node: Node) => originalRemoveChild(node);

    const result = downloadCsv({ filename: 'export.csv', content: 'Name\r\nAlice' });
    expect(result).toBe(true);
    expect(clicks).toContain('export.csv');

    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    document.body.appendChild = originalAppendChild;
    document.body.removeChild = originalRemoveChild;
  });
});
