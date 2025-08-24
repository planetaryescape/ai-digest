"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Edit,
  MoreHorizontal,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { KnownSender } from "@/types/sender";

interface ExtendedSender extends KnownSender {
  classification?: "ai" | "non-ai";
}

interface SenderTableProps {
  filter?: "all" | "ai" | "non-ai";
}

export function SenderTable({ filter = "all" }: SenderTableProps) {
  const queryClient = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState({});

  const {
    data: senders = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["senders", filter],
    queryFn: async () => {
      const res = await fetch(`/api/senders?filter=${filter}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));

        if (errorData.details) {
          throw new Error(errorData.details);
        }
        if (errorData.error) {
          throw new Error(errorData.error);
        }
        throw new Error(`Failed to fetch senders (${res.status})`);
      }
      return res.json() as Promise<ExtendedSender[]>;
    },
    retry: 1,
    retryDelay: 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (emails: string[]) => {
      const res = await fetch("/api/senders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      if (!res.ok) {
        throw new Error("Failed to delete senders");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["senders"] });
      toast.success("Senders deleted successfully");
      setRowSelection({});
    },
    onError: () => {
      toast.error("Failed to delete senders");
    },
  });

  const handleDeleteSender = useCallback(
    (email: string) => {
      deleteMutation.mutate([email]);
    },
    [deleteMutation]
  );

  const handleDeleteSelected = useCallback(
    (emails: string[]) => {
      deleteMutation.mutate(emails);
    },
    [deleteMutation]
  );

  const columns = useMemo<ColumnDef<ExtendedSender>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "senderEmail",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              Email
              {column.getIsSorted() === "asc" ? (
                <ChevronUp className="ml-2 h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ChevronDown className="ml-2 h-4 w-4" />
              ) : null}
            </Button>
          );
        },
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.senderEmail}</div>
            {row.original.senderName && (
              <div className="text-sm text-muted-foreground">{row.original.senderName}</div>
            )}
          </div>
        ),
      },
      {
        accessorKey: "newsletterName",
        header: "Newsletter",
        cell: ({ getValue }) => getValue() || "-",
      },
      {
        accessorKey: "classification",
        header: "Type",
        cell: ({ row }) => {
          const classification = row.original.classification;
          if (!classification) return "-";

          return (
            <Badge variant={classification === "ai" ? "default" : "secondary"}>
              {classification === "ai" ? "AI" : "Non-AI"}
            </Badge>
          );
        },
      },
      {
        accessorKey: "confidence",
        header: "Confidence",
        cell: ({ getValue }) => {
          const confidence = getValue() as number;
          return (
            <div className="flex items-center">
              <div className="w-20 bg-secondary rounded-full h-2">
                <div
                  className={cn(
                    "h-2 rounded-full",
                    confidence >= 90
                      ? "bg-green-500"
                      : confidence >= 70
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  )}
                  style={{ width: `${confidence}%` }}
                />
              </div>
              <span className="ml-2 text-sm">{confidence}%</span>
            </div>
          );
        },
      },
      {
        accessorKey: "emailCount",
        header: "Emails",
      },
      {
        accessorKey: "lastSeen",
        header: "Last Seen",
        cell: ({ getValue }) => {
          const date = new Date(getValue() as string);
          return date.toLocaleDateString();
        },
      },
      {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => {
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {}}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDeleteSender(row.original.senderEmail)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [handleDeleteSender]
  );

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
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-muted-foreground">Loading senders...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="text-destructive font-semibold">Error loading senders</div>
          <div className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Unknown error occurred"}
          </div>
          <Button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["senders"] })}
            variant="outline"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Table Controls */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search senders..."
              className="pl-10 max-w-sm"
            />
          </div>
          {selectedRows.length > 0 && (
            <Button
              onClick={() => {
                const emails = selectedRows.map((row) => row.original.senderEmail);
                handleDeleteSelected(emails);
              }}
              variant="destructive"
              size="sm"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete {selectedRows.length} selected
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between p-4">
        <div className="text-sm text-muted-foreground">
          Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}{" "}
          to{" "}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
            table.getFilteredRowModel().rows.length
          )}{" "}
          of {table.getFilteredRowModel().rows.length} results
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
