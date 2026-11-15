import { db } from './db.ts';

export interface EarnedBadgeInfo {
  id: number;
  code: string;
  title: string;
  description: string;
  icon_name: string;
  xp_reward: number;
  earned_at?: string;
}

export function computeLevel(xp: number) {
  const level = Math.floor(xp / 150) + 1;
  const currentLevelMin = (level - 1) * 150;
  const nextLevelMin = level * 150;
  const progressPercent = Math.min(
    100,
    Math.round(((xp - currentLevelMin) / (nextLevelMin - currentLevelMin)) * 100),
  );
  const titles = [
    'Foundation Learner',
    'Rising Scholar',
    'Analytical Thinker',
    'Honors Candidate',
    'Academy Fellow',
    'Master Laureate',
  ];
  const title = titles[Math.min(level - 1, titles.length - 1)];
  return { level, title, currentLevelMin, nextLevelMin, progressPercent };
}

export function awardXp(
  userId: number,
  sourceType: string,
  sourceId: number,
  points: number,
  description: string,
  allowDuplicate = false,
): { awarded: number; newlyUnlockedBadges: EarnedBadgeInfo[] } {
  const now = new Date().toISOString();
  if (!allowDuplicate) {
    const existing = db
      .prepare('SELECT id FROM xp_events WHERE user_id = ? AND source_type = ? AND source_id = ? LIMIT 1')
      .get(userId, sourceType, sourceId);
    if (existing) {
      const unlocked = evaluateAndUnlockBadges(userId);
      return { awarded: 0, newlyUnlockedBadges: unlocked };
    }
  }

  db.prepare(
    'INSERT INTO xp_events (user_id, source_type, source_id, points, description, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(userId, sourceType, sourceId, points, description, now);
  db.prepare('UPDATE users SET xp_points = xp_points + ? WHERE id = ?').run(points, userId);

  const newlyUnlockedBadges = evaluateAndUnlockBadges(userId);
  return { awarded: points, newlyUnlockedBadges };
}

export function evaluateAndUnlockBadges(userId: number): EarnedBadgeInfo[] {
  const now = new Date().toISOString();
  const user = db.prepare('SELECT xp_points FROM users WHERE id = ?').get(userId) as
    | { xp_points: number }
    | undefined;
  if (!user) return [];

  const lessonsCompleted = (
    db.prepare('SELECT COUNT(*) as cnt FROM lesson_progress WHERE user_id = ? AND completed = 1').get(userId) as {
      cnt: number;
    }
  ).cnt;
  const quizzesPassed = (
    db.prepare('SELECT COUNT(DISTINCT quiz_id) as cnt FROM quiz_attempts WHERE user_id = ? AND passed = 1').get(userId) as {
      cnt: number;
    }
  ).cnt;
  const perfectQuizzes = (
    db.prepare('SELECT COUNT(DISTINCT quiz_id) as cnt FROM quiz_attempts WHERE user_id = ? AND percentage >= 100').get(userId) as {
      cnt: number;
    }
  ).cnt;
  const assignmentsSubmitted = (
    db.prepare('SELECT COUNT(DISTINCT assignment_id) as cnt FROM assignment_submissions WHERE user_id = ?').get(userId) as {
      cnt: number;
    }
  ).cnt;

  const allBadges = db.prepare('SELECT * FROM badges').all() as Array<{
    id: number;
    code: string;
    title: string;
    description: string;
    icon_name: string;
    xp_reward: number;
    threshold_type: string;
    threshold_value: number;
  }>;

  const earnedRows = db.prepare('SELECT badge_id FROM user_badges WHERE user_id = ?').all(userId) as Array<{
    badge_id: number;
  }>;
  const earnedSet = new Set(earnedRows.map((r) => r.badge_id));
  const newlyUnlocked: EarnedBadgeInfo[] = [];

  for (const b of allBadges) {
    if (earnedSet.has(b.id)) continue;
    let met = false;
    if (b.threshold_type === 'lessons_completed') met = lessonsCompleted >= b.threshold_value;
    else if (b.threshold_type === 'quizzes_passed') met = quizzesPassed >= b.threshold_value;
    else if (b.threshold_type === 'perfect_quizzes') met = perfectQuizzes >= b.threshold_value;
    else if (b.threshold_type === 'assignments_submitted') met = assignmentsSubmitted >= b.threshold_value;
    else if (b.threshold_type === 'xp_total') met = user.xp_points >= b.threshold_value;

    if (met) {
      db.prepare('INSERT INTO user_badges (user_id, badge_id, earned_at) VALUES (?, ?, ?)').run(userId, b.id, now);
      db.prepare(
        'INSERT INTO xp_events (user_id, source_type, source_id, points, description, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(userId, 'badge', b.id, b.xp_reward, `Unlocked badge: ${b.title}`, now);
      db.prepare('UPDATE users SET xp_points = xp_points + ? WHERE id = ?').run(b.xp_reward, userId);
      user.xp_points += b.xp_reward;
      newlyUnlocked.push({
        id: b.id,
        code: b.code,
        title: b.title,
        description: b.description,
        icon_name: b.icon_name,
        xp_reward: b.xp_reward,
        earned_at: now,
      });
    }
  }

  return newlyUnlocked;
}

export function getLeaderboard(limit = 10) {
  const rows = db
    .prepare(
      `SELECT u.id, u.full_name, u.grade, u.school, u.avatar_url, u.xp_points,
        (SELECT COUNT(*) FROM user_badges ub WHERE ub.user_id = u.id) as badges_count,
        (SELECT COUNT(*) FROM lesson_progress lp WHERE lp.user_id = u.id AND lp.completed = 1) as lessons_completed,
        (SELECT COALESCE(ROUND(AVG(qa.percentage)), 0) FROM quiz_attempts qa WHERE qa.user_id = u.id) as avg_quiz_score
       FROM users u
       WHERE u.role = 'student' AND u.status = 'active'
       ORDER BY u.xp_points DESC, lessons_completed DESC, u.id ASC
       LIMIT ?`,
    )
    .all(limit) as Array<{
    id: number;
    full_name: string;
    grade: string;
    school: string;
    avatar_url: string;
    xp_points: number;
    badges_count: number;
    lessons_completed: number;
    avg_quiz_score: number;
  }>;

  return rows.map((row, idx) => ({
    ...row,
    rank: idx + 1,
    ...computeLevel(row.xp_points),
  }));
}
