import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

for (const dir of [
  DATA_DIR,
  UPLOADS_DIR,
  path.join(UPLOADS_DIR, 'videos'),
  path.join(UPLOADS_DIR, 'materials'),
  path.join(UPLOADS_DIR, 'receipts'),
  path.join(UPLOADS_DIR, 'homework'),
  path.join(UPLOADS_DIR, 'branding'),
]) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new Database(path.join(DATA_DIR, 'zazaxpras.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function hashSeedPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function createSamplePdf(filePath: string, title: string, lines: string[]) {
  if (fs.existsSync(filePath)) return;
  const escapedTitle = title.replace(/[()\\]/g, '\\$&');
  const textOps = [
    'BT',
    '/F1 18 Tf',
    '54 740 Td',
    `(${escapedTitle}) Tj`,
    '/F1 11 Tf',
    '0 -28 Td',
    ...lines.flatMap((line) => [
      `(${line.replace(/[()\\]/g, '\\$&')}) Tj`,
      '0 -18 Td',
    ]),
    'ET',
  ].join('\n');

  const objects: string[] = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
  );
  objects.push(
    `4 0 obj\n<< /Length ${Buffer.byteLength(textOps, 'utf8')} >>\nstream\n${textOps}\nendstream\nendobj\n`,
  );
  objects.push(
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  );

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  fs.writeFileSync(filePath, pdf, 'utf8');
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nav_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      target TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_visible INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS custom_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      phone TEXT NOT NULL DEFAULT '',
      grade TEXT NOT NULL DEFAULT 'Grade 12',
      school TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      xp_points INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      icon_name TEXT NOT NULL DEFAULT 'award',
      xp_reward INTEGER NOT NULL DEFAULT 25,
      threshold_type TEXT NOT NULL,
      threshold_value INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS user_badges (
      user_id INTEGER NOT NULL,
      badge_id INTEGER NOT NULL,
      earned_at TEXT NOT NULL,
      PRIMARY KEY (user_id, badge_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS xp_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      source_id INTEGER NOT NULL DEFAULT 0,
      points INTEGER NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subscription_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      duration_days INTEGER NOT NULL,
      price_egp REAL NOT NULL,
      billing_label TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      features_json TEXT NOT NULL DEFAULT '[]',
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plan_id INTEGER,
      plan_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      starts_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      account_label TEXT NOT NULL,
      account_value TEXT NOT NULL,
      instructions TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS payment_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plan_id INTEGER NOT NULL,
      payment_method_id INTEGER NOT NULL,
      method_name TEXT NOT NULL,
      amount_egp REAL NOT NULL,
      sender_reference TEXT NOT NULL DEFAULT '',
      receipt_url TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      reviewed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      grade TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      thumbnail_url TEXT NOT NULL DEFAULT '',
      is_featured INTEGER NOT NULL DEFAULT 1,
      is_published INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      duration_minutes INTEGER NOT NULL DEFAULT 30,
      video_url TEXT NOT NULL DEFAULT '',
      video_type TEXT NOT NULL DEFAULT 'external',
      access_type TEXT NOT NULL DEFAULT 'subscription',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lesson_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      material_type TEXT NOT NULL DEFAULT 'summary_pdf',
      file_url TEXT NOT NULL,
      file_size TEXT NOT NULL DEFAULT 'PDF',
      created_at TEXT NOT NULL,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lesson_access_grants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      lesson_id INTEGER,
      course_id INTEGER,
      granted_by INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lesson_progress (
      user_id INTEGER NOT NULL,
      lesson_id INTEGER NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      watch_percent INTEGER NOT NULL DEFAULT 0,
      last_watched_at TEXT NOT NULL,
      PRIMARY KEY (user_id, lesson_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS saved_lessons (
      user_id INTEGER NOT NULL,
      lesson_id INTEGER NOT NULL,
      saved_at TEXT NOT NULL,
      PRIMARY KEY (user_id, lesson_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      lesson_id INTEGER,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      time_limit_minutes INTEGER NOT NULL DEFAULT 15,
      passing_score INTEGER NOT NULL DEFAULT 60,
      randomize_questions INTEGER NOT NULL DEFAULT 0,
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quiz_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      question_type TEXT NOT NULL DEFAULT 'multiple_choice',
      question_text TEXT NOT NULL,
      options_json TEXT NOT NULL DEFAULT '[]',
      correct_index INTEGER NOT NULL DEFAULT 0,
      accepted_answer TEXT NOT NULL DEFAULT '',
      explanation TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      answers_json TEXT NOT NULL,
      score INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      percentage REAL NOT NULL,
      passed INTEGER NOT NULL,
      xp_earned INTEGER NOT NULL DEFAULT 0,
      submitted_at TEXT NOT NULL,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      lesson_id INTEGER,
      title TEXT NOT NULL,
      instructions TEXT NOT NULL,
      due_date TEXT NOT NULL DEFAULT '',
      max_score INTEGER NOT NULL DEFAULT 100,
      created_at TEXT NOT NULL,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assignment_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      answer_text TEXT NOT NULL DEFAULT '',
      file_url TEXT NOT NULL DEFAULT '',
      score INTEGER,
      feedback TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'submitted',
      submitted_at TEXT NOT NULL,
      graded_at TEXT,
      FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      target_grade TEXT NOT NULL DEFAULT 'All Grades',
      is_pinned INTEGER NOT NULL DEFAULT 0,
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      student_name TEXT NOT NULL,
      student_grade TEXT NOT NULL DEFAULT '',
      rating INTEGER NOT NULL DEFAULT 5,
      comment TEXT NOT NULL,
      outcome_metric TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'approved',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      admin_reply TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);

  seedInitialData();
}

function seedInitialData() {
  const settingsCount = (db.prepare('SELECT COUNT(*) as cnt FROM site_settings').get() as { cnt: number }).cnt;
  if (settingsCount > 0) return;

  const now = new Date().toISOString();

  createSamplePdf(
    path.join(UPLOADS_DIR, 'materials', 'calculus_limits_summary.pdf'),
    'ZAZA XPRAS - Calculus Limits & Continuity Summary',
    [
      'Instructor: Prof. Karim El-Masry | Subject: Applied Mathematics (Grade 12)',
      '1. Formal Definition of Limit: lim (x -> a) f(x) = L',
      '2. L-Hopital Rule applies to indeterminate forms 0/0 and inf/inf.',
      '3. Standard Trigonometric Limit: lim (x -> 0) sin(x)/x = 1.',
      '4. Continuity at x = a requires f(a) defined, limit exists, and lim f(x) = f(a).',
      '5. Key Practice Tip: Always factor or rationalize before substituting.',
    ],
  );
  createSamplePdf(
    path.join(UPLOADS_DIR, 'materials', 'physics_optics_worksheet.pdf'),
    'ZAZA XPRAS - Wave Optics & Prism Refraction Worksheet',
    [
      'Instructor: Prof. Karim El-Masry | Subject: Modern Physics (Grade 12)',
      '1. Snell Law: n1 * sin(theta1) = n2 * sin(theta2)',
      '2. Critical Angle: sin(theta_c) = n2 / n1 when n1 > n2.',
      '3. Minimum Deviation in Equilateral Prism: delta_m = 2*i - A.',
      '4. Solve Problems 1 to 10 in your student portal assignment tab.',
    ],
  );
  createSamplePdf(
    path.join(UPLOADS_DIR, 'materials', 'chemistry_organic_hydrocarbons.pdf'),
    'ZAZA XPRAS - Organic Chemistry: Alkanes & Alkenes Guide',
    [
      'Instructor: Prof. Karim El-Masry | Subject: Organic Chemistry (Grade 11)',
      '1. General Formulas: Alkanes CnH2n+2, Alkenes CnH2n, Alkynes CnH2n-2.',
      '2. Markovnikov Rule for asymmetrical addition of HX to alkenes.',
      '3. Baeyer Test: Cold dilute KMnO4 decolorizes in presence of double bonds.',
    ],
  );

  const defaultSettings: Record<string, string> = {
    platform_name: 'ZAZA XPRAS',
    tagline: 'Structured Academic Mastery & Guided Exam Preparation',
    logo_url: '',
    hero_kicker: 'Egyptian Secondary & Pre-University Academy',
    hero_headline: 'Precision Teaching for Top Academic Rankings',
    hero_subheadline:
      'Structured video lectures, annotated PDF summaries, timed online exams, and personal progress tracking tailored to ambitious students across Egypt.',
    hero_cta_label: 'Explore Courses',
    hero_image_url: '/assets/images/hero_academy_campus_1794731929131.jpg',
    teacher_name: 'Prof. Karim El-Masry',
    teacher_title: 'Senior Academic Lecturer & Curriculum Director',
    teacher_subject: 'Mathematics, Physics & Applied Sciences',
    teacher_bio:
      'With over 14 years of specialized teaching across Cairo and Alexandria, Prof. Karim El-Masry has guided more than 8,400 secondary and pre-university students to top national honors. His curriculum translates complex derivations into clear, exam-ready frameworks.',
    teacher_photo_url: '/assets/images/teacher_portrait_1794731927126.jpg',
    teacher_credentials: '14+ Years Teaching · 8,400+ Enrolled Students · 96.4% Honor Rate',
    theme_navy: '#0b1528',
    theme_blue: '#1d4ed8',
    theme_gold: '#c59b27',
    theme_bg: '#f8fafc',
    whatsapp_number: '01130868723',
    contact_email: 'admissions@zazaxpras.edu',
    contact_phone: '+20 113 086 8723',
    contact_address: '18 El-Tahrir Academic Plaza, Dokki, Giza, Egypt',
    contact_hours: 'Saturday – Thursday, 10:00 AM – 9:00 PM EET',
    footer_credit: 'Designed & Developed by ZAZA XPRAS',
    sections_config: JSON.stringify([
      { id: 'hero', label: 'Welcome Hero', visible: true },
      { id: 'teacher', label: 'Teacher Profile', visible: true },
      { id: 'courses', label: 'Featured Courses', visible: true },
      { id: 'leaderboard', label: 'Student Leaderboard', visible: true },
      { id: 'plans', label: 'Subscription Plans', visible: true },
      { id: 'announcements', label: 'Latest Announcements', visible: true },
      { id: 'reviews', label: 'Student Reviews', visible: true },
      { id: 'contact', label: 'Contact Section', visible: true },
    ]),
  };

  const insertSetting = db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaultSettings)) {
    insertSetting.run(k, v);
  }

  // Top Bar Contract: <= 5 concise nav links
  const insertNav = db.prepare('INSERT INTO nav_links (label, target, sort_order, is_visible) VALUES (?, ?, ?, ?)');
  insertNav.run('Courses', '#courses', 1, 1);
  insertNav.run('Plans', '#plans', 2, 1);
  insertNav.run('Leaderboard', '#leaderboard', 3, 1);
  insertNav.run('Reviews', '#reviews', 4, 1);
  insertNav.run('Contact', '#contact', 5, 1);

  db.prepare(
    'INSERT INTO custom_pages (slug, title, subtitle, content, is_published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(
    'study-policy',
    'Academic Study Guide & Exam Rules',
    'How to maximize your score using weekly video reviews and timed mock assessments.',
    '1. Complete each unit lecture before attempting the unit quiz (+25 XP per lesson).\n2. Download the annotated PDF summary and annotate problem steps.\n3. Upload your weekly homework sheet before Thursday 10:00 PM EET for detailed instructor feedback (+20 XP).\n4. Earn milestone badges and climb the ZAZA XPRAS Honor Leaderboard by scoring above 90% on timed quizzes.',
    1,
    now,
    now,
  );

  // Badges
  const insertBadge = db.prepare(
    'INSERT INTO badges (code, title, description, icon_name, xp_reward, threshold_type, threshold_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const bFirstLesson = insertBadge.run('first_lesson', 'First Lecture', 'Completed your first video lesson on the platform.', 'play', 20, 'lessons_completed', 1);
  insertBadge.run('dedicated_scholar', 'Dedicated Scholar', 'Completed 3 or more structured curriculum lessons.', 'book', 40, 'lessons_completed', 3);
  const bQuizStarter = insertBadge.run('quiz_passed', 'Exam Qualifier', 'Passed an interactive timed assessment.', 'check', 30, 'quizzes_passed', 1);
  const bQuizAce = insertBadge.run('quiz_ace', 'Perfect Score Ace', 'Achieved 100% accuracy on an online exam.', 'trophy', 60, 'perfect_quizzes', 1);
  insertBadge.run('homework_pro', 'Assignment Contributor', 'Submitted homework for instructor evaluation.', 'file', 25, 'assignments_submitted', 1);
  const bHonorRoll = insertBadge.run('honor_roll', 'Honor Roll 200 XP', 'Reached 200 total academic XP points.', 'star', 50, 'xp_total', 200);

  // Users
  const insertUser = db.prepare(
    `INSERT INTO users (full_name, email, password_hash, role, phone, grade, school, bio, xp_points, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertUser.run(
    'ZAZA XPRAS Administrator',
    'admin@zazaxpras.edu',
    hashSeedPassword('Admin@Zaza2026!'),
    'admin',
    '01130868723',
    'Faculty',
    'ZAZA XPRAS Academy',
    'Platform administrator and lead curriculum coordinator.',
    0,
    'active',
    now,
  );
  const student1Res = insertUser.run(
    'Omar Hassan El-Sayed',
    'student@zazaxpras.edu',
    hashSeedPassword('Student@2026!'),
    'student',
    '01023456789',
    'Grade 12',
    'Orman Language School, Giza',
    'Focused on Engineering & Applied Science track for 2026–2027.',
    275,
    'active',
    now,
  );
  const student2Res = insertUser.run(
    'Nourhan Tarek Mansour',
    'nourhan@zazaxpras.edu',
    hashSeedPassword('Student@2026!'),
    'student',
    '01287654321',
    'Grade 11',
    'Victoria College, Alexandria',
    'Preparing early for STEM calculus and physics honors.',
    210,
    'active',
    now,
  );
  const student3Res = insertUser.run(
    'Youssef Mohamed Fathy',
    'youssef@zazaxpras.edu',
    hashSeedPassword('Student@2026!'),
    'student',
    '01145678901',
    'Grade 12',
    'Cairo STEM High School',
    'Targeting top 1% national STEM ranking.',
    340,
    'active',
    now,
  );
  const student4Res = insertUser.run(
    'Salma Abdelrahman',
    'salma@zazaxpras.edu',
    hashSeedPassword('Student@2026!'),
    'student',
    '01099887766',
    'Grade 12',
    'Maadi Narmer School, Cairo',
    'Pre-med physics and organic chemistry scholar.',
    185,
    'active',
    now,
  );

  // Assign earned badges for seeded leaderboard students
  const insertUserBadge = db.prepare('INSERT INTO user_badges (user_id, badge_id, earned_at) VALUES (?, ?, ?)');
  insertUserBadge.run(student1Res.lastInsertRowid, bFirstLesson.lastInsertRowid, now);
  insertUserBadge.run(student1Res.lastInsertRowid, bQuizStarter.lastInsertRowid, now);
  insertUserBadge.run(student1Res.lastInsertRowid, bQuizAce.lastInsertRowid, now);
  insertUserBadge.run(student1Res.lastInsertRowid, bHonorRoll.lastInsertRowid, now);

  insertUserBadge.run(student3Res.lastInsertRowid, bFirstLesson.lastInsertRowid, now);
  insertUserBadge.run(student3Res.lastInsertRowid, bQuizStarter.lastInsertRowid, now);
  insertUserBadge.run(student3Res.lastInsertRowid, bQuizAce.lastInsertRowid, now);
  insertUserBadge.run(student3Res.lastInsertRowid, bHonorRoll.lastInsertRowid, now);

  insertUserBadge.run(student2Res.lastInsertRowid, bFirstLesson.lastInsertRowid, now);
  insertUserBadge.run(student2Res.lastInsertRowid, bHonorRoll.lastInsertRowid, now);

  insertUserBadge.run(student4Res.lastInsertRowid, bFirstLesson.lastInsertRowid, now);

  // Seed XP events for Omar
  const insertXp = db.prepare(
    'INSERT INTO xp_events (user_id, source_type, source_id, points, description, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  );
  insertXp.run(student1Res.lastInsertRowid, 'lesson_complete', 1, 25, 'Completed Lesson 1.1: Foundations of Limits', now);
  insertXp.run(student1Res.lastInsertRowid, 'quiz_attempt', 1, 80, 'Scored 100% on Unit 1 Diagnostic Quiz', now);
  insertXp.run(student1Res.lastInsertRowid, 'badge', 4, 60, 'Unlocked Perfect Score Ace badge', now);
  insertXp.run(student1Res.lastInsertRowid, 'badge', 6, 50, 'Unlocked Honor Roll 200 XP badge', now);
  insertXp.run(student1Res.lastInsertRowid, 'assignment_submit', 1, 20, 'Submitted Homework 1 derivations', now);

  // Subscription Plans
  const insertPlan = db.prepare(
    `INSERT INTO subscription_plans
     (name, duration_days, price_egp, billing_label, description, features_json, is_featured, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertPlan.run(
    'Weekly Pass',
    7,
    120,
    '7 Days Access',
    'Ideal for focused exam-week revision and unit catch-up.',
    JSON.stringify(['Full access to all subscription video lessons', 'Downloadable PDF summaries', 'Unit quizzes & instant grading']),
    0,
    1,
    1,
  );
  const monthlyPlan = insertPlan.run(
    'Monthly Plan',
    30,
    380,
    'Per Month',
    'Consistent weekly lectures, homework grading, and topic assessments.',
    JSON.stringify(['All video lessons & study materials', 'Weekly homework submission & feedback', 'Online timed exams & grade tracker']),
    0,
    1,
    2,
  );
  insertPlan.run(
    '3-Month Term',
    90,
    990,
    'Per 3 Months',
    'Complete academic term coverage with 13% savings over monthly billing.',
    JSON.stringify(['Full 90-day unrestricted course library', 'All quizzes, mock exams & PDFs', 'Priority homework review']),
    1,
    1,
    3,
  );
  insertPlan.run(
    '6-Month Semester',
    180,
    1800,
    'Per 6 Months',
    'Full semester continuity including midterm bootcamps and past-paper banks.',
    JSON.stringify(['180-day full platform access', 'Midterm revision workshops included', 'Direct instructor Q&A via WhatsApp']),
    0,
    1,
    4,
  );
  insertPlan.run(
    'Annual Mastery',
    365,
    3100,
    'Full Academic Year',
    'End-to-end academic year coverage from foundation units through final exams.',
    JSON.stringify(['365-day complete curriculum & archives', 'Final revision marathon packs', 'Maximum 32% annual tuition savings']),
    0,
    1,
    5,
  );

  // Active subscription for Omar
  const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 25).toISOString();
  db.prepare(
    `INSERT INTO user_subscriptions (user_id, plan_id, plan_name, status, starts_at, expires_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(student1Res.lastInsertRowid, monthlyPlan.lastInsertRowid, 'Monthly Plan', 'active', now, futureDate, now);

  // Egypt Payment Methods
  const insertMethod = db.prepare(
    `INSERT INTO payment_methods (code, name, account_label, account_value, instructions, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const vfMethod = insertMethod.run(
    'vodafone_cash',
    'Vodafone Cash',
    'Vodafone Cash Wallet Number',
    '0109 876 5432',
    'Dial *9*7*01098765432*AMOUNT# or send via Ana Vodafone app. Upload a clear screenshot of the transfer confirmation SMS.',
    1,
    1,
  );
  insertMethod.run(
    'instapay',
    'InstaPay Egypt',
    'InstaPay Address (IPA)',
    'zazaxpras@instapay',
    'Open the InstaPay app, transfer the exact plan amount in EGP to zazaxpras@instapay, and upload the transaction reference screenshot.',
    1,
    2,
  );
  insertMethod.run(
    'bank_transfer',
    'Bank Transfer (CIB / NBE)',
    'IBAN / Account Number',
    'EG38 0010 0155 0000 0001 0004 8291 0',
    'Transfer to Commercial International Bank (CIB) – Beneficiary: ZAZA XPRAS Educational Services. Upload the bank slip or transfer receipt.',
    1,
    3,
  );
  insertMethod.run(
    'manual_cash',
    'Manual Center Confirmation',
    'Center Desk Code',
    'Dokki Center – Desk #2',
    'Pay in person at our Dokki academic office or through an authorized assistant, then upload your stamped paper receipt for online activation.',
    1,
    4,
  );

  db.prepare(
    `INSERT INTO payment_requests
     (user_id, plan_id, payment_method_id, method_name, amount_egp, sender_reference, receipt_url, notes, status, admin_note, created_at, reviewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    student1Res.lastInsertRowid,
    monthlyPlan.lastInsertRowid,
    vfMethod.lastInsertRowid,
    'Vodafone Cash',
    380,
    '01023456789 · TXN-88419',
    '',
    'Monthly subscription transfer completed.',
    'approved',
    'Verified via Vodafone Cash statement.',
    now,
    now,
  );

  db.prepare(
    `INSERT INTO payment_requests
     (user_id, plan_id, payment_method_id, method_name, amount_egp, sender_reference, receipt_url, notes, status, admin_note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    student2Res.lastInsertRowid,
    monthlyPlan.lastInsertRowid,
    vfMethod.lastInsertRowid,
    'Vodafone Cash',
    380,
    '01287654321 · TXN-99210',
    '',
    'Transferred 380 EGP for Monthly Plan activation.',
    'pending',
    '',
    now,
  );

  // Courses, Units, Lessons
  const insertCourse = db.prepare(
    `INSERT INTO courses (title, subject, grade, description, thumbnail_url, is_featured, is_published, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const cMath = insertCourse.run(
    'Applied Calculus & Differential Equations',
    'Mathematics',
    'Grade 12',
    'Comprehensive mastery of limits, differentiation, curve sketching, definite integrals, and applications for top secondary exam performance.',
    '/assets/images/course_mathematics_1794731929565.jpg',
    1,
    1,
    1,
    now,
  );
  const cPhys = insertCourse.run(
    'Electromagnetism & Wave Optics',
    'Physics',
    'Grade 12',
    'Deep conceptual intuition and numerical problem-solving covering refraction, prism dispersion, magnetic flux, and AC circuits.',
    '/assets/images/course_physics_1794731929321.jpg',
    1,
    1,
    2,
    now,
  );
  const cChem = insertCourse.run(
    'Organic Chemistry & Analytical Synthesis',
    'Chemistry',
    'Grade 11',
    'Structured breakdown of hydrocarbon families, isomerism, reaction mechanisms, and volumetric titration calculations.',
    '/assets/images/course_chemistry_1794731929644.jpg',
    1,
    1,
    3,
    now,
  );

  const insertUnit = db.prepare('INSERT INTO units (course_id, title, description, sort_order) VALUES (?, ?, ?, ?)');
  const uMath1 = insertUnit.run(cMath.lastInsertRowid, 'Unit 1: Limits, Continuity & Derivatives', 'Core theorems, L-Hopital applications, and implicit differentiation.', 1);
  const uMath2 = insertUnit.run(cMath.lastInsertRowid, 'Unit 2: Integration & Area Under Curves', 'Substitution, integration by parts, and volume of revolution.', 2);
  const uPhys1 = insertUnit.run(cPhys.lastInsertRowid, 'Unit 1: Geometric & Wave Optics', 'Snell law, total internal reflection, and equilateral prism deviation.', 1);
  const uChem1 = insertUnit.run(cChem.lastInsertRowid, 'Unit 1: Aliphatic Hydrocarbons', 'Nomenclature, reactions, and lab tests for alkanes and alkenes.', 1);

  const insertLesson = db.prepare(
    `INSERT INTO lessons (unit_id, course_id, title, description, duration_minutes, video_url, video_type, access_type, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const lMath1 = insertLesson.run(
    uMath1.lastInsertRowid,
    cMath.lastInsertRowid,
    'Lesson 1.1: Foundations of Limits & Indeterminate Forms',
    'Free orientation lecture introducing algebraic factoring, conjugate multiplication, and trigonometric limit identities.',
    38,
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'external',
    'free',
    1,
    now,
  );
  const lMath2 = insertLesson.run(
    uMath1.lastInsertRowid,
    cMath.lastInsertRowid,
    'Lesson 1.2: Chain Rule & Implicit Differentiation',
    'Step-by-step solved past-paper problems on composite and implicit functions.',
    46,
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'external',
    'subscription',
    2,
    now,
  );
  insertLesson.run(
    uMath2.lastInsertRowid,
    cMath.lastInsertRowid,
    'Lesson 2.1: Definite Integrals & Bounded Regions',
    'Calculating exact areas between intersecting polynomial and trigonometric curves.',
    52,
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    'external',
    'subscription',
    1,
    now,
  );
  const lPhys1 = insertLesson.run(
    uPhys1.lastInsertRowid,
    cPhys.lastInsertRowid,
    'Lesson 1.1: Refraction & Critical Angle',
    'Free introductory session demonstrating Snell Law and optical fiber reflection.',
    35,
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoy.mp4',
    'external',
    'free',
    1,
    now,
  );
  insertLesson.run(
    uPhys1.lastInsertRowid,
    cPhys.lastInsertRowid,
    'Lesson 1.2: Minimum Deviation in Triangular Prisms',
    'Graphical analysis of deviation angle versus angle of incidence.',
    44,
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    'external',
    'subscription',
    2,
    now,
  );
  const lChem1 = insertLesson.run(
    uChem1.lastInsertRowid,
    cChem.lastInsertRowid,
    'Lesson 1.1: IUPAC Nomenclature & Isomerism',
    'Systematic rules for naming branched alkanes, alkenes, and cyclic rings.',
    40,
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'external',
    'free',
    1,
    now,
  );

  const insertMat = db.prepare(
    'INSERT INTO lesson_materials (lesson_id, title, material_type, file_url, file_size, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  );
  insertMat.run(lMath1.lastInsertRowid, 'Limits & Continuity Annotated Summary (PDF)', 'summary_pdf', '/uploads/materials/calculus_limits_summary.pdf', '185 KB', now);
  insertMat.run(lMath2.lastInsertRowid, 'Chain Rule Solved Sheet (PDF)', 'worksheet', '/uploads/materials/calculus_limits_summary.pdf', '185 KB', now);
  insertMat.run(lPhys1.lastInsertRowid, 'Wave Optics & Prism Formula Sheet (PDF)', 'summary_pdf', '/uploads/materials/physics_optics_worksheet.pdf', '160 KB', now);
  insertMat.run(lChem1.lastInsertRowid, 'Hydrocarbons Reaction Map (PDF)', 'summary_pdf', '/uploads/materials/chemistry_organic_hydrocarbons.pdf', '172 KB', now);

  // Progress & Saved
  db.prepare('INSERT INTO lesson_progress (user_id, lesson_id, completed, watch_percent, last_watched_at) VALUES (?, ?, ?, ?, ?)').run(
    student1Res.lastInsertRowid,
    lMath1.lastInsertRowid,
    1,
    100,
    now,
  );
  db.prepare('INSERT INTO lesson_progress (user_id, lesson_id, completed, watch_percent, last_watched_at) VALUES (?, ?, ?, ?, ?)').run(
    student3Res.lastInsertRowid,
    lMath1.lastInsertRowid,
    1,
    100,
    now,
  );
  db.prepare('INSERT INTO lesson_progress (user_id, lesson_id, completed, watch_percent, last_watched_at) VALUES (?, ?, ?, ?, ?)').run(
    student3Res.lastInsertRowid,
    lPhys1.lastInsertRowid,
    1,
    100,
    now,
  );
  db.prepare('INSERT INTO saved_lessons (user_id, lesson_id, saved_at) VALUES (?, ?, ?)').run(
    student1Res.lastInsertRowid,
    lPhys1.lastInsertRowid,
    now,
  );

  // Quizzes with Mixed Question Formats + Randomization Option
  const insertQuiz = db.prepare(
    `INSERT INTO quizzes (course_id, lesson_id, title, description, time_limit_minutes, passing_score, randomize_questions, is_published, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const qMath = insertQuiz.run(
    cMath.lastInsertRowid,
    lMath1.lastInsertRowid,
    'Unit 1 Diagnostic Quiz: Limits & Continuity',
    'Mixed-format timed exam covering MCQ, True/False, and short-answer limit evaluations with instant explanations.',
    15,
    60,
    1,
    1,
    now,
  );
  const qPhys = insertQuiz.run(
    cPhys.lastInsertRowid,
    lPhys1.lastInsertRowid,
    'Optics Assessment: Refraction & Prisms',
    'Timed calculation drill on Snell Law, critical angles, and minimum deviation.',
    20,
    60,
    1,
    1,
    now,
  );

  const insertQuestion = db.prepare(
    `INSERT INTO quiz_questions (quiz_id, question_type, question_text, options_json, correct_index, accepted_answer, explanation, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertQuestion.run(
    qMath.lastInsertRowid,
    'multiple_choice',
    'Evaluate the limit: lim (x -> 0) of sin(5x) / x',
    JSON.stringify(['0', '1', '5', 'Undefined']),
    2,
    '',
    'Using the standard identity lim (u -> 0) sin(u)/u = 1, rewrite sin(5x)/x as 5 * [sin(5x)/(5x)] = 5.',
    1,
  );
  insertQuestion.run(
    qMath.lastInsertRowid,
    'true_false',
    'True or False: If a function f(x) is continuous at x = a, it must always be differentiable at x = a.',
    JSON.stringify(['True', 'False']),
    1,
    '',
    'False. Continuity does not guarantee differentiability (e.g., f(x) = |x| is continuous at x = 0, but has a sharp corner and is not differentiable there).',
    2,
  );
  insertQuestion.run(
    qMath.lastInsertRowid,
    'short_answer',
    'Evaluate numerically: lim (x -> 3) of (x^2 - 9) / (x - 3)',
    JSON.stringify([]),
    0,
    '6',
    'Factor the numerator as (x - 3)(x + 3), cancel (x - 3), then substitute x = 3 to get 3 + 3 = 6.',
    3,
  );
  insertQuestion.run(
    qMath.lastInsertRowid,
    'multiple_choice',
    'Which indeterminate form directly permits applying L-Hopital Rule?',
    JSON.stringify(['1 / 0', '0 / 0', 'infinity * 1', '0 + infinity']),
    1,
    '',
    'L-Hopital Rule applies directly to 0/0 or infinity/infinity indeterminate quotients.',
    4,
  );

  insertQuestion.run(
    qPhys.lastInsertRowid,
    'multiple_choice',
    'Light travels from glass (n = 1.5) into air (n = 1.0). What is sin(theta_c) for total internal reflection?',
    JSON.stringify(['0.50', '0.67', '0.75', '1.50']),
    1,
    '',
    'sin(theta_c) = n_air / n_glass = 1.0 / 1.5 = 2/3 ≈ 0.67.',
    1,
  );
  insertQuestion.run(
    qPhys.lastInsertRowid,
    'true_false',
    'True or False: At minimum deviation in a triangular prism, the angle of incidence equals the angle of emergence.',
    JSON.stringify(['True', 'False']),
    0,
    '',
    'True. Minimum deviation occurs symmetrically when the internal ray travels parallel to the prism base, so i1 = i2.',
    2,
  );
  insertQuestion.run(
    qPhys.lastInsertRowid,
    'short_answer',
    'In an equilateral prism (A = 60 deg), if angle of incidence i = 45 deg at minimum deviation, find the angle of minimum deviation delta_m (enter number in degrees).',
    JSON.stringify([]),
    0,
    '30,30 deg,30°',
    'At minimum deviation, delta_m = 2i - A = 2(45) - 60 = 30 degrees.',
    3,
  );

  db.prepare(
    `INSERT INTO quiz_attempts (quiz_id, user_id, answers_json, score, total_questions, percentage, passed, xp_earned, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(qMath.lastInsertRowid, student1Res.lastInsertRowid, JSON.stringify({}), 4, 4, 100, 1, 80, now);

  // Assignments
  const insertAssign = db.prepare(
    'INSERT INTO assignments (course_id, lesson_id, title, instructions, due_date, max_score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const aMath = insertAssign.run(
    cMath.lastInsertRowid,
    lMath1.lastInsertRowid,
    'Homework 1: Algebraic & Trigonometric Limits Set',
    'Solve the 5 limit problems in the attached PDF summary and submit your step-by-step derivations below or upload a clear photo/PDF of your notebook.',
    '2026-11-25',
    20,
    now,
  );
  insertAssign.run(
    cPhys.lastInsertRowid,
    lPhys1.lastInsertRowid,
    'Lab Sheet 1: Optical Prism Angle Derivations',
    'Derive the relation between apex angle A and minimum deviation angle delta_m and include a labeled ray diagram.',
    '2026-11-28',
    25,
    now,
  );

  db.prepare(
    `INSERT INTO assignment_submissions (assignment_id, user_id, answer_text, file_url, score, feedback, status, submitted_at, graded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    aMath.lastInsertRowid,
    student1Res.lastInsertRowid,
    'Completed all 5 limit derivations using factoring and L-Hopital verification. Final answers: (1) 5, (2) 6, (3) 1/2, (4) 0, (5) 12.',
    '',
    19,
    'Clean algebraic steps on questions 1-4. Double-check sign notation in question 5.',
    'graded',
    now,
    now,
  );

  // Announcements
  const insertAnn = db.prepare(
    'INSERT INTO announcements (title, body, target_grade, is_pinned, is_published, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  );
  insertAnn.run(
    'Mid-Term Calculus & Optics Intensive Workshop Schedule',
    'Live problem-solving revision sessions begin this Friday at 6:00 PM EET. Download the updated Unit 1 & 2 formula sheets directly inside each lesson before joining.',
    'Grade 12',
    1,
    1,
    now,
  );
  insertAnn.run(
    'Instant InstaPay & Vodafone Cash Activation Notice',
    'Students submitting InstaPay or Vodafone Cash receipts between 10:00 AM and 10:00 PM EET receive verification within 20 minutes. Always include your sender phone number.',
    'All Grades',
    0,
    1,
    now,
  );

  // Student Reviews
  const insertRev = db.prepare(
    'INSERT INTO reviews (user_id, student_name, student_grade, rating, comment, outcome_metric, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );
  insertRev.run(
    student1Res.lastInsertRowid,
    'Omar Hassan El-Sayed',
    'Grade 12 · Giza',
    5,
    'The step-by-step video breakdowns and annotated PDF summaries completely changed how I approach calculus proofs. My mock exam score jumped from 74% to 97% in six weeks.',
    '+23% Exam Score Improvement',
    'approved',
    now,
  );
  insertRev.run(
    null,
    'Salma Abdelrahman',
    'Grade 12 · Cairo',
    5,
    'Having timed online quizzes right beneath each physics lecture made revision effortless. Whenever I got stuck on prism deviation, the PDF sheet and WhatsApp desk helped immediately.',
    '98% Physics Final Score',
    'approved',
    now,
  );
  insertRev.run(
    null,
    'Youssef Mohamed Fathy',
    'Grade 11 · Alexandria',
    5,
    'Clear organization by unit and lesson, zero distractions, and seamless Vodafone Cash subscription activation. Easily the best structured academic platform I have used.',
    'Top 3 in School Mock Ranking',
    'approved',
    now,
  );
}
