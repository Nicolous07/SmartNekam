import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Code2,
  Globe2,
  MessageCircle,
  Rocket,
  Sparkles,
  Target,
  UserPlus,
  Users,
} from 'lucide-react'
import Reveal from '@/components/ui/Reveal'
import ThemeToggle from '@/components/layout/ThemeToggle'

const FEATURES = [
  {
    icon: BookOpen,
    eyebrow: 'MAKTABA',
    title: 'Nyenzo zote za masomo',
    text: 'Tafuta past papers, notes na vitabu kwa nchi, mtaala, kiwango na somo.',
    tone: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  },
  {
    icon: Users,
    eyebrow: 'JAMII',
    title: 'Jifunze pamoja',
    text: 'Ungana na wanafunzi wenzako, uliza maswali na shiriki kwenye study groups.',
    tone: 'bg-violet-50 text-violet-700 ring-violet-100',
  },
  {
    icon: Code2,
    eyebrow: 'LEARN',
    title: 'Jenga ujuzi wa kidijitali',
    text: 'Jifunze programming, AI na Data Science kwa masomo ya hatua kwa hatua.',
    tone: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  },
  {
    icon: Briefcase,
    eyebrow: 'FURSA',
    title: 'Gundua fursa mpya',
    text: 'Fuatilia scholarships, internships, mashindano na nafasi za kujiendeleza.',
    tone: 'bg-teal-50 text-teal-700 ring-teal-100',
  },
]

const STEPS = [
  { icon: UserPlus, title: 'Fungua akaunti', text: 'Jisajili kwa barua pepe au namba ya simu.' },
  { icon: Target, title: 'Weka taarifa za masomo', text: 'Chagua nchi, kiwango na shule au chuo chako.' },
  { icon: Rocket, title: 'Anza safari yako', text: 'Tumia maktaba, jiunge na jamii na gundua kozi na fursa.' },
]

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f8fbf9] text-slate-900 dark:bg-[#0B0F1A] dark:text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[620px] bg-[radial-gradient(ellipse_at_top_left,_rgba(79,124,255,0.20),_transparent_55%),radial-gradient(ellipse_at_top_right,_rgba(139,92,246,0.17),_transparent_45%)]" />

      <header className="sticky top-0 z-40 border-b border-emerald-100/80 bg-white/85 backdrop-blur-xl dark:border-slate-800 dark:bg-[#0B0F1A]/90">
        <div className="mx-auto flex h-[70px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="SmartNekam mwanzo" className="group flex shrink-0 items-center gap-2.5">
            <Image src="/images/smartnekam-mark.png" alt="SmartNekam" width={48} height={48} className="h-10 w-10 shrink-0 object-contain transition duration-300 group-hover:-rotate-3 group-hover:scale-105" />
            <span>
              <span className="block font-heading text-lg font-black tracking-tight text-slate-950 dark:text-white">SmartNekam</span>
              <span className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700 sm:block dark:text-emerald-300">Jifunze. Ungana. Kua.</span>
            </span>
          </Link>

          <nav aria-label="Menyu kuu" className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex dark:text-slate-300">
            <a href="#vipengele" className="transition hover:text-emerald-700 dark:hover:text-emerald-300">Vipengele</a>
            <a href="#hatua" className="transition hover:text-emerald-700 dark:hover:text-emerald-300">Jinsi inavyofanya kazi</a>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden sm:block"><ThemeToggle /></div>
            <Link href="/auth" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800 sm:px-4 dark:text-slate-200 dark:hover:bg-slate-800">
              Ingia
            </Link>
            <Link href="/auth" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-700/20 transition hover:-translate-y-0.5 hover:bg-emerald-700 sm:px-4">
              Jisajili <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14 lg:px-8 lg:pb-24 lg:pt-20">
        <div className="relative z-10">
          <div className="anim-fade-up inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-3.5 py-2 text-xs font-extrabold text-emerald-800 shadow-sm dark:border-emerald-900 dark:bg-slate-900/80 dark:text-emerald-200">
            <Sparkles className="h-4 w-4" /> Jukwaa la elimu kwa kizazi cha kidijitali
          </div>
          <h1 className="anim-fade-up anim-delay-1 mt-6 max-w-3xl font-heading text-4xl font-black leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl dark:text-white">
            Fikisha uwezo wako wa kujifunza{' '}
            <span className="relative inline-block text-emerald-700 dark:text-emerald-300">
              hatua nyingine.
              <span className="absolute -bottom-1 left-0 -z-10 h-3 w-full rounded-full bg-emerald-200/70 dark:bg-emerald-900/70" />
            </span>
          </h1>
          <p className="anim-fade-up anim-delay-2 mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg dark:text-slate-300">
            SmartNekam inaunganisha maktaba ya masomo, jamii za wanafunzi, kozi za ujuzi wa kidijitali na fursa za elimu—mahali pamoja.
          </p>
          <div className="anim-fade-up anim-delay-3 mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/auth" className="anim-pulse-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3.5 text-sm font-extrabold text-white shadow-xl shadow-emerald-700/20 transition hover:-translate-y-0.5 hover:bg-emerald-700">
              Anza bila malipo <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#vipengele" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-extrabold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
              Gundua SmartNekam
            </a>
          </div>
          <div className="anim-fade-up anim-delay-3 mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Kwa O-Level, A-Level na vyuo</span>
            <span className="inline-flex items-center gap-1.5"><Globe2 className="h-4 w-4 text-emerald-600" /> Kiswahili na English</span>
          </div>
        </div>

        <div className="anim-slide-left anim-delay-2 relative mx-auto w-full max-w-[640px] lg:ml-auto">
          <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-emerald-200/60 via-transparent to-teal-200/70 blur-2xl dark:from-emerald-900/40 dark:to-teal-900/30" />
          <div className="relative overflow-hidden rounded-[1.8rem] border border-white bg-white p-2.5 shadow-[0_30px_90px_-35px_rgba(79,124,255,0.38)] dark:border-slate-700 dark:bg-slate-900">
            <div className="relative aspect-[1.12/1] overflow-hidden rounded-[1.35rem] bg-emerald-50 sm:aspect-[1.18/1]">
              <Image
                src="/images/hero-desk.jpg"
                alt="Dawati la kusomea lenye vitabu, kompyuta na vifaa vya kujifunzia"
                fill
                priority
                sizes="(min-width: 1024px) 600px, 100vw"
                className="object-cover transition duration-700 hover:scale-[1.025]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-emerald-950/10" />
            </div>
          </div>
          <div className="anim-float absolute -left-2 top-8 flex items-center gap-3 rounded-2xl border border-white/80 bg-white/95 px-3.5 py-3 shadow-xl shadow-slate-900/10 sm:-left-7 sm:px-4 dark:border-slate-700 dark:bg-slate-900/95">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"><BookOpen className="h-5 w-5" /></span>
            <span><span className="block text-xs font-extrabold text-slate-900 dark:text-white">Maktaba ya masomo</span><span className="mt-0.5 block text-[10px] font-semibold text-slate-500 dark:text-slate-400">Notes na past papers</span></span>
          </div>
          <div className="anim-float-slow absolute -bottom-4 right-2 flex items-center gap-3 rounded-2xl border border-white/80 bg-white/95 px-3.5 py-3 shadow-xl shadow-slate-900/10 sm:-right-5 sm:px-4 dark:border-slate-700 dark:bg-slate-900/95">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"><MessageCircle className="h-5 w-5" /></span>
            <span><span className="block text-xs font-extrabold text-slate-900 dark:text-white">Jamii za wanafunzi</span><span className="mt-0.5 block text-[10px] font-semibold text-slate-500 dark:text-slate-400">Uliza, jadili, shirikiana</span></span>
          </div>
        </div>
      </section>

      <section id="vipengele" className="relative z-10 border-y border-slate-200/80 bg-white/80 py-16 sm:py-20 dark:border-slate-800 dark:bg-[#0B0F1A]/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Zana zako zote sehemu moja</span>
              <h2 className="mt-3 font-heading text-3xl font-black tracking-tight text-slate-950 sm:text-4xl dark:text-white">Kila unachohitaji kukua kitaaluma</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base dark:text-slate-300">Jipange, pata nyenzo, uliza maswali na gundua njia mpya za kufikia malengo yako ya elimu.</p>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:mt-12 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, eyebrow, title, text, tone }, i) => (
              <Reveal key={title} delay={i * 90}>
                <article className="group h-full rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1.5 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-900/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-900">
                  <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ring-1 transition duration-300 group-hover:scale-105 ${tone}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="mt-5 text-[10px] font-black tracking-[0.18em] text-slate-400">{eyebrow}</p>
                  <h3 className="mt-2 font-heading text-lg font-extrabold leading-snug text-slate-950 dark:text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{text}</p>
                  <span className="mt-5 inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 transition group-hover:gap-2 dark:text-emerald-300">Gundua zaidi <ArrowRight className="h-3.5 w-3.5" /></span>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="hatua" className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[1.8rem] border border-blue-100 bg-blue-50 p-2 shadow-xl shadow-blue-900/10 dark:border-slate-700 dark:bg-slate-900">
            <div className="relative aspect-[1.15/1] overflow-hidden rounded-[1.35rem]">
              <Image src="/images/study-desk.jpg" alt="Daftari, kalamu na vitabu vya masomo kwenye dawati" fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover transition duration-700 hover:scale-[1.03]" />
            </div>
          </div>
        </Reveal>
        <div>
          <Reveal>
            <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Ni rahisi kuanza</span>
            <h2 className="mt-3 font-heading text-3xl font-black tracking-tight text-slate-950 sm:text-4xl dark:text-white">Safari yako inaanza kwa hatua tatu</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">Unda akaunti yako, eleza unachosomea, kisha upate nyenzo na jumuiya zinazokufaa.</p>
          </Reveal>
          <ol className="mt-8 space-y-5">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} delay={i * 110}>
                <li className="flex gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 transition hover:border-emerald-200 dark:border-slate-800 dark:bg-slate-900">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-700/20"><Icon className="h-5 w-5" /></span>
                  <span><span className="block font-heading text-base font-extrabold text-slate-950 dark:text-white">{i + 1}. {title}</span><span className="mt-1 block text-sm leading-6 text-slate-600 dark:text-slate-300">{text}</span></span>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="relative z-10 px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
        <Reveal>
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#243A7A] via-[#4F7CFF] to-[#8B5CF6] px-6 py-12 text-center text-white shadow-2xl shadow-blue-900/20 sm:px-12 sm:py-16">
            <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border-[40px] border-white/10" />
            <div className="pointer-events-none absolute -bottom-32 -left-12 h-72 w-72 rounded-full border-[45px] border-white/10" />
            <div className="relative mx-auto max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-2 text-xs font-bold text-emerald-50"><Sparkles className="h-4 w-4" /> Anza leo</span>
              <h2 className="mt-5 font-heading text-3xl font-black tracking-tight sm:text-4xl">Tengeneza nafasi ya mafanikio yako.</h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-emerald-50 sm:text-base">Jiunge na SmartNekam ili upate nyenzo za kujifunzia, uungane na wanafunzi wengine na ugundue fursa za elimu.</p>
              <Link href="/auth" className="mt-7 inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-extrabold text-emerald-800 shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-50">Fungua akaunti <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="relative z-10 border-t border-emerald-100 bg-white/80 py-7 text-center dark:border-slate-800 dark:bg-[#0B0F1A]/80">
        <Link href="/" className="font-heading text-sm font-black text-slate-900 dark:text-white">SmartNekam</Link>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">© {new Date().getFullYear()} SmartNekam. Elimu kwa kila mwanafunzi.</p>
      </footer>
    </main>
  )
}
