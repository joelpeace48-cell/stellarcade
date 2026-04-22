import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DataTable, type DataTableColumn } from '@/components/v1/DataTable';

type Row = { id: number; name: string; value: number };

const columns: DataTableColumn<Row>[] = [
  { key: 'id', header: 'ID', sortable: true },
  { key: 'name', header: 'Name', sortable: true },
  { key: 'value', header: 'Value', sortable: true },
];

const rows: Row[] = [
  { id: 1, name: 'A', value: 100 },
  { id: 2, name: 'B', value: 50 },
  { id: 3, name: 'C', value: 75 },
];

describe('DataTable', () => {
  it('shows loading state', () => {
    render(<DataTable columns={columns} data={rows} isLoading />);
    expect(screen.getByTestId('data-table-loading')).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByTestId('data-table-empty')).toHaveTextContent('No records found.');
  });

  it('sorts by column click and toggles direction', () => {
    render(<DataTable columns={columns} data={rows} />);

    const nameHeader = screen.getByTestId('data-table-header-name');
    fireEvent.click(nameHeader);
    expect(screen.getByTestId('data-table-row-0')).toHaveTextContent('A');

    fireEvent.click(nameHeader);
    expect(screen.getByTestId('data-table-row-0')).toHaveTextContent('C');
  });

  it('paginates data and allows page size change', () => {
    render(<DataTable columns={columns} data={rows} pageSize={2} />);

    expect(screen.getByTestId('data-table-row-0')).toHaveTextContent('A');
    expect(screen.getByTestId('data-table-row-1')).toHaveTextContent('B');
    expect(screen.queryByTestId('data-table-row-2')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('data-table-next'));
    expect(screen.getByTestId('data-table-row-0')).toHaveTextContent('C');

    fireEvent.change(screen.getByTestId('data-table-page-size'), { target: { value: '5' } });
    expect(screen.getByTestId('data-table-page-info')).toHaveTextContent('Page 1 of 1');
  });

  it('applies compact density classes without breaking table rendering', () => {
    render(<DataTable columns={columns} data={rows} density="compact" />);

    expect(screen.getByTestId('data-table')).toHaveClass('data-table--compact');
    expect(screen.getByTestId('data-table')).toHaveAttribute('data-density', 'compact');
    expect(screen.getByTestId('data-table-row-0')).toHaveTextContent('A');
  });
});
