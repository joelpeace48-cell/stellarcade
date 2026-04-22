import React, { useMemo, useState } from 'react';
import type { SortDirection } from '@/types/pagination';
import type { TableDensityPreference } from '@/services/global-state-store';
import './DataTable.css';

export type DataTableColumn<T> = {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  width?: string;
  render?: (row: T) => React.ReactNode;
  sortAccessor?: (row: T) => string | number;
};

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  pageSize?: number;
  isLoading?: boolean;
  emptyMessage?: string;
  density?: TableDensityPreference;
  className?: string;
  testId?: string;
  onSortChange?: (field: string, direction: SortDirection) => void;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  initialSortField?: string;
  initialSortDirection?: SortDirection;
}

function toggleDirection(current: SortDirection): SortDirection {
  return current === 'asc' ? 'desc' : 'asc';
}

export function DataTable<T extends object>({
  columns,
  data,
  pageSize = 10,
  isLoading = false,
  emptyMessage = 'No records found.',
  density = 'standard',
  className = '',
  testId = 'data-table',
  onSortChange,
  onPageChange,
  onPageSizeChange,
  initialSortField,
  initialSortDirection = 'asc',
}: DataTableProps<T>): JSX.Element {
  const [sortField, setSortField] = useState<string | undefined>(initialSortField);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialSortDirection);
  const [page, setPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);

  const sortedData = useMemo(() => {
    if (!sortField) return data;

    const col = columns.find((c) => c.key === sortField);
    if (!col) return data;

    return [...data].sort((a, b) => {
      const aValue = col.sortAccessor
        ? col.sortAccessor(a)
        : (a as Record<string, unknown>)[sortField];
      const bValue = col.sortAccessor
        ? col.sortAccessor(b)
        : (b as Record<string, unknown>)[sortField];

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return -1;
      if (bValue == null) return 1;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aStr = String(aValue).localeCompare(String(bValue), undefined, {
        numeric: true,
        sensitivity: 'base',
      });

      return sortDirection === 'asc' ? aStr : -aStr;
    });
  }, [data, columns, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / currentPageSize));

  const pagedData = useMemo(() => {
    const start = (page - 1) * currentPageSize;
    return sortedData.slice(start, start + currentPageSize);
  }, [sortedData, page, currentPageSize]);

  const changeSort = (column: DataTableColumn<T>) => {
    if (!column.sortable) return;
    const field = String(column.key);
    const nextDirection = sortField === field ? toggleDirection(sortDirection) : 'asc';
    setSortField(field);
    setSortDirection(nextDirection);
    setPage(1);
    onSortChange?.(field, nextDirection);
  };

  const changePage = (nextPage: number) => {
    const p = Math.min(Math.max(1, nextPage), totalPages);
    setPage(p);
    onPageChange?.(p);
  };

  const changePageSize = (size: number) => {
    setCurrentPageSize(size);
    setPage(1);
    onPageSizeChange?.(size);
  };

  if (isLoading) {
    return <div className="data-table-loading" data-testid="data-table-loading">Loading table...</div>;
  }

  if (data.length === 0) {
    return <div className="data-table-empty" data-testid="data-table-empty">{emptyMessage}</div>;
  }

  return (
    <div
      className={['data-table', density === 'compact' ? 'data-table--compact' : '', className]
        .filter(Boolean)
        .join(' ')}
      data-testid={testId}
      data-density={density}
    >
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                style={column.width ? { width: column.width } : undefined}
                className={column.sortable ? 'sortable' : undefined}
                onClick={() => changeSort(column)}
                data-testid={`data-table-header-${String(column.key)}`}
              >
                {column.header}
                {column.sortable && sortField === String(column.key) && (
                  <span className="sort-indicator">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pagedData.map((row, rowIndex) => (
            <tr key={rowIndex} data-testid={`data-table-row-${rowIndex}`}>
              {columns.map((column) => (
                <td key={`${String(column.key)}-${rowIndex}`}>
                  {column.render
                    ? column.render(row)
                    : String((row as Record<string, unknown>)[String(column.key)] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="data-table-pagination">
        <div className="page-controls">
          <button onClick={() => changePage(page - 1)} disabled={page === 1} data-testid="data-table-prev">
            Prev
          </button>
          <span data-testid="data-table-page-info">
            Page {page} of {totalPages}
          </span>
          <button onClick={() => changePage(page + 1)} disabled={page === totalPages} data-testid="data-table-next">
            Next
          </button>
        </div>
        <div className="page-size">
          <label htmlFor="page-size-select">Rows per page:</label>
          <select
            id="page-size-select"
            value={currentPageSize}
            onChange={(e) => changePageSize(Number(e.target.value))}
            data-testid="data-table-page-size"
          >
            {[5, 10, 25, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
