import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { useSession } from "@/components/session";
import {
  addGoal,
  listGoals,
  removeGoal,
  setGoalDone,
  type Goal,
} from "@/goals.functions";
import { formatGoalDate, MAX_GOAL_TITLE } from "@/lib/goals";

export const Route = createFileRoute("/goals")({
  head: () => ({
    meta: [
      { title: "Goals — Dash" },
      {
        name: "description",
        content:
          "Write down what you're working toward and keep your goals in one private place.",
      },
      { property: "og:title", content: "Goals — Dash" },
      {
        property: "og:description",
        content: "Write down what you're working toward and keep your goals in one private place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GoalsPage,
});

function message(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function GoalsPage() {
  const { session, loading } = useSession();
  const queryClient = useQueryClient();

  const fetchGoals = useServerFn(listGoals);
  const createGoal = useServerFn(addGoal);
  const completeGoal = useServerFn(setGoalDone);
  const dropGoal = useServerFn(removeGoal);

  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["goals"] });

  const goalsQuery = useQuery({
    queryKey: ["goals"],
    queryFn: () => fetchGoals(),
    enabled: !!session,
  });

  const add = useMutation({
    mutationFn: async () => {
      const result = await createGoal({
        data: { title, targetDate: targetDate || null },
      });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      setTitle("");
      setTargetDate("");
      void refresh();
    },
    onError: (error) => toast.error(message(error)),
  });

  const toggle = useMutation({
    mutationFn: async (goal: Goal) => {
      const result = await completeGoal({
        data: { id: goal.id, done: !goal.done },
      });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => void refresh(),
    onError: (error) => toast.error(message(error)),
  });

  const del = useMutation({
    mutationFn: async (goal: Goal) => {
      const result = await dropGoal({ data: { id: goal.id } });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => void refresh(),
    onError: (error) => toast.error(message(error)),
  });

  const result = goalsQuery.data;
  const goals = result?.ok ? result.goals : [];

  return (
    <main className="mx-auto w-full max-w-2xl px-6 pb-24">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
        Your goals
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Write down what you're working toward. Dash keeps them here, private to
        your account.
      </p>

      {loading ? null : !session ? (
        <div className="mt-10 rounded-2xl border border-input bg-card p-8 text-center">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Sign in to keep your goals
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Your goals stay private to your own account — nobody else can see or
            change them.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/auth"
              className="rounded-full bg-timer-accent px-6 py-3 font-display text-sm font-semibold text-timer-accent-foreground transition-opacity hover:opacity-90"
            >
              Sign in
            </Link>
            <Link
              to="/auth"
              className="rounded-full border border-input px-6 py-3 font-display text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Create an account
            </Link>
          </div>
        </div>
      ) : (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!add.isPending) add.mutate();
            }}
            className="mt-8 flex flex-col gap-3 sm:flex-row"
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={MAX_GOAL_TITLE}
              placeholder="What do you want to get done?"
              aria-label="Your goal"
              className="h-12 flex-1 rounded-full border border-input bg-transparent px-5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-timer-accent"
            />
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              aria-label="Target date (optional)"
              className="h-12 rounded-full border border-input bg-transparent px-4 font-mono text-sm text-muted-foreground outline-none focus:border-timer-accent"
            />
            <button
              type="submit"
              disabled={add.isPending || title.trim().length === 0}
              className="h-12 rounded-full bg-timer-accent px-7 font-display text-sm font-semibold text-timer-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Add
            </button>
          </form>

          <div className="mt-8">
            {goalsQuery.isLoading ? (
              <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                loading…
              </p>
            ) : result && !result.ok ? (
              <p className="font-mono text-xs text-destructive">{result.error}</p>
            ) : goals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing here yet — add the first thing you want to get done.
              </p>
            ) : (
              <ul className="space-y-2">
                {goals.map((goal) => (
                  <li
                    key={goal.id}
                    className="flex items-center gap-4 rounded-xl border border-input bg-card px-4 py-3"
                  >
                    <button
                      onClick={() => toggle.mutate(goal)}
                      aria-pressed={goal.done}
                      aria-label={
                        goal.done ? "Mark as not done" : "Mark as done"
                      }
                      className={
                        "h-5 w-5 shrink-0 rounded-full border transition-colors " +
                        (goal.done
                          ? "border-timer-accent bg-timer-accent"
                          : "border-input hover:border-timer-accent")
                      }
                    />
                    <span
                      className={
                        "flex-1 text-sm " +
                        (goal.done
                          ? "text-muted-foreground line-through"
                          : "text-foreground")
                      }
                    >
                      {goal.title}
                    </span>
                    {formatGoalDate(goal.target_date) ? (
                      <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                        {formatGoalDate(goal.target_date)}
                      </span>
                    ) : null}
                    <button
                      onClick={() => del.mutate(goal)}
                      aria-label={`Delete ${goal.title}`}
                      className="rounded-md px-2 py-1 font-mono text-xs tracking-wider text-muted-foreground uppercase transition-colors hover:text-destructive"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </main>
  );
}
