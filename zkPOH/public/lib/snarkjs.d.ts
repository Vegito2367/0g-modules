declare module "snarkjs" {
  export interface Groth16Proof {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
  }

  export const groth16: {
    fullProve(
      input: Record<string, unknown>,
      wasmFile: string | Uint8Array | ArrayBuffer,
      zkeyFile: string | Uint8Array | ArrayBuffer,
    ): Promise<{ proof: Groth16Proof; publicSignals: string[] }>;

    verify(
      vk: Record<string, unknown>,
      publicSignals: string[],
      proof: Groth16Proof,
    ): Promise<boolean>;
  };
}
