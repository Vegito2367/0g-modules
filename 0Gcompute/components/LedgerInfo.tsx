"use client";

interface LedgerInfoProps {
  address: string | null;
  exists: boolean | null;
  info: Record<string, unknown> | null;
}

export default function LedgerInfo({ address, exists, info }: LedgerInfoProps) {
  if (!address) return null;

  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-4 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-300">Wallet:</span>
        <code className="text-xs text-gray-400">{address}</code>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="font-medium text-gray-300">Ledger:</span>
        {exists === null ? (
          <span className="text-gray-500">unknown</span>
        ) : exists ? (
          <span className="text-green-400 font-medium">exists</span>
        ) : (
          <span className="text-red-400 font-medium">not found</span>
        )}
      </div>

      {info && (
        <pre className="mt-2 max-h-40 overflow-auto rounded bg-white/5 p-2 text-xs text-gray-400">
          {JSON.stringify(info, null, 2)}
        </pre>
      )}
    </div>
  );
}
