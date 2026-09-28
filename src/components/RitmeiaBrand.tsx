import type { SVGProps } from "react";

export function RitmeiaSymbol({
  className = "h-10 w-10",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Símbolo Ritmeia"
      className={className}
      {...props}
    >
      <circle cx="12" cy="20" r="6" fill="#C1743D" />
      <circle cx="11" cy="44" r="6" fill="#C1743D" />
      <path
        d="M27 10c0 8-6 9-6 17 0 7 5 8 9 8 5 0 8-3 8-8 0-7-6-8-6-17"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M32 54c0-8 6-9 6-17 0-7-5-8-9-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M43 17c7 0 10 5 10 12 0 6-3 10-9 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function RitmeiaBrand({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={"inline-flex items-center gap-2.5 " + className}>
      <RitmeiaSymbol className={compact ? "h-8 w-8 shrink-0" : "h-10 w-10 shrink-0"} />
      <span className={compact ? "text-lg font-black tracking-[-0.04em]" : "text-2xl font-black tracking-[-0.045em]"}>
        Ritmeia
      </span>
    </span>
  );
}
