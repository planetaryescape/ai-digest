'use client'

import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  ColumnDef,
  flexRender,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { 
  ChevronUp, 
  ChevronDown, 
  Trash2, 
  Edit,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import type { KnownSender } from '@/types/sender'
import { cn } from '@/lib/utils'

export function SenderTable() {
  const queryClient = useQueryClient()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [rowSelection, setRowSelection] = useState({})

  const { data: senders = [], isLoading, error } = useQuery({
    queryKey: ['senders'],
    queryFn: async () => {
      const res = await fetch('/api/senders')
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        console.error('Failed to fetch senders:', errorData)
        
        if (errorData.details) {
          throw new Error(errorData.details)
        } else if (errorData.error) {
          throw new Error(errorData.error)
        } else {
          throw new Error(`Failed to fetch senders (${res.status})`)
        }
      }
      return res.json() as Promise<KnownSender[]>
    },
    retry: 1,
    retryDelay: 1000,
  })

  const deleteMutation = useMutation({
    mutationFn: async (emails: string[]) => {
      const res = await fetch('/api/senders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      })
      if (!res.ok) throw new Error('Failed to delete senders')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['senders'] })
      toast.success('Senders deleted successfully')
      setRowSelection({})
    },
    onError: () => {
      toast.error('Failed to delete senders')
    },
  })

  const columns = useMemo<ColumnDef<KnownSender>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={(e) => row.toggleSelected(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded"
          />
        ),
      },
      {
        accessorKey: 'senderEmail',
        header: 'Email',
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.senderEmail}</div>
            {row.original.senderName && (
              <div className="text-sm text-gray-500">{row.original.senderName}</div>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'newsletterName',
        header: 'Newsletter',
        cell: ({ getValue }) => getValue() || '-',
      },
      {
        accessorKey: 'confidence',
        header: 'Confidence',
        cell: ({ getValue }) => {
          const confidence = getValue() as number
          return (
            <div className="flex items-center">
              <div className="w-20 bg-gray-200 rounded-full h-2">
                <div
                  className={cn(
                    "h-2 rounded-full",
                    confidence >= 90 ? "bg-green-500" :
                    confidence >= 70 ? "bg-yellow-500" :
                    "bg-red-500"
                  )}
                  style={{ width: `${confidence}%` }}
                />
              </div>
              <span className="ml-2 text-sm">{confidence}%</span>
            </div>
          )
        },
      },
      {
        accessorKey: 'emailCount',
        header: 'Emails',
      },
      {
        accessorKey: 'lastSeen',
        header: 'Last Seen',
        cell: ({ getValue }) => {
          const date = new Date(getValue() as string)
          return date.toLocaleDateString()
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex space-x-2">
            <button
              onClick={() => console.log('Edit', row.original)}
              className="p-1 text-gray-600 hover:text-gray-900"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={() => deleteMutation.mutate([row.original.senderEmail])}
              className="p-1 text-red-600 hover:text-red-900"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [deleteMutation]
  )

  const table = useReactTable({
    data: senders,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const selectedRows = table.getFilteredSelectedRowModel().rows

  if (isLoading) {
    return <div className="p-8 text-center">Loading senders...</div>
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-600 font-semibold">Error loading senders</div>
        <div className="text-sm text-gray-600 mt-2">
          {error instanceof Error ? error.message : 'Unknown error occurred'}
        </div>
        <button 
          onClick={() => queryClient.invalidateQueries({ queryKey: ['senders'] })}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Table Controls */}
      <div className="p-4 border-b">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder="Search senders..."
                className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {selectedRows.length > 0 && (
              <button
                onClick={() => {
                  const emails = selectedRows.map(row => row.original.senderEmail)
                  deleteMutation.mutate(emails)
                }}
                className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete {selectedRows.length} selected
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={cn(
                          "flex items-center space-x-1",
                          header.column.getCanSort() && "cursor-pointer select-none"
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <span>
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                        </span>
                        {header.column.getIsSorted() && (
                          <span>
                            {header.column.getIsSorted() === 'desc' ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronUp className="h-4 w-4" />
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-4 py-3 border-t">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )}{' '}
            of {table.getFilteredRowModel().rows.length} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1 border rounded-lg disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1 border rounded-lg disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}