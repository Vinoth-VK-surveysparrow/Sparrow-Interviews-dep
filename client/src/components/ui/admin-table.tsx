import React from 'react';
import { Table, Tbody, Td, Th, Thead, Tr } from "@sparrowengg/twigs-react";
import { Button } from "@sparrowengg/twigs-react";
import { RefreshCw, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import './admin-table.css';

export interface Column {
  key: string;
  label: string;
  width?: string;
  render?: (value: any, row: any) => React.ReactNode;
  sortable?: boolean;
  sortKey?: string;
}

export interface AdminTableProps {
  columns: Column[];
  data: any[];
  visibleColumns: string[];
  onToggleColumn: (columnKey: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  onRowClick?: (row: any, index: number) => void;
  rowClassName?: string;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
}

export function AdminTable({
  columns,
  data,
  visibleColumns,
  onToggleColumn,
  onRefresh,
  refreshing = false,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No data found.',
  className = '',
  onRowClick,
  rowClassName = '',
  sortColumn,
  sortDirection,
  onSort
}: AdminTableProps) {
  const visibleColumnObjects = columns.filter(col => visibleColumns.includes(col.key));

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onSearchChange && (
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-64"
            />
          )}
        </div>

        <div className="flex gap-2">
          {onRefresh && (
            <Button
              variant="solid"
              color="primary"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
              leftIcon={<RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="solid" color="primary" size="sm">
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48">
              {columns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={visibleColumns.includes(col.key)}
                  onCheckedChange={() => onToggleColumn(col.key)}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto">
        <Table border="horizontal" className="w-full min-w-fit">
          <Thead className="admin-table-header" style={{
            backgroundColor: 'hsl(var(--muted) / 0.5)',
            borderBottom: '1px solid hsl(var(--border))'
          }}>
            <Tr>
              {visibleColumnObjects.map((col) => (
                <Th
                  key={col.key}
                  style={{
                    width: col.width,
                    height: '48px',
                    padding: '16px',
                    textAlign: 'left',
                    verticalAlign: 'middle',
                    fontWeight: '500',
                    borderBottom: '1px solid hsl(var(--border))'
                  }}
                >
                  {col.sortable ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSort?.(col.sortKey || col.key)}
                      className="h-auto p-0 font-medium hover:bg-transparent justify-start text-foreground"
                    >
                      {col.label}
                      {sortColumn === (col.sortKey || col.key) ? (
                        sortDirection === 'asc' ? (
                          <ChevronUp className="ml-1 h-4 w-4" />
                        ) : (
                          <ChevronDown className="ml-1 h-4 w-4" />
                        )
                      ) : (
                        <ArrowUpDown className="ml-1 h-4 w-4 opacity-50" />
                      )}
                    </Button>
                  ) : (
                    col.label
                  )}
                </Th>
              ))}
            </Tr>
          </Thead>
          <Tbody>
            {data.length > 0 ? (
              data.map((row, index) => (
                <Tr
                  key={row.id || index}
                  style={{
                    borderBottom: '1px solid hsl(var(--border))',
                    transition: 'background-color 0.15s ease-in-out',
                    cursor: onRowClick ? 'pointer' : 'default'
                  }}
                  className={cn(
                    "hover:bg-muted/50",
                    rowClassName
                  )}
                  onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                >
                  {visibleColumnObjects.map((col) => (
                    <Td
                      key={col.key}
                      style={{
                        padding: '16px',
                        verticalAlign: 'middle',
                        color: 'hsl(var(--foreground))'
                      }}
                    >
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </Td>
                  ))}
                </Tr>
              ))
            ) : (
              <Tr style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                <Td
                  colSpan={visibleColumnObjects.length}
                  style={{
                    textAlign: 'center',
                    padding: '24px 16px',
                    verticalAlign: 'middle',
                    color: 'hsl(var(--foreground) / 0.7)'
                  }}
                >
                  {emptyMessage}
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </div>
    </div>
  );
}
