import { create } from "zustand"

export interface Product {
  id: string
  name: string
  category: string
  price: number
  unit: string // "piece", "box", "carton", "crate", "kg", "liter"
  stock: number
  supplierId: string
  supplierName: string
  supplierLocation: string
  description?: string
  image?: string // Added image field for product images
  createdAt: string
}

interface ProductState {
  products: Product[]
  addProduct: (product: Omit<Product, "id" | "createdAt">) => void
  updateProduct: (id: string, updates: Partial<Product>) => void
  deleteProduct: (id: string) => void
  getProductsBySupplier: (supplierId: string) => Product[]
  getProductsByCategory: (category: string) => Product[]
  getProductsByLocation: (location: string) => Product[]
}

export const useProductStore = create<ProductState>()((set, get) => ({
  products: [],
  addProduct: (product) =>
    set((state) => ({
      products: [
        ...state.products,
        {
          ...product,
          id: Math.random().toString(36).substr(2, 9),
          createdAt: new Date().toISOString(),
        },
      ],
    })),
  updateProduct: (id, updates) =>
    set((state) => ({
      products: state.products.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  deleteProduct: (id) =>
    set((state) => ({
      products: state.products.filter((p) => p.id !== id),
    })),
  getProductsBySupplier: (supplierId) => {
    return get().products.filter((p) => p.supplierId === supplierId)
  },
  getProductsByCategory: (category) => {
    return get().products.filter((p) => p.category === category)
  },
  getProductsByLocation: (location) => {
    return get().products.filter((p) => p.supplierLocation === location)
  },
}))
