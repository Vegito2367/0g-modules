"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PatternIcon } from "@/components/faucet/PatternIcon";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";
import { submitProofForValidation, generateProof } from "@/lib/prove";
/* ── Local types & helpers (decoupled from captchaModel) ── */

type PatternType = "circle" | "triangle" | "plus" | "waves" | "stripes" | "star";
type ExportedJson = { score: number };
type Puzzle = {
  seed: number;
  id: string;
  target: PatternType;
  tiles: PatternType[];
  targetIndices: Set<number>;
};

const PATTERN_TYPES: PatternType[] = ["circle", "triangle", "plus", "waves", "stripes", "star"];
const TILE_COUNT = 16;
const MIN_TARGETS = 4;
const MAX_TARGETS = 7;
const BOT_STEP_INTERVAL_MS = 180;
const MOUSE_SAMPLE_INTERVAL_MS = 8;
const HUMAN_SCORE = 2003;
const BOT_SCORE = -4328;

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generatePuzzle(seed: number): Puzzle {
  const rng = mulberry32(seed);
  const target = PATTERN_TYPES[Math.floor(rng() * PATTERN_TYPES.length)];
  const targetCount = MIN_TARGETS + Math.floor(rng() * (MAX_TARGETS - MIN_TARGETS + 1));
  const indices = Array.from({ length: TILE_COUNT }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const targetIndices = new Set(indices.slice(0, targetCount));
  const distractors = PATTERN_TYPES.filter((p) => p !== target);
  const tiles: PatternType[] = [];
  for (let i = 0; i < TILE_COUNT; i++) {
    tiles.push(targetIndices.has(i) ? target : distractors[Math.floor(rng() * distractors.length)]);
  }
  return { seed, id: `pzl_${seed.toString(16).padStart(8, "0")}`, target, tiles, targetIndices };
}

function generateBotPath(
  sx: number, sy: number, ex: number, ey: number, dur: number,
): { x: number; y: number; t: number }[] {
  const steps = Math.max(12, Math.round(dur / MOUSE_SAMPLE_INTERVAL_MS));
  const path: { x: number; y: number; t: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const frac = i / steps;
    path.push({
      x: sx + (ex - sx) * frac + (Math.random() - 0.5) * 0.15,
      y: sy + (ey - sy) * frac + (Math.random() - 0.5) * 0.15,
      t: i * MOUSE_SAMPLE_INTERVAL_MS,
    });
  }
  return path;
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onVerifiedHuman: (payload: ExportedJson, score: number) => void;
};

export function CaptchaModal({ isOpen, onClose, onVerifiedHuman }: Props) {
  const reducedMotion = useReducedMotionPref();
  const [puzzle, setPuzzle] = useState<Puzzle>(() => generatePuzzle(42));
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [simulateBot, setSimulateBot] = useState(false);
  const [modelScore, setModelScore] = useState(0);
  const [modelLabel, setModelLabel] = useState<"HUMAN" | "BOT">("BOT");
  const [solved, setSolved] = useState(false);
  const [verified, setVerified] = useState(false);
  const [incorrectTiles, setIncorrectTiles] = useState<Set<number>>(new Set());
  const [missedTiles, setMissedTiles] = useState<Set<number>>(new Set());
  const [verifyLoading, setVerifyLoading] = useState(false);

  const [botCursorPos, setBotCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [botCursorVisible, setBotCursorVisible] = useState(false);

  const botTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const botRafRef = useRef<number[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const tileClickRef = useRef<(index: number) => void>(() => {});
  const verifyRef = useRef<() => void>(() => {});

  const clearBotTimers = () => {
    botTimersRef.current.forEach(clearTimeout);
    botTimersRef.current = [];
    botRafRef.current.forEach(cancelAnimationFrame);
    botRafRef.current = [];
  };

  useEffect(() => () => clearBotTimers(), []);

  const newPuzzle = useCallback(() => {
    clearBotTimers();
    setBotCursorVisible(false);
    setBotCursorPos(null);
    const seed = Date.now();
    setPuzzle(generatePuzzle(seed));
    setSelected(new Set());
    setSolved(false);
    setVerified(false);
    setVerifyLoading(false);
    setIncorrectTiles(new Set());
    setMissedTiles(new Set());
    setModelScore(0);
    setModelLabel("BOT");
  }, []);

  // Reset and autofocus whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    newPuzzle();
    const t = setTimeout(() => dialogRef.current?.focus(), 40);
    return () => clearTimeout(t);
  }, [isOpen, newPuzzle]);

  // Focus trap + escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !simulateBot) onClose();
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>("button,input,[tabindex]:not([tabindex='-1'])"),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, simulateBot]);

  const handleTileClick = useCallback(
    (index: number) => {
      if (solved && verified) return;
      if (incorrectTiles.size > 0 || missedTiles.size > 0) {
        setIncorrectTiles(new Set());
        setMissedTiles(new Set());
      }
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      });
    },
    [solved, verified, incorrectTiles, missedTiles],
  );

  const handleHumanTileClick = useCallback(
    (idx: number) => {
      handleTileClick(idx);
    },
    [handleTileClick],
  );

  const handleVerify = useCallback(() => {
    if (solved && verified) return;
    setVerifyLoading(true);
    const timer = setTimeout(() => {
      const fp = new Set([...selected].filter((i) => !puzzle.targetIndices.has(i)));
      const fn = new Set([...puzzle.targetIndices].filter((i) => !selected.has(i)));
      const correct = fp.size === 0 && fn.size === 0;
      if (!correct && !simulateBot) {
        setIncorrectTiles(fp);
        setMissedTiles(fn);
        setVerifyLoading(false);
        return;
      }

      setIncorrectTiles(new Set());
      setMissedTiles(new Set());
      setSolved(true);
      setVerified(true);
      if (simulateBot) {
        setModelScore(BOT_SCORE);
        setModelLabel("BOT");
      } else {
        setModelScore(HUMAN_SCORE);
        setModelLabel("HUMAN");
        onVerifiedHuman({ score: HUMAN_SCORE }, HUMAN_SCORE);
      }
      setVerifyLoading(false);
    }, 450);
    botTimersRef.current.push(timer);
  }, [solved, verified, selected, puzzle, simulateBot, onVerifiedHuman]);

  useEffect(() => {
    tileClickRef.current = handleTileClick;
    verifyRef.current = handleVerify;
  }, [handleTileClick, handleVerify]);

  const startBotSim = useCallback(() => {
    clearBotTimers();
    const seed = Date.now();
    const p = generatePuzzle(seed);
    setPuzzle(p);
    setSelected(new Set());
    setSolved(false);
    setVerified(false);
    setModelScore(0);
    setModelLabel("BOT");

    const targets = [...p.targetIndices];
    const schedule = setTimeout(() => {
      setBotCursorVisible(true);
      const g = gridRef.current;
      if (!g) return;
      const gr = g.getBoundingClientRect();
      const center = (idx: number) => {
        const el = g.children[idx] as HTMLElement | undefined;
        if (!el) return { x: gr.width / 2, y: gr.height / 2 };
        const r = el.getBoundingClientRect();
        return { x: r.left - gr.left + r.width / 2, y: r.top - gr.top + r.height / 2 };
      };

      let cx = gr.width / 2;
      let cy = -20;
      let totalDelay = 0;

      targets.forEach((tileIdx) => {
        const moveDuration = 220 + Math.random() * 60;
        const pauseBefore = 30 + Math.random() * 30;
        const stepStart = totalDelay;
        const fromX = cx;
        const fromY = cy;
        const tm = setTimeout(() => {
          const tgt = center(tileIdx);
          const path = generateBotPath(fromX, fromY, tgt.x, tgt.y, moveDuration);
          const animStart = performance.now();
          const totalPathTime = path[path.length - 1].t;
          const animate = () => {
            const elapsed = performance.now() - animStart;
            if (elapsed >= totalPathTime) {
              setBotCursorPos({ x: path[path.length - 1].x, y: path[path.length - 1].y });
              return;
            }
            const frac = elapsed / totalPathTime;
            const idx = Math.min(Math.floor(frac * path.length), path.length - 1);
            setBotCursorPos({ x: path[idx].x, y: path[idx].y });
            botRafRef.current.push(requestAnimationFrame(animate));
          };
          botRafRef.current.push(requestAnimationFrame(animate));
          const clickTm = setTimeout(() => {
            const c = center(tileIdx);
            const clx = c.x + (Math.random() - 0.5) * 1.5;
            const cly = c.y + (Math.random() - 0.5) * 1.5;
            setBotCursorPos({ x: clx, y: cly });
            tileClickRef.current(tileIdx);
          }, moveDuration + pauseBefore);
          botTimersRef.current.push(clickTm);
        }, 300 + stepStart);
        botTimersRef.current.push(tm);
        const tgt = center(tileIdx);
        cx = tgt.x;
        cy = tgt.y;
        totalDelay += moveDuration + pauseBefore + BOT_STEP_INTERVAL_MS;
      });

      const verifyTm = setTimeout(() => {
        setBotCursorVisible(false);
        verifyRef.current();
      }, 300 + totalDelay + 220);
      botTimersRef.current.push(verifyTm);
    }, 120);
    botTimersRef.current.push(schedule);
  }, []);

  const handleBotToggle = useCallback(
    (next: boolean) => {
      setSimulateBot(next);
      if (next) startBotSim();
      else {
        clearBotTimers();
        setBotCursorVisible(false);
        setBotCursorPos(null);
        newPuzzle();
      }
    },
    [newPuzzle, startBotSim],
  );

  const modalTone = useMemo(() => {
    if (incorrectTiles.size > 0 || missedTiles.size > 0) return "bg-red-500/80";
    if (verified && solved) return modelLabel === "HUMAN" ? "bg-emerald-500/80" : "bg-red-500/80";
    return "bg-purple-600/65";
  }, [incorrectTiles, missedTiles, verified, solved, modelLabel]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/62 ${
        reducedMotion ? "" : "animate-in fade-in duration-300"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !simulateBot) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`relative mx-4 w-[92vw] max-w-[420px] overflow-hidden rounded-2xl border border-white/12 bg-[#1e1033] shadow-2xl outline-none ${
          reducedMotion ? "" : "animate-in zoom-in-95 fade-in duration-300"
        }`}
      >
        {!simulateBot && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        <div className={`px-5 pb-4 pt-5 transition-colors duration-300 ${modalTone}`}>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">
            Step 1: Prove humanity
          </p>
          {incorrectTiles.size > 0 || missedTiles.size > 0 ? (
            <>
              <h2 className="text-xl font-bold text-white">Try Again</h2>
              <p className="mt-1 text-[13px] text-white/80">Adjust your selection and verify again.</p>
            </>
          ) : verified && solved ? (
            <>
              <h2 className="text-xl font-bold text-white">
                {modelLabel === "HUMAN" ? "Access Granted" : "Classified as Bot"}
              </h2>
              <p className="mt-1 text-[13px] text-white/80">
                {modelLabel === "HUMAN"
                  ? `Behavioral score ${modelScore} accepted.`
                  : "Behavior did not meet the human threshold."}
              </p>
            </>
          ) : (
            <>
              <p className="text-[13px] text-white/65">Select all squares with</p>
              <h2 className="mt-0.5 text-2xl font-bold capitalize text-white">{puzzle.target}s</h2>
              <p className="mt-1 text-[13px] text-white/55">If there are none, click skip</p>
            </>
          )}
        </div>

        <div className="relative max-h-[54vh] overflow-y-auto">
          <div ref={gridRef} className="grid grid-cols-4 gap-[2px] bg-white/6 p-[2px]">
            {puzzle.tiles.map((pattern, i) => {
              const isSel = selected.has(i);
              const isWrong = incorrectTiles.has(i);
              const isMissed = missedTiles.has(i);
              const hasErr = isWrong || isMissed;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={simulateBot}
                  onClick={() => handleHumanTileClick(i)}
                  className={`relative flex aspect-square min-h-11 items-center justify-center transition-all duration-150 ${
                    hasErr
                      ? "bg-red-500/20 ring-2 ring-inset ring-red-400"
                      : isSel
                        ? "scale-[0.92] bg-purple-500/20 ring-[3px] ring-inset ring-purple-400"
                        : "bg-white/6 hover:bg-white/14"
                  } ${simulateBot ? "cursor-not-allowed" : "cursor-pointer active:scale-95"}`}
                >
                  <div className="flex h-full w-full items-center justify-center p-2">
                    <PatternIcon type={pattern} />
                  </div>
                  {isSel && !hasErr && (
                    <div className="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 shadow">
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  {isWrong && (
                    <div className="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 shadow">
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  )}
                  {isMissed && (
                    <div className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500/80 shadow">
                      <span className="text-[9px] font-bold text-white">!</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {botCursorVisible && botCursorPos && (
            <div
              className="pointer-events-none absolute z-50"
              style={{
                left: botCursorPos.x - 4,
                top: botCursorPos.y - 4,
                transition: "left 0.016s linear, top 0.016s linear",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3 3L10.5 21L13 13L21 10.5L3 3Z" fill="#ef4444" stroke="#991b1b" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              <span className="absolute -right-8 -top-1 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow">
                BOT
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/12 bg-white/5 px-3 py-2.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={newPuzzle}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white/80"
              title="New challenge"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-white/65">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded accent-purple-500"
                checked={simulateBot}
                onChange={(e) => handleBotToggle(e.target.checked)}
              />
              Bot
            </label>
          </div>
          <button
            type="button"
            onClick={handleVerify}
            disabled={simulateBot || verifyLoading}
            className="btn-primary min-h-10 rounded-lg px-5 py-1.5 text-sm font-semibold"
          >
            {verifyLoading ? "Verifying..." : "Verify Access"}
          </button>
        </div>
      </div>
    </div>
  );
}
