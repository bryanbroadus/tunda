export type Plan = 'free' | 'starter' | 'business' | 'shop_plus'
export type Role = 'owner' | 'employee'
export type PaymentType = 'cash' | 'credit'
export type CashLogType = 'sale' | 'bank_deposit' | 'expense' | 'credit_payment'
export type ReminderSchedule = 'daily' | 'weekly' | 'monthly' | 'custom'

export interface Business {
  id: string
  name: string
  owner_id: string
  plan: Plan
  created_at: string
}

export interface Employee {
  id: string
  business_id: string
  user_id: string
  role: Role
  created_at: string
}

export interface Product {
  id: string
  business_id: string
  name: string
  category: string | null
  buy_price: number
  sell_price: number
  stock_qty: number
  low_stock_threshold: number
  is_active: boolean
  created_at: string
}

export interface Customer {
  id: string
  business_id: string
  name: string
  phone: string
  credit_limit: number
  credit_balance: number
  is_active: boolean
  created_at: string
}

export interface Sale {
  id: string
  business_id: string
  employee_id: string
  customer_id: string | null
  payment_type: PaymentType
  total_amount: number
  note: string | null
  created_at: string
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  qty: number
  unit_price: number
  unit_cost: number
}

export interface CreditPayment {
  id: string
  business_id: string
  customer_id: string
  amount: number
  note: string | null
  created_at: string
}

export interface CashLog {
  id: string
  business_id: string
  type: CashLogType
  amount: number
  note: string | null
  created_at: string
}

export interface ReminderConfig {
  id: string
  business_id: string
  is_enabled: boolean
  schedule: ReminderSchedule
  custom_cron: string | null
  message_template: string
  updated_at: string
}

export interface StockAdjustment {
  id: string
  business_id: string
  product_id: string
  qty_change: number
  reason: string | null
  created_at: string
}

// Plan limits
export const PLAN_LIMITS: Record<Plan, {
  products: number | null
  customers: number | null
  users: number
  sms: boolean
  smsMonthly: number
  fullAccounting: boolean
  mobileApp: boolean
  multiBranch: boolean
  priceUGX: number
}> = {
  free:      { products: 50,   customers: 10,   users: 1,  sms: false, smsMonthly: 0,   fullAccounting: false, mobileApp: false, multiBranch: false, priceUGX: 0 },
  starter:   { products: null, customers: 50,   users: 2,  sms: false, smsMonthly: 0,   fullAccounting: false, mobileApp: true,  multiBranch: false, priceUGX: 25000 },
  business:  { products: null, customers: null, users: 5,  sms: true,  smsMonthly: 50,  fullAccounting: true,  mobileApp: true,  multiBranch: false, priceUGX: 60000 },
  shop_plus: { products: null, customers: null, users: 10, sms: true,  smsMonthly: 200, fullAccounting: true,  mobileApp: true,  multiBranch: true,  priceUGX: 120000 },
}

export function formatUGX(amount: number): string {
  return `UGX ${amount.toLocaleString('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
