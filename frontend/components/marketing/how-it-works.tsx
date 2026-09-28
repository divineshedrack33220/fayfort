import { Eyebrow } from "@/components/marketing/section";

const steps = [
  {
    title: "Enter your product",
    text: "Tell us what you want, the quantity, and where it's heading.",
  },
  {
    title: "Estimate your costs",
    text: "See supplier price, freight, inspection, customs and fees itemized.",
  },
  {
    title: "Understand your margins",
    text: "Know your true landed cost per unit before you commit.",
  },
  {
    title: "Let Fayfort help you source",
    text: "Verified suppliers and managed logistics from factory to your door.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white">
      <div className="container-shell flex flex-col items-center gap-6 py-16 text-center sm:py-24">
        <Eyebrow>How it works</Eyebrow>
        <h2 className="max-w-2xl font-display text-3xl font-semibold tracking-tight text-balance text-brand-900 sm:text-4xl">
          Know Your Costs Before You Buy.
        </h2>

        <div className="relative mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div
            aria-hidden
            className="absolute inset-x-8 top-5 hidden border-t border-dashed border-brand-200 lg:block"
          />
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="relative flex flex-col gap-3 rounded-xl border border-sand-200 bg-white p-6 text-left shadow-card"
            >
              <span className="relative flex size-10 items-center justify-center rounded-full bg-brand-600 font-display text-sm font-semibold text-white ring-4 ring-brand-100">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="pt-1 font-display text-base font-semibold text-brand-900">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-sand-500">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}