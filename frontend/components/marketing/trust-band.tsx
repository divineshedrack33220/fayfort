import { Eyebrow } from "@/components/marketing/section";

export function TrustBand() {
  return (
    <section className="border-t border-white/10 bg-brand-950">
      <div className="container-shell flex flex-col items-center gap-5 py-16 text-center sm:py-20">
        <Eyebrow onDark>Trusted across Africa</Eyebrow>
        <h2 className="max-w-2xl font-display text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl">
          Trusted by businesses across Africa.
        </h2>
        <p className="max-w-2xl text-pretty text-base leading-relaxed text-brand-100 sm:text-lg">
          Fayfort helps businesses source products more efficiently — accurate
          landed costs, verified suppliers, and logistics you can follow every
          step of the way.
        </p>
      </div>
    </section>
  );
}