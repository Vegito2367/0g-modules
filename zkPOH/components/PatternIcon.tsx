import { PatternType } from "@/lib/captchaModel";

export function PatternIcon({ type }: { type: PatternType }) {
  const s = 48;
  const h = s / 2;
  switch (type) {
    case "circle":
      return (
        <svg viewBox={`0 0 ${s} ${s}`} className="h-full w-full drop-shadow-sm">
          <defs>
            <radialGradient id="cg" cx="40%" cy="35%">
              <stop offset="0%" stopColor="#c4b5fd" />
              <stop offset="100%" stopColor="#7c3aed" />
            </radialGradient>
          </defs>
          <circle cx={h} cy={h} r={16} fill="url(#cg)" />
          <circle cx={h - 4} cy={h - 5} r={4} fill="white" opacity={0.3} />
        </svg>
      );
    case "triangle":
      return (
        <svg viewBox={`0 0 ${s} ${s}`} className="h-full w-full drop-shadow-sm">
          <defs>
            <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f0abfc" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          <polygon points="24,6 42,42 6,42" fill="url(#tg)" />
        </svg>
      );
    case "plus":
      return (
        <svg viewBox={`0 0 ${s} ${s}`} className="h-full w-full drop-shadow-sm">
          <defs>
            <linearGradient id="pg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#67e8f9" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
          <rect x={18} y={6} width={12} height={36} rx={3} fill="url(#pg)" />
          <rect x={6} y={18} width={36} height={12} rx={3} fill="url(#pg)" />
        </svg>
      );
    case "waves":
      return (
        <svg viewBox={`0 0 ${s} ${s}`} className="h-full w-full drop-shadow-sm">
          <path d="M6 16 Q14 8 24 16 Q34 24 42 16" fill="none" stroke="#c084fc" strokeWidth={3.5} strokeLinecap="round" />
          <path d="M6 26 Q14 18 24 26 Q34 34 42 26" fill="none" stroke="#a855f7" strokeWidth={3.5} strokeLinecap="round" />
          <path d="M6 36 Q14 28 24 36 Q34 44 42 36" fill="none" stroke="#7c3aed" strokeWidth={3.5} strokeLinecap="round" />
        </svg>
      );
    case "stripes":
      return (
        <svg viewBox={`0 0 ${s} ${s}`} className="h-full w-full drop-shadow-sm">
          {[10, 18, 26, 34].map((y, i) => (
            <rect key={y} x={6} y={y} width={36} height={4} rx={2} fill={i % 2 === 0 ? "#e879f9" : "#c026d3"} />
          ))}
        </svg>
      );
    case "star":
      return (
        <svg viewBox={`0 0 ${s} ${s}`} className="h-full w-full drop-shadow-sm">
          <defs>
            <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          <polygon points="24,4 29,18 44,18 32,27 36,42 24,33 12,42 16,27 4,18 19,18" fill="url(#sg)" />
        </svg>
      );
  }
}
