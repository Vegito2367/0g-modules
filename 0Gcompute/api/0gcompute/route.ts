import { NextResponse } from "next/server";
import { Wallet, JsonRpcProvider } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";

export const runtime = "nodejs";

const RPC_URL = "https://evmrpc-testnet.0g.ai";
const CHAIN_ID = 16602;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

// ---------------------------------------------------------------------------
// Helpers (mirrors compute/initializer.ts)
// ---------------------------------------------------------------------------

function isLedgerNotExists(err: unknown): boolean {
  const e = err as Record<string, unknown>;
  const msg = String(e?.shortMessage ?? e?.message ?? "");
  const reason = String(e?.reason ?? "");
  const revertName = String((e?.revert as Record<string, unknown>)?.name ?? "");
  return (
    msg.includes("LedgerNotExists") ||
    reason.includes("LedgerNotExists") ||
    revertName === "LedgerNotExists"
  );
}

async function getBrokerAndWallet() {
  const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID);
  const wallet = new Wallet(PRIVATE_KEY, provider);
  const broker = await createZGComputeNetworkBroker(wallet);
  return { broker, wallet };
}

// ---------------------------------------------------------------------------
// POST /api/0gcompute
//
// body.action determines which step to run:
//   "status"       – check ledger existence
//   "createLedger" – create ledger if missing
//   "depositFund"  – deposit OG into ledger  (body.amount)
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action: string = body.action ?? "status";

    const { broker, wallet } = await getBrokerAndWallet();
    const address = wallet.address;

    // ── status ────────────────────────────────────────────────────────────
    if (action === "status") {
      let ledgerExists = false;
      let ledgerInfo: unknown = null;

      try {
        ledgerInfo = await broker.ledger.getLedger();
        ledgerExists = true;
      } catch (err) {
        if (!isLedgerNotExists(err)) throw err;
      }

      return NextResponse.json({
        ok: true,
        address,
        ledgerExists,
        ledgerInfo,
      });
    }

    // ── createLedger ─────────────────────────────────────────────────────
    if (action === "createLedger") {
      let alreadyExists = false;

      try {
        await broker.ledger.getLedger();
        alreadyExists = true;
      } catch (err) {
        if (!isLedgerNotExists(err)) throw err;
      }

      if (alreadyExists) {
        return NextResponse.json({
          ok: true,
          created: false,
          message: "Ledger already exists.",
        });
      }

      await broker.ledger.addLedger(3);

      return NextResponse.json({
        ok: true,
        created: true,
        message: "Ledger created with 3 OG minimum.",
      });
    }

    // ── depositFund ──────────────────────────────────────────────────────
    if (action === "depositFund") {
      const amount = Number(body.amount);
      if (!amount || amount <= 0) {
        return NextResponse.json(
          { ok: false, error: "amount must be a positive number" },
          { status: 400 },
        );
      }

      await broker.ledger.depositFund(amount);

      return NextResponse.json({
        ok: true,
        deposited: amount,
        message: `Deposited ${amount} OG into ledger.`,
      });
    }

    return NextResponse.json(
      { ok: false, error: `Unknown action: ${action}` },
      { status: 400 },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
