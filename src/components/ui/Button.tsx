import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const base =
  "inline-flex items-center justify-center gap-2 px-4 py-2 rounded font-display tracking-wider uppercase text-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-plasma-blue disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary:
    "border border-plasma-blue text-plasma-blue bg-transparent hover:bg-plasma-blue/10 hover:shadow-glow-blue hover:scale-[1.02]",
  secondary:
    "border border-plasma-magenta text-plasma-magenta bg-transparent hover:bg-plasma-magenta/10 hover:shadow-glow-magenta hover:scale-[1.02]",
  ghost:
    "border border-white/10 text-text-muted hover:text-text-neon hover:border-white/30",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button {...rest} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}
