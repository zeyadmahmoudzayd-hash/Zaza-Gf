import { Check, Eye, Plus, Trash2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import { apiFetch, withAuthUrl } from '../../lib/api';

export function PlansAndPaymentsPanel() {
  const { refreshBootstrap, showToast } = usePlatform();
  const [plans, setPlans] = useState<any[]>([]);
  const [methods, setMethods] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [previewReceipt, setPreviewReceipt] = useState<string | null>(null);

  // New plan form
  const [pName, setPName] = useState('');
  const [pDays, setPDays] = useState(30);
  const [pPrice, setPPrice] = useState(350);
  const [pLabel, setPLabel] = useState('Per Month');
  const [pDesc, setPDesc] = useState('');

  const loadAll = async () => {
    const [plRes, mRes, payRes] = await Promise.all([
      apiFetch<{ plans: any[] }>('/api/admin/plans'),
      apiFetch<{ paymentMethods: any[] }>('/api/admin/payment-methods'),
      apiFetch<{ payments: any[] }>('/api/admin/payments'),
    ]);
    setPlans(plRes.plans);
    setMethods(mRes.paymentMethods);
    setPayments(payRes.payments);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const savePlan = async (plan: any) => {
    await apiFetch(`/api/admin/plans/${plan.id}`, {
      method: 'PUT',
      body: JSON.stringify(plan),
    });
    await loadAll();
    await refreshBootstrap();
    showToast(`Saved plan: ${plan.name}`);
  };

  const addPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/plans', {
      method: 'POST',
      body: JSON.stringify({
        name: pName,
        duration_days: pDays,
        price_egp: pPrice,
        billing_label: pLabel,
        description: pDesc,
        features: ['Full video course access', 'Downloadable PDF summaries', 'Timed quizzes & progress tracking'],
        is_active: true,
        sort_order: plans.length + 1,
      }),
    });
    setPName('');
    setPDesc('');
    await loadAll();
    await refreshBootstrap();
    showToast('Subscription plan created.');
  };

  const deletePlan = async (id: number) => {
    await apiFetch(`/api/admin/plans/${id}`, { method: 'DELETE' });
    await loadAll();
    await refreshBootstrap();
    showToast('Plan removed.');
  };

  const saveMethod = async (m: any) => {
    await apiFetch(`/api/admin/payment-methods/${m.id}`, {
      method: 'PUT',
      body: JSON.stringify(m),
    });
    await loadAll();
    await refreshBootstrap();
    showToast(`Updated payment method: ${m.name}`);
  };

  const reviewPayment = async (id: number, action: 'approve' | 'reject') => {
    const note = action === 'approve' ? 'Verified and subscription activated.' : 'Receipt could not be verified.';
    await apiFetch(`/api/admin/payments/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, admin_note: note }),
    });
    await loadAll();
    showToast(action === 'approve' ? 'Payment approved & subscription activated.' : 'Payment rejected.');
  };

  return (
    <div className="space-y-8">
      {/* Payment Requests Verification Queue */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">
          Student Payment Requests ({payments.filter((p) => p.status === 'pending').length} Pending)
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2.5">Student</th>
                <th className="py-2.5">Plan</th>
                <th className="py-2.5">Method</th>
                <th className="py-2.5 text-right">Amount</th>
                <th className="py-2.5">Reference &amp; Receipt</th>
                <th className="py-2.5">Status</th>
                <th className="py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((pr) => (
                <tr key={pr.id}>
                  <td className="py-3">
                    <p className="font-semibold text-slate-900">{pr.student_name}</p>
                    <p className="text-slate-500">{pr.student_email}</p>
                  </td>
                  <td className="py-3 font-medium text-slate-800">{pr.plan_name}</td>
                  <td className="py-3 text-slate-600">{pr.method_name}</td>
                  <td className="font-mono-num py-3 text-right font-bold text-slate-900">{pr.amount_egp} EGP</td>
                  <td className="py-3">
                    <p className="text-slate-700">{pr.sender_reference || '—'}</p>
                    {pr.receipt_url && (
                      <button
                        type="button"
                        onClick={() => setPreviewReceipt(withAuthUrl(pr.receipt_url))}
                        className="mt-1 inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
                      >
                        <Eye className="h-3 w-3" />
                        <span>View Receipt</span>
                      </button>
                    )}
                  </td>
                  <td className="py-3">
                    <span
                      className={`font-semibold ${
                        pr.status === 'approved'
                          ? 'text-emerald-700'
                          : pr.status === 'rejected'
                            ? 'text-red-600'
                            : 'text-amber-700'
                      }`}
                    >
                      {pr.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {pr.status === 'pending' && (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => reviewPayment(pr.id, 'approve')}
                          className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 font-semibold text-white hover:bg-emerald-700"
                        >
                          <Check className="h-3 w-3" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => reviewPayment(pr.id, 'reject')}
                          className="inline-flex items-center gap-1 rounded bg-red-600 px-2.5 py-1 font-semibold text-white hover:bg-red-700"
                        >
                          <X className="h-3 w-3" />
                          <span>Reject</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customizable Subscription Plans */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">Customizable Subscription Plans</h2>
        <div className="mt-4 space-y-4">
          {plans.map((plan, idx) => (
            <div
              key={plan.id}
              className="grid grid-cols-1 items-end gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-6"
            >
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-semibold text-slate-600">Plan Name</label>
                <input
                  type="text"
                  value={plan.name}
                  onChange={(e) => {
                    const next = [...plans];
                    next[idx] = { ...plan, name: e.target.value };
                    setPlans(next);
                  }}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600">Price (EGP)</label>
                <input
                  type="number"
                  value={plan.price_egp}
                  onChange={(e) => {
                    const next = [...plans];
                    next[idx] = { ...plan, price_egp: Number(e.target.value) };
                    setPlans(next);
                  }}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600">Days</label>
                <input
                  type="number"
                  value={plan.duration_days}
                  onChange={(e) => {
                    const next = [...plans];
                    next[idx] = { ...plan, duration_days: Number(e.target.value) };
                    setPlans(next);
                  }}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
              <div className="flex items-center gap-3 py-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(plan.is_active)}
                    onChange={(e) => {
                      const next = [...plans];
                      next[idx] = { ...plan, is_active: e.target.checked ? 1 : 0 };
                      setPlans(next);
                    }}
                  />
                  <span>Active</span>
                </label>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => savePlan(plan)}
                  className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => deletePlan(plan.id)}
                  className="rounded p-1.5 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={addPlan} className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-200 pt-5 sm:grid-cols-5">
          <input
            type="text"
            required
            value={pName}
            onChange={(e) => setPName(e.target.value)}
            placeholder="New Plan Name"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
          />
          <input
            type="number"
            required
            value={pDays}
            onChange={(e) => setPDays(Number(e.target.value))}
            placeholder="Duration Days"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
          />
          <input
            type="number"
            required
            value={pPrice}
            onChange={(e) => setPPrice(Number(e.target.value))}
            placeholder="Price (EGP)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
          />
          <input
            type="text"
            value={pLabel}
            onChange={(e) => setPLabel(e.target.value)}
            placeholder="Billing Label"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-white"
            style={{ backgroundColor: 'var(--brand-blue)' }}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Plan</span>
          </button>
        </form>
      </div>

      {/* Configurable Egypt Payment Methods */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">Egypt Payment Channels Configuration</h2>
        <div className="mt-4 space-y-4">
          {methods.map((m, idx) => (
            <div key={m.id} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  value={m.name}
                  onChange={(e) => {
                    const next = [...methods];
                    next[idx] = { ...m, name: e.target.value };
                    setMethods(next);
                  }}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
                />
                <input
                  type="text"
                  value={m.account_label}
                  onChange={(e) => {
                    const next = [...methods];
                    next[idx] = { ...m, account_label: e.target.value };
                    setMethods(next);
                  }}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={m.account_value}
                  onChange={(e) => {
                    const next = [...methods];
                    next[idx] = { ...m, account_value: e.target.value };
                    setMethods(next);
                  }}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono-num"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={m.instructions}
                  onChange={(e) => {
                    const next = [...methods];
                    next[idx] = { ...m, instructions: e.target.value };
                    setMethods(next);
                  }}
                  className="flex-1 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs"
                />
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(m.is_active)}
                    onChange={(e) => {
                      const next = [...methods];
                      next[idx] = { ...m, is_active: e.target.checked ? 1 : 0 };
                      setMethods(next);
                    }}
                  />
                  <span>Enabled</span>
                </label>
                <button
                  type="button"
                  onClick={() => saveMethod(m)}
                  className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Save Method
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Receipt Preview Modal */}
      {previewReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-4">
            <button
              type="button"
              onClick={() => setPreviewReceipt(null)}
              className="mb-3 rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
            >
              Close Preview
            </button>
            <img src={previewReceipt} alt="Payment Receipt" className="w-full rounded-lg border border-slate-200" />
          </div>
        </div>
      )}
    </div>
  );
}

export function StudentsAccessPanel() {
  const { data, showToast } = usePlatform();
  const [students, setStudents] = useState<any[]>([]);
  const [grants, setGrants] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  // Grant course/lesson access form
  const [grantUserId, setGrantUserId] = useState<number>(0);
  const [grantCourseId, setGrantCourseId] = useState<number>(data?.courses?.[0]?.id || 1);

  const loadAll = async () => {
    const res = await apiFetch<{ students: any[]; grants: any[] }>('/api/admin/students');
    setStudents(res.students);
    setGrants(res.grants);
    if (res.students.length > 0 && !grantUserId) setGrantUserId(res.students[0].id);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const toggleSub = async (studentId: number, action: 'activate' | 'deactivate') => {
    await apiFetch(`/api/admin/students/${studentId}/subscription`, {
      method: 'POST',
      body: JSON.stringify({ action, duration_days: 30 }),
    });
    await loadAll();
    showToast(action === 'activate' ? '30-day subscription activated.' : 'Subscription deactivated.');
  };

  const toggleStatus = async (studentId: number, currentStatus: string) => {
    const status = currentStatus === 'active' ? 'suspended' : 'active';
    await apiFetch(`/api/admin/students/${studentId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    await loadAll();
    showToast(`Student status set to ${status}.`);
  };

  const handleGrantCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantUserId || !grantCourseId) return;
    await apiFetch(`/api/admin/students/${grantUserId}/access`, {
      method: 'POST',
      body: JSON.stringify({ course_id: grantCourseId }),
    });
    await loadAll();
    showToast('Course access granted to student.');
  };

  const revokeGrant = async (grantId: number) => {
    await apiFetch(`/api/admin/access/${grantId}`, { method: 'DELETE' });
    await loadAll();
  };

  const filtered = students.filter(
    (s) =>
      !search.trim() ||
      `${s.full_name} ${s.email} ${s.grade}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-display text-lg font-bold text-slate-900">Student Directory ({students.length})</h2>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student name or email..."
            className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs"
          />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[740px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2.5">Student</th>
                <th className="py-2.5">Grade</th>
                <th className="py-2.5 text-right">XP</th>
                <th className="py-2.5 text-right">Lessons</th>
                <th className="py-2.5 text-right">Quiz Avg</th>
                <th className="py-2.5">Subscription</th>
                <th className="py-2.5 text-right">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((st) => (
                <tr key={st.id}>
                  <td className="py-3">
                    <p className="font-semibold text-slate-900">{st.full_name}</p>
                    <p className="text-slate-500">{st.email}</p>
                  </td>
                  <td className="py-3 text-slate-700">{st.grade}</td>
                  <td className="font-mono-num py-3 text-right font-bold text-blue-700">{st.xp_points}</td>
                  <td className="font-mono-num py-3 text-right text-slate-700">{st.completed_lessons}</td>
                  <td className="font-mono-num py-3 text-right text-slate-700">{st.avg_quiz_score}%</td>
                  <td className="py-3">
                    {st.active_plan ? (
                      <span className="font-semibold text-emerald-700">{st.active_plan}</span>
                    ) : (
                      <span className="text-slate-400">None</span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {st.active_plan ? (
                        <button
                          type="button"
                          onClick={() => toggleSub(st.id, 'deactivate')}
                          className="rounded border border-slate-300 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Deactivate Sub
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleSub(st.id, 'activate')}
                          className="rounded bg-blue-700 px-2.5 py-1 font-semibold text-white hover:bg-blue-800"
                        >
                          Activate 30d
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleStatus(st.id, st.status)}
                        className="rounded border border-slate-300 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {st.status === 'active' ? 'Suspend' : 'Restore'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explicit Course Access Grants */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">Individual Course Access Grants</h2>
        <form onSubmit={handleGrantCourse} className="mt-4 flex flex-wrap gap-3">
          <select
            value={grantUserId}
            onChange={(e) => setGrantUserId(Number(e.target.value))}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} ({s.email})
              </option>
            ))}
          </select>
          <select
            value={grantCourseId}
            onChange={(e) => setGrantCourseId(Number(e.target.value))}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
          >
            {data?.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg px-4 py-2 text-xs font-semibold text-white"
            style={{ backgroundColor: 'var(--brand-navy)' }}
          >
            Grant Course Access
          </button>
        </form>

        {grants.length > 0 && (
          <div className="mt-4 divide-y divide-slate-100 text-xs">
            {grants.map((g) => (
              <div key={g.id} className="flex items-center justify-between py-2">
                <span>
                  Student #{g.user_id} → <strong>{g.course_title || g.lesson_title}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => revokeGrant(g.id)}
                  className="font-semibold text-red-600 hover:underline"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommunicationsPanel() {
  const { refreshBootstrap, showToast } = usePlatform();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);

  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annGrade, setAnnGrade] = useState('All Grades');
  const [annPinned, setAnnPinned] = useState(false);

  const loadAll = async () => {
    const [aRes, rRes, mRes] = await Promise.all([
      apiFetch<{ announcements: any[] }>('/api/admin/announcements'),
      apiFetch<{ reviews: any[] }>('/api/admin/reviews'),
      apiFetch<{ messages: any[] }>('/api/admin/messages'),
    ]);
    setAnnouncements(aRes.announcements);
    setReviews(rRes.reviews);
    setMessages(mRes.messages);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const addAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/announcements', {
      method: 'POST',
      body: JSON.stringify({
        title: annTitle,
        body: annBody,
        target_grade: annGrade,
        is_pinned: annPinned,
        is_published: true,
      }),
    });
    setAnnTitle('');
    setAnnBody('');
    await loadAll();
    await refreshBootstrap();
    showToast('Announcement published.');
  };

  const deleteAnnouncement = async (id: number) => {
    await apiFetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
    await loadAll();
    await refreshBootstrap();
  };

  const setReviewStatus = async (id: number, status: 'approved' | 'hidden') => {
    await apiFetch(`/api/admin/reviews/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    await loadAll();
    await refreshBootstrap();
  };

  const deleteReview = async (id: number) => {
    await apiFetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
    await loadAll();
    await refreshBootstrap();
  };

  const markReplied = async (id: number) => {
    await apiFetch(`/api/admin/messages/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ admin_reply: 'Responded via WhatsApp / Email.' }),
    });
    await loadAll();
    showToast('Message marked replied.');
  };

  return (
    <div className="space-y-8">
      {/* Announcements */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">Send Student Announcements</h2>
        <form onSubmit={addAnnouncement} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              type="text"
              required
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              placeholder="Announcement Headline"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
            />
            <select
              value={annGrade}
              onChange={(e) => setAnnGrade(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="All Grades">All Grades</option>
              <option value="Grade 10">Grade 10</option>
              <option value="Grade 11">Grade 11</option>
              <option value="Grade 12">Grade 12</option>
            </select>
          </div>
          <textarea
            rows={2}
            required
            value={annBody}
            onChange={(e) => setAnnBody(e.target.value)}
            placeholder="Announcement message..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={annPinned}
                onChange={(e) => setAnnPinned(e.target.checked)}
              />
              <span>Pin to top of homepage</span>
            </label>
            <button
              type="submit"
              className="rounded-lg px-4 py-2 text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--brand-navy)' }}
            >
              Publish Announcement
            </button>
          </div>
        </form>

        <div className="mt-5 divide-y divide-slate-100">
          {announcements.map((a) => (
            <div key={a.id} className="flex items-center justify-between py-3 text-xs">
              <div>
                <p className="font-bold text-slate-900">{a.title}</p>
                <p className="text-slate-500">{a.target_grade}</p>
              </div>
              <button
                type="button"
                onClick={() => deleteAnnouncement(a.id)}
                className="rounded p-1.5 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews Moderation */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">Manage Student Reviews</h2>
        <div className="mt-4 space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4 text-xs">
              <div className="max-w-xl">
                <p className="font-bold text-slate-900">
                  {r.student_name} · {r.rating}/5 Stars ({r.status})
                </p>
                <p className="mt-1 text-slate-600">{r.comment}</p>
              </div>
              <div className="flex items-center gap-2">
                {r.status !== 'approved' ? (
                  <button
                    type="button"
                    onClick={() => setReviewStatus(r.id, 'approved')}
                    className="rounded bg-emerald-600 px-2.5 py-1 font-semibold text-white"
                  >
                    Approve
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setReviewStatus(r.id, 'hidden')}
                    className="rounded border border-slate-300 px-2.5 py-1 font-semibold text-slate-700"
                  >
                    Hide
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteReview(r.id)}
                  className="rounded p-1 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contact Inbox */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">Contact Inbox ({messages.length})</h2>
        <div className="mt-4 space-y-3">
          {messages.map((m) => (
            <div key={m.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-slate-900">
                  {m.name} ({m.email} {m.phone ? `· ${m.phone}` : ''})
                </p>
                <span className={m.status === 'replied' ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
                  {m.status.toUpperCase()}
                </span>
              </div>
              <p className="mt-1 font-semibold text-slate-700">{m.subject}</p>
              <p className="mt-1 text-slate-600">{m.message}</p>
              {m.status !== 'replied' && (
                <button
                  type="button"
                  onClick={() => markReplied(m.id)}
                  className="mt-3 rounded bg-slate-900 px-3 py-1 font-semibold text-white"
                >
                  Mark as Replied
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
