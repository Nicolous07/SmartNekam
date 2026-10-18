import Image from 'next/image'
import OnboardingWizard from '@/components/onboarding/OnboardingWizard'
import ThemeToggle from '@/components/layout/ThemeToggle'

export default function OnboardingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f5f7fc] pb-10 dark:bg-[#0b1120]">
      {/* Mapambo ya nyuma yanayotembea taratibu */}
      <div className="anim-blob pointer-events-none absolute -left-20 top-40 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-700/20" />
      <div className="anim-blob-slow pointer-events-none absolute -right-20 top-96 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl dark:bg-teal-600/20" />

      {/* Banner */}
      <div className="relative h-48 overflow-hidden sm:h-56">
        <Image
          src="/images/hero-desk.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="anim-ken-burns object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/90 via-emerald-900/60 to-emerald-800/40" />

        <div className="relative mx-auto flex h-full max-w-lg flex-col px-4 py-3 text-white">
          <div className="flex items-center justify-between">
            <span className="anim-fade-in flex items-center gap-2">
              <Image src="/images/smartnekam-mark.png" alt="SmartNekam" width={40} height={40} className="h-8 w-8 object-contain" />
              <span className="font-heading text-base font-extrabold">SmartNekam</span>
            </span>
            <ThemeToggle className="rounded-full bg-white/15 p-2 text-white backdrop-blur transition hover:bg-white/25" />
          </div>

          <div className="mt-auto pb-8">
            <h1 className="anim-fade-up text-2xl font-extrabold sm:text-3xl">Karibu SmartNekam</h1>
            <p className="anim-fade-up anim-delay-1 text-sm text-emerald-50">
              Tujaze taarifa zako kwa hatua 3 ili tukuandalie maudhui yanayokufaa.
            </p>
          </div>
        </div>
      </div>

      {/* Kadi ya wizard inapishana na banner */}
      <div className="anim-fade-up anim-delay-2 relative z-10 mx-auto -mt-6 w-full max-w-lg px-4">
        <OnboardingWizard />
      </div>
    </main>
  )
}
