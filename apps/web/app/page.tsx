import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-white px-4">
      <div className="text-center max-w-2xl">
        <div className="mb-6 inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl shadow-lg">
          <span className="text-white text-2xl font-bold">T</span>
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Tunda</h1>
        <p className="text-xl text-slate-600 mb-8">
          Stock management, point-of-sale, credit tracking &amp; accounting for small businesses in Uganda.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/signup"
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
          >
            Get Started Free
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
          >
            Sign In
          </Link>
        </div>
        <p className="mt-6 text-sm text-slate-500">All prices in UGX · Free plan available</p>
      </div>
    </main>
  )
}
