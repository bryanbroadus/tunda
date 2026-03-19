'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { formatUGX } from '@/lib/types'

interface Props {
  data: { label: string; collected: number }[]
}

export default function DashboardChart({ data }: Props) {
  const hasData = data.some(d => d.collected > 0)
  if (!hasData) return null

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-sm font-medium text-slate-700 mb-4">Cash Collected — Last 30 Days</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            interval={4}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip formatter={(v) => formatUGX(Number(v))} />
          <Bar dataKey="collected" fill="#059669" radius={[4, 4, 0, 0]} name="Cash Collected" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
