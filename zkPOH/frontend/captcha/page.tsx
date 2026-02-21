"use client";

import { useState } from "react";
import CaptchaModal from "@/components/CaptchaModal";

export default function FaucetPage() {
  const [address, setAddress] = useState("");
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [verified, setVerified] = useState(false);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%", maxWidth: "400px", padding: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", textAlign: "center" }}>Faucet</h1>

        <input
          type="text"
          placeholder="Enter wallet address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            border: "1px solid #333",
            background: "#111",
            color: "#fff",
            fontSize: "1rem",
            outline: "none",
          }}
        />

        <button
          onClick={() => setShowCaptcha(true)}
          disabled={!address.trim() || verified}
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            border: "none",
            background: verified ? "#22c55e" : "#6366f1",
            color: "#fff",
            fontSize: "1rem",
            fontWeight: 600,
            cursor: !address.trim() || verified ? "not-allowed" : "pointer",
            opacity: !address.trim() ? 0.5 : 1,
          }}
        >
          {verified ? "✔ Verified" : "Verify & Claim"}
        </button>

        {verified && (
          <p style={{ textAlign: "center", color: "#22c55e", fontSize: "0.875rem" }}>
            Human verified for {address}
          </p>
        )}

        <CaptchaModal
          isOpen={showCaptcha}
          onClose={() => setShowCaptcha(false)}
          onVerified={() => {
            setVerified(true);
            setShowCaptcha(false);
          }}
        />
      </div>
    </div>
  );
}