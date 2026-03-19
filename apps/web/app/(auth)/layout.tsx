export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-white px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-600 rounded-xl shadow mb-3">
            <span className="text-white text-lg font-bold">T</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Tunda</h1>
        </div>
        {children}
      </div>
    </div>
  )
}
