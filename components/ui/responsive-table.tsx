"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ResponsiveTableProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  minWidth?: string
}

const ResponsiveTable = React.forwardRef<HTMLDivElement, ResponsiveTableProps>(
  ({ className, children, minWidth = "600px", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0",
          "scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent",
          className
        )}
        {...props}
      >
        <div style={{ minWidth }}>
          {children}
        </div>
      </div>
    )
  }
)
ResponsiveTable.displayName = "ResponsiveTable"

interface DataTableProps extends React.HTMLAttributes<HTMLTableElement> {
  children: React.ReactNode
}

const DataTable = React.forwardRef<HTMLTableElement, DataTableProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="rounded-md border overflow-hidden">
        <table
          ref={ref}
          className={cn("w-full text-sm caption-bottom", className)}
          {...props}
        >
          {children}
        </table>
      </div>
    )
  }
)
DataTable.displayName = "DataTable"

interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode
}

const TableHeader = React.forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ className, children, ...props }, ref) => (
    <thead
      ref={ref}
      className={cn("bg-muted/50 border-b", className)}
      {...props}
    >
      {children}
    </thead>
  )
)
TableHeader.displayName = "TableHeader"

interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode
}

const TableBody = React.forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ className, children, ...props }, ref) => (
    <tbody
      ref={ref}
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    >
      {children}
    </tbody>
  )
)
TableBody.displayName = "TableBody"

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: React.ReactNode
}

const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, children, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  )
)
TableRow.displayName = "TableRow"

interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode
}

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, children, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    >
      {children}
    </th>
  )
)
TableHead.displayName = "TableHead"

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode
}

const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, children, ...props }, ref) => (
    <td
      ref={ref}
      className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
      {...props}
    >
      {children}
    </td>
  )
)
TableCell.displayName = "TableCell"

export {
  ResponsiveTable,
  DataTable,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
}
