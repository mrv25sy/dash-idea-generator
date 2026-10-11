import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { isUuid, validateGoalInput } from "@/lib/goals";

export type Goal = Database["public"]["Tables"]["goals"]["Row"];

export type GoalList = { ok: true; goals: Goal[] } | { ok: false; error: string };

export type GoalResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): GoalResult => ({ ok: false, error });

export const listGoals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GoalList> => {
    const { data, error } = await context.supabase
      .from("goals")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return { ok: false, error: "Could not load your goals." };
    return { ok: true, goals: (data ?? []) as Goal[] };
  });

export const addGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title?: unknown; targetDate?: unknown }) => input)
  .handler(async ({ data, context }): Promise<GoalResult> => {
    const parsed = validateGoalInput(data);
    if (!parsed.ok) return fail(parsed.error);

    const { error } = await context.supabase.from("goals").insert({
      user_id: context.userId,
      title: parsed.value.title,
      target_date: parsed.value.targetDate,
    });

    if (error) return fail("Could not save that goal. Try again.");
    return { ok: true };
  });

export const setGoalDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id?: unknown; done?: unknown }) => input)
  .handler(async ({ data, context }): Promise<GoalResult> => {
    if (!isUuid(data.id)) return fail("That goal no longer exists.");

    const { error } = await context.supabase
      .from("goals")
      .update({ done: Boolean(data.done) })
      .eq("id", data.id);

    if (error) return fail("Could not update that goal. Try again.");
    return { ok: true };
  });

export const removeGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id?: unknown }) => input)
  .handler(async ({ data, context }): Promise<GoalResult> => {
    if (!isUuid(data.id)) return fail("That goal no longer exists.");

    const { error } = await context.supabase
      .from("goals")
      .delete()
      .eq("id", data.id);

    if (error) return fail("Could not delete that goal. Try again.");
    return { ok: true };
  });
