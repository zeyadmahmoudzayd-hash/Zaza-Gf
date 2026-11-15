import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import {
  COOKIE_NAME,
  hashPassword,
  loadUserFromRequest,
  optionalAuth,
  requireAdmin,
  requireAuth,
  signToken,
  userHasLessonAccess,
  verifyPassword,
  getActiveSubscription,
  type AuthedRequest,
} from './server/auth.ts';
import { db, initDatabase, UPLOADS_DIR } from './server/db.ts';
import { awardXp, computeLevel, evaluateAndUnlockBadges, getLeaderboard } from './server/gamification.ts';

initDatabase();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static assets generated for the platform & public branding uploads
app.use('/assets/images', express.static(path.resolve(process.cwd(), 'src/assets/images')));
app.use('/uploads/branding', express.static(path.join(UPLOADS_DIR, 'branding')));

// Multer storage helper
function makeUploader(subfolder: string, maxMb = 100) {
  const destDir = path.join(UPLOADS_DIR, subfolder);
  fs.mkdirSync(destDir, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, destDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '') || '.bin';
        const safeBase = path
          .basename(file.originalname, path.extname(file.originalname))
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '_')
          .slice(0, 40);
        cb(null, `${Date.now()}_${safeBase}${ext}`);
      },
    }),
    limits: { fileSize: maxMb * 1024 * 1024 },
  });
}

const uploadReceipt = makeUploader('receipts', 15);
const uploadHomework = makeUploader('homework', 25);
const uploadBranding = makeUploader('branding', 15);
const uploadVideo = makeUploader('videos', 250);
const uploadMaterial = makeUploader('materials', 50);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getSettingsMap(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM site_settings').all() as Array<{ key: string; value: string }>;
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

function setSessionCookie(res: express.Response, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    maxAge: 1000 * 60 * 60 * 24 * 14,
    path: '/',
  });
}

// ==========================================
// PUBLIC BOOTSTRAP & CONTENT ROUTES
// ==========================================

app.get('/api/public/bootstrap', optionalAuth, (req: AuthedRequest, res) => {
  const settings = getSettingsMap();
  const navLinks = db
    .prepare('SELECT * FROM nav_links WHERE is_visible = 1 ORDER BY sort_order ASC, id ASC')
    .all();
  const pages = db
    .prepare('SELECT id, slug, title, subtitle, content, updated_at FROM custom_pages WHERE is_published = 1 ORDER BY id ASC')
    .all();
  const plans = db
    .prepare('SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY sort_order ASC, id ASC')
    .all()
    .map((p: any) => ({ ...p, features: JSON.parse(p.features_json || '[]') }));
  const paymentMethods = db
    .prepare('SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY sort_order ASC, id ASC')
    .all();
  const courses = db
    .prepare(
      `SELECT c.*,
        (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) as lesson_count,
        (SELECT COALESCE(SUM(l.duration_minutes), 0) FROM lessons l WHERE l.course_id = c.id) as total_minutes,
        (SELECT COUNT(*) FROM quizzes q WHERE q.course_id = c.id AND q.is_published = 1) as quiz_count
       FROM courses c
       WHERE c.is_published = 1
       ORDER BY c.sort_order ASC, c.id ASC`,
    )
    .all();
  const announcements = db
    .prepare('SELECT * FROM announcements WHERE is_published = 1 ORDER BY is_pinned DESC, created_at DESC LIMIT 6')
    .all();
  const reviews = db
    .prepare("SELECT * FROM reviews WHERE status = 'approved' ORDER BY created_at DESC LIMIT 12")
    .all();
  const leaderboard = getLeaderboard(8);

  res.json({
    settings,
    navLinks,
    pages,
    plans,
    paymentMethods,
    courses,
    announcements,
    reviews,
    leaderboard,
    user: req.user || null,
  });
});

app.get('/api/gamification/leaderboard', (_req, res) => {
  res.json({ leaderboard: getLeaderboard(20) });
});

app.get('/api/gamification/me', requireAuth, (req: AuthedRequest, res) => {
  const user = db.prepare('SELECT id, xp_points FROM users WHERE id = ?').get(req.user!.id) as {
    id: number;
    xp_points: number;
  };
  const allBadges = db.prepare('SELECT * FROM badges ORDER BY id ASC').all() as Array<any>;
  const earnedRows = db.prepare('SELECT badge_id, earned_at FROM user_badges WHERE user_id = ?').all(user.id) as Array<{
    badge_id: number;
    earned_at: string;
  }>;
  const earnedMap = new Map(earnedRows.map((r) => [r.badge_id, r.earned_at]));

  const badges = allBadges.map((b) => ({
    ...b,
    earned: earnedMap.has(b.id),
    earned_at: earnedMap.get(b.id) || null,
  }));

  const xpHistory = db
    .prepare('SELECT * FROM xp_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 20')
    .all(user.id);

  res.json({
    xp_points: user.xp_points,
    ...computeLevel(user.xp_points),
    badges,
    xpHistory,
    leaderboard: getLeaderboard(10),
  });
});

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

app.post('/api/auth/register', (req, res) => {
  const { full_name, email, password, phone, grade, school } = req.body as Record<string, string>;
  if (!full_name?.trim() || !email?.trim() || !password || password.length < 6) {
    res.status(400).json({ error: 'Full name, valid email, and password (min 6 characters) are required.' });
    return;
  }
  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO users (full_name, email, password_hash, role, phone, grade, school, bio, xp_points, status, created_at)
       VALUES (?, ?, ?, 'student', ?, ?, ?, '', 0, 'active', ?)`,
    )
    .run(full_name.trim(), normalizedEmail, hashPassword(password), (phone || '').trim(), (grade || 'Grade 12').trim(), (school || '').trim(), now);

  const userId = Number(info.lastInsertRowid);
  const user = db
    .prepare('SELECT id, full_name, email, role, phone, grade, school, bio, avatar_url, xp_points, status FROM users WHERE id = ?')
    .get(userId);
  const token = signToken(userId, 'student');
  setSessionCookie(res, token);
  res.status(201).json({ token, user });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email?.trim() || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }
  const userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase()) as any;
  if (!userRow || !verifyPassword(password, userRow.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }
  if (userRow.status !== 'active') {
    res.status(403).json({ error: 'This account is currently suspended. Contact administration.' });
    return;
  }

  const token = signToken(userRow.id, userRow.role);
  setSessionCookie(res, token);
  const { password_hash: _ph, ...safeUser } = userRow;
  res.json({ token, user: safeUser });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const userRow = db
    .prepare('SELECT id, full_name, email, role, phone, grade, school, bio, avatar_url, xp_points, status, created_at FROM users WHERE id = ?')
    .get(userId) as any;
  const subscription = getActiveSubscription(userId) || null;
  const payments = db
    .prepare(
      `SELECT pr.*, sp.name as plan_name
       FROM payment_requests pr
       LEFT JOIN subscription_plans sp ON sp.id = pr.plan_id
       WHERE pr.user_id = ?
       ORDER BY pr.created_at DESC`,
    )
    .all(userId);

  const progressRows = db
    .prepare(
      `SELECT lp.*, l.title as lesson_title, l.course_id, c.title as course_title
       FROM lesson_progress lp
       JOIN lessons l ON l.id = lp.lesson_id
       JOIN courses c ON c.id = l.course_id
       WHERE lp.user_id = ?
       ORDER BY lp.last_watched_at DESC`,
    )
    .all(userId);

  const savedLessons = db
    .prepare(
      `SELECT sl.saved_at, l.id as lesson_id, l.title as lesson_title, l.duration_minutes, l.course_id, c.title as course_title, c.subject
       FROM saved_lessons sl
       JOIN lessons l ON l.id = sl.lesson_id
       JOIN courses c ON c.id = l.course_id
       WHERE sl.user_id = ?
       ORDER BY sl.saved_at DESC`,
    )
    .all(userId);

  const quizAttempts = db
    .prepare(
      `SELECT qa.*, q.title as quiz_title, q.passing_score, c.title as course_title
       FROM quiz_attempts qa
       JOIN quizzes q ON q.id = qa.quiz_id
       JOIN courses c ON c.id = q.course_id
       WHERE qa.user_id = ?
       ORDER BY qa.submitted_at DESC`,
    )
    .all(userId);

  const submissions = db
    .prepare(
      `SELECT s.*, a.title as assignment_title, a.max_score, c.title as course_title
       FROM assignment_submissions s
       JOIN assignments a ON a.id = s.assignment_id
       JOIN courses c ON c.id = a.course_id
       WHERE s.user_id = ?
       ORDER BY s.submitted_at DESC`,
    )
    .all(userId);

  const courseProgress = db
    .prepare(
      `SELECT c.id, c.title, c.subject, c.grade, c.thumbnail_url,
        (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) as total_lessons,
        (SELECT COUNT(*) FROM lesson_progress lp JOIN lessons l2 ON l2.id = lp.lesson_id WHERE l2.course_id = c.id AND lp.user_id = ? AND lp.completed = 1) as completed_lessons
       FROM courses c
       WHERE c.is_published = 1
       ORDER BY c.sort_order ASC`,
    )
    .all(userId);

  const levelInfo = computeLevel(userRow.xp_points || 0);
  const allBadges = db.prepare('SELECT * FROM badges ORDER BY id ASC').all() as Array<any>;
  const earnedRows = db.prepare('SELECT badge_id, earned_at FROM user_badges WHERE user_id = ?').all(userId) as Array<{
    badge_id: number;
    earned_at: string;
  }>;
  const earnedMap = new Map(earnedRows.map((r) => [r.badge_id, r.earned_at]));
  const badges = allBadges.map((b) => ({
    ...b,
    earned: earnedMap.has(b.id),
    earned_at: earnedMap.get(b.id) || null,
  }));

  res.json({
    user: { ...userRow, ...levelInfo },
    subscription,
    payments,
    progressRows,
    savedLessons,
    quizAttempts,
    submissions,
    courseProgress,
    badges,
  });
});

app.put('/api/auth/profile', requireAuth, (req: AuthedRequest, res) => {
  const { full_name, phone, grade, school, bio, new_password } = req.body as Record<string, string>;
  if (!full_name?.trim()) {
    res.status(400).json({ error: 'Full name is required.' });
    return;
  }
  db.prepare('UPDATE users SET full_name = ?, phone = ?, grade = ?, school = ?, bio = ? WHERE id = ?').run(
    full_name.trim(),
    (phone || '').trim(),
    (grade || 'Grade 12').trim(),
    (school || '').trim(),
    (bio || '').trim(),
    req.user!.id,
  );
  if (new_password && new_password.length >= 6) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(new_password), req.user!.id);
  }
  const updated = db
    .prepare('SELECT id, full_name, email, role, phone, grade, school, bio, avatar_url, xp_points, status FROM users WHERE id = ?')
    .get(req.user!.id);
  res.json({ user: updated });
});

app.post('/api/auth/avatar', requireAuth, uploadBranding.single('avatar'), (req: AuthedRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No image file uploaded.' });
    return;
  }
  const url = `/uploads/branding/${req.file.filename}`;
  db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(url, req.user!.id);
  res.json({ avatar_url: url });
});

// ==========================================
// COURSES, LESSONS & SECURE MEDIA STREAMING
// ==========================================

app.get('/api/courses/:id', optionalAuth, (req: AuthedRequest, res) => {
  const courseId = Number(req.params.id);
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId) as any;
  if (!course || (!course.is_published && req.user?.role !== 'admin')) {
    res.status(404).json({ error: 'Course not found.' });
    return;
  }

  const units = db.prepare('SELECT * FROM units WHERE course_id = ? ORDER BY sort_order ASC, id ASC').all(courseId) as any[];
  const lessons = db.prepare('SELECT * FROM lessons WHERE course_id = ? ORDER BY sort_order ASC, id ASC').all(courseId) as any[];

  const progressMap = new Map<number, { completed: boolean; watch_percent: number }>();
  const savedSet = new Set<number>();
  if (req.user) {
    const progRows = db.prepare('SELECT lesson_id, completed, watch_percent FROM lesson_progress WHERE user_id = ?').all(req.user.id) as any[];
    for (const r of progRows) progressMap.set(r.lesson_id, { completed: Boolean(r.completed), watch_percent: r.watch_percent });
    const savedRows = db.prepare('SELECT lesson_id FROM saved_lessons WHERE user_id = ?').all(req.user.id) as any[];
    for (const r of savedRows) savedSet.add(r.lesson_id);
  }

  const enrichedLessons = lessons.map((l) => {
    const unlocked = userHasLessonAccess(req.user, l);
    const materials = unlocked
      ? db.prepare('SELECT * FROM lesson_materials WHERE lesson_id = ? ORDER BY id ASC').all(l.id)
      : db.prepare('SELECT id, lesson_id, title, material_type, file_size FROM lesson_materials WHERE lesson_id = ? ORDER BY id ASC').all(l.id);
    return {
      ...l,
      video_url: unlocked ? (l.video_type === 'upload' ? `/api/media/lesson/${l.id}/video` : l.video_url) : '',
      has_access: unlocked,
      completed: progressMap.get(l.id)?.completed || false,
      watch_percent: progressMap.get(l.id)?.watch_percent || 0,
      is_saved: savedSet.has(l.id),
      materials,
    };
  });

  const quizzes = db
    .prepare(
      `SELECT q.*,
        (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) as question_count
       FROM quizzes q
       WHERE q.course_id = ? AND q.is_published = 1
       ORDER BY q.id ASC`,
    )
    .all(courseId);

  const assignments = db.prepare('SELECT * FROM assignments WHERE course_id = ? ORDER BY id ASC').all(courseId) as any[];
  const enrichedAssignments = assignments.map((a) => {
    const submission = req.user
      ? db.prepare('SELECT * FROM assignment_submissions WHERE assignment_id = ? AND user_id = ? ORDER BY submitted_at DESC LIMIT 1').get(a.id, req.user.id)
      : null;
    return { ...a, my_submission: submission || null };
  });

  res.json({
    course,
    units: units.map((u) => ({
      ...u,
      lessons: enrichedLessons.filter((l) => l.unit_id === u.id),
    })),
    quizzes,
    assignments: enrichedAssignments,
  });
});

app.get('/api/media/lesson/:lessonId/video', optionalAuth, (req: AuthedRequest, res) => {
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(Number(req.params.lessonId)) as any;
  if (!lesson || !userHasLessonAccess(req.user, lesson)) {
    res.status(403).json({ error: 'Active subscription or lesson access required.' });
    return;
  }
  if (lesson.video_type !== 'upload') {
    res.redirect(lesson.video_url);
    return;
  }
  const filename = path.basename(lesson.video_url);
  const fullPath = path.join(UPLOADS_DIR, 'videos', filename);
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'Video file not found on server.' });
    return;
  }
  const stat = fs.statSync(fullPath);
  const range = req.headers.range;
  const ext = path.extname(fullPath).toLowerCase();
  const contentType = ext === '.webm' ? 'video/webm' : 'video/mp4';

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunkSize = end - start + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
    });
    fs.createReadStream(fullPath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': contentType,
    });
    fs.createReadStream(fullPath).pipe(res);
  }
});

app.get('/api/media/material/:materialId', optionalAuth, (req: AuthedRequest, res) => {
  const mat = db.prepare('SELECT * FROM lesson_materials WHERE id = ?').get(Number(req.params.materialId)) as any;
  if (!mat) {
    res.status(404).json({ error: 'Material not found.' });
    return;
  }
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(mat.lesson_id) as any;
  if (!lesson || !userHasLessonAccess(req.user, lesson)) {
    res.status(403).json({ error: 'Please subscribe or unlock this lesson to download materials.' });
    return;
  }
  if (mat.file_url.startsWith('http://') || mat.file_url.startsWith('https://')) {
    res.redirect(mat.file_url);
    return;
  }
  const filename = path.basename(mat.file_url);
  const fullPath = path.join(UPLOADS_DIR, 'materials', filename);
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'File not found.' });
    return;
  }
  res.download(fullPath, `${mat.title.replace(/[^a-zA-Z0-9._-]/g, '_')}${path.extname(filename)}`);
});

app.get('/api/media/receipt/:filename', requireAuth, (req: AuthedRequest, res) => {
  const safeName = path.basename(req.params.filename);
  const fullPath = path.join(UPLOADS_DIR, 'receipts', safeName);
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'Receipt not found.' });
    return;
  }
  if (req.user!.role !== 'admin') {
    const owned = db
      .prepare('SELECT id FROM payment_requests WHERE user_id = ? AND receipt_url LIKE ? LIMIT 1')
      .get(req.user!.id, `%${safeName}%`);
    if (!owned) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
  }
  res.sendFile(fullPath);
});

app.get('/api/media/homework/:filename', requireAuth, (req: AuthedRequest, res) => {
  const safeName = path.basename(req.params.filename);
  const fullPath = path.join(UPLOADS_DIR, 'homework', safeName);
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'File not found.' });
    return;
  }
  if (req.user!.role !== 'admin') {
    const owned = db
      .prepare('SELECT id FROM assignment_submissions WHERE user_id = ? AND file_url LIKE ? LIMIT 1')
      .get(req.user!.id, `%${safeName}%`);
    if (!owned) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
  }
  res.sendFile(fullPath);
});

// ==========================================
// STUDENT LESSON PROGRESS, QUIZZES & HOMEWORK
// ==========================================

app.post('/api/lessons/:id/progress', requireAuth, (req: AuthedRequest, res) => {
  const lessonId = Number(req.params.id);
  const { completed, watch_percent } = req.body as { completed?: boolean; watch_percent?: number };
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId) as any;
  if (!lesson || !userHasLessonAccess(req.user, lesson)) {
    res.status(403).json({ error: 'Access denied to this lesson.' });
    return;
  }
  const now = new Date().toISOString();
  const isCompleted = completed ? 1 : 0;
  const pct = Math.max(0, Math.min(100, Number(watch_percent ?? (isCompleted ? 100 : 0))));

  db.prepare(
    `INSERT INTO lesson_progress (user_id, lesson_id, completed, watch_percent, last_watched_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, lesson_id) DO UPDATE SET
       completed = MAX(completed, excluded.completed),
       watch_percent = MAX(watch_percent, excluded.watch_percent),
       last_watched_at = excluded.last_watched_at`,
  ).run(req.user!.id, lessonId, isCompleted, pct, now);

  let gamification = { awarded: 0, newlyUnlockedBadges: [] as any[] };
  if (isCompleted) {
    gamification = awardXp(req.user!.id, 'lesson_complete', lessonId, 25, `Completed lesson: ${lesson.title}`, false);
  }

  res.json({ ok: true, completed: Boolean(isCompleted), watch_percent: pct, ...gamification });
});

app.post('/api/lessons/:id/save', requireAuth, (req: AuthedRequest, res) => {
  const lessonId = Number(req.params.id);
  const existing = db
    .prepare('SELECT 1 FROM saved_lessons WHERE user_id = ? AND lesson_id = ?')
    .get(req.user!.id, lessonId);
  if (existing) {
    db.prepare('DELETE FROM saved_lessons WHERE user_id = ? AND lesson_id = ?').run(req.user!.id, lessonId);
    res.json({ saved: false });
  } else {
    db.prepare('INSERT INTO saved_lessons (user_id, lesson_id, saved_at) VALUES (?, ?, ?)').run(
      req.user!.id,
      lessonId,
      new Date().toISOString(),
    );
    res.json({ saved: true });
  }
});

// Interactive Multi-Format Quiz Fetch (Supports Randomized Order)
app.get('/api/quizzes/:id', requireAuth, (req: AuthedRequest, res) => {
  const quizId = Number(req.params.id);
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quizId) as any;
  if (!quiz) {
    res.status(404).json({ error: 'Quiz not found.' });
    return;
  }

  let questions = db
    .prepare('SELECT id, quiz_id, question_type, question_text, options_json, sort_order FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order ASC, id ASC')
    .all(quizId)
    .map((q: any) => ({
      ...q,
      options: JSON.parse(q.options_json || '[]'),
    }));

  if (quiz.randomize_questions) {
    questions = [...questions].sort(() => Math.random() - 0.5);
  }

  const pastAttempts = db
    .prepare('SELECT id, score, total_questions, percentage, passed, xp_earned, submitted_at FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? ORDER BY submitted_at DESC')
    .all(quizId, req.user!.id);

  res.json({ quiz, questions, pastAttempts });
});

// Auto-Grade Multi-Format Quiz + Immediate Feedback + XP & Badges
app.post('/api/quizzes/:id/attempt', requireAuth, (req: AuthedRequest, res) => {
  const quizId = Number(req.params.id);
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quizId) as any;
  if (!quiz) {
    res.status(404).json({ error: 'Quiz not found.' });
    return;
  }
  const questions = db
    .prepare('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order ASC, id ASC')
    .all(quizId) as any[];
  if (questions.length === 0) {
    res.status(400).json({ error: 'This quiz has no questions yet.' });
    return;
  }

  // answers map: { [questionId]: number | string }
  const answersMap = (req.body?.answers || {}) as Record<string, number | string>;
  let score = 0;

  const feedback = questions.map((q) => {
    const rawAns = answersMap[String(q.id)];
    const options = JSON.parse(q.options_json || '[]') as string[];
    let isCorrect = false;
    let studentDisplay = '';
    let correctDisplay = '';

    if (q.question_type === 'short_answer') {
      const studentStr = String(rawAns ?? '').trim().toLowerCase();
      const acceptedList = String(q.accepted_answer || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      isCorrect = studentStr.length > 0 && acceptedList.includes(studentStr);
      studentDisplay = String(rawAns ?? '').trim() || 'No answer';
      correctDisplay = String(q.accepted_answer || '').split(',')[0] || '';
    } else {
      const selectedIdx = typeof rawAns === 'number' ? rawAns : Number(rawAns);
      isCorrect = !Number.isNaN(selectedIdx) && selectedIdx === q.correct_index;
      studentDisplay =
        !Number.isNaN(selectedIdx) && options[selectedIdx] !== undefined ? options[selectedIdx] : 'No answer';
      correctDisplay = options[q.correct_index] ?? '';
    }

    if (isCorrect) score += 1;
    return {
      question_id: q.id,
      question_type: q.question_type,
      question_text: q.question_text,
      is_correct: isCorrect,
      student_answer: studentDisplay,
      correct_answer: correctDisplay,
      explanation: q.explanation,
    };
  });

  const total = questions.length;
  const percentage = Math.round((score / total) * 100);
  const passed = percentage >= quiz.passing_score ? 1 : 0;

  // XP: 30 base + up to 50 accuracy bonus on first passing/high attempt
  const xpCandidate = passed ? 30 + Math.round((percentage / 100) * 50) : 15;
  const existingBest = db
    .prepare('SELECT MAX(xp_earned) as best_xp FROM quiz_attempts WHERE quiz_id = ? AND user_id = ?')
    .get(quizId, req.user!.id) as { best_xp: number | null };
  const prevBest = existingBest?.best_xp || 0;
  const netXp = Math.max(0, xpCandidate - prevBest);

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO quiz_attempts (quiz_id, user_id, answers_json, score, total_questions, percentage, passed, xp_earned, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(quizId, req.user!.id, JSON.stringify(answersMap), score, total, percentage, passed, xpCandidate, now);

  let gamification = { awarded: 0, newlyUnlockedBadges: [] as any[] };
  if (netXp > 0) {
    gamification = awardXp(
      req.user!.id,
      'quiz_attempt_delta',
      quizId,
      netXp,
      `Scored ${percentage}% on quiz: ${quiz.title}`,
      true,
    );
  } else {
    gamification.newlyUnlockedBadges = evaluateAndUnlockBadges(req.user!.id);
  }

  res.json({
    score,
    total_questions: total,
    percentage,
    passed: Boolean(passed),
    passing_score: quiz.passing_score,
    feedback,
    xp_awarded: gamification.awarded,
    newly_unlocked_badges: gamification.newlyUnlockedBadges,
  });
});

// Homework submission
app.post('/api/assignments/:id/submit', requireAuth, uploadHomework.single('file'), (req: AuthedRequest, res) => {
  const assignmentId = Number(req.params.id);
  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId) as any;
  if (!assignment) {
    res.status(404).json({ error: 'Assignment not found.' });
    return;
  }
  const answerText = String(req.body?.answer_text || '').trim();
  const fileUrl = req.file ? `/api/media/homework/${req.file.filename}` : '';
  if (!answerText && !fileUrl) {
    res.status(400).json({ error: 'Please write an answer or attach a homework file.' });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO assignment_submissions (assignment_id, user_id, answer_text, file_url, status, submitted_at)
     VALUES (?, ?, ?, ?, 'submitted', ?)`,
  ).run(assignmentId, req.user!.id, answerText, fileUrl, now);

  const gamification = awardXp(
    req.user!.id,
    'assignment_submit',
    assignmentId,
    20,
    `Submitted assignment: ${assignment.title}`,
    false,
  );

  res.status(201).json({ ok: true, ...gamification });
});

// ==========================================
// PAYMENTS, REVIEWS & CONTACT
// ==========================================

app.post('/api/payments/request', requireAuth, uploadReceipt.single('receipt'), (req: AuthedRequest, res) => {
  const planId = Number(req.body?.plan_id);
  const methodId = Number(req.body?.payment_method_id);
  const senderReference = String(req.body?.sender_reference || '').trim();
  const notes = String(req.body?.notes || '').trim();

  const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ? AND is_active = 1').get(planId) as any;
  const method = db.prepare('SELECT * FROM payment_methods WHERE id = ? AND is_active = 1').get(methodId) as any;
  if (!plan || !method) {
    res.status(400).json({ error: 'Selected plan or payment method is unavailable.' });
    return;
  }
  if (!senderReference && !req.file) {
    res.status(400).json({ error: 'Please provide your transfer phone/reference or upload a payment receipt.' });
    return;
  }

  const receiptUrl = req.file ? `/api/media/receipt/${req.file.filename}` : '';
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO payment_requests
       (user_id, plan_id, payment_method_id, method_name, amount_egp, sender_reference, receipt_url, notes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    )
    .run(req.user!.id, plan.id, method.id, method.name, plan.price_egp, senderReference, receiptUrl, notes, now);

  res.status(201).json({ ok: true, id: info.lastInsertRowid });
});

app.post('/api/reviews', requireAuth, (req: AuthedRequest, res) => {
  const { rating, comment, outcome_metric } = req.body as {
    rating?: number;
    comment?: string;
    outcome_metric?: string;
  };
  if (!comment?.trim()) {
    res.status(400).json({ error: 'Review comment is required.' });
    return;
  }
  const safeRating = Math.max(1, Math.min(5, Number(rating || 5)));
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO reviews (user_id, student_name, student_grade, rating, comment, outcome_metric, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'approved', ?)`,
  ).run(
    req.user!.id,
    req.user!.full_name,
    req.user!.grade || 'Student',
    safeRating,
    comment.trim(),
    (outcome_metric || '').trim(),
    now,
  );
  res.status(201).json({ ok: true });
});

app.post('/api/contact', (req, res) => {
  const { name, email, phone, subject, message } = req.body as Record<string, string>;
  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    res.status(400).json({ error: 'Name, email, and message are required.' });
    return;
  }
  db.prepare(
    `INSERT INTO contact_messages (name, email, phone, subject, message, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'new', ?)`,
  ).run(
    name.trim(),
    email.trim(),
    (phone || '').trim(),
    (subject || 'General Inquiry').trim(),
    message.trim(),
    new Date().toISOString(),
  );
  res.status(201).json({ ok: true });
});

// ==========================================
// ADMIN CMS & PLATFORM MANAGEMENT ROUTES
// ==========================================

app.get('/api/admin/overview', requireAdmin, (_req, res) => {
  const totalStudents = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'student'").get() as { c: number }).c;
  const activeSubs = (
    db
      .prepare("SELECT COUNT(DISTINCT user_id) as c FROM user_subscriptions WHERE status = 'active' AND expires_at > ?")
      .get(new Date().toISOString()) as { c: number }
  ).c;
  const pendingPayments = (
    db.prepare("SELECT COUNT(*) as c FROM payment_requests WHERE status = 'pending'").get() as { c: number }
  ).c;
  const totalRevenue = (
    db.prepare("SELECT COALESCE(SUM(amount_egp), 0) as s FROM payment_requests WHERE status = 'approved'").get() as {
      s: number;
    }
  ).s;
  const totalCourses = (db.prepare('SELECT COUNT(*) as c FROM courses').get() as { c: number }).c;
  const totalLessons = (db.prepare('SELECT COUNT(*) as c FROM lessons').get() as { c: number }).c;
  const avgQuizScore = (
    db.prepare('SELECT COALESCE(ROUND(AVG(percentage)), 0) as a FROM quiz_attempts').get() as { a: number }
  ).a;
  const unreadMessages = (
    db.prepare("SELECT COUNT(*) as c FROM contact_messages WHERE status = 'new'").get() as { c: number }
  ).c;

  const recentPayments = db
    .prepare(
      `SELECT pr.*, u.full_name as student_name, u.email as student_email, sp.name as plan_name
       FROM payment_requests pr
       JOIN users u ON u.id = pr.user_id
       JOIN subscription_plans sp ON sp.id = pr.plan_id
       ORDER BY pr.created_at DESC LIMIT 8`,
    )
    .all();

  res.json({
    stats: {
      totalStudents,
      activeSubs,
      pendingPayments,
      totalRevenue,
      totalCourses,
      totalLessons,
      avgQuizScore,
      unreadMessages,
    },
    recentPayments,
  });
});

// Site Settings & Branding & Theme
app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const updates = req.body as Record<string, unknown>;
  const upsert = db.prepare(
    'INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );
  const tx = db.transaction(() => {
    for (const [key, val] of Object.entries(updates)) {
      upsert.run(key, typeof val === 'string' ? val : JSON.stringify(val));
    }
  });
  tx();
  res.json({ settings: getSettingsMap() });
});

app.post('/api/admin/upload/branding', requireAdmin, uploadBranding.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded.' });
    return;
  }
  res.json({ url: `/uploads/branding/${req.file.filename}` });
});

// Navigation Links CRUD
app.get('/api/admin/nav', requireAdmin, (_req, res) => {
  res.json({ navLinks: db.prepare('SELECT * FROM nav_links ORDER BY sort_order ASC, id ASC').all() });
});
app.post('/api/admin/nav', requireAdmin, (req, res) => {
  const { label, target, sort_order, is_visible } = req.body;
  const info = db
    .prepare('INSERT INTO nav_links (label, target, sort_order, is_visible) VALUES (?, ?, ?, ?)')
    .run(String(label).trim(), String(target).trim(), Number(sort_order || 0), is_visible ? 1 : 0);
  res.status(201).json({ id: info.lastInsertRowid });
});
app.put('/api/admin/nav/:id', requireAdmin, (req, res) => {
  const { label, target, sort_order, is_visible } = req.body;
  db.prepare('UPDATE nav_links SET label = ?, target = ?, sort_order = ?, is_visible = ? WHERE id = ?').run(
    String(label).trim(),
    String(target).trim(),
    Number(sort_order || 0),
    is_visible ? 1 : 0,
    Number(req.params.id),
  );
  res.json({ ok: true });
});
app.delete('/api/admin/nav/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM nav_links WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Custom Pages CRUD
app.get('/api/admin/pages', requireAdmin, (_req, res) => {
  res.json({ pages: db.prepare('SELECT * FROM custom_pages ORDER BY id DESC').all() });
});
app.post('/api/admin/pages', requireAdmin, (req, res) => {
  const { slug, title, subtitle, content, is_published } = req.body;
  const cleanSlug = String(slug || title)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '');
  const now = new Date().toISOString();
  const info = db
    .prepare(
      'INSERT INTO custom_pages (slug, title, subtitle, content, is_published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(cleanSlug, String(title).trim(), String(subtitle || ''), String(content || ''), is_published ? 1 : 0, now, now);
  res.status(201).json({ id: info.lastInsertRowid });
});
app.put('/api/admin/pages/:id', requireAdmin, (req, res) => {
  const { slug, title, subtitle, content, is_published } = req.body;
  const cleanSlug = String(slug || title)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '');
  db.prepare(
    'UPDATE custom_pages SET slug = ?, title = ?, subtitle = ?, content = ?, is_published = ?, updated_at = ? WHERE id = ?',
  ).run(
    cleanSlug,
    String(title).trim(),
    String(subtitle || ''),
    String(content || ''),
    is_published ? 1 : 0,
    new Date().toISOString(),
    Number(req.params.id),
  );
  res.json({ ok: true });
});
app.delete('/api/admin/pages/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM custom_pages WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Courses, Units, Lessons, Materials CRUD
app.get('/api/admin/courses', requireAdmin, (_req, res) => {
  const courses = db.prepare('SELECT * FROM courses ORDER BY sort_order ASC, id ASC').all() as any[];
  const units = db.prepare('SELECT * FROM units ORDER BY sort_order ASC, id ASC').all() as any[];
  const lessons = db.prepare('SELECT * FROM lessons ORDER BY sort_order ASC, id ASC').all() as any[];
  const materials = db.prepare('SELECT * FROM lesson_materials ORDER BY id ASC').all() as any[];

  const enrichedLessons = lessons.map((l) => ({
    ...l,
    materials: materials.filter((m) => m.lesson_id === l.id),
  }));
  const enrichedCourses = courses.map((c) => ({
    ...c,
    units: units
      .filter((u) => u.course_id === c.id)
      .map((u) => ({
        ...u,
        lessons: enrichedLessons.filter((l) => l.unit_id === u.id),
      })),
  }));
  res.json({ courses: enrichedCourses });
});

app.post('/api/admin/courses', requireAdmin, (req, res) => {
  const { title, subject, grade, description, thumbnail_url, is_featured, is_published, sort_order } = req.body;
  const info = db
    .prepare(
      `INSERT INTO courses (title, subject, grade, description, thumbnail_url, is_featured, is_published, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      String(title).trim(),
      String(subject).trim(),
      String(grade).trim(),
      String(description || ''),
      String(thumbnail_url || '/assets/images/course_mathematics_1794731929565.jpg'),
      is_featured ? 1 : 0,
      is_published !== false ? 1 : 0,
      Number(sort_order || 0),
      new Date().toISOString(),
    );
  res.status(201).json({ id: info.lastInsertRowid });
});

app.put('/api/admin/courses/:id', requireAdmin, (req, res) => {
  const { title, subject, grade, description, thumbnail_url, is_featured, is_published, sort_order } = req.body;
  db.prepare(
    `UPDATE courses SET title = ?, subject = ?, grade = ?, description = ?, thumbnail_url = ?, is_featured = ?, is_published = ?, sort_order = ? WHERE id = ?`,
  ).run(
    String(title).trim(),
    String(subject).trim(),
    String(grade).trim(),
    String(description || ''),
    String(thumbnail_url || ''),
    is_featured ? 1 : 0,
    is_published ? 1 : 0,
    Number(sort_order || 0),
    Number(req.params.id),
  );
  res.json({ ok: true });
});

app.delete('/api/admin/courses/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM courses WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

app.post('/api/admin/units', requireAdmin, (req, res) => {
  const { course_id, title, description, sort_order } = req.body;
  const info = db
    .prepare('INSERT INTO units (course_id, title, description, sort_order) VALUES (?, ?, ?, ?)')
    .run(Number(course_id), String(title).trim(), String(description || ''), Number(sort_order || 1));
  res.status(201).json({ id: info.lastInsertRowid });
});

app.put('/api/admin/units/:id', requireAdmin, (req, res) => {
  const { title, description, sort_order } = req.body;
  db.prepare('UPDATE units SET title = ?, description = ?, sort_order = ? WHERE id = ?').run(
    String(title).trim(),
    String(description || ''),
    Number(sort_order || 1),
    Number(req.params.id),
  );
  res.json({ ok: true });
});

app.delete('/api/admin/units/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM units WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

app.post('/api/admin/lessons', requireAdmin, uploadVideo.single('video_file'), (req, res) => {
  const { unit_id, course_id, title, description, duration_minutes, video_url, access_type, sort_order } = req.body;
  const isUploaded = Boolean(req.file);
  const finalVideoUrl = isUploaded ? req.file!.filename : String(video_url || '').trim();
  const videoType = isUploaded ? 'upload' : 'external';
  const info = db
    .prepare(
      `INSERT INTO lessons (unit_id, course_id, title, description, duration_minutes, video_url, video_type, access_type, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      Number(unit_id),
      Number(course_id),
      String(title).trim(),
      String(description || ''),
      Number(duration_minutes || 30),
      finalVideoUrl,
      videoType,
      String(access_type || 'subscription'),
      Number(sort_order || 1),
      new Date().toISOString(),
    );
  res.status(201).json({ id: info.lastInsertRowid });
});

app.put('/api/admin/lessons/:id', requireAdmin, uploadVideo.single('video_file'), (req, res) => {
  const existing = db.prepare('SELECT * FROM lessons WHERE id = ?').get(Number(req.params.id)) as any;
  if (!existing) {
    res.status(404).json({ error: 'Lesson not found.' });
    return;
  }
  const { title, description, duration_minutes, video_url, access_type, sort_order } = req.body;
  let finalVideoUrl = existing.video_url;
  let videoType = existing.video_type;
  if (req.file) {
    finalVideoUrl = req.file.filename;
    videoType = 'upload';
  } else if (typeof video_url === 'string' && video_url.trim() !== '') {
    finalVideoUrl = video_url.trim();
    videoType = 'external';
  }
  db.prepare(
    `UPDATE lessons SET title = ?, description = ?, duration_minutes = ?, video_url = ?, video_type = ?, access_type = ?, sort_order = ? WHERE id = ?`,
  ).run(
    String(title || existing.title).trim(),
    String(description ?? existing.description),
    Number(duration_minutes ?? existing.duration_minutes),
    finalVideoUrl,
    videoType,
    String(access_type || existing.access_type),
    Number(sort_order ?? existing.sort_order),
    Number(req.params.id),
  );
  res.json({ ok: true });
});

app.delete('/api/admin/lessons/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM lessons WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

app.post('/api/admin/materials', requireAdmin, uploadMaterial.single('file'), (req, res) => {
  const { lesson_id, title, material_type, file_url } = req.body;
  if (!req.file && !file_url) {
    res.status(400).json({ error: 'Upload a file or provide a resource URL.' });
    return;
  }
  const finalUrl = req.file ? `/uploads/materials/${req.file.filename}` : String(file_url).trim();
  const sizeLabel = req.file ? formatFileSize(req.file.size) : 'Link';
  const info = db
    .prepare('INSERT INTO lesson_materials (lesson_id, title, material_type, file_url, file_size, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(Number(lesson_id), String(title).trim(), String(material_type || 'summary_pdf'), finalUrl, sizeLabel, new Date().toISOString());
  res.status(201).json({ id: info.lastInsertRowid });
});

app.delete('/api/admin/materials/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM lesson_materials WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Quizzes & Multi-Format Questions CRUD
app.get('/api/admin/quizzes', requireAdmin, (_req, res) => {
  const quizzes = db
    .prepare(
      `SELECT q.*, c.title as course_title
       FROM quizzes q
       LEFT JOIN courses c ON c.id = q.course_id
       ORDER BY q.id DESC`,
    )
    .all() as any[];
  const questions = db.prepare('SELECT * FROM quiz_questions ORDER BY sort_order ASC, id ASC').all() as any[];
  res.json({
    quizzes: quizzes.map((q) => ({
      ...q,
      questions: questions
        .filter((qq) => qq.quiz_id === q.id)
        .map((qq) => ({ ...qq, options: JSON.parse(qq.options_json || '[]') })),
    })),
  });
});

app.post('/api/admin/quizzes', requireAdmin, (req, res) => {
  const { course_id, lesson_id, title, description, time_limit_minutes, passing_score, randomize_questions, is_published } = req.body;
  const info = db
    .prepare(
      `INSERT INTO quizzes (course_id, lesson_id, title, description, time_limit_minutes, passing_score, randomize_questions, is_published, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      Number(course_id),
      lesson_id ? Number(lesson_id) : null,
      String(title).trim(),
      String(description || ''),
      Number(time_limit_minutes || 15),
      Number(passing_score || 60),
      randomize_questions ? 1 : 0,
      is_published !== false ? 1 : 0,
      new Date().toISOString(),
    );
  res.status(201).json({ id: info.lastInsertRowid });
});

app.put('/api/admin/quizzes/:id', requireAdmin, (req, res) => {
  const { title, description, time_limit_minutes, passing_score, randomize_questions, is_published } = req.body;
  db.prepare(
    `UPDATE quizzes SET title = ?, description = ?, time_limit_minutes = ?, passing_score = ?, randomize_questions = ?, is_published = ? WHERE id = ?`,
  ).run(
    String(title).trim(),
    String(description || ''),
    Number(time_limit_minutes || 15),
    Number(passing_score || 60),
    randomize_questions ? 1 : 0,
    is_published ? 1 : 0,
    Number(req.params.id),
  );
  res.json({ ok: true });
});

app.delete('/api/admin/quizzes/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM quizzes WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

app.post('/api/admin/quizzes/:id/questions', requireAdmin, (req, res) => {
  const quizId = Number(req.params.id);
  const { question_type, question_text, options, correct_index, accepted_answer, explanation, sort_order } = req.body;
  const qType = question_type || 'multiple_choice';
  const finalOptions =
    qType === 'true_false'
      ? ['True', 'False']
      : qType === 'short_answer'
        ? []
        : Array.isArray(options)
          ? options
          : [];
  const info = db
    .prepare(
      `INSERT INTO quiz_questions (quiz_id, question_type, question_text, options_json, correct_index, accepted_answer, explanation, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      quizId,
      qType,
      String(question_text).trim(),
      JSON.stringify(finalOptions),
      Number(correct_index || 0),
      String(accepted_answer || '').trim(),
      String(explanation || '').trim(),
      Number(sort_order || 1),
    );
  res.status(201).json({ id: info.lastInsertRowid });
});

app.delete('/api/admin/questions/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM quiz_questions WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Assignments & Grading
app.get('/api/admin/assignments', requireAdmin, (_req, res) => {
  const assignments = db
    .prepare(
      `SELECT a.*, c.title as course_title
       FROM assignments a
       LEFT JOIN courses c ON c.id = a.course_id
       ORDER BY a.id DESC`,
    )
    .all();
  const submissions = db
    .prepare(
      `SELECT s.*, a.title as assignment_title, a.max_score, u.full_name as student_name, u.email as student_email
       FROM assignment_submissions s
       JOIN assignments a ON a.id = s.assignment_id
       JOIN users u ON u.id = s.user_id
       ORDER BY s.submitted_at DESC`,
    )
    .all();
  res.json({ assignments, submissions });
});

app.post('/api/admin/assignments', requireAdmin, (req, res) => {
  const { course_id, lesson_id, title, instructions, due_date, max_score } = req.body;
  const info = db
    .prepare(
      'INSERT INTO assignments (course_id, lesson_id, title, instructions, due_date, max_score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      Number(course_id),
      lesson_id ? Number(lesson_id) : null,
      String(title).trim(),
      String(instructions).trim(),
      String(due_date || ''),
      Number(max_score || 100),
      new Date().toISOString(),
    );
  res.status(201).json({ id: info.lastInsertRowid });
});

app.delete('/api/admin/assignments/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM assignments WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

app.post('/api/admin/submissions/:id/grade', requireAdmin, (req, res) => {
  const { score, feedback } = req.body;
  db.prepare(
    "UPDATE assignment_submissions SET score = ?, feedback = ?, status = 'graded', graded_at = ? WHERE id = ?",
  ).run(Number(score), String(feedback || ''), new Date().toISOString(), Number(req.params.id));
  res.json({ ok: true });
});

// Subscription Plans CRUD
app.get('/api/admin/plans', requireAdmin, (_req, res) => {
  const plans = db
    .prepare('SELECT * FROM subscription_plans ORDER BY sort_order ASC, id ASC')
    .all()
    .map((p: any) => ({ ...p, features: JSON.parse(p.features_json || '[]') }));
  res.json({ plans });
});

app.post('/api/admin/plans', requireAdmin, (req, res) => {
  const { name, duration_days, price_egp, billing_label, description, features, is_featured, is_active, sort_order } = req.body;
  const info = db
    .prepare(
      `INSERT INTO subscription_plans
       (name, duration_days, price_egp, billing_label, description, features_json, is_featured, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      String(name).trim(),
      Number(duration_days),
      Number(price_egp),
      String(billing_label || `${duration_days} Days`).trim(),
      String(description || ''),
      JSON.stringify(Array.isArray(features) ? features : []),
      is_featured ? 1 : 0,
      is_active !== false ? 1 : 0,
      Number(sort_order || 1),
    );
  res.status(201).json({ id: info.lastInsertRowid });
});

app.put('/api/admin/plans/:id', requireAdmin, (req, res) => {
  const { name, duration_days, price_egp, billing_label, description, features, is_featured, is_active, sort_order } = req.body;
  db.prepare(
    `UPDATE subscription_plans
     SET name = ?, duration_days = ?, price_egp = ?, billing_label = ?, description = ?, features_json = ?, is_featured = ?, is_active = ?, sort_order = ?
     WHERE id = ?`,
  ).run(
    String(name).trim(),
    Number(duration_days),
    Number(price_egp),
    String(billing_label).trim(),
    String(description || ''),
    JSON.stringify(Array.isArray(features) ? features : []),
    is_featured ? 1 : 0,
    is_active ? 1 : 0,
    Number(sort_order || 1),
    Number(req.params.id),
  );
  res.json({ ok: true });
});

app.delete('/api/admin/plans/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM subscription_plans WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Egypt Payment Methods CRUD
app.get('/api/admin/payment-methods', requireAdmin, (_req, res) => {
  res.json({ paymentMethods: db.prepare('SELECT * FROM payment_methods ORDER BY sort_order ASC, id ASC').all() });
});
app.post('/api/admin/payment-methods', requireAdmin, (req, res) => {
  const { code, name, account_label, account_value, instructions, is_active, sort_order } = req.body;
  const info = db
    .prepare(
      'INSERT INTO payment_methods (code, name, account_label, account_value, instructions, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      String(code || 'custom').trim(),
      String(name).trim(),
      String(account_label).trim(),
      String(account_value).trim(),
      String(instructions).trim(),
      is_active !== false ? 1 : 0,
      Number(sort_order || 1),
    );
  res.status(201).json({ id: info.lastInsertRowid });
});
app.put('/api/admin/payment-methods/:id', requireAdmin, (req, res) => {
  const { name, account_label, account_value, instructions, is_active, sort_order } = req.body;
  db.prepare(
    'UPDATE payment_methods SET name = ?, account_label = ?, account_value = ?, instructions = ?, is_active = ?, sort_order = ? WHERE id = ?',
  ).run(
    String(name).trim(),
    String(account_label).trim(),
    String(account_value).trim(),
    String(instructions).trim(),
    is_active ? 1 : 0,
    Number(sort_order || 1),
    Number(req.params.id),
  );
  res.json({ ok: true });
});
app.delete('/api/admin/payment-methods/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM payment_methods WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Payment Verification
app.get('/api/admin/payments', requireAdmin, (_req, res) => {
  const payments = db
    .prepare(
      `SELECT pr.*, u.full_name as student_name, u.email as student_email, u.phone as student_phone, sp.name as plan_name, sp.duration_days
       FROM payment_requests pr
       JOIN users u ON u.id = pr.user_id
       JOIN subscription_plans sp ON sp.id = pr.plan_id
       ORDER BY CASE WHEN pr.status = 'pending' THEN 0 ELSE 1 END, pr.created_at DESC`,
    )
    .all();
  res.json({ payments });
});

app.post('/api/admin/payments/:id/review', requireAdmin, (req, res) => {
  const paymentId = Number(req.params.id);
  const { action, admin_note } = req.body as { action: 'approve' | 'reject'; admin_note?: string };
  const pr = db.prepare('SELECT * FROM payment_requests WHERE id = ?').get(paymentId) as any;
  if (!pr) {
    res.status(404).json({ error: 'Payment request not found.' });
    return;
  }
  const now = new Date().toISOString();
  const status = action === 'approve' ? 'approved' : 'rejected';

  const tx = db.transaction(() => {
    db.prepare('UPDATE payment_requests SET status = ?, admin_note = ?, reviewed_at = ? WHERE id = ?').run(
      status,
      (admin_note || '').trim(),
      now,
      paymentId,
    );

    if (action === 'approve') {
      const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(pr.plan_id) as any;
      const days = plan?.duration_days || 30;
      const currentSub = getActiveSubscription(pr.user_id);
      const baseTime = currentSub ? new Date(currentSub.expires_at).getTime() : Date.now();
      const newExpiry = new Date(baseTime + days * 24 * 60 * 60 * 1000).toISOString();

      db.prepare("UPDATE user_subscriptions SET status = 'expired' WHERE user_id = ? AND status = 'active'").run(pr.user_id);
      db.prepare(
        `INSERT INTO user_subscriptions (user_id, plan_id, plan_name, status, starts_at, expires_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, ?)`,
      ).run(pr.user_id, pr.plan_id, plan?.name || 'Subscription Plan', now, newExpiry, now);
    }
  });
  tx();
  res.json({ ok: true });
});

// Students Management & Access Grants
app.get('/api/admin/students', requireAdmin, (_req, res) => {
  const nowIso = new Date().toISOString();
  const students = db
    .prepare(
      `SELECT u.id, u.full_name, u.email, u.phone, u.grade, u.school, u.xp_points, u.status, u.created_at,
        (SELECT COUNT(*) FROM lesson_progress lp WHERE lp.user_id = u.id AND lp.completed = 1) as completed_lessons,
        (SELECT COALESCE(ROUND(AVG(qa.percentage)), 0) FROM quiz_attempts qa WHERE qa.user_id = u.id) as avg_quiz_score,
        (SELECT us.plan_name FROM user_subscriptions us WHERE us.user_id = u.id AND us.status = 'active' AND us.expires_at > ? ORDER BY us.expires_at DESC LIMIT 1) as active_plan,
        (SELECT us.expires_at FROM user_subscriptions us WHERE us.user_id = u.id AND us.status = 'active' AND us.expires_at > ? ORDER BY us.expires_at DESC LIMIT 1) as subscription_expires_at
       FROM users u
       WHERE u.role = 'student'
       ORDER BY u.created_at DESC`,
    )
    .all(nowIso, nowIso);
  const grants = db
    .prepare(
      `SELECT g.*, c.title as course_title, l.title as lesson_title
       FROM lesson_access_grants g
       LEFT JOIN courses c ON c.id = g.course_id
       LEFT JOIN lessons l ON l.id = g.lesson_id
       ORDER BY g.created_at DESC`,
    )
    .all();
  res.json({ students, grants });
});

app.post('/api/admin/students/:id/subscription', requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  const { action, plan_id, duration_days } = req.body as {
    action: 'activate' | 'deactivate';
    plan_id?: number;
    duration_days?: number;
  };
  const now = new Date().toISOString();
  if (action === 'deactivate') {
    db.prepare("UPDATE user_subscriptions SET status = 'cancelled', updated_at = ? WHERE user_id = ? AND status = 'active'").run(
      now,
      userId,
    );
    res.json({ ok: true });
    return;
  }
  const plan = plan_id ? (db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(plan_id) as any) : null;
  const days = Number(duration_days || plan?.duration_days || 30);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  db.prepare("UPDATE user_subscriptions SET status = 'expired' WHERE user_id = ? AND status = 'active'").run(userId);
  db.prepare(
    `INSERT INTO user_subscriptions (user_id, plan_id, plan_name, status, starts_at, expires_at, updated_at)
     VALUES (?, ?, ?, 'active', ?, ?, ?)`,
  ).run(userId, plan?.id || null, plan?.name || `${days}-Day Admin Grant`, now, expiresAt, now);
  res.json({ ok: true });
});

app.post('/api/admin/students/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body as { status: 'active' | 'suspended' };
  db.prepare('UPDATE users SET status = ? WHERE id = ? AND role = ?').run(status, Number(req.params.id), 'student');
  res.json({ ok: true });
});

app.post('/api/admin/students/:id/access', requireAdmin, (req: AuthedRequest, res) => {
  const userId = Number(req.params.id);
  const { course_id, lesson_id } = req.body;
  const info = db
    .prepare('INSERT INTO lesson_access_grants (user_id, lesson_id, course_id, granted_by, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(userId, lesson_id ? Number(lesson_id) : null, course_id ? Number(course_id) : null, req.user!.id, new Date().toISOString());
  res.status(201).json({ id: info.lastInsertRowid });
});

app.delete('/api/admin/access/:grantId', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM lesson_access_grants WHERE id = ?').run(Number(req.params.grantId));
  res.json({ ok: true });
});

// Announcements CRUD
app.get('/api/admin/announcements', requireAdmin, (_req, res) => {
  res.json({ announcements: db.prepare('SELECT * FROM announcements ORDER BY is_pinned DESC, created_at DESC').all() });
});
app.post('/api/admin/announcements', requireAdmin, (req, res) => {
  const { title, body, target_grade, is_pinned, is_published } = req.body;
  const info = db
    .prepare(
      'INSERT INTO announcements (title, body, target_grade, is_pinned, is_published, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(
      String(title).trim(),
      String(body).trim(),
      String(target_grade || 'All Grades'),
      is_pinned ? 1 : 0,
      is_published !== false ? 1 : 0,
      new Date().toISOString(),
    );
  res.status(201).json({ id: info.lastInsertRowid });
});
app.delete('/api/admin/announcements/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM announcements WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Reviews Moderation
app.get('/api/admin/reviews', requireAdmin, (_req, res) => {
  res.json({ reviews: db.prepare('SELECT * FROM reviews ORDER BY created_at DESC').all() });
});
app.put('/api/admin/reviews/:id', requireAdmin, (req, res) => {
  const { status } = req.body as { status: 'approved' | 'pending' | 'hidden' };
  db.prepare('UPDATE reviews SET status = ? WHERE id = ?').run(status, Number(req.params.id));
  res.json({ ok: true });
});
app.delete('/api/admin/reviews/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM reviews WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Contact Inbox
app.get('/api/admin/messages', requireAdmin, (_req, res) => {
  res.json({ messages: db.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC').all() });
});
app.post('/api/admin/messages/:id/reply', requireAdmin, (req, res) => {
  const { admin_reply } = req.body;
  db.prepare("UPDATE contact_messages SET admin_reply = ?, status = 'replied' WHERE id = ?").run(
    String(admin_reply || ''),
    Number(req.params.id),
  );
  res.json({ ok: true });
});
app.delete('/api/admin/messages/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM contact_messages WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ==========================================
// VITE DEV / PRODUCTION SPA INTEGRATION
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'API route not found.' });
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ZAZA XPRAS Educational Platform running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Keep loadUserFromRequest referenced cleanly
void loadUserFromRequest;
