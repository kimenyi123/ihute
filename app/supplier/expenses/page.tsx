"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DollarSign,
  Plus,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type Expense = {
  id: string
  amount: number
  description: string
  category: string
  expenseDate: string
  createdAt: string
}

const EXPENSE_CATEGORIES = [
  "Inventory",
  "Marketing",
  "Shipping",
  "Utilities",
  "Rent",
  "Salaries",
  "Equipment",
  "Supplies",
  "Other",
]

export default function ExpensesPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0])
  const [categoryFilter, setCategoryFilter] = useState("all")

  // Add expense dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [newExpense, setNewExpense] = useState({
    amount: "",
    description: "",
    category: "Other",
    expenseDate: new Date().toISOString().split("T")[0],
  })

  // Fetch expenses
  const fetchExpenses = async () => {
    if (!user?.ishyigaAccount) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        account: user.ishyigaAccount,
        startDate,
        endDate,
      })

      if (categoryFilter !== "all") params.set("category", categoryFilter)

      const res = await fetch(`/api/supplier/expenses/list?${params.toString()}`)
      const json = await res.json()

      if (json.ok) {
        setExpenses(json.expenses || [])
      } else {
        setError(json.error || "Failed to fetch expenses")
      }
    } catch (e: any) {
      setError(e?.message || "Failed to fetch expenses")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "supplier") {
      router.push("/login")
      return
    }

    fetchExpenses()
  }, [isAuthenticated, user, router, startDate, endDate, categoryFilter])

  // Add new expense
  const handleAddExpense = async () => {
    if (!user?.ishyigaAccount || !newExpense.amount || !newExpense.description) {
      alert("Please fill in all required fields")
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch("/api/supplier/expenses/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account: user.ishyigaAccount,
          ...newExpense,
          amount: parseFloat(newExpense.amount),
        }),
      })

      const json = await res.json()

      if (json.ok) {
        alert("Expense added successfully!")
        setDialogOpen(false)
        setNewExpense({
          amount: "",
          description: "",
          category: "Other",
          expenseDate: new Date().toISOString().split("T")[0],
        })
        fetchExpenses()
      } else {
        alert(`Error: ${json.error || "Failed to add expense"}`)
      }
    } catch (e: any) {
      alert(`Error: ${e?.message || "Failed to add expense"}`)
    } finally {
      setSubmitting(false)
    }
  }

  // Export to CSV
  const exportToCSV = () => {
    if (!expenses.length) {
      alert("No expenses to export")
      return
    }

    const headers = "Date,Category,Description,Amount"
    const rows = expenses.map(
      (e) =>
        `${e.expenseDate},${e.category},"${e.description.replace(/"/g, '""')}",${e.amount}`
    )
    const csv = [headers, ...rows].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `expenses_${startDate}_to_${endDate}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Calculate totals
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const expensesByCategory = expenses.reduce(
    (acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount
      return acc
    },
    {} as Record<string, number>
  )

  if (loading && expenses.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg font-semibold text-foreground">Loading expenses...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
              <DollarSign className="w-8 h-8" />
              Business Expenses
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track and manage your business expenses
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={fetchExpenses}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>

            {/* Add Expense Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Expense
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Add New Expense</DialogTitle>
                  <DialogDescription>
                    Record a new business expense. All fields are required.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Amount (RWF) *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="5000"
                      value={newExpense.amount}
                      onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="category">Category *</Label>
                    <select
                      id="category"
                      value={newExpense.category}
                      onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                      className="px-3 py-2 border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      placeholder="What was this expense for?"
                      value={newExpense.description}
                      onChange={(e) =>
                        setNewExpense({ ...newExpense, description: e.target.value })
                      }
                      rows={3}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="expenseDate">Expense Date *</Label>
                    <Input
                      id="expenseDate"
                      type="date"
                      value={newExpense.expenseDate}
                      onChange={(e) =>
                        setNewExpense({ ...newExpense, expenseDate: e.target.value })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddExpense} disabled={submitting}>
                    {submitting ? "Adding..." : "Add Expense"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Expenses</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {totalExpenses.toLocaleString()} RWF
                  </p>
                </div>
                <div className="bg-red-100 dark:bg-red-900/20 p-3 rounded-lg">
                  <TrendingDown className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Number of Expenses</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{expenses.length}</p>
                </div>
                <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-lg">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Average Expense</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {expenses.length > 0
                      ? Math.round(totalExpenses / expenses.length).toLocaleString()
                      : 0}{" "}
                    RWF
                  </p>
                </div>
                <div className="bg-purple-100 dark:bg-purple-900/20 p-3 rounded-lg">
                  <DollarSign className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Top Category</p>
                  <p className="text-xl font-bold text-foreground mt-1">
                    {Object.keys(expensesByCategory).length > 0
                      ? Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1])[0][0]
                      : "N/A"}
                  </p>
                </div>
                <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col">
                <label className="text-sm font-medium mb-2">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-sm font-medium mb-2">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-sm font-medium mb-2">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Categories</option>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-6 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <p className="text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchExpenses} className="ml-auto">
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Expenses List */}
        {expenses.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Expense History</CardTitle>
              <CardDescription>
                {expenses.length} expenses from {new Date(startDate).toLocaleDateString()} to{" "}
                {new Date(endDate).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-sm font-semibold">Date</th>
                      <th className="text-left p-3 text-sm font-semibold">Category</th>
                      <th className="text-left p-3 text-sm font-semibold">Description</th>
                      <th className="text-right p-3 text-sm font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((expense) => (
                      <tr key={expense.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">
                              {new Date(expense.expenseDate).toLocaleDateString()}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary">{expense.category}</Badge>
                        </td>
                        <td className="p-3 text-sm">{expense.description}</td>
                        <td className="p-3 text-right font-semibold text-red-600">
                          -{expense.amount.toLocaleString()} RWF
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold">
                      <td colSpan={3} className="p-3 text-right">
                        Total:
                      </td>
                      <td className="p-3 text-right text-red-600">
                        -{totalExpenses.toLocaleString()} RWF
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <DollarSign className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No expenses found</h3>
              <p className="text-muted-foreground mb-6">
                {categoryFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Get started by adding your first expense"}
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Expense
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
