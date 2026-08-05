import { Container } from "./Container";

export function PageHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="bg-hero-grid text-white">
      <Container className="py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-300">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            {title}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-navy-200">
            {description}
          </p>
        </div>
      </Container>
    </section>
  );
}
