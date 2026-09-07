import type { LucideIcon } from "lucide-react";

import { cn } from "#lib/utils";

/**
 * État vide standardisé : icône + titre + description (+ action optionnelle).
 */
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex flex-col items-center justify-center gap-2 py-12 text-center",
        className
      )}
    >
      <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
        <Icon className="size-5" />
      </div>
      <p className="text-foreground text-sm font-medium">{title}</p>
      {description ? <p className="max-w-sm text-sm">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
