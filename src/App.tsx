/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { CheckoutModal } from './components/CheckoutModal';
import { CourseWorkspace } from './components/CourseWorkspace';
import { CustomPageView } from './components/CustomPageView';
import { HomePage } from './components/HomePage';
import { StudentDashboard } from './components/StudentDashboard';
import { TopBar } from './components/TopBar';
import { WhatsAppButton } from './components/WhatsAppButton';
import { PlatformProvider, usePlatform } from './context/PlatformContext';

function AppShell() {
  const { loading, error, activeView, data, toastMessage, refreshBootstrap } = usePlatform();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          <p className="mt-4 text-sm font-medium text-slate-600">Loading ZAZA XPRAS Educational Platform...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="font-display text-xl font-bold text-slate-900">Unable to connect to server</h1>
          <p className="mt-2 text-sm text-slate-600">{error || 'Please refresh the page.'}</p>
          <button
            type="button"
            onClick={() => refreshBootstrap()}
            className="mt-5 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--brand-bg)' }}>
      <TopBar />

      {activeView === 'home' && <HomePage />}
      {activeView === 'course' && <CourseWorkspace />}
      {activeView === 'page' && <CustomPageView />}
      {activeView === 'student' && (data.user ? <StudentDashboard /> : <HomePage />)}
      {activeView === 'admin' && (data.user?.role === 'admin' ? <AdminDashboard /> : <HomePage />)}

      <AuthModal />
      <CheckoutModal />
      <WhatsAppButton />

      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-5 left-5 z-50 max-w-sm rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-lg"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <PlatformProvider>
      <AppShell />
    </PlatformProvider>
  );
}
