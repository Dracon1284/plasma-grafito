import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

const fieldBase =
  "w-full bg-graphite text-text-neon border border-white/10 rounded px-3 py-2 text-sm transition-all focus:outline-none focus:border-plasma-blue focus:shadow-glow-soft placeholder:text-text-muted";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldBase} ${props.className ?? ""}`} />;
}

export function Select(
  props: SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }
) {
  return (
    <select {...props} className={`${fieldBase} ${props.className ?? ""}`}>
      {props.children}
    </select>
  );
}

export function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs uppercase tracking-wider text-text-muted mb-1 font-display"
    >
      {children}
    </label>
  );
}
