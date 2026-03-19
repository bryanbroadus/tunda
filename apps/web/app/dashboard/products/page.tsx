import { redirect } from 'next/navigation'

export default function OldProductsPage() {
  redirect('/dashboard/sales/products')
}
