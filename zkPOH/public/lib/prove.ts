import type * as snarkjs from "snarkjs";

// Paths to the static ZK assets served from public/
const WASM_URL = "/zk/captcha.wasm";
const ZKEY_URL = "/zk/captcha_final.zkey";

// Circuit-level valid score range (must match captcha.circom constraints)
const SCORE_MIN = -4000;
const SCORE_MAX = 6000;

export interface ZKProofResult {
  success: true;
  proof: snarkjs.Groth16Proof;
  publicSignals: string[];
}

export interface ZKProofError {
  success: false;
  message: string;
}

/* ── Worker management ── */

let worker: Worker | null = null;
let msgId = 0;
const pending = new Map<
  number,
  { resolve: (v: unknown) => void; reject: (e: Error) => void }
>();

function getWorker(): Worker | null {
  if (typeof window === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./zkProveWorker.ts", import.meta.url));
    worker.addEventListener("message", (e: MessageEvent) => {
      const { id, ...rest } = e.data;
      const p = pending.get(id);
      if (p) {
        pending.delete(id);
        p.resolve(rest);
      }
    });
    worker.addEventListener("error", () => {
      // If the worker itself errors, reject all pending requests
      for (const [id, p] of pending) {
        p.reject(new Error("ZK worker crashed"));
        pending.delete(id);
      }
      worker = null;
    });
    return worker;
  } catch {
    return null;
  }
}

function sendToWorker<T = unknown>(
  data: Record<string, unknown>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const w = getWorker();
    if (!w) return reject(new Error("Worker unavailable"));
    const id = ++msgId;
    pending.set(id, {
      resolve: resolve as (v: unknown) => void,
      reject,
    });
    w.postMessage({ ...data, id });
  });
}

/**
 * Begin fetching the WASM + zkey in the background so they are ready
 * when `generateProof` is called.  Safe to call multiple times.
 */
export function preloadZKAssets(): void {
  sendToWorker({ type: "preload" }).catch(() => {
    /* non-critical — generateProof will retry */
  });
}

// Eagerly kick off preloading on module import (client-side only)
if (typeof window !== "undefined") {
  preloadZKAssets();
}

/* ── Main-thread fallback (used only when worker is unavailable) ── */

/* ── Public API ── */

/**
 * Generate a Groth16 ZK proof for a given captcha score, entirely in the browser.
 *
 * Assets are preloaded & cached, and proof generation runs in a Web Worker
 * so the UI thread stays responsive.  Falls back to the main thread if the
 * worker is unavailable.
 */
export async function generateProof(
  inputScore: number,
): Promise<ZKProofResult | ZKProofError> {
  if (typeof inputScore !== "number" || Number.isNaN(inputScore)) {
    return { success: false, message: "Invalid input: score must be a number." };
  }

  const score = Math.round(inputScore);

  if (score < SCORE_MIN || score > SCORE_MAX) {
    return {
      success: false,
      message: "Score out of valid human range. Proof not generated.",
    };
  }

  /* --- Try the Web Worker first (off main thread) --- */
  try {
    const res = await sendToWorker<{
      success: boolean;
      proof?: snarkjs.Groth16Proof;
      publicSignals?: string[];
      message?: string;
    }>({ type: "prove", score });

    if (res.success && res.proof && res.publicSignals) {
      return { success: true, proof: res.proof, publicSignals: res.publicSignals };
    }
    // Worker ran but the circuit failed — don't fall through
    return {
      success: false,
      message: res.message ?? "ZK proof generation failed in worker",
    };
  } catch {
    /* Worker unavailable or crashed — fall back to main thread */
  }

  /* --- Fallback: main thread with URL strings --- */
  try {
    const snarkjsMod = await import("snarkjs");
    const { proof, publicSignals } = await snarkjsMod.groth16.fullProve(
      { score },
      WASM_URL,
      ZKEY_URL,
    );
    return { success: true, proof, publicSignals };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `ZK proof generation failed: ${msg}` };
  }
}

/**
 * Send the proof + publicSignals to the backend /api/validate route
 * and return the verification result.
 */
export async function submitProofForValidation(
  proof: snarkjs.Groth16Proof,
  publicSignals: string[],
): Promise<{ ok: boolean; verified: boolean; error?: string }> {
  try {
    console.log("Submitting proof for validation. Proof:", proof, "Public signals:", publicSignals);
    const res = await fetch("/api/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proof, publicSignals }),
    });

    console.log("Received validation response. HTTP status:", res.status);
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, verified: false, error: data.error ?? "Validation request failed" };
    }
    console.log("Validation response data:", data);
    return { ok: true, verified: !!data.verified };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, verified: false, error: msg };
  }
}
