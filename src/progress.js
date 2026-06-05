export function toLocalDateKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildGrowthCalendar(history, now = new Date()) {
  const days = new Map();
  for (const session of history) {
    const key = toLocalDateKey(session.date);
    const current = days.get(key) || { date: key, sessions: 0, bestScore: 0, words: 0 };
    current.sessions += 1;
    current.bestScore = Math.max(current.bestScore, Number(session.overall) || 0);
    current.words += Number(session.words) || 0;
    days.set(key, current);
  }

  const year = now.getFullYear();
  const month = now.getMonth();
  const cells = Array.from({ length: new Date(year, month, 1).getDay() }, () => null);
  for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day += 1) {
    const key = toLocalDateKey(new Date(year, month, day));
    cells.push({ day, key, isToday: key === toLocalDateKey(now), activity: days.get(key) || null });
  }

  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  return {
    label: `${year}年${month + 1}月`,
    cells,
    activeDays: [...days.keys()].filter(key => key.startsWith(monthPrefix)).length,
    streak: calculateStreak(days, now),
    totalWords: [...days.values()].reduce((sum, day) => sum + day.words, 0)
  };
}

function calculateStreak(days, now) {
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(toLocalDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(toLocalDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
