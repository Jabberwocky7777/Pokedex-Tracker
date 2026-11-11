import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "danger-soft" | "ghost";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-indigo-600 hover:bg-indigo-500 text-white",
  secondary: "bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200",
  danger: "bg-red-700 hover:bg-red-600 text-white",
  // The first step of a destructive action ("Sign out…"), before its confirmation
  "danger-soft": "bg-red-900/40 hover:bg-red-900/60 border border-red-800/60 text-red-300",
  ghost: "text-gray-300 hover:bg-gray-800 hover:text-gray-100",
};

const SIZES = {
  sm: "px-3 py-1 text-xs",
  md: "px-4 py-2 text-sm",
} as const;

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: keyof typeof SIZES;
}

/**
 * The shared button: one look per variant, so screens don't each paste the
 * class string. Labels are sentence case ("Export notes", not "Export Notes").
 */
export default function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`${SIZES[size]} rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
