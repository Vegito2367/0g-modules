import * as snarkjs from "snarkjs";

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

/**
 * Generate a Groth16 ZK proof for a given captcha score, entirely in the browser.
 *
 * The circuit expects `{ score }` as private input and outputs `isHuman = 1`
 * when the score falls within [-4000, 6000].
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
  
//   const normalizedScore = Math.round(score * 100); // or your circuit's expected scale
//   console.log(score,normalizedScore);
// if (!Number.isInteger(normalizedScore) || normalizedScore < 0 || normalizedScore > 255) {
//   throw new Error("Score is out of circuit range (expected 0..255 integer).");
// }
  try {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
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
