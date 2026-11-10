import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-5xl px-4 sm:px-6", className)}>{children}</div>;
}

export function PageHeader({ title, intro, children }: { title: ReactNode; intro?: ReactNode; children?: ReactNode }) {
  return (
    <div className="bg-sun-soft py-8 sm:py-12">
      <Container>
        <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{title}</h1>
        {intro ? <p className="mt-3 max-w-2xl text-lg text-muted">{intro}</p> : null}
        {children}
      </Container>
    </div>
  );
}

export function Card({ children, className, as: As = "div" }: { children: ReactNode; className?: string; as?: "div" | "li" | "article" | "section" }) {
  return <As className={cn("rounded-2xl border border-line bg-card p-5 shadow-sm", className)}>{children}</As>;
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-block rounded-full bg-brand-soft px-3 py-0.5 text-sm font-semibold text-brand-dark", className)}>
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border-2 border-dashed border-line p-6 text-center text-muted">{children}</p>;
}

export function Section({ title, children, className, id }: { title?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={cn("py-10", className)} aria-labelledby={id ? `${id}-title` : undefined}>
      <Container>
        {title ? (
          <h2 id={id ? `${id}-title` : undefined} className="mb-6 text-2xl font-bold sm:text-3xl">
            {title}
          </h2>
        ) : null}
        {children}
      </Container>
    </section>
  );
}
