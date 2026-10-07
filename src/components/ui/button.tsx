import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "subtle" | "ghost" };

export function Button({ className, variant = "primary", ...props }: Props) {
  return <button className={cn("button", `button--${variant}`, className)} {...props} />;
}
