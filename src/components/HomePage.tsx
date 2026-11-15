import { ArrowRight, Award, BookOpen, Check, Clock, Mail, MapPin, Phone, Play, Send, Star, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import React, { useMemo, useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { apiFetch } from '../lib/api';
import type { SectionConfigItem } from '../types/platform';

export function HomePage() {
  const { data, openCourse, openPage, openCheckout, openAuthModal, showToast, refreshBootstrap } = usePlatform();

  const [gradeFilter, setGradeFilter] = useState('All');
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Contact form
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSending, setContactSending] = useState(false);

  // Student review form
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewMetric, setReviewMetric] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSending, setReviewSending] = useState(false);

  const sections: SectionConfigItem[] = useMemo(() => {
    try {
      return JSON.parse(data?.settings?.sections_config || '[]');
    } catch {
      return [
        { id: 'hero', label: 'Welcome Hero', visible: true },
        { id: 'teacher', label: 'Teacher Profile', visible: true },
        { id: 'courses', label: 'Featured Courses', visible: true },
        { id: 'leaderboard', label: 'Student Leaderboard', visible: true },
        { id: 'plans', label: 'Subscription Plans', visible: true },
        { id: 'announcements', label: 'Latest Announcements', visible: true },
        { id: 'reviews', label: 'Student Reviews', visible: true },
        { id: 'contact', label: 'Contact Section', visible: true },
      ];
    }
  }, [data?.settings?.sections_config]);

  const grades = useMemo(() => {
    const list = new Set<string>(['All']);
    data?.courses.forEach((c) => list.add(c.grade));
    return Array.from(list);
  }, [data?.courses]);

  const subjects = useMemo(() => {
    const list = new Set<string>(['All']);
    data?.courses.forEach((c) => list.add(c.subject));
    return Array.from(list);
  }, [data?.courses]);

  const filteredCourses = useMemo(() => {
    if (!data) return [];
    return data.courses.filter((c) => {
      if (gradeFilter !== 'All' && c.grade !== gradeFilter) return false;
      if (subjectFilter !== 'All' && c.subject !== subjectFilter) return false;
      if (
        searchQuery.trim() &&
        !`${c.title} ${c.subject} ${c.grade} ${c.description}`.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [data, gradeFilter, subjectFilter, searchQuery]);

  if (!data) return null;
  const { settings, courses, plans, announcements, reviews, leaderboard, pages, user } = data;

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactSending(true);
    try {
      await apiFetch('/api/contact', {
        method: 'POST',
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          phone: contactPhone,
          subject: contactSubject,
          message: contactMessage,
        }),
      });
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setContactSubject('');
      setContactMessage('');
      showToast('Your message has been received. Our academic office will reply soon.');
    } catch (err: any) {
      showToast(err?.message || 'Unable to send message.');
    } finally {
      setContactSending(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModal('login');
      return;
    }
    setReviewSending(true);
    try {
      await apiFetch('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          rating: reviewRating,
          outcome_metric: reviewMetric,
          comment: reviewComment,
        }),
      });
      setReviewComment('');
      setReviewMetric('');
      await refreshBootstrap();
      showToast('Thank you. Your student review has been published.');
    } catch (err: any) {
      showToast(err?.message || 'Failed to submit review.');
    } finally {
      setReviewSending(false);
    }
  };

  const renderSection = (sectionId: string) => {
    switch (sectionId) {
      case 'hero':
        return (
          <section
            key="hero"
            className="border-b border-slate-200/80 text-white"
            style={{ backgroundColor: 'var(--brand-navy)' }}
          >
            <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
              <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="flex flex-col justify-center lg:col-span-6"
                >
                  <p className="text-sm font-medium tracking-wide" style={{ color: 'var(--brand-gold)' }}>
                    {settings.hero_kicker}
                  </p>
                  <h1 className="font-display mt-3 text-balance text-4xl font-extrabold leading-[1.12] tracking-tight text-white sm:text-5xl">
                    {settings.hero_headline}
                  </h1>
                  <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
                    {settings.hero_subheadline}
                  </p>

                  <div className="mt-8 flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() => document.getElementById('courses')?.scrollIntoView({ behavior: 'smooth' })}
                      className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-transform duration-150 hover:scale-[1.01] whitespace-nowrap shrink-0"
                      style={{ backgroundColor: 'var(--brand-blue)' }}
                    >
                      <span>{settings.hero_cta_label}</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' })}
                      className="inline-flex items-center rounded-lg border border-white/25 px-5 py-3 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10 whitespace-nowrap shrink-0"
                    >
                      View Subscription Plans
                    </button>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.08 }}
                  className="lg:col-span-6"
                >
                  <div className="relative h-full min-h-[280px] overflow-hidden rounded-xl border border-white/15 bg-slate-900">
                    {settings.hero_image_url ? (
                      <img
                        src={settings.hero_image_url}
                        alt={settings.platform_name}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover lg:h-full"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-slate-800 text-slate-300">
                        <BookOpen className="h-12 w-12" />
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-5 right-5 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-200">
                      <span>{settings.tagline}</span>
                      <span style={{ color: 'var(--brand-gold)' }}>{settings.teacher_name}</span>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* 4-column structured proof row below hero split */}
              <div className="mt-12 grid grid-cols-2 gap-6 border-t border-white/15 pt-8 sm:grid-cols-4">
                <div>
                  <p className="font-mono-num text-2xl font-bold text-white sm:text-3xl">{courses.length}</p>
                  <p className="mt-1 text-xs text-slate-300">Structured Academic Courses</p>
                </div>
                <div>
                  <p className="font-mono-num text-2xl font-bold text-white sm:text-3xl">
                    {courses.reduce((acc, c) => acc + (c.lesson_count || 0), 0)}
                  </p>
                  <p className="mt-1 text-xs text-slate-300">Studio Video Lectures</p>
                </div>
                <div>
                  <p className="font-mono-num text-2xl font-bold text-white sm:text-3xl">
                    {courses.reduce((acc, c) => acc + (c.quiz_count || 0), 0)}
                  </p>
                  <p className="mt-1 text-xs text-slate-300">Auto-Graded Timed Quizzes</p>
                </div>
                <div>
                  <p className="font-mono-num text-2xl font-bold" style={{ color: 'var(--brand-gold)' }}>
                    {plans.length} Plans
                  </p>
                  <p className="mt-1 text-xs text-slate-300">Vodafone Cash &amp; InstaPay Ready</p>
                </div>
              </div>
            </div>
          </section>
        );

      case 'teacher':
        return (
          <section key="teacher" id="teacher" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-stretch gap-10 rounded-xl border border-slate-200 bg-white p-6 sm:p-10 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <div className="h-full min-h-[300px] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  {settings.teacher_photo_url ? (
                    <img
                      src={settings.teacher_photo_url}
                      alt={settings.teacher_name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-400">
                      <Award className="h-12 w-12" />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col justify-center lg:col-span-8">
                <p className="text-xs font-semibold tracking-wide" style={{ color: 'var(--brand-blue)' }}>
                  Lead Educator · {settings.teacher_subject}
                </p>
                <h2 className="font-display mt-2 text-3xl font-bold tracking-tight text-slate-900">
                  {settings.teacher_name}
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-600">{settings.teacher_title}</p>
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-700">{settings.teacher_bio}</p>

                <div className="mt-6 border-t border-slate-200 pt-5 text-sm font-medium text-slate-700">
                  {settings.teacher_credentials}
                </div>
              </div>
            </div>
          </section>
        );

      case 'courses':
        return (
          <section key="courses" id="courses" className="border-y border-slate-200 bg-white py-16">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                <div>
                  <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">
                    Featured Courses &amp; Curriculum
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600">
                    Organized by grade, unit, and subject. Preview free orientation lessons or unlock the complete syllabus.
                  </p>
                </div>

                {/* Filter bar */}
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search courses..."
                    className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                  <select
                    value={gradeFilter}
                    onChange={(e) => setGradeFilter(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-700 focus:outline-none"
                  >
                    {grades.map((g) => (
                      <option key={g} value={g}>
                        {g === 'All' ? 'All Grades' : g}
                      </option>
                    ))}
                  </select>
                  <select
                    value={subjectFilter}
                    onChange={(e) => setSubjectFilter(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-700 focus:outline-none"
                  >
                    {subjects.map((s) => (
                      <option key={s} value={s}>
                        {s === 'All' ? 'All Subjects' : s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {filteredCourses.length === 0 ? (
                <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-10 text-center">
                  <p className="text-sm font-medium text-slate-700">No courses matched your current filter.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setGradeFilter('All');
                      setSubjectFilter('All');
                      setSearchQuery('');
                    }}
                    className="mt-3 text-sm font-semibold text-blue-700 hover:underline"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="mt-10 grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3">
                  {filteredCourses.map((course) => (
                    <article
                      key={course.id}
                      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors hover:border-slate-300"
                    >
                      <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                        {course.thumbnail_url ? (
                          <img
                            src={course.thumbnail_url}
                            alt={course.title}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-slate-400">
                            <BookOpen className="h-10 w-10" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col p-6">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                          <span style={{ color: 'var(--brand-blue)' }}>{course.subject}</span>
                          <span aria-hidden="true">·</span>
                          <span>{course.grade}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{course.lesson_count || 0} Lessons</span>
                        </div>

                        <h3 className="font-display mt-2 text-lg font-bold tracking-tight text-slate-900">
                          {course.title}
                        </h3>
                        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-600">
                          {course.description}
                        </p>

                        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                          <span className="font-mono-num text-xs font-medium text-slate-500">
                            {course.total_minutes || 0} mins · {course.quiz_count || 0} quizzes
                          </span>
                          <button
                            type="button"
                            onClick={() => openCourse(course.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 whitespace-nowrap shrink-0"
                            style={{ backgroundColor: 'var(--brand-navy)' }}
                          >
                            <Play className="h-3.5 w-3.5" />
                            <span>Open Course</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        );

      case 'leaderboard':
        return (
          <section key="leaderboard" id="leaderboard" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">
                  Honor Roll Leaderboard
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Earn XP points by completing video lectures, passing timed quizzes, and unlocking academic milestone badges.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <Trophy className="h-4 w-4" style={{ color: 'var(--brand-gold)' }} />
                <span>+25 XP per Lesson · Up to +80 XP per Quiz</span>
              </div>
            </div>

            <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-5 py-3.5">Rank</th>
                    <th className="px-5 py-3.5">Student</th>
                    <th className="px-5 py-3.5">Level</th>
                    <th className="px-5 py-3.5 text-right">Lessons</th>
                    <th className="px-5 py-3.5 text-right">Avg Quiz</th>
                    <th className="px-5 py-3.5 text-right">Badges</th>
                    <th className="px-5 py-3.5 text-right">Total XP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {leaderboard.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/80">
                      <td className="font-mono-num px-5 py-3.5 font-bold text-slate-900">#{entry.rank}</td>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-900">{entry.full_name}</div>
                        <div className="text-xs text-slate-500">
                          {entry.grade}
                          {entry.school ? ` · ${entry.school}` : ''}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs font-medium text-slate-700">
                        Lv.{entry.level} · {entry.title}
                      </td>
                      <td className="font-mono-num px-5 py-3.5 text-right text-slate-700">
                        {entry.lessons_completed}
                      </td>
                      <td className="font-mono-num px-5 py-3.5 text-right text-slate-700">
                        {entry.avg_quiz_score}%
                      </td>
                      <td className="font-mono-num px-5 py-3.5 text-right text-slate-700">{entry.badges_count}</td>
                      <td className="font-mono-num px-5 py-3.5 text-right font-bold" style={{ color: 'var(--brand-blue)' }}>
                        {entry.xp_points} XP
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );

      case 'plans':
        return (
          <section
            key="plans"
            id="plans"
            className="border-y border-slate-200 py-16 text-white"
            style={{ backgroundColor: 'var(--brand-navy)' }}
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="max-w-2xl">
                <h2 className="font-display text-3xl font-bold tracking-tight text-white">
                  Flexible Subscription Plans
                </h2>
                <p className="mt-2 text-sm text-slate-300">
                  Choose Weekly, Monthly, 3-Month, 6-Month, or Annual access. Pay seamlessly via Vodafone Cash, InstaPay, or Bank Transfer.
                </p>
              </div>

              <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`flex flex-col rounded-xl border p-5 ${
                      plan.is_featured
                        ? 'border-amber-400/70 bg-white text-slate-900'
                        : 'border-white/15 bg-white/5 text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-medium">
                      <span className={plan.is_featured ? 'text-blue-700' : 'text-slate-300'}>{plan.billing_label}</span>
                      {Boolean(plan.is_featured) && (
                        <span className="font-semibold" style={{ color: 'var(--brand-gold)' }}>
                          Recommended
                        </span>
                      )}
                    </div>

                    <h3 className="font-display mt-2 text-lg font-bold tracking-tight">{plan.name}</h3>

                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="font-mono-num text-3xl font-extrabold">{plan.price_egp}</span>
                      <span className={`text-xs font-semibold ${plan.is_featured ? 'text-slate-500' : 'text-slate-300'}`}>
                        EGP
                      </span>
                    </div>

                    <p className={`mt-2 text-xs leading-relaxed ${plan.is_featured ? 'text-slate-600' : 'text-slate-300'}`}>
                      {plan.description}
                    </p>

                    <ul className="mt-5 flex-1 space-y-2 border-t border-current/10 pt-4 text-xs">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={() => openCheckout(plan.id)}
                      className={`mt-6 w-full rounded-lg px-4 py-2.5 text-xs font-semibold transition-opacity hover:opacity-90 whitespace-nowrap ${
                        plan.is_featured ? 'text-white' : 'bg-white text-slate-900'
                      }`}
                      style={plan.is_featured ? { backgroundColor: 'var(--brand-blue)' } : undefined}
                    >
                      Subscribe Now
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );

      case 'announcements':
        return (
          <section key="announcements" id="announcements" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">Latest Announcements</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Live schedule updates, workshop notices, and important exam circulars.
                </p>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
              {announcements.map((ann) => (
                <article key={ann.id} className="rounded-xl border border-slate-200 bg-white p-6">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <span>{ann.target_grade}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{new Date(ann.created_at).toLocaleDateString('en-EG')}</span>
                    {Boolean(ann.is_pinned) && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold" style={{ color: 'var(--brand-gold)' }}>
                          Pinned
                        </span>
                      </>
                    )}
                  </div>
                  <h3 className="font-display mt-2 text-lg font-bold text-slate-900">{ann.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{ann.body}</p>
                </article>
              ))}
            </div>
          </section>
        );

      case 'reviews':
        return (
          <section key="reviews" id="reviews" className="border-t border-slate-200 bg-white py-16">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="max-w-2xl">
                <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">
                  Student Reviews &amp; Outcomes
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Verified academic outcomes shared by students enrolled across Egypt.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
                {reviews.map((rev) => (
                  <article key={rev.id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-6">
                    <div>
                      <div className="flex items-center gap-1 text-amber-500" aria-label={`${rev.rating} out of 5 stars`}>
                        {Array.from({ length: rev.rating }).map((_, idx) => (
                          <Star key={idx} className="h-4 w-4 fill-current" />
                        ))}
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-slate-700">“{rev.comment}”</p>
                    </div>

                    <div className="mt-5 border-t border-slate-200 pt-4">
                      {rev.outcome_metric && (
                        <p className="text-xs font-semibold" style={{ color: 'var(--brand-blue)' }}>
                          {rev.outcome_metric}
                        </p>
                      )}
                      <p className="mt-1 text-sm font-bold text-slate-900">{rev.student_name}</p>
                      <p className="text-xs text-slate-500">{rev.student_grade}</p>
                    </div>
                  </article>
                ))}
              </div>

              {/* Interactive Review Submission */}
              <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
                <h3 className="font-display text-lg font-bold text-slate-900">Share Your Learning Experience</h3>
                <p className="mt-1 text-xs text-slate-600">
                  {user
                    ? `Posting as ${user.full_name} (${user.grade})`
                    : 'Sign in with your student account to publish a review.'}
                </p>
                <form onSubmit={handleReviewSubmit} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-12">
                  <div className="sm:col-span-3">
                    <label className="mb-1 block text-xs font-medium text-slate-700">Rating</label>
                    <select
                      value={reviewRating}
                      onChange={(e) => setReviewRating(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      <option value={5}>5 Stars</option>
                      <option value={4}>4 Stars</option>
                      <option value={3}>3 Stars</option>
                    </select>
                  </div>
                  <div className="sm:col-span-4">
                    <label className="mb-1 block text-xs font-medium text-slate-700">Outcome Achieved</label>
                    <input
                      type="text"
                      value={reviewMetric}
                      onChange={(e) => setReviewMetric(e.target.value)}
                      placeholder="e.g. 96% Midterm Score"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <label className="mb-1 block text-xs font-medium text-slate-700">Your Review</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Write your feedback..."
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      />
                      <button
                        type="submit"
                        disabled={reviewSending}
                        className="rounded-lg px-4 py-2 text-xs font-semibold text-white whitespace-nowrap shrink-0"
                        style={{ backgroundColor: 'var(--brand-navy)' }}
                      >
                        {reviewSending ? 'Posting...' : 'Post Review'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </section>
        );

      case 'contact':
        return (
          <section key="contact" id="contact" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">
                  Contact &amp; Academic Desk
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Have questions about course placement, subscription activation, or group schedules? Reach our team directly.
                </p>

                <div className="mt-8 space-y-4 text-sm text-slate-700">
                  <div className="flex items-start gap-3">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    <span>{settings.contact_phone}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    <span>{settings.contact_email}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    <span>{settings.contact_address}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    <span>{settings.contact_hours}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 lg:col-span-7">
                <form onSubmit={handleContactSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Your Name</label>
                    <input
                      type="text"
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Email Address</label>
                    <input
                      type="email"
                      required
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Phone / WhatsApp</label>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Subject</label>
                    <input
                      type="text"
                      value={contactSubject}
                      onChange={(e) => setContactSubject(e.target.value)}
                      placeholder="Course or Subscription inquiry"
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-700">Message</label>
                    <textarea
                      required
                      rows={4}
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={contactSending}
                      className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                      style={{ backgroundColor: 'var(--brand-navy)' }}
                    >
                      <Send className="h-4 w-4" />
                      <span>{contactSending ? 'Sending...' : 'Send Message'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <div>
      {sections.filter((s) => s.visible).map((s) => renderSection(s.id))}

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-10 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <div>
            <p className="font-display text-base font-bold text-slate-900">{settings.platform_name}</p>
            <p className="mt-1 text-xs text-slate-500">{settings.footer_credit}</p>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-slate-600">
            {pages.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openPage(p.slug)}
                className="hover:text-slate-900 hover:underline"
              >
                {p.title}
              </button>
            ))}
            <button
              type="button"
              onClick={() => document.getElementById('courses')?.scrollIntoView({ behavior: 'smooth' })}
              className="hover:text-slate-900 hover:underline"
            >
              Courses
            </button>
            <button
              type="button"
              onClick={() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' })}
              className="hover:text-slate-900 hover:underline"
            >
              Subscriptions
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
