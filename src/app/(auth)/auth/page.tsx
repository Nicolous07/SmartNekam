'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Eye, EyeOff, GraduationCap, Loader2, Mail, Lock, BookOpen, MessagesSquare, Briefcase, Phone, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import InstitutionSearchField from '@/components/institutions/InstitutionSearchField'
import ThemeToggle from '@/components/layout/ThemeToggle'

export default function AuthPage() {
  const supabase = useMemo(() => createClient(), [])

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [studyLevel, setStudyLevel] = useState<'O_LEVEL' | 'A_LEVEL' | 'UNIVERSITY'>('O_LEVEL')
  const [formOrYear, setFormOrYear] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [universityId, setUniversityId] = useState('')
  const [otherInstitutionName, setOtherInstitutionName] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email')
  const [phone, setPhone] = useState('+255')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)

  // Show authentication callback errors once, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const authError = params.get('error')
    if (!authError) return

    const reason = params.get('reason')
    const providerDescription = params.get('error_description')
    let callbackMessage = ''

    if (reason === 'missing_code') {
      callbackMessage = 'Kiungo cha uthibitisho hakina code ya kuingia. Anza tena kuingia na ujaribu kiungo kipya.'
    } else if (reason === 'exchange_failed') {
      callbackMessage = 'Kiungo cha kuingia kimeisha muda, tayari kimetumika, au hakilingani na kivinjari kilichoanza kuingia. Jaribu tena.'
    } else if (reason === 'provider_error') {
      callbackMessage = providerDescription
        ? `Mtoa huduma wa kuingia amekataa ombi: ${providerDescription}`
        : 'Mtoa huduma wa kuingia amekataa ombi. Jaribu tena au tumia barua pepe/nywila au namba ya simu.'
    } else if (reason === 'server_error') {
      callbackMessage = 'Seva imeshindwa kukamilisha uthibitisho. Hakikisha mipangilio ya Supabase iko sahihi, kisha jaribu tena.'
    } else {
      callbackMessage = 'Imeshindikana kukamilisha kuingia. Jaribu tena kwa barua pepe/nywila au namba ya simu.'
    }

    setError(callbackMessage)
    for (const key of ['error', 'reason', 'error_code', 'error_description']) params.delete(key)
    const query = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (mode === 'register' && !(authMethod === 'phone' && otpSent)) {
        const cleanName = displayName.trim().replace(/\s+/g, ' ')
        const cleanUsername = username.trim().toLowerCase()
        const normalizeIdentity = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
        if (cleanName.length < 3 || cleanName.length > 120) {
          setError('Weka jina lako halisi la kuonekana kwenye profile (herufi 3–120).')
          return
        }
        if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
          setError('Username iwe herufi ndogo, namba au underscore pekee; herufi 3–20. Mfano: neema_k.')
          return
        }
        if (normalizeIdentity(cleanName) === normalizeIdentity(cleanUsername)) {
          setError('Username lazima iwe tofauti na display name yako.')
          return
        }
        const selectedInstitution = studyLevel === 'UNIVERSITY' ? universityId : schoolId
        if (!selectedInstitution) {
          setError(studyLevel === 'UNIVERSITY' ? 'Ni lazima uchague chuo/university yako ili upate Official Community ya taasisi yako.' : 'Ni lazima uchague shule yako ya sekondari/high school ili upate Official Community ya shule yako.')
          return
        }
        const needsOtherInstitution = selectedInstitution === '__other__'
        if (needsOtherInstitution && otherInstitutionName.trim().length < 2) {
          setError('Andika jina la shule au chuo chako kwa sababu hakipo kwenye orodha.')
          return
        }
        const { data: available, error: availabilityError } = await supabase.rpc('is_smartnekam_username_available', { p_username: cleanUsername, p_display_name: cleanName })
        if (availabilityError) {
          setError('Imeshindikana kuthibitisha username. Hakikisha umeendesha SQL 017 kisha ujaribu tena.')
          return
        }
        if (!available) {
          setError('Username hii imeshatumika au haikubaliki. Chagua username nyingine.')
          return
        }
      }

      if (authMethod === 'phone') {
        const normalizedPhone = phone.trim().replace(/[\s()-]/g, '')
        if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
          setError('Tumia namba ya kimataifa, kwa mfano +255712345678.')
          return
        }
        if (!otpSent) {
          const { error: otpError } = await supabase.auth.signInWithOtp({
            phone: normalizedPhone,
            options: {
              shouldCreateUser: mode === 'register',
              ...(mode === 'register' ? { data: { full_name: displayName.trim().replace(/\s+/g, ' '), username: username.trim().toLowerCase(), level: studyLevel, form_or_year: formOrYear.trim(), school_id: studyLevel !== 'UNIVERSITY' && schoolId !== '__other__' ? schoolId || null : null, university_id: studyLevel === 'UNIVERSITY' && universityId !== '__other__' ? universityId || null : null, institution_name: (studyLevel === 'UNIVERSITY' ? universityId === '__other__' : schoolId === '__other__') ? otherInstitutionName.trim() : null } } : {}),
            },
          })
          if (otpError) {
            const detail = otpError.message.toLowerCase()
            if (detail.includes('signups not allowed for otp') || detail.includes('otp_disabled')) {
              setError(
                mode === 'register'
                  ? 'Supabase imezuia usajili kwa OTP. Fungua Supabase Dashboard → Authentication → Sign In / Providers; ruhusu signups/new users, washa Phone provider, na hakikisha SMS provider (mf. Twilio/Vonage) ina credentials sahihi. Hifadhi mabadiliko kisha jaribu tena.'
                  : 'Namba hii huenda bado haina akaunti ya SmartNekam. Badili kwenda “Jisajili” kama ni mara ya kwanza. Ikiwa tayari una akaunti, hakikisha Phone provider imewashwa kwenye Supabase Auth.'
              )
            } else if (detail.includes('phone provider') || detail.includes('provider is not enabled') || detail.includes('unsupported phone')) {
              setError('Phone Auth haijawashwa kwenye Supabase. Nenda Authentication → Sign In / Providers → Phone, washa provider na weka SMS provider yenye credentials halali.')
            } else if (detail.includes('rate limit') || detail.includes('too many requests')) {
              setError('Umeomba OTP mara nyingi. Subiri angalau sekunde 60, kisha jaribu tena.')
            } else {
              setError(`OTP haikutumwa: ${otpError.message}. Kagua Authentication → Sign In / Providers → Phone na mipangilio ya SMS provider.`)
            }
            return
          }
          setOtpSent(true)
          setMessage(`Tumetuma OTP kwa ${normalizedPhone}. Ingiza namba sita kuthibitisha.`)
          return
        }
        if (!/^\d{6}$/.test(otp.trim())) {
          setError('OTP lazima iwe na tarakimu 6.')
          return
        }
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          phone: normalizedPhone,
          token: otp.trim(),
          type: 'sms',
        })
        if (verifyError) {
          setError(`OTP haikuthibitishwa: ${verifyError.message}`)
          return
        }
        if (data.session) {
          window.location.assign('/dashboard')
          return
        }
        setError('OTP imepokelewa lakini session haikupatikana. Jaribu tena.')
        return
      }

      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: { full_name: displayName.trim().replace(/\s+/g, ' '), username: username.trim().toLowerCase(), level: studyLevel, form_or_year: formOrYear.trim(), school_id: studyLevel !== 'UNIVERSITY' && schoolId !== '__other__' ? schoolId || null : null, university_id: studyLevel === 'UNIVERSITY' && universityId !== '__other__' ? universityId || null : null, institution_name: (studyLevel === 'UNIVERSITY' ? universityId === '__other__' : schoolId === '__other__') ? otherInstitutionName.trim() : null },
          },
        })
        if (error) {
          setError(error.message)
        } else if (data.session) {
          // A full navigation ensures the first server request sees the new
          // Supabase cookies instead of a potentially cached App Router result.
          window.location.assign('/dashboard')
          return
        } else {
          setMessage('Tumekutumia barua pepe. Bofya kiungo kilichomo kuthibitisha akaunti yako.')
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) {
          setError(
            error.code === 'invalid_credentials'
              ? 'Barua pepe au nywila si sahihi.'
              : error.message,
          )
        } else if (!data.session) {
          setError('Kuingia hakukamilika kwa sababu session haikupatikana. Jaribu tena.')
        } else {
          // Force a clean request so the Next.js proxy reads the new auth cookies.
          window.location.assign('/dashboard')
          return
        }
      }
    } catch (err) {
      console.error('[SmartNekam auth] Sign-in request failed:', err instanceof Error ? err.name : 'UnknownError')
      setError('Imeshindikana kuwasiliana na huduma ya kuingia. Angalia intaneti na mipangilio ya Supabase kisha ujaribu tena.')
    } finally {
      setLoading(false)
    }
  }



  const inputWrap =
    'auth-input-wrap flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-3 transition focus-within:border-emerald-400 focus-within:bg-white/10 focus-within:ring-4 focus-within:ring-emerald-400/15'
  const inputBase =
    'auth-input w-full bg-transparent py-3 text-sm text-white placeholder:text-slate-400 focus:outline-none'

  const FEATURES = [
    { icon: BookOpen, title: 'Pata Maarifa', text: 'Past papers, vitabu na notes kulingana na mtaala wako.' },
    { icon: MessagesSquare, title: 'Shirikiana', text: 'Uliza maswali na jifunze pamoja na wenzako na wanachuo.' },
    { icon: Briefcase, title: 'Pata Fursa', text: 'Scholarships, internships na maombi ya vyuo mahali pamoja.' },
  ]

  return (
    <main className="auth-screen relative flex min-h-screen flex-col overflow-hidden bg-[#0B0F1A] text-[var(--sn-text)]">
      {/* Mandhari ya picha yenye overlay inayofuata theme iliyochaguliwa */}
      <Image
        src="/images/reference-login.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center opacity-90"
      />
      <div className="auth-image-overlay absolute inset-0 bg-gradient-to-b from-[#0B0F1A]/55 via-[#121826]/40 to-[#0B0F1A]/85" />
      <div className="auth-color-overlay absolute inset-0 bg-emerald-950/25 mix-blend-multiply" />
      <div className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />

      <div className="relative z-10 flex flex-1 flex-col">
        <div className="absolute right-4 top-3 z-30 sm:right-6"><ThemeToggle /></div>
        {/* Juu: chapa + kadi ya kuingia */}
        <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-5 py-8 lg:grid-cols-[1fr_26rem_1fr] lg:px-8">
          {/* Chapa (kushoto) */}
          <div className="anim-fade-in flex flex-col items-center gap-2 text-center lg:items-start lg:self-start lg:pt-6 lg:text-left">
            <Link href="/" className="inline-flex items-center justify-center rounded-2xl bg-white/95 p-2 shadow-lg shadow-black/10">
              <Image src="/images/smartnekam-logo.png" alt="Nembo rasmi ya SmartNekam — Learn • Connect • Grow" width={190} height={174} priority className="h-auto w-36 object-contain sm:w-44" />
            </Link>
            <p className="text-sm text-emerald-300">Soma. Ungana. Pata Fursa.</p>

            <blockquote className="mt-10 hidden max-w-[14rem] text-sm text-slate-300 lg:block">
              “Elimu ni ufunguo wa fursa zako.”
              <footer className="mt-1 text-xs text-emerald-300">SmartNekam</footer>
            </blockquote>
          </div>

          {/* Kadi ya glass */}
          <div className="auth-card anim-fade-up w-full rounded-3xl border border-emerald-300/30 bg-black/25 p-6 shadow-2xl shadow-emerald-950/40 backdrop-blur-[3px] sm:p-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-emerald-400/60 bg-white p-2">
              <Image src="/images/smartnekam-mark.png" alt="SmartNekam" width={64} height={64} className="h-full w-full object-contain" />
            </div>

            {/* key inafanya animation ianze upya mode inapobadilika */}
            <div key={mode} className="anim-fade-in text-center">
              <h1 className="text-2xl font-extrabold">
                {mode === 'login' ? 'Karibu Tena!' : 'Karibu SmartNekam!'}
              </h1>
              <p className="mb-6 mt-1 text-sm text-slate-300">
                {mode === 'login'
                  ? 'Ingia ili uendelee na safari yako ya kujifunza.'
                  : 'Fungua akaunti mpya na upate pointi 50 za bure.'}
              </p>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/20 p-1">
              <button type="button" onClick={() => { setAuthMethod('email'); setOtpSent(false); setOtp(''); setError(null); setMessage(null) }} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${authMethod === 'email' ? 'bg-emerald-400 text-emerald-950' : 'text-slate-300 hover:bg-white/5'}`}><Mail className="mr-1.5 inline h-3.5 w-3.5"/> Barua pepe</button>
              <button type="button" onClick={() => { setAuthMethod('phone'); setError(null); setMessage(null) }} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${authMethod === 'phone' ? 'bg-emerald-400 text-emerald-950' : 'text-slate-300 hover:bg-white/5'}`}><Phone className="mr-1.5 inline h-3.5 w-3.5"/> Simu + OTP</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'register' && (
                <div className="space-y-3 rounded-2xl border border-emerald-300/20 bg-emerald-950/25 p-3">
                  <label className={inputWrap}>
                    <GraduationCap className="h-4 w-4 shrink-0 text-slate-400" />
                    <input type="text" name="displayName" required minLength={3} maxLength={120} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jina lako kamili (Display name)" autoComplete="name" className={inputBase} />
                  </label>
                  <label className={inputWrap}>
                    <span className="shrink-0 text-sm font-extrabold text-emerald-300">@</span>
                    <input type="text" name="username" required minLength={3} maxLength={20} pattern="[a-z0-9_]{3,20}" title="Herufi ndogo, namba au underscore; herufi 3 hadi 20" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))} placeholder="username_ya_kipekee" autoComplete="username" aria-label="Username ya lazima na ya kipekee" className={inputBase} />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block px-1 text-xs font-bold text-emerald-100">Kiwango cha masomo</span>
                      <select value={studyLevel} onChange={(e) => { const value = e.target.value as 'O_LEVEL' | 'A_LEVEL' | 'UNIVERSITY'; setStudyLevel(value); setSchoolId(''); setUniversityId(''); setOtherInstitutionName(''); setFormOrYear('') }} className="w-full rounded-xl border border-white/15 bg-[#121826] px-3 py-3 text-sm text-white outline-none focus:border-emerald-400">
                        <option value="O_LEVEL">Sekondari — O-Level</option>
                        <option value="A_LEVEL">High School — A-Level</option>
                        <option value="UNIVERSITY">Chuo / University</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block px-1 text-xs font-bold text-emerald-100">{studyLevel === 'UNIVERSITY' ? 'Mwaka wa masomo (hiari)' : 'Kidato (hiari)'}</span>
                      <input value={formOrYear} onChange={(e) => setFormOrYear(e.target.value.slice(0, 30))} maxLength={30} placeholder={studyLevel === 'UNIVERSITY' ? 'Mfano: Mwaka wa 2' : 'Mfano: Form IV'} className="w-full rounded-xl border border-white/15 bg-[#121826] px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400" />
                    </label>
                  </div>
                  {studyLevel === 'UNIVERSITY' ? (
                    <div className="space-y-2">
                      <InstitutionSearchField kind="tertiary" label="Chuo / college / university (lazima)" value={universityId} onChange={setUniversityId} allowOther dark placeholder="Andika jina la chuo, mfano UDOM, DIT, MUHAS..." />
                      {universityId === '__other__' && <input value={otherInstitutionName} onChange={(e) => setOtherInstitutionName(e.target.value.slice(0, 180))} required minLength={2} maxLength={180} placeholder="Andika jina la chuo chako" className="w-full rounded-xl border border-white/15 bg-[#121826] px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400" />}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <InstitutionSearchField kind="school" label={studyLevel === 'A_LEVEL' ? 'High school / sekondari (lazima)' : 'Shule ya sekondari (lazima)'} value={schoolId} onChange={setSchoolId} allowOther dark placeholder="Andika jina la shule, mfano Ilboru, Tabora Boys..." />
                      {schoolId === '__other__' && <input value={otherInstitutionName} onChange={(e) => setOtherInstitutionName(e.target.value.slice(0, 180))} required minLength={2} maxLength={180} placeholder="Andika jina la shule yako" className="w-full rounded-xl border border-white/15 bg-[#121826] px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400" />}
                    </div>
                  )}
                  <p className="px-1 text-[11px] leading-5 text-slate-400">Jaza jina lako kamili, kisha username ya kipekee. Shule/chuo ni lazima. Official Community ya shule/chuo chako ni ya wanafunzi walioweka taasisi hiyo; Maswali na Majibu na Study Groups zinabaki wazi kwa wanafunzi wote.</p>
                </div>
              )}
              {authMethod === 'email' ? (
                <>
                  <label className={inputWrap}>
                    <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Barua pepe" autoComplete="email" className={inputBase} />
                  </label>
                  <label className={inputWrap}>
                    <Lock className="h-4 w-4 shrink-0 text-slate-400" />
                    <input type={showPassword ? 'text' : 'password'} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nywila (angalau herufi 8)" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className={inputBase} />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Ficha nywila' : 'Onyesha nywila'} className="text-slate-400 hover:text-white">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </label>
                </>
              ) : (
                <>
                  {!otpSent ? (
                    <label className={inputWrap}><Phone className="h-4 w-4 shrink-0 text-slate-400"/><input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+255 712 345 678" autoComplete="tel" className={inputBase}/></label>
                  ) : (
                    <>
                      <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-3 text-xs text-emerald-100"><ShieldCheck className="mr-2 inline h-4 w-4"/> OTP imetumwa kwa {phone.trim()}</div>
                      <label className={inputWrap}><Lock className="h-4 w-4 shrink-0 text-slate-400"/><input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Ingiza OTP ya tarakimu 6" className={`${inputBase} text-center tracking-[0.35em]`}/></label>
                      <button type="button" disabled={loading} onClick={() => { setOtpSent(false); setOtp(''); setMessage(null) }} className="text-xs font-semibold text-emerald-300 hover:underline">Badili namba / tuma OTP tena</button>
                    </>
                  )}
                </>
              )}

              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 py-3 text-sm font-bold text-emerald-950 shadow-lg shadow-emerald-500/25 transition hover:from-emerald-400 hover:to-emerald-300 active:scale-[0.98] disabled:opacity-60">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Subiri...' : authMethod === 'phone' ? (otpSent ? 'Thibitisha OTP' : 'Tuma OTP') : (mode === 'login' ? 'Ingia' : 'Jisajili')}
              </button>
            </form>

            {error && (
              <p className="anim-scale-in mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
            {message && (
              <p className="anim-scale-in mt-3 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">
                {message}
              </p>
            )}


            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setOtpSent(false); setOtp(''); setError(null); setMessage(null) }}
              className="mt-6 w-full text-center text-sm text-slate-300"
            >
              {mode === 'login' ? 'Huna akaunti? ' : 'Una akaunti tayari? '}
              <span className="font-bold text-emerald-300 hover:underline">
                {mode === 'login' ? 'Jisajili' : 'Ingia'}
              </span>
            </button>
          </div>

          {/* Nafasi ya kulia (kusawazisha mpangilio kwenye kompyuta) */}
          <div className="hidden lg:block" />
        </div>

        {/* Chini: vipengele 3 + hakimiliki */}
        <div className="mx-auto w-full max-w-4xl px-5 pb-6">
          <ul className="grid gap-6 sm:grid-cols-3 sm:divide-x sm:divide-white/10">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex flex-col items-center px-4 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-2 text-sm font-semibold">{title}</p>
                <p className="mt-0.5 text-xs text-slate-400">{text}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-center text-xs text-slate-500">
            © {new Date().getFullYear()} SmartNekam. Haki zote zimehifadhiwa.
          </p>
        </div>
      </div>
    </main>
  )
}
