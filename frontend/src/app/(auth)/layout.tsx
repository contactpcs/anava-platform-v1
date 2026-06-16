"use client";

import { usePathname } from "next/navigation";
import { Brain, ShieldCheck, Activity, Users, Heart, Stethoscope, Sparkles } from "lucide-react";

const BRAND_CONTENT = {
  register: {
    headline: <>Begin your<br />healing journey</>,
    sub: "Personalized neuromodulation therapy, guided by expert clinicians, tracked every step of the way.",
    features: [
      { icon: Heart,        text: "Personalized therapy tailored to your needs" },
      { icon: Stethoscope, text: "Guided by expert neuromodulation clinicians" },
      { icon: Sparkles,    text: "Track your progress every step of the way" },
    ],
  },
  default: {
    headline: <>India's integrated<br />neuromodulation<br />care platform</>,
    sub: "Unifying patient journeys, clinical workflows, and therapeutic insights in one seamless experience.",
    features: [
      { icon: ShieldCheck, text: "Secure & DPDP-compliant data handling" },
      { icon: Activity,    text: "Multi-scale neurological assessments" },
      { icon: Users,       text: "Collaborative care across clinical teams" },
    ],
  },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const content  = pathname.includes("/register") ? BRAND_CONTENT.register : BRAND_CONTENT.default;

  return (
    <div className="min-h-screen flex bg-neutral-50">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] bg-brand-gradient relative overflow-hidden flex-shrink-0">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-16 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-white/[0.03]" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-base leading-tight">Anava</p>
              <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest leading-tight">PRS</p>
            </div>
          </div>

          {/* Headline + features */}
          <div>
            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-snug mb-4">
              {content.headline}
            </h1>
            <p className="text-white/70 text-base leading-relaxed max-w-xs">
              {content.sub}
            </p>

            <ul className="mt-8 space-y-3">
              {content.features.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="text-white/80 text-sm">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer */}
          <p className="text-white/40 text-xs">
            © {new Date().getFullYear()} Anava. All rights reserved.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-brand-gradient flex items-center justify-center">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-accent-dark">Anava PRS</span>
          </div>

          <div className="bg-white rounded-2xl shadow-card border border-neutral-200/80 p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
