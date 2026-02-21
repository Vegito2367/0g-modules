"use client";

import { useState } from "react";
import StepCard from "@/components/StepCard";
import LedgerInfo from "@/components/LedgerInfo";

type Status = "idle" | "loading" | "success" | "error";

const API = "/demo0g/api/0gcompute";

async function callApi(action: string, extra: Record<string, unknown> = {}) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
  });
  return res.json();
}

export default function ZeroGComputePage() {
  // ── status step ──
  const [statusState, setStatusState] = useState<Status>("idle");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [ledgerExists, setLedgerExists] = useState<boolean | null>(null);
  const [ledgerInfo, setLedgerInfo] = useState<Record<string, unknown> | null>(null);

  // ── create ledger step ──
  const [createState, setCreateState] = useState<Status>("idle");
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  // ── deposit step ──
  const [depositState, setDepositState] = useState<Status>("idle");
  const [depositMsg, setDepositMsg] = useState<string | null>(null);
  const [depositAmt, setDepositAmt] = useState("1");

  // ── handlers ──
  const checkStatus = async () => {
    setStatusState("loading");
    setStatusMsg(null);
    try {
      const data = await callApi("status");
      if (!data.ok) throw new Error(data.error);
      setAddress(data.address);
      setLedgerExists(data.ledgerExists);
      setLedgerInfo(data.ledgerInfo);
      setStatusMsg(data.ledgerExists ? "Ledger found." : "No ledger yet.");
      setStatusState("success");
    } catch (e: unknown) {
      setStatusMsg(e instanceof Error ? e.message : String(e));
      setStatusState("error");
    }
  };

  const createLedger = async () => {
    setCreateState("loading");
    setCreateMsg(null);
    try {
      const data = await callApi("createLedger");
      if (!data.ok) throw new Error(data.error);
      setCreateMsg(data.message);
      setCreateState("success");
      // refresh status
      await checkStatus();
    } catch (e: unknown) {
      setCreateMsg(e instanceof Error ? e.message : String(e));
      setCreateState("error");
    }
  };

  const depositFund = async () => {
    setDepositState("loading");
    setDepositMsg(null);
    try {
      const data = await callApi("depositFund", { amount: Number(depositAmt) });
      if (!data.ok) throw new Error(data.error);
      setDepositMsg(data.message);
      setDepositState("success");
    } catch (e: unknown) {
      setDepositMsg(e instanceof Error ? e.message : String(e));
      setDepositState("error");
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900">
        0G Compute Network Demo
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Interactive walkthrough of the 0G compute broker SDK — check ledger
        status, create a ledger, and deposit funds.
      </p>

      <div className="mt-8 flex flex-col gap-6">
        {/* Step 1 – Status */}
        <StepCard
          title="1. Check Ledger Status"
          description="Query the 0G testnet to see if a ledger exists for the configured wallet."
          buttonLabel="Check Status"
          status={statusState}
          message={statusMsg}
          onAction={checkStatus}
        >
          <LedgerInfo
            address={address}
            exists={ledgerExists}
            info={ledgerInfo}
          />
        </StepCard>

        {/* Step 2 – Create Ledger */}
        <StepCard
          title="2. Create Ledger"
          description="If no ledger exists, create one with the 3 OG minimum required by the contract."
          buttonLabel="Create Ledger"
          status={createState}
          message={createMsg}
          onAction={createLedger}
        />

        {/* Step 3 – Deposit */}
        <StepCard
          title="3. Deposit Funds"
          description="Add OG tokens to the ledger so the wallet can pay for compute services."
          buttonLabel="Deposit"
          status={depositState}
          message={depositMsg}
          onAction={depositFund}
        >
          <label className="flex items-center gap-2 text-sm text-gray-700">
            Amount (OG)
            <input
              type="number"
              min="0.01"
              step="0.1"
              value={depositAmt}
              onChange={(e) => setDepositAmt(e.target.value)}
              className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
        </StepCard>
      </div>

      <p className="mt-10 text-center text-xs text-gray-400">
        Powered by{" "}
        <code className="text-gray-500">@0glabs/0g-serving-broker</code> on the
        0G testnet
      </p>
    </div>
  );
}
