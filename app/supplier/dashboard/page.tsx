"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuthStore } from "@/lib/auth-store"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  TrendingUp,
  Package,
  AlertTriangle,
  Star,
  DollarSign,
  ShoppingCart,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  CheckCircle,
  Clock,
  Users,
  TrendingDown,
  Download,
  Printer,
  Bell,
  RotateCcw,
  Filter,
  Keyboard,
  Eye,
  EyeOff,
  Calendar,
  MessageSquare,
  RefreshCw,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// Helper function to export data to CSV
const exportToCSV = (data: any[], filename: string) => {
  if (!data.length) {
    alert("No data to export")
    return
  }

  const headers = Object.keys(data[0]).join(",")
  const rows = data.map((row) => Object.values(row).join(","))
  const csv = [headers, ...rows].join("\n")

  const blob = new Blob([csv], { type: "text/csv" })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`
  a.click()
  window.URL.revokeObjectURL(url)
}

export default function SupplierDashboard() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const printRef = useRef<HTMLDivElement>(null)

  // State for live data
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [selectedTab, setSelectedTab] = useState("overview")

  // Date filter state
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0])

  // Visibility toggles for widgets
  const [visibleWidgets, setVisibleWidgets] = useState({
    income: true,
    orders: true,
    products: true,
    lowStock: true,
    ratings: true,
    customers: true,
    alerts: true,
    topProducts: true,
    inventory: true,
    performance: true,
  })

  // Category filter
  const [selectedCategory, setSelectedCategory] = useState("all")

  // Fetch live stats from backend
  const fetchStats = async () => {
    if (!user?.ishyigaAccount) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        account: user.ishyigaAccount,
        startDate,
        endDate,
      })

      const res = await fetch(`/api/supplier/stats?${params.toString()}`)
      const json = await res.json()

      if (json.ok) {
        setStats(json)
      } else {
        console.error("Failed to fetch stats:", json.error)
      }
    } catch (error) {
      console.error("Error fetching stats:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "supplier") {
      router.push("/login")
      return
    }

    fetchStats()
  }, [isAuthenticated, user, router, startDate, endDate])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        switch (e.key) {
          case "1":
            setSelectedTab("overview")
            e.preventDefault()
            break
          case "2":
            setSelectedTab("products")
            e.preventDefault()
            break
          case "3":
            setSelectedTab("inventory")
            e.preventDefault()
            break
          case "4":
            setSelectedTab("ratings")
            e.preventDefault()
            break
          case "5":
            setSelectedTab("summary")
            e.preventDefault()
            break
          case "p":
            handlePrint()
            e.preventDefault()
            break
          case "e":
            exportCurrentTabData()
            e.preventDefault()
            break
        }
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [selectedTab, stats])

  const handlePrint = () => {
    window.print()
  }

  const exportCurrentTabData = () => {
    if (!stats) return

    switch (selectedTab) {
      case "overview":
        exportToCSV(stats.incomeData || [], "income_data")
        exportToCSV(stats.ordersData || [], "orders_data")
        break
      case "products":
        exportToCSV(stats.topProducts || [], "top_products")
        break
      case "inventory":
        exportToCSV(stats.inventoryByCategory || [], "inventory")
        break
      case "ratings":
        exportToCSV(stats.ratingsDistribution || [], "ratings")
        break
      default:
        alert("No data to export for this tab")
    }
  }

  const toggleWidget = (widget: keyof typeof visibleWidgets) => {
    setVisibleWidgets((prev) => ({ ...prev, [widget]: !prev[widget] }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg font-semibold text-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-lg font-semibold text-foreground">Failed to load dashboard data</p>
          <Button onClick={fetchStats} className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const { stats: dashboardStats, incomeData, ordersData, topProducts, inventoryByCategory, ratingsDistribution, recentActivity, performanceComparison } = stats

  // Metric Card Component
  const MetricCard = ({ icon: Icon, label, value, trend, unit = "", visible }: any) => {
    if (!visible) return null

    return (
      <Card className="bg-card hover:shadow-lg transition-shadow print:shadow-none">
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{label}</p>
              <p className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2 break-words">
                {unit}
                {typeof value === "number" ? value.toLocaleString() : value}
              </p>
              {trend !== undefined && (
                <p
                  className={`text-xs mt-1 sm:mt-2 flex items-center gap-1 ${trend >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {trend >= 0 ? (
                    <TrendingUp className="w-3 h-3 flex-shrink-0" />
                  ) : (
                    <TrendingDown className="w-3 h-3 flex-shrink-0" />
                  )}
                  {Math.abs(trend)}% vs last period
                </p>
              )}
            </div>
            <div className="bg-primary/10 p-2 sm:p-3 rounded-lg flex-shrink-0">
              <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const AlertCard = ({ alert }: any) => {
    const AlertIcon = alert.icon
    const bgColor =
      alert.type === "warning"
        ? "bg-orange-50 dark:bg-orange-950/20"
        : alert.type === "success"
          ? "bg-green-50 dark:bg-green-950/20"
          : "bg-blue-50 dark:bg-blue-950/20"
    const borderColor =
      alert.type === "warning"
        ? "border-orange-200 dark:border-orange-800"
        : alert.type === "success"
          ? "border-green-200 dark:border-green-800"
          : "border-blue-200 dark:border-blue-800"
    const iconColor =
      alert.type === "warning"
        ? "text-orange-600 dark:text-orange-400"
        : alert.type === "success"
          ? "text-green-600 dark:text-green-400"
          : "text-blue-600 dark:text-blue-400"

    return (
      <div className={`flex items-start gap-3 p-3 sm:p-4 rounded-lg border ${bgColor} ${borderColor}`}>
        <AlertIcon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColor}`} />
        <p className="text-xs sm:text-sm text-foreground flex-1">{alert.message}</p>
      </div>
    )
  }

  const ProductRow = ({ product }: any) => (
    <div className="flex items-center justify-between py-3 px-3 sm:px-4 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm font-medium text-foreground truncate">{product.name}</p>
        <p className="text-xs text-muted-foreground mt-1">{product.sales} sales</p>
      </div>
      <div className="text-right flex-shrink-0 ml-2">
        <p className="text-xs sm:text-sm font-bold text-foreground">${product.revenue.toLocaleString()}</p>
        {product.trend !== undefined && (
          <p
            className={`text-xs mt-1 flex items-center justify-end gap-1 ${product.trend >= 0 ? "text-green-600" : "text-red-600"}`}
          >
            {product.trend >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(product.trend)}%
          </p>
        )}
      </div>
    </div>
  )

  // Quick stats bar (always visible)
  const QuickStatsBar = () => (
    <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg mb-6 flex flex-wrap items-center justify-between gap-4 print:bg-white print:text-black print:border">
      <div className="flex items-center gap-2">
        <DollarSign className="w-4 h-4" />
        <span className="text-sm font-semibold">Today: ${dashboardStats.todayRevenue || 0}</span>
      </div>
      <div className="flex items-center gap-2">
        <ShoppingCart className="w-4 h-4" />
        <span className="text-sm font-semibold">Pending: {dashboardStats.pendingOrders || 0}</span>
      </div>
      <div className="flex items-center gap-2">
        <Bell className="w-4 h-4" />
        <span className="text-sm font-semibold">New Reviews: {dashboardStats.newReviews || 0}</span>
      </div>
      <div className="flex items-center gap-2">
        <RotateCcw className="w-4 h-4" />
        <span className="text-sm font-semibold">Returns: {dashboardStats.pendingReturns || 0}</span>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8" ref={printRef}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8 print:mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground print:text-2xl">
                Supplier Dashboard
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
                Welcome back, {user?.firstName || user?.email}! Here's your business overview.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 print:hidden">
              <Button variant="outline" size="sm" onClick={handlePrint} title="Print Dashboard (Ctrl+P)">
                <Printer className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={exportCurrentTabData} title="Export Data (Ctrl+E)">
                <Download className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={fetchStats} title="Refresh">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <QuickStatsBar />

        {/* Date Range Filter */}
        <div className="bg-card border rounded-lg p-4 sm:p-6 mb-6 sm:mb-8 print:hidden">
          <h2 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filter by Date Range
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col">
              <label className="text-xs sm:text-sm font-medium text-foreground mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs sm:text-sm font-medium text-foreground mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs sm:text-sm font-medium text-foreground mb-2">Quick Select</label>
              <select
                onChange={(e) => {
                  const end = new Date()
                  const start = new Date()
                  if (e.target.value === "7days") {
                    start.setDate(end.getDate() - 7)
                  } else if (e.target.value === "30days") {
                    start.setDate(end.getDate() - 30)
                  } else if (e.target.value === "90days") {
                    start.setDate(end.getDate() - 90)
                  }
                  setStartDate(start.toISOString().split("T")[0])
                  setEndDate(end.toISOString().split("T")[0])
                }}
                className="px-3 py-2 border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select Range</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs sm:text-sm font-medium text-foreground mb-2">Category Filter</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Categories</option>
                <option value="electronics">Electronics</option>
                <option value="clothing">Clothing</option>
                <option value="books">Books</option>
                <option value="home">Home & Garden</option>
              </select>
            </div>
          </div>
        </div>

        {/* Widget Customization */}
        <div className="bg-card border rounded-lg p-4 mb-6 print:hidden">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Customize Dashboard
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.keys(visibleWidgets).map((widget) => (
              <Button
                key={widget}
                size="sm"
                variant={visibleWidgets[widget as keyof typeof visibleWidgets] ? "default" : "outline"}
                onClick={() => toggleWidget(widget as keyof typeof visibleWidgets)}
              >
                {visibleWidgets[widget as keyof typeof visibleWidgets] ? <Eye className="w-3 h-3 mr-1" /> : <EyeOff className="w-3 h-3 mr-1" />}
                {widget.charAt(0).toUpperCase() + widget.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <MetricCard
            icon={DollarSign}
            label="Total Income"
            value={dashboardStats.totalIncome}
            unit="$"
            trend={performanceComparison?.totalIncome?.growth}
            visible={visibleWidgets.income}
          />
          <MetricCard
            icon={ShoppingCart}
            label="Total Orders"
            value={dashboardStats.totalOrders}
            trend={performanceComparison?.totalOrders?.growth}
            visible={visibleWidgets.orders}
          />
          <MetricCard
            icon={Package}
            label="Total Products"
            value={dashboardStats.totalProducts}
            visible={visibleWidgets.products}
          />
          <MetricCard
            icon={AlertTriangle}
            label="Low Stock Items"
            value={dashboardStats.lowStockItems}
            visible={visibleWidgets.lowStock}
          />
          <MetricCard
            icon={Package}
            label="Items In Stock"
            value={dashboardStats.inStockItems}
            visible={visibleWidgets.inStockItems}
          />
          <MetricCard
            icon={Star}
            label="Avg Rating"
            value={dashboardStats.avgRating}
            trend={performanceComparison?.avgRating?.growth}
            visible={visibleWidgets.ratings}
          />
        </div>

        {/* Keyboard Shortcuts Info */}
        <div className="bg-muted/50 border rounded-lg p-3 mb-6 text-xs text-muted-foreground print:hidden">
          <div className="flex items-center gap-2 mb-2">
            <Keyboard className="w-4 h-4" />
            <span className="font-semibold">Keyboard Shortcuts:</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <span>Ctrl+1: Overview</span>
            <span>Ctrl+2: Products</span>
            <span>Ctrl+3: Inventory</span>
            <span>Ctrl+4: Ratings</span>
            <span>Ctrl+5: Summary</span>
            <span>Ctrl+P: Print</span>
            <span>Ctrl+E: Export</span>
          </div>
        </div>

        {/* Recent Activity Feed */}
        {recentActivity && recentActivity.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentActivity.slice(0, 5).map((activity: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-3 p-2 border-b last:border-0">
                    <div className="bg-primary/10 p-2 rounded">
                      <MessageSquare className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-foreground">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs for Detailed Charts */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 mb-4 sm:mb-6 print:hidden">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">
              Income & Orders
            </TabsTrigger>
            <TabsTrigger value="products" className="text-xs sm:text-sm">
              Top Products
            </TabsTrigger>
            <TabsTrigger value="inventory" className="text-xs sm:text-sm">
              Inventory
            </TabsTrigger>
            <TabsTrigger value="ratings" className="text-xs sm:text-sm">
              Ratings
            </TabsTrigger>
            <TabsTrigger value="summary" className="text-xs sm:text-sm">
              Summary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Income Chart */}
              {incomeData && incomeData.length > 0 ? (
                <Card className="border-2 shadow-lg print:shadow-none">
                  <CardHeader className="pb-3 sm:pb-6 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 rounded-t-lg print:bg-white">
                    <CardTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white print:text-black">
                      Income Trend
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                      Income data for selected date range
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <ChartContainer
                      config={{
                        income: {
                          label: "Income",
                          color: "#06b6d4",
                        },
                      }}
                      className="h-60 sm:h-80"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={incomeData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.9} />
                              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.1} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                          <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12, fill: "#64748b" }} />
                          <YAxis stroke="#94a3b8" tick={{ fontSize: 12, fill: "#64748b" }} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Area
                            type="monotone"
                            dataKey="income"
                            stroke="#06b6d4"
                            fill="url(#incomeGradient)"
                            strokeWidth={3}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No income data available for selected period
                  </CardContent>
                </Card>
              )}

              {/* Orders Chart */}
              {ordersData && ordersData.length > 0 ? (
                <Card className="border-2 shadow-lg print:shadow-none">
                  <CardHeader className="pb-3 sm:pb-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-slate-900 dark:to-slate-800 rounded-t-lg print:bg-white">
                    <CardTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white print:text-black">
                      Order Volume
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                      Orders for selected date range
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <ChartContainer
                      config={{
                        orders: {
                          label: "Orders",
                          color: "#a855f7",
                        },
                      }}
                      className="h-60 sm:h-80"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={ordersData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                          <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12, fill: "#64748b" }} />
                          <YAxis stroke="#94a3b8" tick={{ fontSize: 12, fill: "#64748b" }} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line
                            type="monotone"
                            dataKey="orders"
                            stroke="#a855f7"
                            strokeWidth={3}
                            dot={{ fill: "#a855f7", r: 5 }}
                            activeDot={{ r: 7, fill: "#d946ef" }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No orders data available for selected period
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="products" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Top Products */}
              {topProducts && topProducts.length > 0 ? (
                <Card className="border-2 shadow-lg print:shadow-none">
                  <CardHeader className="pb-3 sm:pb-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-slate-900 dark:to-slate-800 rounded-t-lg print:bg-white">
                    <CardTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white print:text-black">
                      Top Selling Products
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                      By revenue and sales volume
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="divide-y">
                      {topProducts.map((product: any, idx: number) => (
                        <ProductRow key={idx} product={product} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No product data available
                  </CardContent>
                </Card>
              )}

              {/* Performance Comparison */}
              {performanceComparison && (
                <Card className="border-2 shadow-lg print:shadow-none">
                  <CardHeader className="pb-3 sm:pb-6 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-slate-900 dark:to-slate-800 rounded-t-lg print:bg-white">
                    <CardTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white print:text-black">
                      Performance vs Last Period
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                      Period-over-period comparison
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4 sm:pt-6">
                    <div className="space-y-4">
                      {Object.entries(performanceComparison).map(([key, data]: [string, any]) => (
                        <div key={key} className="pb-4 border-b last:border-0">
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-xs sm:text-sm font-medium text-foreground capitalize">
                              {key.replace(/([A-Z])/g, " $1").trim()}
                            </p>
                            <span
                              className={`text-xs font-bold px-2 py-1 rounded ${data.growth >= 0 ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200"}`}
                            >
                              {data.growth >= 0 ? "+" : ""}
                              {data.growth.toFixed(2)}%
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              Current:{" "}
                              <span className="font-bold text-foreground">{data.current.toLocaleString()}</span>
                            </span>
                            <span className="text-muted-foreground">
                              Previous:{" "}
                              <span className="font-bold text-foreground">{data.previous.toLocaleString()}</span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4 sm:space-y-6">
            {inventoryByCategory && inventoryByCategory.length > 0 ? (
              <Card className="border-2 shadow-lg print:shadow-none">
                <CardHeader className="pb-3 sm:pb-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-slate-900 dark:to-slate-800 rounded-t-lg print:bg-white">
                  <CardTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white print:text-black">
                    Inventory Status by Category
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                    In stock vs low stock items across categories
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <ChartContainer
                    config={{
                      inStock: {
                        label: "In Stock",
                        color: "#10b981",
                      },
                      lowStock: {
                        label: "Low Stock",
                        color: "#f97316",
                      },
                    }}
                    className="h-60 sm:h-80"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={inventoryByCategory} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="category" stroke="#94a3b8" tick={{ fontSize: 12, fill: "#64748b" }} />
                        <YAxis stroke="#94a3b8" tick={{ fontSize: 12, fill: "#64748b" }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                        <Bar dataKey="inStock" fill="#10b981" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="lowStock" fill="#f97316" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No inventory data available
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="ratings" className="space-y-4 sm:space-y-6">
            {ratingsDistribution && ratingsDistribution.length > 0 ? (
              <Card className="border-2 shadow-lg print:shadow-none">
                <CardHeader className="pb-3 sm:pb-6 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 rounded-t-lg print:bg-white">
                  <CardTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white print:text-black">
                    Customer Ratings Distribution
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                    Breakdown of customer ratings
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 flex justify-center">
                  <ChartContainer
                    config={{
                      value: {
                        label: "Count",
                      },
                    }}
                    className="h-60 sm:h-80 w-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Pie
                          data={ratingsDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ rating, value }: any) => `${rating}: ${value}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {ratingsDistribution.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No ratings data available
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="summary" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Weekly/Monthly Totals */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Period Totals</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-sm text-foreground">This Week</span>
                    <span className="font-bold text-primary">${dashboardStats.weeklyRevenue || 0}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-sm text-foreground">This Month</span>
                    <span className="font-bold text-primary">${dashboardStats.monthlyRevenue || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-foreground">This Year</span>
                    <span className="font-bold text-primary">${dashboardStats.yearlyRevenue || 0}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Outstanding Payments */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Payments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-sm text-foreground">Outstanding</span>
                    <span className="font-bold text-orange-600">${dashboardStats.outstandingPayments || 0}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-sm text-foreground">Refunds Issued</span>
                    <span className="font-bold text-red-600">${dashboardStats.totalRefunds || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-foreground">Net Revenue</span>
                    <span className="font-bold text-green-600">
                      ${(dashboardStats.totalIncome - (dashboardStats.totalRefunds || 0)).toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Customer Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Customer Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-sm text-foreground">Avg Order Value</span>
                    <span className="font-bold text-primary">${dashboardStats.avgOrderValue || 0}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-sm text-foreground">Repeat Rate</span>
                    <span className="font-bold text-primary">{dashboardStats.repeatCustomerRate || 0}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-foreground">Avg Order Size</span>
                    <span className="font-bold text-primary">{dashboardStats.avgOrderSize || 0} items</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card className="print:hidden">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Button asChild className="w-full">
                  <Link href="/supplier/products/add">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Product
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="w-full">
                  <Link href="/supplier/orders">
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    View Orders
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="w-full">
                  <Link href="/supplier/products">
                    <Package className="w-4 h-4 mr-2" />
                    Manage Products
                  </Link>
                </Button>
                <Button variant="secondary" onClick={exportCurrentTabData} className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Download Reports
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:bg-white {
            background-color: white !important;
          }
          .print\\:text-black {
            color: black !important;
          }
          .print\\:border {
            border: 1px solid #e2e8f0 !important;
          }
          .print\\:mb-4 {
            margin-bottom: 1rem !important;
          }
        }
      `}</style>
    </div>
  )
}
