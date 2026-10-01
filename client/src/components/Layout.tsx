import { NavLink, Outlet } from 'react-router-dom';
const link = ({ isActive }: { isActive: boolean }) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-100'}`;
export default function Layout() {
  return (
    <div className="min-h-screen">
      <header className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          <span className="mr-4 flex items-center gap-2 font-bold"><b className="rounded-md bg-emerald-700 px-1.5 py-0.5 text-white">TN</b>Land Audit</span>
          <NavLink to="/" end className={link}>Dashboard</NavLink>
          <NavLink to="/new" className={link}>New audit</NavLink>
          <NavLink to="/sources" className={link}>Data sources</NavLink>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6"><Outlet /></main>
    </div>
  );
}
