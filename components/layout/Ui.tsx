"use client";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LoaderCircle } from "lucide-react";

export function IconButton({ label, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return <Tooltip><TooltipTrigger asChild><button type="button" {...props} aria-label={label} className={`icon-button ${props.className ?? ""}`}>{children}</button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}
export function Loading({ children = "Preparing molecule…" }: { children?: ReactNode }) {
  return <div className="empty-state" role="status"><LoaderCircle size={30} className="spin" /><span>{children}</span></div>;
}
export function Formula({ value }: { value: string }) {
  return <span className="chemical-formula">{value.split(/(\d+)/).map((part, i) => /^\d+$/.test(part) ? <sub key={i}>{part}</sub> : part)}</span>;
}
