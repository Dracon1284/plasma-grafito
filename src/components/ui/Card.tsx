import type { HTMLAttributes, ReactNode } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  glow?: "blue" | "magenta" | "none";
  interactive?: boolean;
  children: ReactNode;
}

export function Card({
  glow = "none",
  interactive = false,
  className = "",
  children,
  ...rest
}: Props) {
  const glowHover =
    glow === "blue"
      ? "hover:border-plasma-blue hover:shadow-glow-blue"
      : glow === "magenta"
        ? "hover:border-plasma-magenta hover:shadow-glow-magenta"
        : "";
  return (
    <div
      {...rest}
      className={`bg-carbon border border-white/10 rounded-lg p-5 transition-all duration-200 ${
        interactive ? `cursor-pointer ${glowHover} hover:-translate-y-0.5` : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
