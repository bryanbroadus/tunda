// ============================================================
// Tunda — Shared TypeScript types
// ============================================================

export type Plan = 'free' | 'starter' | 'business' | 'shop_plus'
export type Role = 'owner' | 'manager' | 'waiter' | 'employee'
export type InvoiceStatus = 'draft' | 'open' | 'partial' | 'paid' | 'overdue' | 'void'
export type BillStatus = 'draft' | 'open' | 'partial' | 'paid'
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
export type BankAccountType = 'cash_drawer' | 'cash' | 'checking' | 'savings' | 'mobile_money'
export type PaymentMethod = 'cash' | 'credit' | 'mobile_money' | 'bank'

// ─── Core ────────────────────────────────────────────────
export interface Business {
  id: string
  name: string
  owner_id: string
  plan: Plan
  next_invoice_number: number
  next_bill_number: number
  receipt_template: number
  invoice_template: number
  business_phone: string | null
  business_address: string | null
  receipt_header: string | null
  receipt_footer: string | null
  created_at: string
}

export interface Employee {
  id: string
  business_id: string
  user_id: string
  role: Role
  created_at: string
}

// ─── Inventory ───────────────────────────────────────────
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

// ─── Customers ───────────────────────────────────────────
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

// ─── Vendors ─────────────────────────────────────────────
export interface Vendor {
  id: string
  business_id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  is_active: boolean
  created_at: string
}

// ─── Purchase Catalog ────────────────────────────────────
export interface PurchaseCatalogItem {
  id: string
  business_id: string
  name: string
  category: string | null
  unit: string | null
  default_cost: number
  is_active: boolean
  created_at: string
}

// ─── Purchase Bills ──────────────────────────────────────
export interface PurchaseBill {
  id: string
  business_id: string
  vendor_id: string | null
  bill_number: string
  status: BillStatus
  issue_date: string
  due_date: string | null
  total_amount: number
  amount_paid: number
  notes: string | null
  created_at: string
}

export interface PurchaseBillItem {
  id: string
  bill_id: string
  product_id: string | null
  purchase_item_id: string | null
  description: string | null
  qty: number
  unit_cost: number
  created_at: string
}

export interface PurchaseBillPayment {
  id: string
  bill_id: string
  business_id: string
  amount: number
  payment_date: string
  account_id: string | null
  note: string | null
  created_at: string
}

// ─── Invoices ────────────────────────────────────────────
export interface Invoice {
  id: string
  business_id: string
  employee_id: string | null
  customer_id: string | null
  invoice_number: string
  status: InvoiceStatus
  issue_date: string
  due_date: string | null
  total_amount: number
  amount_paid: number
  payment_method: PaymentMethod | null
  note: string | null
  created_at: string
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  product_id: string | null
  description: string | null
  qty: number
  unit_price: number
  unit_cost: number
  created_at: string
}

export interface InvoicePayment {
  id: string
  invoice_id: string
  business_id: string
  amount: number
  payment_date: string
  payment_method: PaymentMethod | null
  account_id: string | null
  note: string | null
  created_at: string
}

// ─── Banking ─────────────────────────────────────────────
export interface BankAccount {
  id: string
  business_id: string
  name: string
  account_type: BankAccountType
  provider: string | null
  institution: string | null
  opening_balance: number
  current_balance: number
  is_active: boolean
  created_at: string
}

export interface BankTransaction {
  id: string
  bank_account_id: string
  business_id: string
  type: 'deposit' | 'withdrawal' | 'transfer'
  amount: number
  description: string | null
  reference: string | null
  transaction_date: string
  created_at: string
}

// ─── Chart of Accounts ───────────────────────────────────
export interface Account {
  id: string
  business_id: string
  code: string
  name: string
  type: AccountType
  is_system: boolean
  created_at: string
}

// ─── Support ─────────────────────────────────────────────
export interface ReminderConfig {
  id: string
  business_id: string
  is_enabled: boolean
  schedule: 'daily' | 'weekly' | 'monthly' | 'custom'
  custom_cron: string | null
  message_template: string
  updated_at: string
}

// ─── Plan Limits ─────────────────────────────────────────
export const PLAN_LIMITS: Record<Plan, {
  products: number | null
  customers: number | null
  users: number
  sms: boolean
  smsMonthly: number
  priceUGX: number
}> = {
  free:      { products: 50,   customers: 10,   users: 1,  sms: false, smsMonthly: 0,   priceUGX: 0 },
  starter:   { products: null, customers: 50,   users: 2,  sms: false, smsMonthly: 0,   priceUGX: 25000 },
  business:  { products: null, customers: null, users: 5,  sms: true,  smsMonthly: 50,  priceUGX: 60000 },
  shop_plus: { products: null, customers: null, users: 10, sms: true,  smsMonthly: 200, priceUGX: 120000 },
}

// ─── Helpers ─────────────────────────────────────────────
export function formatUGX(amount: number): string {
  return `UGX ${amount.toLocaleString('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function invoiceStatusLabel(status: InvoiceStatus): string {
  const map: Record<InvoiceStatus, string> = {
    draft: 'Draft', open: 'Unpaid', partial: 'Partial',
    paid: 'Paid', overdue: 'Overdue', void: 'Void',
  }
  return map[status]
}

export function billStatusLabel(status: BillStatus): string {
  const map: Record<BillStatus, string> = {
    draft: 'Draft', open: 'Unpaid', partial: 'Partial', paid: 'Paid',
  }
  return map[status]
}

export function statusColor(status: InvoiceStatus | BillStatus): string {
  const map: Record<string, string> = {
    paid:    'bg-emerald-100 text-emerald-700',
    partial: 'bg-amber-100 text-amber-700',
    open:    'bg-blue-100 text-blue-700',
    overdue: 'bg-red-100 text-red-700',
    draft:   'bg-slate-100 text-slate-500',
    void:    'bg-slate-100 text-slate-400',
  }
  return map[status] ?? 'bg-slate-100 text-slate-500'
}

export function accountTypeLabel(type: BankAccountType): string {
  const map: Record<BankAccountType, string> = {
    cash_drawer:  'Cash Drawer',
    cash:         'Cash',
    checking:     'Checking Account',
    savings:      'Savings Account',
    mobile_money: 'Mobile Money',
  }
  return map[type]
}

export function roleLabel(role: Role): string {
  const map: Record<Role, string> = {
    owner:    'Owner',
    manager:  'Manager',
    waiter:   'Waiter',
    employee: 'Employee',
  }
  return map[role]
}
