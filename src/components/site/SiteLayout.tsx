import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="container-page pt-16 pb-10 md:pt-24 md:pb-14">
      {eyebrow && (
        <p className="text-xs uppercase tracking-[0.2em] text-accent font-medium mb-4">
          {eyebrow}
        </p>
      )}
      <h1 className="font-display text-5xl md:text-6xl lg:text-7xl leading-[1.02] text-foreground max-w-4xl">
        {title}
      </h1>
      {description && (
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
