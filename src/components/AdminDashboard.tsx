import {
  BarChart3,
  BookOpen,
  CreditCard,
  FileText,
  GraduationCap,
  HelpCircle,
  Layout,
  LogOut,
  Megaphone,
  Palette,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { apiFetch } from '../lib/api';
import { PagesAndNavPanel, SiteDesignPanel, TeacherProfilePanel } from './admin/AdminCmsPanels';
import { CoursesManagerPanel, QuizzesAssignmentsPanel } from './admin/AdminLmsPanels';
import { CommunicationsPanel, PlansAndPaymentsPanel, StudentsAccessPanel } from './admin/AdminOperationsPanels';

type AdminTab =
  | 'overview'
  | 'design'
  | 'teacher'
  | 'courses'
  | 'quizzes'
  | 'students'
  | 'payments'
  | 'pages'
  | 'comms';

interface AdminOverviewData {
  stats: {
    totalStudents: number;
    activeSubs: number;
    pendingPayments: number;
    totalRevenue: number;
    totalCourses: number;
    totalLessons: number;
    avgQuizScore: number;
    unreadMessages: number;
  };
  recentPayments: any[];
}

export function AdminDashboard() {
  const { logout, setActiveView } = usePlatform();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);

  const loadOverview = async () => {
    try {
      const res = await apiFetch<AdminOverviewData>('/api/admin/overview');
      setOverview(res);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (tab === 'overview') loadOverview();
  }, [tab]);

  const navItems = [
    { id: 'overview', label: 'Overview & Analytics', icon: BarChart3 },
    { id: 'design', label: 'Site & Design CMS', icon: Palette },
    { id: 'teacher', label: 'Teacher Profile', icon: GraduationCap },
    { id: 'courses', label: 'Courses & Materials', icon: BookOpen },
    { id: 'quizzes', label: 'Quizzes & Homework', icon: HelpCircle },
    { id: 'students', label: 'Students & Access', icon: Users },
    { id: 'payments', label: 'Plans & Egypt Payments', icon: CreditCard },
    { id: 'pages', label: 'Pages & Navigation', icon: Layout },
    { id: 'comms', label: 'Announcements & Inbox', icon: Megaphone },
  ] as const;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Admin Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">No-Code Platform Control</p>
          <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-slate-900">
            ZAZA XPRAS Admin Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveView('home')}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            Preview Live Site
          </button>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap"
            style={{ backgroundColor: 'var(--brand-navy)' }}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Sidebar Navigation (240px–260px equivalent) */}
        <aside className="lg:col-span-3">
          <nav className="space-y-1 rounded-xl border border-slate-200 bg-white p-2.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                    active ? 'text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  style={active ? { backgroundColor: 'var(--brand-navy)' } : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Workspace Viewport */}
        <main className="lg:col-span-9">
          {tab === 'overview' && overview && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-medium text-slate-500">Registered Students</p>
                  <p className="font-mono-num mt-1.5 text-2xl font-bold text-slate-900">
                    {overview.stats.totalStudents}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-medium text-slate-500">Active Subscriptions</p>
                  <p className="font-mono-num mt-1.5 text-2xl font-bold text-emerald-700">
                    {overview.stats.activeSubs}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-medium text-slate-500">Pending Payments</p>
                  <p className="font-mono-num mt-1.5 text-2xl font-bold text-amber-700">
                    {overview.stats.pendingPayments}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-medium text-slate-500">Approved Revenue</p>
                  <p className="font-mono-num mt-1.5 text-2xl font-bold text-blue-700">
                    {overview.stats.totalRevenue} EGP
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-medium text-slate-500">Published Courses</p>
                  <p className="font-mono-num mt-1.5 text-2xl font-bold text-slate-900">
                    {overview.stats.totalCourses}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-medium text-slate-500">Video Lessons</p>
                  <p className="font-mono-num mt-1.5 text-2xl font-bold text-slate-900">
                    {overview.stats.totalLessons}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-medium text-slate-500">Avg Quiz Accuracy</p>
                  <p className="font-mono-num mt-1.5 text-2xl font-bold text-slate-900">
                    {overview.stats.avgQuizScore}%
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-medium text-slate-500">Unread Inquiries</p>
                  <p className="font-mono-num mt-1.5 text-2xl font-bold text-slate-900">
                    {overview.stats.unreadMessages}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold text-slate-900">Recent Payment Activity</h2>
                  <button
                    type="button"
                    onClick={() => setTab('payments')}
                    className="text-xs font-semibold text-blue-700 hover:underline"
                  >
                    Open Verification Queue
                  </button>
                </div>
                <div className="mt-4 divide-y divide-slate-100 text-xs">
                  {overview.recentPayments.map((rp) => (
                    <div key={rp.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {rp.student_name} — {rp.plan_name}
                        </p>
                        <p className="text-slate-500">
                          {rp.method_name} · {rp.sender_reference}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono-num font-bold text-slate-900">{rp.amount_egp} EGP</p>
                        <p
                          className={`font-semibold ${
                            rp.status === 'approved'
                              ? 'text-emerald-700'
                              : rp.status === 'rejected'
                                ? 'text-red-600'
                                : 'text-amber-700'
                          }`}
                        >
                          {rp.status.toUpperCase()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'design' && <SiteDesignPanel />}
          {tab === 'teacher' && <TeacherProfilePanel />}
          {tab === 'courses' && <CoursesManagerPanel />}
          {tab === 'quizzes' && <QuizzesAssignmentsPanel />}
          {tab === 'students' && <StudentsAccessPanel />}
          {tab === 'payments' && <PlansAndPaymentsPanel />}
          {tab === 'pages' && <PagesAndNavPanel />}
          {tab === 'comms' && <CommunicationsPanel />}
        </main>
      </div>
    </div>
  );
}

void (undefined as unknown as typeof FileText);
