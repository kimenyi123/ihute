"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { useLanguageStore, type Language } from "@/lib/language-store"
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

const EXPENSES_UI: Record<Language, {
  categories: Record<string, string>;
  fillRequired: string;
  addedSuccess: string;
  noExport: string;
  loadingExpenses: string;
  businessExpenses: string;
  trackExpenses: string;
  exportCsv: string;
  refresh: string;
  addExpense: string;
  addNewExpense: string;
  recordExpense: string;
  amountLabel: string;
  categoryLabel: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  expenseDateLabel: string;
  cancel: string;
  adding: string;
  totalExpenses: string;
  numberOfExpenses: string;
  averageExpense: string;
  topCategory: string;
  filters: string;
  startDate: string;
  endDate: string;
  allCategories: string;
  retry: string;
  expenseHistory: string;
  thDate: string;
  thCategory: string;
  thDescription: string;
  thAmount: string;
  total: string;
  noExpensesFound: string;
  tryAdjusting: string;
  getStarted: string;
}> = {
  en: {
    categories: { Inventory: "Inventory", Marketing: "Marketing", Shipping: "Shipping", Utilities: "Utilities", Rent: "Rent", Salaries: "Salaries", Equipment: "Equipment", Supplies: "Supplies", Other: "Other" },
    fillRequired: "Please fill in all required fields",
    addedSuccess: "Expense added successfully!",
    noExport: "No expenses to export",
    loadingExpenses: "Loading expenses...",
    businessExpenses: "Business Expenses",
    trackExpenses: "Track and manage your business expenses",
    exportCsv: "Export CSV",
    refresh: "Refresh",
    addExpense: "Add Expense",
    addNewExpense: "Add New Expense",
    recordExpense: "Record a new business expense. All fields are required.",
    amountLabel: "Amount (RWF) *",
    categoryLabel: "Category *",
    descriptionLabel: "Description *",
    descriptionPlaceholder: "What was this expense for?",
    expenseDateLabel: "Expense Date *",
    cancel: "Cancel",
    adding: "Adding...",
    totalExpenses: "Total Expenses",
    numberOfExpenses: "Number of Expenses",
    averageExpense: "Average Expense",
    topCategory: "Top Category",
    filters: "Filters",
    startDate: "Start Date",
    endDate: "End Date",
    allCategories: "All Categories",
    retry: "Retry",
    expenseHistory: "Expense History",
    thDate: "Date",
    thCategory: "Category",
    thDescription: "Description",
    thAmount: "Amount",
    total: "Total:",
    noExpensesFound: "No expenses found",
    tryAdjusting: "Try adjusting your filters",
    getStarted: "Get started by adding your first expense",
  },
  rw: {
    categories: { Inventory: "Ibikoresho", Marketing: "Kwamamaza", Shipping: "Kohereza", Utilities: "Serivisi", Rent: "Ubukode", Salaries: "Imishahara", Equipment: "Ibikoresho by'akazi", Supplies: "Ibikenewe", Other: "Ibindi" },
    fillRequired: "Uzuza imyanya yose ikenewe",
    addedSuccess: "Ibyakoreshejwe byongerewe neza!",
    noExport: "Nta byakoreshejwe byo kohereza hanze",
    loadingExpenses: "Birimo gutangira ibyakoreshejwe...",
    businessExpenses: "Ibyakoreshejwe mu bucuruzi",
    trackExpenses: "Kurikirana no gucunga ibyakoreshejwe mu bucuruzi bwawe",
    exportCsv: "Kohereza hanze CSV",
    refresh: "Kura amakuru",
    addExpense: "Ongeraho ibyakoreshejwe",
    addNewExpense: "Ongeraho ibyakoreshejwe bishya",
    recordExpense: "Andika ibyakoreshejwe bishya mu bucuruzi. Imyanya yose irakenewe.",
    amountLabel: "Amafaranga (RWF) *",
    categoryLabel: "Ubwoko *",
    descriptionLabel: "Ibisobanuro *",
    descriptionPlaceholder: "Aya mafaranga yakoreshejwe iki?",
    expenseDateLabel: "Itariki y'ibyakoreshejwe *",
    cancel: "Hagarika",
    adding: "Birimo kongerwa...",
    totalExpenses: "Igiteranyo cy'ibyakoreshejwe",
    numberOfExpenses: "Umubare w'ibyakoreshejwe",
    averageExpense: "Ibyakoreshejwe biri hagati",
    topCategory: "Ubwoko bw'ibanze",
    filters: "Uburyo bwo gushakisha",
    startDate: "Itariki y'itangira",
    endDate: "Itariki y'iherezo",
    allCategories: "Ubwoko bwose",
    retry: "Ongera ugerageze",
    expenseHistory: "Amateka y'ibyakoreshejwe",
    thDate: "Itariki",
    thCategory: "Ubwoko",
    thDescription: "Ibisobanuro",
    thAmount: "Amafaranga",
    total: "Igiteranyo:",
    noExpensesFound: "Nta byakoreshejwe byabonetse",
    tryAdjusting: "Gerageza guhindura uburyo bwo gushakisha",
    getStarted: "Tangira wongeraho ibyakoreshejwe byawe bya mbere",
  },
  fr: {
    categories: { Inventory: "Inventaire", Marketing: "Marketing", Shipping: "Livraison", Utilities: "Services publics", Rent: "Loyer", Salaries: "Salaires", Equipment: "Équipement", Supplies: "Fournitures", Other: "Autre" },
    fillRequired: "Veuillez remplir tous les champs obligatoires",
    addedSuccess: "Dépense ajoutée avec succès !",
    noExport: "Aucune dépense à exporter",
    loadingExpenses: "Chargement des dépenses...",
    businessExpenses: "Dépenses professionnelles",
    trackExpenses: "Suivez et gérez vos dépenses professionnelles",
    exportCsv: "Exporter CSV",
    refresh: "Actualiser",
    addExpense: "Ajouter une dépense",
    addNewExpense: "Ajouter une nouvelle dépense",
    recordExpense: "Enregistrez une nouvelle dépense professionnelle. Tous les champs sont obligatoires.",
    amountLabel: "Montant (RWF) *",
    categoryLabel: "Catégorie *",
    descriptionLabel: "Description *",
    descriptionPlaceholder: "À quoi était destinée cette dépense ?",
    expenseDateLabel: "Date de la dépense *",
    cancel: "Annuler",
    adding: "Ajout en cours...",
    totalExpenses: "Total des dépenses",
    numberOfExpenses: "Nombre de dépenses",
    averageExpense: "Dépense moyenne",
    topCategory: "Catégorie principale",
    filters: "Filtres",
    startDate: "Date de début",
    endDate: "Date de fin",
    allCategories: "Toutes les catégories",
    retry: "Réessayer",
    expenseHistory: "Historique des dépenses",
    thDate: "Date",
    thCategory: "Catégorie",
    thDescription: "Description",
    thAmount: "Montant",
    total: "Total :",
    noExpensesFound: "Aucune dépense trouvée",
    tryAdjusting: "Essayez d'ajuster vos filtres",
    getStarted: "Commencez par ajouter votre première dépense",
  },
}

export default function ExpensesPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const language = useLanguageStore((s) => s.language)
  const ui = EXPENSES_UI[language] ?? EXPENSES_UI.en

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
      alert(ui.fillRequired)
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
        alert(ui.addedSuccess)
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
      alert(ui.noExport)
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
          <p className="text-lg font-semibold text-foreground">{ui.loadingExpenses}</p>
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
              {ui.businessExpenses}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {ui.trackExpenses}
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              {ui.exportCsv}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchExpenses}>
              <RefreshCw className="w-4 h-4 mr-2" />
              {ui.refresh}
            </Button>

            {/* Add Expense Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  {ui.addExpense}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{ui.addNewExpense}</DialogTitle>
                  <DialogDescription>
                    {ui.recordExpense}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="amount">{ui.amountLabel}</Label>
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
                    <Label htmlFor="category">{ui.categoryLabel}</Label>
                    <select
                      id="category"
                      value={newExpense.category}
                      onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                      className="px-3 py-2 border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {ui.categories[cat] ?? cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">{ui.descriptionLabel}</Label>
                    <Textarea
                      id="description"
                      placeholder={ui.descriptionPlaceholder}
                      value={newExpense.description}
                      onChange={(e) =>
                        setNewExpense({ ...newExpense, description: e.target.value })
                      }
                      rows={3}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="expenseDate">{ui.expenseDateLabel}</Label>
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
                    {ui.cancel}
                  </Button>
                  <Button onClick={handleAddExpense} disabled={submitting}>
                    {submitting ? ui.adding : ui.addExpense}
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
                  <p className="text-sm text-muted-foreground">{ui.totalExpenses}</p>
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
                  <p className="text-sm text-muted-foreground">{ui.numberOfExpenses}</p>
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
                  <p className="text-sm text-muted-foreground">{ui.averageExpense}</p>
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
                  <p className="text-sm text-muted-foreground">{ui.topCategory}</p>
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
              {ui.filters}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col">
                <label className="text-sm font-medium mb-2">{ui.startDate}</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-sm font-medium mb-2">{ui.endDate}</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-sm font-medium mb-2">{ui.thCategory}</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">{ui.allCategories}</option>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {ui.categories[cat] ?? cat}
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
                {ui.retry}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Expenses List */}
        {expenses.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>{ui.expenseHistory}</CardTitle>
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
                      <th className="text-left p-3 text-sm font-semibold">{ui.thDate}</th>
                      <th className="text-left p-3 text-sm font-semibold">{ui.thCategory}</th>
                      <th className="text-left p-3 text-sm font-semibold">{ui.thDescription}</th>
                      <th className="text-right p-3 text-sm font-semibold">{ui.thAmount}</th>
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
                          <Badge variant="secondary">{ui.categories[expense.category] ?? expense.category}</Badge>
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
                        {ui.total}
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
              <h3 className="text-lg font-semibold mb-2">{ui.noExpensesFound}</h3>
              <p className="text-muted-foreground mb-6">
                {categoryFilter !== "all"
                  ? ui.tryAdjusting
                  : ui.getStarted}
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {ui.addExpense}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
