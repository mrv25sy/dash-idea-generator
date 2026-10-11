export const MAX_GOAL_TITLE = 200;

export type GoalInput = { title: string; targetDate: string | null };

export type GoalValidation =
  | { ok: true; value: GoalInput }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** True only for a real calendar day written as YYYY-MM-DD. */
function isRealDate(value: string) {
  if (!DATE_RE.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Trims and checks a submitted goal. Returns a readable message on failure. */
export function validateGoalInput(raw: {
  title?: unknown;
  targetDate?: unknown;
}): GoalValidation {
  const title =
    typeof raw.title === "string" ? raw.title.trim().replace(/\s+/g, " ") : "";

  if (!title) return { ok: false, error: "Write your goal first." };
  if (title.length > MAX_GOAL_TITLE)
    return {
      ok: false,
      error: `Keep your goal under ${MAX_GOAL_TITLE} characters.`,
    };

  const rawDate =
    typeof raw.targetDate === "string" ? raw.targetDate.trim() : "";

  if (rawDate && !isRealDate(rawDate))
    return { ok: false, error: "Pick a real date." };

  return { ok: true, value: { title, targetDate: rawDate || null } };
}

export function formatGoalDate(iso: string | null | undefined) {
  if (!iso || !isRealDate(iso)) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
