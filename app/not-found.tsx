import Link from 'next/link';
import { PackageSearch, ArrowLeft, ScanBarcode } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-teal-50 to-blue-50 flex items-center justify-center p-6">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/60 bg-white/75 backdrop-blur-xl shadow-[0_30px_80px_-30px_rgba(15,23,42,0.35)]">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />

        <div className="relative z-10 p-8 md:p-12 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-teal-500 to-blue-600 shadow-lg shadow-blue-500/30">
            <PackageSearch className="h-10 w-10 text-white" />
          </div>

          <p className="mb-3 text-sm font-bold uppercase tracking-[0.35em] text-teal-700">Farhad Medicos</p>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900">Page not found</h1>
          <p className="mx-auto mt-4 max-w-lg text-base md:text-lg text-slate-600">
            The page you&apos;re looking for doesn&apos;t exist or may have been moved.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-blue-500/30 transition-transform hover:-translate-y-0.5"
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Dashboard
            </Link>

            <div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-base font-semibold text-slate-700 shadow-sm">
              <ScanBarcode className="h-5 w-5 text-teal-600" />
              Search inventory from home
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}