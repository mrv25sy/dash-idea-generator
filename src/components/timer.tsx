import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "running" | "paused" | "done";

const PRESETS = [
  { label: "1m", ms: 60_000 },
  { label: "3m", ms: 180_000 },
  { label: "5m", ms: 300_000 },
  { label: "10m", ms: 600_000 },
  { label: "25m", ms: 1_500_000 },
];

const MAX_MS = 24 * 60 * 60 * 1000;

function format(ms: number) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Accepts "5:30", "1:05:00", or a bare number of minutes ("90"). */
function parseDuration(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  if (/^\d{1,3}$/.test(t)) return Number(t) * 60_000;
  const parts = t.split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  if (parts.some((p) => !/^\d{1,2}$/.test(p.trim()))) return null;
  const nums = parts.map((p) => Number(p.trim()));
  if (nums.slice(-2).some((n) => n > 59)) return null;
  const expanded = nums.length === 3 ? nums : [0, ...nums];
  const [h = 0, m = 0, s = 0] = expanded;
  const ms = (h * 3600 + m * 60 + s) * 1000;
  return ms > 0 && ms <= MAX_MS ? ms : null;
}

export function Timer() {
  const [durationMs, setDurationMs] = useState(300_000);
  const [remainingMs, setRemainingMs] = useState(300_000);
  const [status, setStatus] = useState<Status>("idle");
  const [draft, setDraft] = useState("5:00");
  const [error, setError] = useState<string | null>(null);

  const endAtRef = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const running = status === "running";

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const endAt = endAtRef.current;
      if (endAt == null) return;
      const left = endAt - Date.now();
      if (left <= 0) {
        endAtRef.current = null;
        setRemainingMs(0);
        setStatus("done");
      } else {
        setRemainingMs(left);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    document.title =
      status === "running" || status === "paused"
        ? `${format(remainingMs)} — Dash`
        : "Dash";
  }, [remainingMs, status]);

  const chime = useCallback(() => {
    const ctx = audioRef.current;
    if (!ctx) return;
    [0, 0.32, 0.64].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = i === 2 ? 1046.5 : 830.6;
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  }, []);

  useEffect(() => {
    if (status === "done") chime();
  }, [status, chime]);

  const start = useCallback(() => {
    const base = remainingMs > 0 ? remainingMs : durationMs;
    if (base <= 0) return;
    if (!audioRef.current) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Ctor) audioRef.current = new Ctor();
    }
    void audioRef.current?.resume();
    endAtRef.current = Date.now() + base;
    setRemainingMs(base);
    setStatus("running");
  }, [remainingMs, durationMs]);

  const pause = useCallback(() => {
    const endAt = endAtRef.current;
    if (endAt != null) setRemainingMs(Math.max(0, endAt - Date.now()));
    endAtRef.current = null;
    setStatus("paused");
  }, []);

  const reset = useCallback(() => {
    endAtRef.current = null;
    setRemainingMs(durationMs);
    setStatus("idle");
  }, [durationMs]);

  const applyDuration = useCallback((ms: number) => {
    endAtRef.current = null;
    setDurationMs(ms);
    setRemainingMs(ms);
    setStatus("idle");
  }, []);

  const adjust = useCallback((deltaMs: number) => {
    setDurationMs((d) => Math.min(MAX_MS, Math.max(1000, d + deltaMs)));
    setRemainingMs((r) => Math.max(0, r + deltaMs));
    if (endAtRef.current != null) endAtRef.current += deltaMs;
  }, []);

  const commitDraft = useCallback(() => {
    const ms = parseDuration(draft);
    if (ms == null) {
      setError("Use a time like 5:00, 1:30, or 90 (minutes).");
      return;
    }
    setError(null);
    applyDuration(ms);
  }, [draft, applyDuration]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.isContentEditable)) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (status === "running") pause();
        else start();
      } else if (e.key.toLowerCase() === "r") {
        reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, start, pause, reset]);

  const radius = 138;
  const circumference = 2 * Math.PI * radius;
  const progress = durationMs > 0 ? Math.min(1, remainingMs / durationMs) : 0;

  return (
    <section className="w-full max-w-lg">
      <header className="mb-8 flex items-baseline justify-between">
        <span className="font-display text-sm font-semibold tracking-[0.28em] text-timer-accent uppercase">
          Dash
        </span>
        <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
          {status === "done"
            ? "finished"
            : status === "running"
              ? "running"
              : status === "paused"
                ? "paused"
                : "ready"}
        </span>
      </header>

      <div className="relative mx-auto aspect-square w-full max-w-[340px]">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 320 320">
          <circle
            cx="160"
            cy="160"
            r={radius}
            fill="none"
            strokeWidth="10"
            className="stroke-timer-track"
          />
          <circle
            cx="160"
            cy="160"
            r={radius}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            className="stroke-timer-accent transition-[stroke-dashoffset] duration-100 ease-linear"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={
              "font-mono text-6xl font-bold tabular-nums text-foreground sm:text-7xl " +
              (status === "done" ? "animate-pulse text-timer-accent" : "")
            }
          >
            {format(remainingMs)}
          </span>
          <span className="mt-2 h-5 font-mono text-xs tracking-[0.22em] text-muted-foreground uppercase">
            {status === "done" ? "time is up" : "remaining"}
          </span>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {status === "done"
          ? "Timer finished"
          : status === "running"
            ? `Timer running, ${format(remainingMs)} left`
            : ""}
      </p>

      <div className="mt-8 flex items-center justify-center gap-3">
        {running ? (
          <button
            onClick={pause}
            className="h-14 rounded-full bg-timer-accent px-10 font-display text-base font-semibold text-timer-accent-foreground transition-opacity hover:opacity-90"
          >
            Pause
          </button>
        ) : (
          <button
            onClick={start}
            className="h-14 rounded-full bg-timer-accent px-10 font-display text-base font-semibold text-timer-accent-foreground transition-opacity hover:opacity-90"
          >
            {status === "paused" ? "Resume" : status === "done" ? "Again" : "Start"}
          </button>
        )}
        <button
          onClick={reset}
          className="h-14 rounded-full border border-input px-7 font-display text-base font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Reset
        </button>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {PRESETS.map((p) => {
          const active = durationMs === p.ms;
          return (
            <button
              key={p.label}
              onClick={() => applyDuration(p.ms)}
              className={
                "rounded-full px-4 py-2 font-mono text-sm tabular-nums transition-colors " +
                (active
                  ? "bg-timer-accent text-timer-accent-foreground"
                  : "border border-input text-muted-foreground hover:bg-accent hover:text-foreground")
              }
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-center gap-2">
        <button
          onClick={() => adjust(-30_000)}
          className="h-10 w-10 rounded-full border border-input font-mono text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Subtract 30 seconds"
        >
          −30
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            commitDraft();
          }}
          className="flex items-center gap-2"
        >
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            onBlur={commitDraft}
            aria-label="Set a custom time"
            placeholder="mm:ss"
            className="h-10 w-28 rounded-full border border-input bg-transparent px-4 text-center font-mono text-sm tabular-nums text-foreground outline-none placeholder:text-muted-foreground focus:border-timer-accent"
          />
          <button
            type="submit"
            className="h-10 rounded-full border border-input px-4 font-mono text-xs tracking-widest text-muted-foreground uppercase transition-colors hover:bg-accent hover:text-foreground"
          >
            Set
          </button>
        </form>
        <button
          onClick={() => adjust(30_000)}
          className="h-10 w-10 rounded-full border border-input font-mono text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Add 30 seconds"
        >
          +30
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-center font-mono text-xs text-destructive">{error}</p>
      ) : (
        <p className="mt-5 text-center font-mono text-xs tracking-wide text-muted-foreground">
          space = start / pause · r = reset
        </p>
      )}
    </section>
  );
}
