import { create } from 'zustand'
import type { AuthUser, Employee, Business, Product, Customer, BankAccount, QueuedSale } from './types'

interface AppState {
  // Auth
  user: AuthUser | null
  employee: Employee | null
  business: Business | null
  setAuth: (user: AuthUser | null, employee: Employee | null, business: Business | null) => void
  clearAuth: () => void

  // Network
  isOnline: boolean
  setOnline: (v: boolean) => void

  // Sync state
  lastSyncedAt: string | null
  isSyncing: boolean
  setLastSyncedAt: (v: string) => void
  setIsSyncing: (v: boolean) => void

  // Local data cache (in-memory layer over SQLite)
  products: Product[]
  customers: Customer[]
  bankAccounts: BankAccount[]
  setProducts: (p: Product[]) => void
  setCustomers: (c: Customer[]) => void
  setBankAccounts: (a: BankAccount[]) => void

  // Pending offline queue count
  pendingCount: number
  setPendingCount: (n: number) => void
}

export const useStore = create<AppState>((set) => ({
  user: null,
  employee: null,
  business: null,
  setAuth: (user, employee, business) => set({ user, employee, business }),
  clearAuth: () => set({ user: null, employee: null, business: null }),

  isOnline: true,
  setOnline: (isOnline) => set({ isOnline }),

  lastSyncedAt: null,
  isSyncing: false,
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setIsSyncing: (isSyncing) => set({ isSyncing }),

  products: [],
  customers: [],
  bankAccounts: [],
  setProducts: (products) => set({ products }),
  setCustomers: (customers) => set({ customers }),
  setBankAccounts: (bankAccounts) => set({ bankAccounts }),

  pendingCount: 0,
  setPendingCount: (pendingCount) => set({ pendingCount }),
}))
