import {
  Award,
  Bookmark,
  BookOpen,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  LogOut,
  Play,
  Star,
  Trophy,
  User,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { apiFetch } from '../lib/api';
import type { AuthUser, BadgeItem } from '../types/platform';

interface StudentAccountPayload {
  user: AuthUser;
  subscription: {
    id: number;
    plan_name: string;
    status: string;
    starts_at: string;
    expires_at: string;
  } | null;
  payments: Array<{
    id: number;
    plan_name: string;
    method_name: string;
    amount_egp: number;
    sender_reference: string;
    status: string;
    admin_note: string;
    created_at: string;
  }>;
  savedLessons: Array<{
    lesson_id: number;
    lesson_title: string;
    duration_minutes: number;
    course_id: number;
    course_title: string;
    subject: string;
  }>;
  quizAttempts: Array<{
    id: number;
    quiz_title: string;
    course_title: string;
    score: number;
    total_questions: number;
    percentage: number;
    passed: number;
    xp_earned: number;
    submitted_at: string;
  }>;
  submissions: Array<{
    id: number;
    assignment_title: string;
    course_title: string;
    max_score: number;
    score: number | null;
    feedback: string;
    status: string;
    submitted_at: string;
  }>;
  courseProgress: Array<{
    id: number;
    title: string;
    subject: string;
    grade: string;
    total_lessons: number;
    completed_lessons: number;
  }>;
  badges: BadgeItem[];
}

export function StudentDashboard() {
  const { data, openCourse, openCheckout, logout, showToast, refreshBootstrap } = usePlatform();
  const [account, setAccount] = useState<StudentAccountPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'courses' | 'saved' | 'grades' | 'billing' | 'profile'>('overview');

  // Profile form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [grade, setGrade] = useState('Grade 12');
  const [school, setSchool] = useState('');
  const [bio, setBio] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const loadAccount = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<StudentAccountPayload>('/api/auth/me');
      setAccount(res);
      setFullName(res.user.full_name || '');
      setPhone(res.user.phone || '');
      setGrade(res.user.grade || 'Grade 12');
      setSchool(res.user.school || '');
      setBio(res.user.bio || '');
    } catch (err: any) {
      showToast(err?.message || 'Failed to load student dashboard.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: fullName,
          phone,
          grade,
          school,
          bio,
          new_password: newPassword || undefined,
        }),
      });
      setNewPassword('');
      await loadAccount();
      await refreshBootstrap();
      showToast('Profile updated successfully.');
    } catch (err: any) {
      showToast(err?.message || 'Could not update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (file: File | undefined) => {
    if (!file) return;
    const form = new FormData();
    form.append('avatar', file);
    try {
      await apiFetch('/api/auth/avatar', { method: 'POST', body: form });
      await loadAccount();
      showToast('Profile photo updated.');
    } catch (err: any) {
      showToast(err?.message || 'Avatar upload failed.');
    }
  };

  if (loading || !account) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  const { user, subscription, payments, savedLessons, quizAttempts, submissions, courseProgress, badges } = account;
  const totalLessons = courseProgress.reduce((a, c) => a + c.total_lessons, 0);
  const completedLessons = courseProgress.reduce((a, c) => a + c.completed_lessons, 0);
  const overallPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const earnedBadges = badges.filter((b) => b.earned);
  const leaderboard = data?.leaderboard || [];
  const myRank = leaderboard.find((l) => l.id === user.id)?.rank;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-4">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.full_name}
              referrerPolicy="no-referrer"
              className="h-14 w-14 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white"
              style={{ backgroundColor: 'var(--brand-navy)' }}
            >
              {user.full_name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">{user.full_name}</h1>
            <p className="text-xs font-medium text-slate-500">
              {user.grade} · Lv.{user.level || 1} {user.title || 'Scholar'} ·{' '}
              <span className="font-mono-num font-bold text-blue-700">{user.xp_points} XP</span>
              {myRank ? ` · Rank #${myRank}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => openCheckout()}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-white whitespace-nowrap"
            style={{ backgroundColor: 'var(--brand-blue)' }}
          >
            {subscription ? 'Extend Subscription' : 'Activate Subscription'}
          </button>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mt-6 flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5">
        {[
          { id: 'overview', label: 'Overview & Badges' },
          { id: 'courses', label: 'Courses & Progress' },
          { id: 'saved', label: `Saved Lessons (${savedLessons.length})` },
          { id: 'grades', label: `Exams & Grades (${quizAttempts.length})` },
          { id: 'billing', label: 'Subscription & Payments' },
          { id: 'profile', label: 'Edit Profile' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id as any)}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === item.id ? 'text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
            style={tab === item.id ? { backgroundColor: 'var(--brand-navy)' } : undefined}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {tab === 'overview' && (
          <div className="space-y-8">
            {/* 4 KPI Summary Strip */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-medium text-slate-500">Subscription Status</p>
                <p className="mt-1.5 text-lg font-bold text-slate-900">
                  {subscription ? subscription.plan_name : 'Free Access Only'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {subscription
                    ? `Expires ${new Date(subscription.expires_at).toLocaleDateString('en-EG')}`
                    : 'Subscribe to unlock all units'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-medium text-slate-500">Overall Course Progress</p>
                <p className="font-mono-num mt-1.5 text-2xl font-bold text-slate-900">{overallPct}%</p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${overallPct}%`, backgroundColor: 'var(--brand-blue)' }}
                  />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-medium text-slate-500">Academic XP &amp; Level</p>
                <p className="font-mono-num mt-1.5 text-2xl font-bold" style={{ color: 'var(--brand-blue)' }}>
                  {user.xp_points} XP
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${user.progressPercent || 20}%` }}
                  />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-medium text-slate-500">Milestone Badges</p>
                <p className="font-mono-num mt-1.5 text-2xl font-bold text-slate-900">
                  {earnedBadges.length} / {badges.length}
                </p>
                <p className="mt-1 text-xs text-slate-500">Complete lessons &amp; quizzes to unlock</p>
              </div>
            </div>

            {/* Visual Course Progress Bars + Badges Showcase */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
                <h2 className="font-display text-lg font-bold text-slate-900">Course Progress Tracker</h2>
                <div className="mt-4 space-y-4">
                  {courseProgress.map((cp) => {
                    const pct =
                      cp.total_lessons > 0 ? Math.round((cp.completed_lessons / cp.total_lessons) * 100) : 0;
                    return (
                      <div key={cp.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => openCourse(cp.id)}
                            className="text-left text-sm font-semibold text-slate-900 hover:text-blue-700"
                          >
                            {cp.title}
                          </button>
                          <span className="font-mono-num text-xs font-bold text-slate-700">{pct}%</span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {cp.completed_lessons} of {cp.total_lessons} lessons completed
                        </p>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: 'var(--brand-navy)' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold text-slate-900">Achievement Badges</h2>
                  <span className="text-xs font-medium text-slate-500">Automatic milestone rewards</span>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {badges.map((badge) => (
                    <div
                      key={badge.id}
                      className={`flex items-start gap-3 rounded-lg border p-3.5 ${
                        badge.earned
                          ? 'border-amber-300 bg-amber-50/40'
                          : 'border-slate-200 bg-slate-50/60 opacity-65'
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          badge.earned ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {badge.icon_name === 'trophy' ? (
                          <Trophy className="h-4 w-4" />
                        ) : badge.icon_name === 'star' ? (
                          <Star className="h-4 w-4" />
                        ) : (
                          <Award className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900">
                          {badge.title}{' '}
                          <span className="font-mono-num text-blue-700">(+{badge.xp_reward} XP)</span>
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-slate-600">{badge.description}</p>
                        <p className="mt-1 text-[10px] font-semibold text-slate-500">
                          {badge.earned ? 'Unlocked' : 'Locked'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'courses' && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {courseProgress.map((cp) => {
              const pct = cp.total_lessons > 0 ? Math.round((cp.completed_lessons / cp.total_lessons) * 100) : 0;
              return (
                <div key={cp.id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      {cp.subject} · {cp.grade}
                    </p>
                    <h3 className="font-display mt-1.5 text-lg font-bold text-slate-900">{cp.title}</h3>
                    <div className="mt-4 flex items-center justify-between text-xs text-slate-600">
                      <span>Completion</span>
                      <span className="font-mono-num font-bold">{pct}%</span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: 'var(--brand-blue)' }}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openCourse(cp.id)}
                    className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-semibold text-white"
                    style={{ backgroundColor: 'var(--brand-navy)' }}
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>Continue Learning</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'saved' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-display text-lg font-bold text-slate-900">Saved Lessons</h2>
            {savedLessons.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                You have no bookmarked lessons yet. Open any course and click Save Lesson.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-slate-100">
                {savedLessons.map((sl) => (
                  <div key={sl.lesson_id} className="flex flex-wrap items-center justify-between gap-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <Bookmark className="h-4 w-4 text-amber-500" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{sl.lesson_title}</p>
                        <p className="text-xs text-slate-500">
                          {sl.course_title} · {sl.duration_minutes} mins
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCourse(sl.course_id)}
                      className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Open Lesson
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'grades' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="font-display text-lg font-bold text-slate-900">Online Exam &amp; Quiz Results</h2>
              {quizAttempts.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No quiz attempts recorded yet.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[540px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                        <th className="py-2.5">Quiz</th>
                        <th className="py-2.5">Course</th>
                        <th className="py-2.5 text-right">Score</th>
                        <th className="py-2.5 text-right">Result</th>
                        <th className="py-2.5 text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {quizAttempts.map((qa) => (
                        <tr key={qa.id}>
                          <td className="py-3 font-semibold text-slate-900">{qa.quiz_title}</td>
                          <td className="py-3 text-xs text-slate-600">{qa.course_title}</td>
                          <td className="font-mono-num py-3 text-right font-bold text-slate-900">
                            {qa.score}/{qa.total_questions} ({qa.percentage}%)
                          </td>
                          <td
                            className={`py-3 text-right text-xs font-semibold ${
                              qa.passed ? 'text-emerald-700' : 'text-red-600'
                            }`}
                          >
                            {qa.passed ? 'Passed' : 'Review'}
                          </td>
                          <td className="font-mono-num py-3 text-right text-xs text-slate-500">
                            {new Date(qa.submitted_at).toLocaleDateString('en-EG')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="font-display text-lg font-bold text-slate-900">Homework &amp; Assignment Grades</h2>
              {submissions.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No homework submissions yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {submissions.map((sub) => (
                    <div key={sub.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900">
                          {sub.assignment_title}{' '}
                          <span className="text-xs font-normal text-slate-500">· {sub.course_title}</span>
                        </p>
                        <span className="font-mono-num text-xs font-bold text-blue-800">
                          {sub.status === 'graded'
                            ? `Grade: ${sub.score} / ${sub.max_score}`
                            : 'Pending Review'}
                        </span>
                      </div>
                      {sub.feedback && (
                        <p className="mt-2 text-xs text-slate-700">
                          <strong>Instructor Feedback:</strong> {sub.feedback}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'billing' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6">
              <div>
                <p className="text-xs font-medium text-slate-500">Current Membership</p>
                <h2 className="font-display mt-1 text-xl font-bold text-slate-900">
                  {subscription ? `${subscription.plan_name} (Active)` : 'No Active Paid Subscription'}
                </h2>
                {subscription && (
                  <p className="mt-1 text-xs text-slate-600">
                    Valid until {new Date(subscription.expires_at).toLocaleDateString('en-EG')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => openCheckout()}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--brand-blue)' }}
              >
                <CreditCard className="h-4 w-4" />
                <span>Choose or Renew Plan</span>
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="font-display text-lg font-bold text-slate-900">Payment Requests &amp; Receipts</h3>
              {payments.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No payment requests submitted yet.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[540px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                        <th className="py-2.5">Plan</th>
                        <th className="py-2.5">Method</th>
                        <th className="py-2.5 text-right">Amount</th>
                        <th className="py-2.5">Reference</th>
                        <th className="py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td className="py-3 font-semibold text-slate-900">{p.plan_name}</td>
                          <td className="py-3 text-xs text-slate-600">{p.method_name}</td>
                          <td className="font-mono-num py-3 text-right font-semibold text-slate-900">
                            {p.amount_egp} EGP
                          </td>
                          <td className="py-3 text-xs text-slate-600">{p.sender_reference}</td>
                          <td
                            className={`py-3 text-xs font-semibold ${
                              p.status === 'approved'
                                ? 'text-emerald-700'
                                : p.status === 'rejected'
                                  ? 'text-red-600'
                                  : 'text-amber-700'
                            }`}
                          >
                            {p.status.toUpperCase()}
                            {p.admin_note ? ` — ${p.admin_note}` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'profile' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="font-display text-lg font-bold text-slate-900">Edit Student Profile</h2>
            <div className="mt-4 flex items-center gap-4">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                <User className="h-3.5 w-3.5" />
                <span>Upload Profile Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleAvatarUpload(e.target.files?.[0])}
                />
              </label>
            </div>

            <form onSubmit={handleSaveProfile} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Academic Grade</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900"
                >
                  <option value="Grade 10">Grade 10</option>
                  <option value="Grade 11">Grade 11</option>
                  <option value="Grade 12">Grade 12</option>
                  <option value="University Prep">University Prep</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">School / Institution</label>
                <input
                  type="text"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-700">Bio / Study Goals</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Change Password (leave blank to keep current)
                </label>
                <input
                  type="password"
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 6 characters)"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
                  style={{ backgroundColor: 'var(--brand-navy)' }}
                >
                  {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// Suppress unused icon warning cleanly if any
void BookOpen;
void CheckCircle2;
void FileCheck2;
