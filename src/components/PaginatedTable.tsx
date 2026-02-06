import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type PaginationState,
  type VisibilityState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { useState, useRef, useEffect } from "react";
import styles from "./PaginatedTable.module.css";

interface PaginatedTableProps<T> {
  data: T[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[];
  initialPageSize?: number;
}

export function PaginatedTable<T>({
  data,
  columns,
  initialPageSize = 25,
}: PaginatedTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const columnSelectorRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target as Node)) {
        setShowColumnSelector(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination, columnVisibility, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const pageCount = table.getPageCount();
  const currentPage = pagination.pageIndex + 1;

  const visibleCount = table.getVisibleLeafColumns().length;
  const totalCount = table.getAllLeafColumns().length;
  const filteredRowCount = table.getFilteredRowModel().rows.length;
  const hasActiveFilters = columnFilters.length > 0 || globalFilter !== "";

  const clearAllFilters = () => {
    setColumnFilters([]);
    setGlobalFilter("");
  };

  return (
    <div className={styles.tableWrapper}>
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Search all columns..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className={styles.searchInput}
          />
          {globalFilter && (
            <button
              className={styles.clearButton}
              onClick={() => setGlobalFilter("")}
            >
              ×
            </button>
          )}
        </div>

        <button
          className={`${styles.filterToggle} ${showFilters ? styles.active : ""}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filters {hasActiveFilters && `(${columnFilters.length})`}
        </button>

        {hasActiveFilters && (
          <button className={styles.clearFiltersButton} onClick={clearAllFilters}>
            Clear All
          </button>
        )}

        <div className={styles.columnSelector} ref={columnSelectorRef}>
          <button
            className={styles.columnSelectorButton}
            onClick={() => setShowColumnSelector(!showColumnSelector)}
          >
            Columns ({visibleCount}/{totalCount})
          </button>
          {showColumnSelector && (
            <div className={styles.columnSelectorDropdown}>
              <div className={styles.columnSelectorHeader}>
                <label className={styles.columnCheckbox}>
                  <input
                    type="checkbox"
                    checked={table.getIsAllColumnsVisible()}
                    onChange={table.getToggleAllColumnsVisibilityHandler()}
                  />
                  <span>Toggle All</span>
                </label>
              </div>
              <div className={styles.columnSelectorList}>
                {table.getAllLeafColumns().map((column) => (
                  <label key={column.id} className={styles.columnCheckbox}>
                    <input
                      type="checkbox"
                      checked={column.getIsVisible()}
                      onChange={column.getToggleVisibilityHandler()}
                    />
                    <span>{String(column.columnDef.header ?? column.id)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={styles.th}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    {{
                      asc: " ▲",
                      desc: " ▼",
                    }[header.column.getIsSorted() as string] ?? ""}
                  </th>
                ))}
              </tr>
            ))}
            {showFilters && (
              <tr className={styles.filterRow}>
                {table.getHeaderGroups()[0]?.headers.map((header) => (
                  <th key={header.id} className={styles.filterCell}>
                    {header.column.getCanFilter() ? (
                      <input
                        type="text"
                        value={(header.column.getFilterValue() as string) ?? ""}
                        onChange={(e) => header.column.setFilterValue(e.target.value)}
                        placeholder={`Filter...`}
                        className={styles.filterInput}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : null}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={styles.td}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <div className={styles.pageInfo}>
          Showing {table.getRowModel().rows.length} of {filteredRowCount}
          {filteredRowCount !== data.length && ` (${data.length} total)`} rows
          {pageCount > 1 && ` · Page ${currentPage} of ${pageCount}`}
        </div>

        <div className={styles.pageControls}>
          <select
            value={pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className={styles.pageSizeSelect}
          >
            {[10, 25, 50, 100, 200].map((size) => (
              <option key={size} value={size}>
                {size} rows
              </option>
            ))}
          </select>

          <div className={styles.pageButtons}>
            <button
              onClick={() => table.firstPage()}
              disabled={!table.getCanPreviousPage()}
              className={styles.pageButton}
            >
              ««
            </button>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className={styles.pageButton}
            >
              «
            </button>
            <span className={styles.pageNumber}>
              {currentPage} / {pageCount}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className={styles.pageButton}
            >
              »
            </button>
            <button
              onClick={() => table.lastPage()}
              disabled={!table.getCanNextPage()}
              className={styles.pageButton}
            >
              »»
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
