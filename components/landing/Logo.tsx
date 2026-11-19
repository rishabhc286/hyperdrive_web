interface LogoMarkProps {
  className?: string;
}

/**
 * HyperDrive mark: a hexagonal drive housing with an "H" whose crossbar is drawn
 * as streamed chunks. Single colour (currentColor) so it sits quietly in the UI.
 */
export function LogoMark({ className = "size-5" }: LogoMarkProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <path
        d="M16 2.5 27.7 9.25v13.5L16 29.5 4.3 22.75V9.25L16 2.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M11 10.5v11M21 10.5v11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M11.5 16h1.6M15.2 16h1.6M18.9 16h1.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2 text-ink">
      <LogoMark />
      <span className="text-[15px] font-medium tracking-tight">HyperDrive</span>
    </span>
  );
}
