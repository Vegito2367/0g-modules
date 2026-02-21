"use client";

interface LedgerInfoProps {
  address: string | null;
  exists: boolean | null;
  info: Record<string, unknown> | null;
}

export default function LedgerInfo({ address, exists, info }: LedgerInfoProps) {
  if (!address) return null;

  return (
    <div className="rounded-md border border-gray-100 bg-gray-50 p-4 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-700">Wallet:</span>
        <code className="text-xs text-gray-500">{address}</code>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="font-medium text-gray-700">Ledger:</span>
        {exists === null ? (
          <span className="text-gray-400">unknown</span>
        ) : exists ? (
          <span className="text-green-600 font-medium">exists</span>
        ) : (
          <span className="text-red-500 font-medium">not found</span>
        )}
      </div>

      {info && (
        <pre className="mt-2 max-h-40 overflow-auto rounded bg-gray-100 p-2 text-xs text-gray-600">
          {JSON.stringify(info, null, 2)}
        </pre>
      )}
    </div>
  );
}
