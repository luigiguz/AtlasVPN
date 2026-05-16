type Props = {
  /** Más pequeño para sidebar o login */
  compact?: boolean;
  className?: string;
};

export function PoweredByVerkkutech({ compact = false, className = "" }: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 ${className}`}
      aria-label="Powered by Verkkutech"
    >
      <p
        className={
          compact
            ? "text-[9px] font-medium uppercase tracking-[0.22em] text-zinc-500"
            : "text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500"
        }
      >
        Powered by
      </p>
      <img
        src="/verkku-logo.svg"
        alt="Verkkutech"
        className={
          compact
            ? "h-7 w-auto max-w-[9.5rem] object-contain opacity-95"
            : "h-9 w-auto max-w-[12rem] object-contain opacity-95 sm:h-10 sm:max-w-[14rem]"
        }
      />
    </div>
  );
}
