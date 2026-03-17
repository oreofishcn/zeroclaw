import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { ErrorBoundary } from '@/App';

export default function Layout() {
  const { pathname } = useLocation();

  return (
    <div className="theme-shell theme-layout h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-col">
        <Header />
        <main className="theme-main flex-1 min-h-0 overflow-y-auto">
          <ErrorBoundary key={pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
