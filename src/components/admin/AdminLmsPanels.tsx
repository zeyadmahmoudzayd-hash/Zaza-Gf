import { Plus, Trash2, Upload } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import { apiFetch } from '../../lib/api';

export function CoursesManagerPanel() {
  const { refreshBootstrap, showToast } = usePlatform();
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number>(0);

  // New Course form
  const [cTitle, setCTitle] = useState('');
  const [cSubject, setCSubject] = useState('Mathematics');
  const [cGrade, setCGrade] = useState('Grade 12');
  const [cDesc, setCDesc] = useState('');
  const [cThumb, setCThumb] = useState('/assets/images/course_mathematics_1794731929565.jpg');

  // New Unit form
  const [uTitle, setUTitle] = useState('');
  const [uDesc, setUDesc] = useState('');

  // New Lesson form
  const [lUnitId, setLUnitId] = useState<number>(0);
  const [lTitle, setLTitle] = useState('');
  const [lDesc, setLDesc] = useState('');
  const [lDuration, setLDuration] = useState(35);
  const [lAccess, setLAccess] = useState<'free' | 'subscription' | 'restricted'>('subscription');
  const [lVideoUrl, setLVideoUrl] = useState('');
  const [lVideoFile, setLVideoFile] = useState<File | null>(null);

  // New Material form
  const [mLessonId, setMLessonId] = useState<number>(0);
  const [mTitle, setMTitle] = useState('');
  const [mType, setMType] = useState('summary_pdf');
  const [mFile, setMFile] = useState<File | null>(null);

  const loadCourses = async () => {
    const res = await apiFetch<{ courses: any[] }>('/api/admin/courses');
    setCourses(res.courses);
    if (res.courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(res.courses[0].id);
      setLUnitId(res.courses[0].units?.[0]?.id || 0);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const activeCourse = courses.find((c) => c.id === selectedCourseId) || courses[0];

  const handleUploadThumb = async (file: File | undefined) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const res = await apiFetch<{ url: string }>('/api/admin/upload/branding', { method: 'POST', body: fd });
    setCThumb(res.url);
    showToast('Course thumbnail uploaded.');
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiFetch<{ id: number }>('/api/admin/courses', {
      method: 'POST',
      body: JSON.stringify({
        title: cTitle,
        subject: cSubject,
        grade: cGrade,
        description: cDesc,
        thumbnail_url: cThumb,
        is_featured: true,
        is_published: true,
      }),
    });
    setCTitle('');
    setCDesc('');
    await loadCourses();
    setSelectedCourseId(res.id);
    await refreshBootstrap();
    showToast('Course created.');
  };

  const handleDeleteCourse = async (id: number) => {
    await apiFetch(`/api/admin/courses/${id}`, { method: 'DELETE' });
    await loadCourses();
    await refreshBootstrap();
    showToast('Course deleted.');
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCourse) return;
    const res = await apiFetch<{ id: number }>('/api/admin/units', {
      method: 'POST',
      body: JSON.stringify({
        course_id: activeCourse.id,
        title: uTitle,
        description: uDesc,
        sort_order: (activeCourse.units?.length || 0) + 1,
      }),
    });
    setUTitle('');
    setUDesc('');
    setLUnitId(res.id);
    await loadCourses();
    showToast('Unit added.');
  };

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCourse || !lUnitId) return;
    const fd = new FormData();
    fd.append('course_id', String(activeCourse.id));
    fd.append('unit_id', String(lUnitId));
    fd.append('title', lTitle);
    fd.append('description', lDesc);
    fd.append('duration_minutes', String(lDuration));
    fd.append('access_type', lAccess);
    fd.append('video_url', lVideoUrl);
    if (lVideoFile) fd.append('video_file', lVideoFile);

    await apiFetch('/api/admin/lessons', { method: 'POST', body: fd });
    setLTitle('');
    setLDesc('');
    setLVideoUrl('');
    setLVideoFile(null);
    await loadCourses();
    await refreshBootstrap();
    showToast('Lesson published.');
  };

  const handleDeleteLesson = async (id: number) => {
    await apiFetch(`/api/admin/lessons/${id}`, { method: 'DELETE' });
    await loadCourses();
    await refreshBootstrap();
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mLessonId || !mFile) {
      showToast('Select a lesson and choose a PDF/document file.');
      return;
    }
    const fd = new FormData();
    fd.append('lesson_id', String(mLessonId));
    fd.append('title', mTitle);
    fd.append('material_type', mType);
    fd.append('file', mFile);
    await apiFetch('/api/admin/materials', { method: 'POST', body: fd });
    setMTitle('');
    setMFile(null);
    await loadCourses();
    showToast('Study material uploaded.');
  };

  const allCourseLessons = activeCourse?.units?.flatMap((u: any) => u.lessons || []) || [];

  return (
    <div className="space-y-8">
      {/* Create Course */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">Create New Course</h2>
        <form onSubmit={handleAddCourse} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <input
            type="text"
            required
            value={cTitle}
            onChange={(e) => setCTitle(e.target.value)}
            placeholder="Course Title"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            required
            value={cSubject}
            onChange={(e) => setCSubject(e.target.value)}
            placeholder="Subject (e.g. Physics)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={cGrade}
            onChange={(e) => setCGrade(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="Grade 10">Grade 10</option>
            <option value="Grade 11">Grade 11</option>
            <option value="Grade 12">Grade 12</option>
            <option value="University Prep">University Prep</option>
          </select>
          <textarea
            rows={2}
            value={cDesc}
            onChange={(e) => setCDesc(e.target.value)}
            placeholder="Course overview description..."
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
              <Upload className="h-3.5 w-3.5" />
              <span>Thumbnail</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleUploadThumb(e.target.files?.[0])}
              />
            </label>
            <button
              type="submit"
              className="flex-1 rounded-lg px-4 py-2 text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--brand-navy)' }}
            >
              Add Course
            </button>
          </div>
        </form>
      </div>

      {/* Manage Units, Lessons & Materials for Selected Course */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {courses.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelectedCourseId(c.id);
                  setLUnitId(c.units?.[0]?.id || 0);
                  setMLessonId(c.units?.[0]?.lessons?.[0]?.id || 0);
                }}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold ${
                  c.id === activeCourse?.id ? 'text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                style={c.id === activeCourse?.id ? { backgroundColor: 'var(--brand-blue)' } : undefined}
              >
                {c.title}
              </button>
            ))}
          </div>
          {activeCourse && (
            <button
              type="button"
              onClick={() => handleDeleteCourse(activeCourse.id)}
              className="text-xs font-semibold text-red-600 hover:underline"
            >
              Delete Course
            </button>
          )}
        </div>

        {activeCourse && (
          <div className="mt-6 space-y-6">
            {/* Existing Units & Lessons Tree */}
            <div className="space-y-4">
              {activeCourse.units?.map((u: any) => (
                <div key={u.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                  <h3 className="text-sm font-bold text-slate-900">{u.title}</h3>
                  <div className="mt-3 space-y-2">
                    {u.lessons?.map((l: any) => (
                      <div
                        key={l.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-slate-900">{l.title}</span>
                          <span className="ml-2 text-slate-500">
                            {l.duration_minutes}m · {l.access_type} · {l.materials?.length || 0} PDFs
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteLesson(l.id)}
                          className="rounded p-1 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Add Unit + Add Lesson + Upload PDF */}
            <div className="grid grid-cols-1 gap-6 border-t border-slate-200 pt-6 lg:grid-cols-2">
              <form onSubmit={handleAddUnit} className="space-y-3 rounded-lg border border-slate-200 p-4">
                <h4 className="text-sm font-bold text-slate-900">Add New Unit</h4>
                <input
                  type="text"
                  required
                  value={uTitle}
                  onChange={(e) => setUTitle(e.target.value)}
                  placeholder="Unit Title (e.g. Unit 3: Thermodynamics)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={uDesc}
                  onChange={(e) => setUDesc(e.target.value)}
                  placeholder="Short unit description"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white"
                  style={{ backgroundColor: 'var(--brand-navy)' }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Unit</span>
                </button>
              </form>

              <form onSubmit={handleAddMaterial} className="space-y-3 rounded-lg border border-slate-200 p-4">
                <h4 className="text-sm font-bold text-slate-900">Upload PDF Summary / Study Material</h4>
                <select
                  required
                  value={mLessonId}
                  onChange={(e) => setMLessonId(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value={0}>Select Lesson...</option>
                  {allCourseLessons.map((l: any) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={mTitle}
                    onChange={(e) => setMTitle(e.target.value)}
                    placeholder="Material Title"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <select
                    value={mType}
                    onChange={(e) => setMType(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="summary_pdf">Summary PDF</option>
                    <option value="worksheet">Practice Worksheet</option>
                    <option value="slides">Lecture Slides</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                    <Upload className="h-3.5 w-3.5" />
                    <span>{mFile ? mFile.name : 'Choose PDF / File'}</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => setMFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-lg px-4 py-2 text-xs font-semibold text-white"
                    style={{ backgroundColor: 'var(--brand-blue)' }}
                  >
                    Upload Material
                  </button>
                </div>
              </form>
            </div>

            <form onSubmit={handleAddLesson} className="space-y-3 rounded-lg border border-slate-200 p-4">
              <h4 className="text-sm font-bold text-slate-900">Add Video Lesson</h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <select
                  required
                  value={lUnitId}
                  onChange={(e) => setLUnitId(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value={0}>Select Unit...</option>
                  {activeCourse.units?.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.title}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  value={lTitle}
                  onChange={(e) => setLTitle(e.target.value)}
                  placeholder="Lesson Title"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <select
                  value={lAccess}
                  onChange={(e) => setLAccess(e.target.value as any)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="free">Free Preview</option>
                  <option value="subscription">Paid Subscription</option>
                  <option value="restricted">Explicit Student Grant Only</option>
                </select>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  value={lVideoUrl}
                  onChange={(e) => setLVideoUrl(e.target.value)}
                  placeholder="Video URL (MP4 / YouTube / Vimeo)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
                />
                <input
                  type="number"
                  min={1}
                  value={lDuration}
                  onChange={(e) => setLDuration(Number(e.target.value))}
                  placeholder="Minutes"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <textarea
                rows={2}
                value={lDesc}
                onChange={(e) => setLDesc(e.target.value)}
                placeholder="Lesson overview..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                  <Upload className="h-3.5 w-3.5" />
                  <span>{lVideoFile ? lVideoFile.name : 'Or Upload MP4/WebM Video File'}</span>
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => setLVideoFile(e.target.files?.[0] || null)}
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-white"
                  style={{ backgroundColor: 'var(--brand-navy)' }}
                >
                  Publish Lesson
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export function QuizzesAssignmentsPanel() {
  const { data, showToast, refreshBootstrap } = usePlatform();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);

  // Create Quiz form
  const [qCourseId, setQCourseId] = useState<number>(data?.courses?.[0]?.id || 1);
  const [qTitle, setQTitle] = useState('');
  const [qDesc, setQDesc] = useState('');
  const [qTime, setQTime] = useState(15);
  const [qPass, setQPass] = useState(60);
  const [qRandom, setQRandom] = useState(true);

  // Add Question form
  const [targetQuizId, setTargetQuizId] = useState<number>(0);
  const [qType, setQType] = useState<'multiple_choice' | 'true_false' | 'short_answer'>('multiple_choice');
  const [qText, setQText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctIdx, setCorrectIdx] = useState(0);
  const [acceptedAns, setAcceptedAns] = useState('');
  const [explanation, setExplanation] = useState('');

  // Create Assignment form
  const [aCourseId, setACourseId] = useState<number>(data?.courses?.[0]?.id || 1);
  const [aTitle, setATitle] = useState('');
  const [aInst, setAInst] = useState('');
  const [aDue, setADue] = useState('2026-12-01');
  const [aMax, setAMax] = useState(20);

  // Grading state
  const [gradeScore, setGradeScore] = useState<Record<number, number>>({});
  const [gradeFeedback, setGradeFeedback] = useState<Record<number, string>>({});

  const loadAll = async () => {
    const [qRes, aRes] = await Promise.all([
      apiFetch<{ quizzes: any[] }>('/api/admin/quizzes'),
      apiFetch<{ assignments: any[]; submissions: any[] }>('/api/admin/assignments'),
    ]);
    setQuizzes(qRes.quizzes);
    setAssignments(aRes.assignments);
    setSubmissions(aRes.submissions);
    if (qRes.quizzes.length > 0 && !targetQuizId) {
      setTargetQuizId(qRes.quizzes[0].id);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiFetch<{ id: number }>('/api/admin/quizzes', {
      method: 'POST',
      body: JSON.stringify({
        course_id: qCourseId,
        title: qTitle,
        description: qDesc,
        time_limit_minutes: qTime,
        passing_score: qPass,
        randomize_questions: qRandom,
      }),
    });
    setQTitle('');
    setQDesc('');
    setTargetQuizId(res.id);
    await loadAll();
    await refreshBootstrap();
    showToast('Quiz created. Now add questions below.');
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetQuizId) return;
    await apiFetch(`/api/admin/quizzes/${targetQuizId}/questions`, {
      method: 'POST',
      body: JSON.stringify({
        question_type: qType,
        question_text: qText,
        options: qType === 'multiple_choice' ? [optA, optB, optC, optD] : undefined,
        correct_index: correctIdx,
        accepted_answer: acceptedAns,
        explanation,
      }),
    });
    setQText('');
    setOptA('');
    setOptB('');
    setOptC('');
    setOptD('');
    setAcceptedAns('');
    setExplanation('');
    await loadAll();
    showToast('Question added to quiz.');
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/assignments', {
      method: 'POST',
      body: JSON.stringify({
        course_id: aCourseId,
        title: aTitle,
        instructions: aInst,
        due_date: aDue,
        max_score: aMax,
      }),
    });
    setATitle('');
    setAInst('');
    await loadAll();
    showToast('Homework assignment posted.');
  };

  const handleGrade = async (subId: number) => {
    await apiFetch(`/api/admin/submissions/${subId}/grade`, {
      method: 'POST',
      body: JSON.stringify({
        score: gradeScore[subId] ?? 0,
        feedback: gradeFeedback[subId] || 'Reviewed by instructor.',
      }),
    });
    await loadAll();
    showToast('Homework graded.');
  };

  return (
    <div className="space-y-8">
      {/* Quiz Builder */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">Create Interactive Online Quiz</h2>
        <form onSubmit={handleCreateQuiz} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select
            value={qCourseId}
            onChange={(e) => setQCourseId(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {data?.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <input
            type="text"
            required
            value={qTitle}
            onChange={(e) => setQTitle(e.target.value)}
            placeholder="Quiz Title"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            type="text"
            value={qDesc}
            onChange={(e) => setQDesc(e.target.value)}
            placeholder="Quiz instructions / description"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-3"
          />
          <div>
            <label className="mb-1 block text-xs text-slate-600">Time Limit (Minutes)</label>
            <input
              type="number"
              min={1}
              value={qTime}
              onChange={(e) => setQTime(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">Passing Score (%)</label>
            <input
              type="number"
              min={1}
              max={100}
              value={qPass}
              onChange={(e) => setQPass(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end justify-between gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={qRandom}
                onChange={(e) => setQRandom(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span>Randomize Question Order</span>
            </label>
            <button
              type="submit"
              className="rounded-lg px-4 py-2 text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--brand-navy)' }}
            >
              Create Quiz
            </button>
          </div>
        </form>

        {/* Add Multi-Format Questions */}
        <form onSubmit={handleAddQuestion} className="mt-6 space-y-3 border-t border-slate-200 pt-5">
          <h3 className="text-sm font-bold text-slate-900">Add Question (Multiple Choice, True/False, or Short Answer)</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select
              value={targetQuizId}
              onChange={(e) => setTargetQuizId(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title} ({q.questions?.length || 0} Qs)
                </option>
              ))}
            </select>
            <select
              value={qType}
              onChange={(e) => setQType(e.target.value as any)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="multiple_choice">Multiple Choice (4 Options)</option>
              <option value="true_false">True / False</option>
              <option value="short_answer">Short Answer (Exact/Comma-Separated)</option>
            </select>
          </div>
          <input
            type="text"
            required
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="Question prompt..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />

          {qType === 'multiple_choice' && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                required
                value={optA}
                onChange={(e) => setOptA(e.target.value)}
                placeholder="Option A"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                required
                value={optB}
                onChange={(e) => setOptB(e.target.value)}
                placeholder="Option B"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                required
                value={optC}
                onChange={(e) => setOptC(e.target.value)}
                placeholder="Option C"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                required
                value={optD}
                onChange={(e) => setOptD(e.target.value)}
                placeholder="Option D"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={correctIdx}
                onChange={(e) => setCorrectIdx(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:col-span-2"
              >
                <option value={0}>Correct Option: A</option>
                <option value={1}>Correct Option: B</option>
                <option value={2}>Correct Option: C</option>
                <option value={3}>Correct Option: D</option>
              </select>
            </div>
          )}

          {qType === 'true_false' && (
            <select
              value={correctIdx}
              onChange={(e) => setCorrectIdx(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value={0}>Correct Answer: True</option>
              <option value={1}>Correct Answer: False</option>
            </select>
          )}

          {qType === 'short_answer' && (
            <input
              type="text"
              required
              value={acceptedAns}
              onChange={(e) => setAcceptedAns(e.target.value)}
              placeholder="Accepted answer(s), comma-separated (e.g. 6, 6.0)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          )}

          <input
            type="text"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Immediate feedback explanation shown after student submits..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />

          <button
            type="submit"
            className="rounded-lg px-4 py-2 text-xs font-semibold text-white"
            style={{ backgroundColor: 'var(--brand-blue)' }}
          >
            Add Question to Quiz
          </button>
        </form>
      </div>

      {/* Homework Assignments & Grading */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">Homework Assignments &amp; Student Grading</h2>
        <form onSubmit={handleCreateAssignment} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select
            value={aCourseId}
            onChange={(e) => setACourseId(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {data?.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <input
            type="text"
            required
            value={aTitle}
            onChange={(e) => setATitle(e.target.value)}
            placeholder="Assignment Title"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={aDue}
              onChange={(e) => setADue(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={1}
              value={aMax}
              onChange={(e) => setAMax(Number(e.target.value))}
              className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <textarea
            rows={2}
            required
            value={aInst}
            onChange={(e) => setAInst(e.target.value)}
            placeholder="Assignment instructions..."
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-3"
          />
          <div className="sm:col-span-3">
            <button
              type="submit"
              className="rounded-lg px-4 py-2 text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--brand-navy)' }}
            >
              Post Homework Assignment
            </button>
          </div>
        </form>

        <div className="mt-6 space-y-3 border-t border-slate-200 pt-5">
          <h3 className="text-sm font-bold text-slate-900">Student Submissions ({submissions.length})</h3>
          {submissions.map((sub) => (
            <div key={sub.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-slate-900">
                  {sub.student_name} — {sub.assignment_title}
                </p>
                <span className={sub.status === 'graded' ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
                  {sub.status === 'graded' ? `Graded: ${sub.score}/${sub.max_score}` : 'Pending Grading'}
                </span>
              </div>
              {sub.answer_text && <p className="mt-2 text-slate-700">{sub.answer_text}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={sub.max_score}
                  value={gradeScore[sub.id] ?? sub.score ?? sub.max_score}
                  onChange={(e) => setGradeScore({ ...gradeScore, [sub.id]: Number(e.target.value) })}
                  className="w-24 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={gradeFeedback[sub.id] ?? sub.feedback ?? ''}
                  onChange={(e) => setGradeFeedback({ ...gradeFeedback, [sub.id]: e.target.value })}
                  placeholder="Write feedback..."
                  className="flex-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => handleGrade(sub.id)}
                  className="rounded bg-blue-700 px-3 py-1.5 font-semibold text-white hover:bg-blue-800"
                >
                  Save Grade
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

void (undefined as unknown as typeof Trash2);
