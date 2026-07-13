import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 p-4">
      <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-100 w-full max-w-xs">
        <h1 className="text-6xl font-black text-slate-800 mb-2">404</h1>
        <p className="text-slate-500 font-medium mb-8">Halaman tidak ditemukan.</p>
        <Link href="/" className="block w-full py-4 bg-primary text-white rounded-xl font-bold shadow-sm active-elevate">
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}