import {
  ArrowLeft,
  Award,
  Bookmark,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Lock,
  PlayCircle,
  Send,
  Timer,
  Upload,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { apiFetch, withAuthUrl } from '../lib/api';
import type { Assignment, CourseSummary, Lesson, Quiz, QuizQuestion, QuizResult, Unit } from '../types/platform';

interface CoursePayload {
  course: CourseSummary;
  units: Unit[];
  quizzes: Quiz[];
  assignments: Assignment[];
}

function toEmbedUrl(url: string): string | null {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return null;
}

export function CourseWorkspace() {
  const { data, selectedCourseId, setActiveView, openCheckout, openAuthModal, showToast, refreshBootstrap } =
    usePlatform();

  const [courseData, setCourseData] = useState<CoursePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [activeTab, setActiveTab] = useState<'lesson' | 'quizzes' | 'assignments'>('lesson');

  // Quiz Runner state
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number | string>>({});
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [quizSubmitting, setQuizSubmitting] = useState(false);

  // Assignment submission state
  const [hwText, setHwText] = useState<Record<number, string>>({});
  const [hwFile, setHwFile] = useState<Record<number, File | null>>({});
  const [hwSubmitting, setHwSubmitting] = useState<number | null>(null);

  const loadCourse = useCallback(async () => {
    if (!selectedCourseId) return;
    setLoading(true);
    try {
      const res = await apiFetch<CoursePayload>(`/api/courses/${selectedCourseId}`);
      setCourseData(res);
      setSelectedLesson((prev) => {
        if (prev) {
          for (const u of res.units) {
            const match = u.lessons.find((l) => l.id === prev.id);
            if (match) return match;
          }
        }
        return res.units[0]?.lessons[0] || null;
      });
    } catch (err: any) {
      showToast(err?.message || 'Failed to load course.');
    } finally {
      setLoading(false);
    }
  }, [selectedCourseId, showToast]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse, data?.user?.id]);

  // Quiz countdown timer
  const handleSubmitQuiz = useCallback(async () => {
    if (!activeQuiz || quizSubmitting || quizResult) return;
    setQuizSubmitting(true);
    try {
      const res = await apiFetch<QuizResult>(`/api/quizzes/${activeQuiz.id}/attempt`, {
        method: 'POST',
        body: JSON.stringify({ answers: quizAnswers }),
      });
      setQuizResult(res);
      await refreshBootstrap();
      if (res.xp_awarded > 0) {
        showToast(`Quiz graded: ${res.percentage}% (+${res.xp_awarded} XP)`);
      }
      if (res.newly_unlocked_badges?.length > 0) {
        showToast(`Unlocked badge: ${res.newly_unlocked_badges.map((b) => b.title).join(', ')}`);
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not submit quiz.');
    } finally {
      setQuizSubmitting(false);
    }
  }, [activeQuiz, quizAnswers, quizResult, quizSubmitting, refreshBootstrap, showToast]);

  useEffect(() => {
    if (!activeQuiz || quizResult || secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          handleSubmitQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeQuiz, quizResult, secondsLeft, handleSubmitQuiz]);

  const startQuiz = async (quizId: number) => {
    if (!data?.user) {
      openAuthModal('login');
      showToast('Please sign in to take online quizzes and save your score.');
      return;
    }
    try {
      const res = await apiFetch<{ quiz: Quiz; questions: QuizQuestion[] }>(`/api/quizzes/${quizId}`);
      setActiveQuiz(res.quiz);
      setQuizQuestions(res.questions);
      setQuizAnswers({});
      setQuizResult(null);
      setSecondsLeft((res.quiz.time_limit_minutes || 15) * 60);
    } catch (err: any) {
      showToast(err?.message || 'Unable to start quiz.');
    }
  };

  const handleMarkComplete = async (lesson: Lesson) => {
    if (!data?.user) {
      openAuthModal('login');
      return;
    }
    try {
      const res = await apiFetch<{ awarded: number; newlyUnlockedBadges: Array<{ title: string }> }>(
        `/api/lessons/${lesson.id}/progress`,
        {
          method: 'POST',
          body: JSON.stringify({ completed: true, watch_percent: 100 }),
        },
      );
      await loadCourse();
      await refreshBootstrap();
      if (res.awarded > 0) {
        showToast(`Lesson marked complete (+${res.awarded} XP)`);
      } else {
        showToast('Lesson marked complete.');
      }
      if (res.newlyUnlockedBadges?.length > 0) {
        showToast(`Milestone unlocked: ${res.newlyUnlockedBadges.map((b) => b.title).join(', ')}`);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to update progress.');
    }
  };

  const handleToggleSave = async (lesson: Lesson) => {
    if (!data?.user) {
      openAuthModal('login');
      return;
    }
    try {
      const res = await apiFetch<{ saved: boolean }>(`/api/lessons/${lesson.id}/save`, { method: 'POST' });
      await loadCourse();
      showToast(res.saved ? 'Lesson saved to your study list.' : 'Removed from saved lessons.');
    } catch (err: any) {
      showToast(err?.message || 'Failed to toggle bookmark.');
    }
  };

  const handleAssignmentSubmit = async (e: React.FormEvent, assignmentId: number) => {
    e.preventDefault();
    if (!data?.user) {
      openAuthModal('login');
      return;
    }
    setHwSubmitting(assignmentId);
    try {
      const form = new FormData();
      form.append('answer_text', hwText[assignmentId] || '');
      if (hwFile[assignmentId]) form.append('file', hwFile[assignmentId]!);
      const res = await apiFetch<{ awarded: number; newlyUnlockedBadges: Array<{ title: string }> }>(
        `/api/assignments/${assignmentId}/submit`,
        { method: 'POST', body: form },
      );
      await loadCourse();
      await refreshBootstrap();
      showToast(res.awarded > 0 ? `Homework submitted (+${res.awarded} XP)` : 'Homework submitted.');
    } catch (err: any) {
      showToast(err?.message || 'Failed to submit assignment.');
    } finally {
      setHwSubmitting(null);
    }
  };

  if (loading || !courseData) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  const { course, units, quizzes, assignments } = courseData;
  const embedSrc = selectedLesson?.video_url ? toEmbedUrl(selectedLesson.video_url) : null;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Course Breadcrumb Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <button
            type="button"
            onClick={() => setActiveView('home')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Courses</span>
          </button>
          <h1 className="font-display mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {course.title}
          </h1>
          <p className="mt-1 text-xs font-medium text-slate-500">
            {course.subject} · {course.grade} · {units.length} Units
          </p>
        </div>

        {/* Workspace Tab Switcher */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('lesson')}
            className={`rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'lesson' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Video &amp; Materials
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quizzes')}
            className={`rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'quizzes' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Online Quizzes ({quizzes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('assignments')}
            className={`rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'assignments' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Homework ({assignments.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Syllabus Column */}
        <aside className="lg:col-span-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-display text-sm font-bold text-slate-900">Course Curriculum</h2>
            <div className="mt-4 space-y-5">
              {units.map((unit) => (
                <div key={unit.id}>
                  <h3 className="text-xs font-bold text-slate-700">{unit.title}</h3>
                  <div className="mt-2 space-y-1.5">
                    {unit.lessons.map((lesson) => {
                      const isActive = selectedLesson?.id === lesson.id && activeTab === 'lesson';
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          onClick={() => {
                            setSelectedLesson(lesson);
                            setActiveTab('lesson');
                          }}
                          className={`flex w-full items-start justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                            isActive
                              ? 'border-blue-700 bg-blue-50/70 text-slate-900'
                              : 'border-slate-100 bg-slate-50/50 text-slate-700 hover:bg-slate-100/70'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            {lesson.completed ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            ) : lesson.has_access ? (
                              <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                            ) : (
                              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold leading-snug">{lesson.title}</p>
                              <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                                {lesson.duration_minutes} mins ·{' '}
                                {lesson.access_type === 'free'
                                  ? 'Free Preview'
                                  : lesson.has_access
                                    ? 'Unlocked'
                                    : 'Subscription'}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Interactive Stage */}
        <main className="lg:col-span-8">
          {activeTab === 'lesson' && selectedLesson && (
            <div className="space-y-6">
              {/* Video Player Container */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
                {selectedLesson.has_access ? (
                  selectedLesson.video_url ? (
                    embedSrc ? (
                      <iframe
                        src={embedSrc}
                        title={selectedLesson.title}
                        className="aspect-video w-full"
                        allowFullScreen
                      />
                    ) : (
                      <video
                        key={selectedLesson.id}
                        controls
                        controlsList="nodownload"
                        className="aspect-video w-full bg-black"
                        src={
                          selectedLesson.video_type === 'upload'
                            ? withAuthUrl(selectedLesson.video_url)
                            : selectedLesson.video_url
                        }
                      />
                    )
                  ) : (
                    <div className="flex aspect-video items-center justify-center text-sm text-slate-300">
                      Video recording will appear here once uploaded by the instructor.
                    </div>
                  )
                ) : (
                  <div className="flex aspect-video flex-col items-center justify-center p-8 text-center text-white">
                    <Lock className="h-10 w-10 text-amber-400" />
                    <h3 className="font-display mt-4 text-xl font-bold">Subscription Required</h3>
                    <p className="mt-2 max-w-md text-sm text-slate-300">
                      This lesson and its downloadable PDF summary are reserved for active subscribers or students granted access.
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => openCheckout()}
                        className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
                        style={{ backgroundColor: 'var(--brand-blue)' }}
                      >
                        Activate Subscription
                      </button>
                      {!data?.user && (
                        <button
                          type="button"
                          onClick={() => openAuthModal('login')}
                          className="rounded-lg border border-white/25 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
                        >
                          Sign In
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Lesson Details & Actions */}
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="tabular-nums">{selectedLesson.duration_minutes} minutes</span>
                      <span aria-hidden="true">·</span>
                      <span>{selectedLesson.completed ? 'Completed' : 'In Progress'}</span>
                    </div>
                    <h2 className="font-display mt-2 text-xl font-bold text-slate-900">{selectedLesson.title}</h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleToggleSave(selectedLesson)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors ${
                        selectedLesson.is_saved
                          ? 'border-amber-400 bg-amber-50 text-amber-900'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                      <span>{selectedLesson.is_saved ? 'Saved' : 'Save Lesson'}</span>
                    </button>

                    {selectedLesson.has_access && (
                      <button
                        type="button"
                        onClick={() => handleMarkComplete(selectedLesson)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white ${
                          selectedLesson.completed ? 'bg-emerald-600' : ''
                        }`}
                        style={!selectedLesson.completed ? { backgroundColor: 'var(--brand-navy)' } : undefined}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{selectedLesson.completed ? 'Completed' : 'Mark Completed (+25 XP)'}</span>
                      </button>
                    )}
                  </div>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-slate-600">{selectedLesson.description}</p>

                {/* Downloadable Study Materials */}
                <div className="mt-6 border-t border-slate-200 pt-5">
                  <h3 className="text-sm font-bold text-slate-900">PDF Summaries &amp; Study Materials</h3>
                  {selectedLesson.materials && selectedLesson.materials.length > 0 ? (
                    <div className="mt-3 space-y-2.5">
                      {selectedLesson.materials.map((mat) => (
                        <div
                          key={mat.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className="h-4 w-4 shrink-0 text-blue-700" />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-slate-900">{mat.title}</p>
                              <p className="text-[11px] text-slate-500">
                                {mat.material_type.replace('_', ' ')} · {mat.file_size}
                              </p>
                            </div>
                          </div>

                          {selectedLesson.has_access ? (
                            <a
                              href={withAuthUrl(`/api/media/material/${mat.id}`)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0"
                            >
                              <Download className="h-3.5 w-3.5" />
                              <span>Download</span>
                            </a>
                          ) : (
                            <span className="text-xs font-medium text-slate-400">Locked</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">No downloadable materials attached to this lesson yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Interactive Multi-Format Timed Quiz System */}
          {activeTab === 'quizzes' && (
            <div className="space-y-6">
              {!activeQuiz ? (
                <div className="space-y-4">
                  {quizzes.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
                      No quizzes published for this course yet.
                    </div>
                  ) : (
                    quizzes.map((q) => (
                      <div
                        key={q.id}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6"
                      >
                        <div>
                          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                            <span className="tabular-nums">{q.question_count || 0} Questions</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{q.time_limit_minutes} Min Timer</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">Pass {q.passing_score}%</span>
                            {Boolean(q.randomize_questions) && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>Randomized Order</span>
                              </>
                            )}
                          </div>
                          <h3 className="font-display mt-1.5 text-lg font-bold text-slate-900">{q.title}</h3>
                          <p className="mt-1 text-sm text-slate-600">{q.description}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => startQuiz(q.id)}
                          className="rounded-lg px-4 py-2.5 text-xs font-semibold text-white whitespace-nowrap shrink-0"
                          style={{ backgroundColor: 'var(--brand-blue)' }}
                        >
                          Start Timed Quiz
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <h2 className="font-display text-xl font-bold text-slate-900">{activeQuiz.title}</h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Pass threshold: {activeQuiz.passing_score}% · Automatic grading with instant feedback
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {!quizResult && (
                        <div
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono-num text-sm font-bold ${
                            secondsLeft < 60
                              ? 'border-red-300 bg-red-50 text-red-700'
                              : 'border-slate-200 bg-slate-50 text-slate-900'
                          }`}
                        >
                          <Timer className="h-4 w-4" />
                          <span>
                            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setActiveQuiz(null)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Exit Quiz
                      </button>
                    </div>
                  </div>

                  {!quizResult ? (
                    <div className="mt-6 space-y-6">
                      {quizQuestions.map((question, qIdx) => (
                        <div key={question.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-5">
                          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                            <span>
                              Question {qIdx + 1} of {quizQuestions.length}
                            </span>
                            <span>
                              {question.question_type === 'true_false'
                                ? 'True / False'
                                : question.question_type === 'short_answer'
                                  ? 'Short Answer'
                                  : 'Multiple Choice'}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-slate-900">{question.question_text}</p>

                          {question.question_type === 'short_answer' ? (
                            <input
                              type="text"
                              value={String(quizAnswers[question.id] ?? '')}
                              onChange={(e) =>
                                setQuizAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                              }
                              placeholder="Type your final numerical or text answer..."
                              className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                            />
                          ) : (
                            <div className="mt-3 space-y-2">
                              {question.options.map((opt, optIdx) => {
                                const selected = quizAnswers[question.id] === optIdx;
                                return (
                                  <button
                                    key={optIdx}
                                    type="button"
                                    onClick={() =>
                                      setQuizAnswers((prev) => ({ ...prev, [question.id]: optIdx }))
                                    }
                                    className={`flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                                      selected
                                        ? 'border-blue-700 bg-blue-50 font-semibold text-blue-950'
                                        : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                                    }`}
                                  >
                                    <span
                                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                                        selected
                                          ? 'border-blue-700 bg-blue-700 text-white'
                                          : 'border-slate-300 text-slate-500'
                                      }`}
                                    >
                                      {String.fromCharCode(65 + optIdx)}
                                    </span>
                                    <span>{opt}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={handleSubmitQuiz}
                        disabled={quizSubmitting}
                        className="w-full rounded-lg px-5 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                        style={{ backgroundColor: 'var(--brand-navy)' }}
                      >
                        {quizSubmitting ? 'Grading Exam...' : 'Submit & Grade Quiz'}
                      </button>
                    </div>
                  ) : (
                    /* Immediate Feedback Breakdown */
                    <div className="mt-6 space-y-6">
                      <div
                        className={`rounded-xl border p-6 ${
                          quizResult.passed
                            ? 'border-emerald-200 bg-emerald-50/70'
                            : 'border-amber-200 bg-amber-50/70'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                              {quizResult.passed ? 'Passed Assessment' : 'Needs Review'}
                            </p>
                            <h3 className="font-display mt-1 text-3xl font-extrabold text-slate-900 tabular-nums">
                              {quizResult.score} / {quizResult.total_questions} ({quizResult.percentage}%)
                            </h3>
                          </div>
                          {quizResult.xp_awarded > 0 && (
                            <div className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-blue-800 shadow-xs">
                              <Award className="h-4 w-4 text-amber-500" />
                              <span className="tabular-nums">+{quizResult.xp_awarded} XP Earned</span>
                            </div>
                          )}
                        </div>
                        {quizResult.newly_unlocked_badges?.length > 0 && (
                          <p className="mt-3 text-xs font-semibold text-emerald-800">
                            New Milestone Badges Unlocked:{' '}
                            {quizResult.newly_unlocked_badges.map((b) => b.title).join(', ')}
                          </p>
                        )}
                      </div>

                      <div className="space-y-4">
                        {quizResult.feedback.map((item, idx) => (
                          <div
                            key={item.question_id}
                            className={`rounded-lg border p-5 ${
                              item.is_correct ? 'border-emerald-200 bg-white' : 'border-red-200 bg-red-50/30'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs font-semibold">
                              <span className="text-slate-500">Question {idx + 1}</span>
                              <span className={item.is_correct ? 'text-emerald-700' : 'text-red-700'}>
                                {item.is_correct ? 'Correct' : 'Incorrect'}
                              </span>
                            </div>
                            <p className="mt-1.5 text-sm font-semibold text-slate-900">{item.question_text}</p>
                            <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                              <div className="rounded-md bg-slate-50 px-3 py-2">
                                <span className="text-slate-500">Your Answer: </span>
                                <span className="font-semibold text-slate-900">{item.student_answer}</span>
                              </div>
                              <div className="rounded-md bg-emerald-50/60 px-3 py-2">
                                <span className="text-slate-500">Correct Answer: </span>
                                <span className="font-semibold text-emerald-800">{item.correct_answer}</span>
                              </div>
                            </div>
                            {item.explanation && (
                              <p className="mt-3 text-xs leading-relaxed text-slate-600">
                                <strong className="text-slate-800">Explanation:</strong> {item.explanation}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => startQuiz(activeQuiz.id)}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Retake Quiz
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Homework & Assignments Tab */}
          {activeTab === 'assignments' && (
            <div className="space-y-5">
              {assignments.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
                  No homework assignments posted for this course yet.
                </div>
              ) : (
                assignments.map((assign) => (
                  <div key={assign.id} className="rounded-xl border border-slate-200 bg-white p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span>Max Score: {assign.max_score} pts</span>
                      {assign.due_date && <span>Due: {assign.due_date}</span>}
                    </div>
                    <h3 className="font-display mt-1.5 text-lg font-bold text-slate-900">{assign.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{assign.instructions}</p>

                    {assign.my_submission && (
                      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
                        <div className="flex items-center justify-between font-semibold text-slate-800">
                          <span>
                            Latest Submission ·{' '}
                            {assign.my_submission.status === 'graded' ? 'Graded' : 'Awaiting Instructor Review'}
                          </span>
                          {assign.my_submission.score !== null && (
                            <span className="font-mono-num text-emerald-700">
                              Score: {assign.my_submission.score} / {assign.max_score}
                            </span>
                          )}
                        </div>
                        {assign.my_submission.answer_text && (
                          <p className="mt-2 text-slate-600">{assign.my_submission.answer_text}</p>
                        )}
                        {assign.my_submission.feedback && (
                          <p className="mt-2 rounded bg-white p-2.5 text-slate-700">
                            <strong>Instructor Feedback:</strong> {assign.my_submission.feedback}
                          </p>
                        )}
                      </div>
                    )}

                    <form onSubmit={(e) => handleAssignmentSubmit(e, assign.id)} className="mt-5 space-y-3">
                      <textarea
                        rows={3}
                        value={hwText[assign.id] || ''}
                        onChange={(e) => setHwText((prev) => ({ ...prev, [assign.id]: e.target.value }))}
                        placeholder="Write your solutions or notes here..."
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100">
                          <Upload className="h-3.5 w-3.5" />
                          <span>{hwFile[assign.id] ? hwFile[assign.id]!.name : 'Attach PDF / Image'}</span>
                          <input
                            type="file"
                            accept=".pdf,image/*,.doc,.docx"
                            className="hidden"
                            onChange={(e) =>
                              setHwFile((prev) => ({ ...prev, [assign.id]: e.target.files?.[0] || null }))
                            }
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={hwSubmitting === assign.id}
                          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white"
                          style={{ backgroundColor: 'var(--brand-navy)' }}
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>{hwSubmitting === assign.id ? 'Submitting...' : 'Submit Homework (+20 XP)'}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
