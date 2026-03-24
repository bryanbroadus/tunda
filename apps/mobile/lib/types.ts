// ============================================================
// Tunda Mobile — Shared Types
// ============================================================

export type Role = 'owner' | 'manager' | 'waiter' | 'employee'

export interface AuthUser {
  id: string
  email: string | undefined
}

export interface Employee {
  id: string
  business_id: string
  user_id: string
  role: Role
}

export interface Business {
  id: string
  name: string
  business_phone: string | null
  business_address: string | null
  receipt_template: number
  receipt_footer: string | null
}

export interface Product {
  id: string
  business_id: string
  name: string
  category: string | null
  sell_price: number
  buy_price: number
  stock_qty: number
  low_stock_threshold: number
  is_active: boolean
}

export interface Customer {
  id: string
  business_id: string
  name: string
  phone: string
  credit_balance: number
  is_active: boolean
}

export interface BankAccount {
  id: string
  name: string
  account_type: string
  current_balance: number
  is_active: boolean
}

export interface Invoice {
  id: string
  invoice_number: string
  customer_id: string | null
  status: 'draft' | 'open' | 'partial' | 'paid' | 'overdue' | 'void'
  issue_date: string
  due_date: string | null
  total_amount: number
  amount_paid: number
  payment_method: string | null
  note: string | null
  created_at: string
  customers?: { name: string; phone: string } | null
}

export interface CartItem {
  product: Product
  qty: number
}

export type PaymentType = 'cash' | 'credit'

// Offline queue entry
export interface QueuedSale {
  localId: string
  businessId: string
  employeeId: string
  items: CartItem[]
  total: number
  paymentType: PaymentType
  accountId: string | null
  customerId: string | null
  customerName: string | null
  saleDate: string
  note: string | null
  createdAt: string
  status: 'pending' | 'syncing' | 'synced' | 'failed'
}

export function formatUGX(amount: number): string {
  return `UGX ${amount.toLocaleString('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
