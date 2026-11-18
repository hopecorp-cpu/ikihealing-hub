import type { ReactNode } from "react";

export function Sensitive({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`sensitive ${className}`}>{children}</span>;
}
