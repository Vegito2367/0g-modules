/// <reference lib="webworker" />
import * as snarkjs from "snarkjs";

declare const self: DedicatedWorkerGlobalScope;

const WASM_PATH = "/zk/captcha.wasm";
const ZKEY_PATH = "/zk/captcha_final.zkey";

/* ── Resolve absolute URLs once (workers can't use relative paths) ── */

function absUrl(path: string): string {
  return new URL(path, self.location.origin).href;
}

const WASM_URL = absUrl(WASM_PATH);
const ZKEY_URL = absUrl(ZKEY_PATH);

/* ── Warm the browser HTTP cache so fullProve's internal fetch is instant ── */

let preloaded = false;
let preloadPromise: Promise<void> | null = null;

async function ensurePreloaded(): Promise<void> {
  if (preloaded) return;
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    await Promise.all([
      fetch(WASM_URL),
      fetch(ZKEY_URL),
    ]);
    preloaded = true;
  })();
  return preloadPromise;
}

/* ── Message handler ── */

self.onmessage = async (e: MessageEvent) => {
  const { id, type, score } = e.data as {
    id: number;
    type: "preload" | "prove";
    score?: number;
  };

  if (type === "preload") {
    try {
      await ensurePreloaded();
      self.postMessage({ id, type: "preload", success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      self.postMessage({ id, type: "preload", success: false, message: msg });
    }
    return;
  }

  if (type === "prove") {
    try {
      await ensurePreloaded();
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        { score },
        WASM_URL,
        ZKEY_URL,
      );
      self.postMessage({ id, type: "prove", success: true, proof, publicSignals });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      self.postMessage({ id, type: "prove", success: false, message: msg });
    }
  }
};
