"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

interface StepCardProps {
  title: string;
  description: string;
  buttonLabel: string;
  status: Status;
  message: string | null;
  onAction: () => void;
  children?: React.ReactNode;
}

export default function StepCard({
  title,
  description,
  buttonLabel,
  status,
  message,
  onAction,
  children,
}: StepCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{description}</p>

      {children && <div className="mt-3">{children}</div>}

      <button
        onClick={onAction}
        disabled={status === "loading"}
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:opacity-50"
      >
        {status === "loading" && (
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        )}
        {status === "loading" ? "Working…" : buttonLabel}
      </button>

      {message && (
        <p
          className={`mt-3 text-sm ${
            status === "error" ? "text-red-600" : "text-green-600"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
