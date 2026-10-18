import { headers } from 'next/headers'
import Link from 'next/link'
import QRCode from 'qrcode'
import { BadgeCheck, CalendarClock, ExternalLink, ShieldAlert } from 'lucide-react'
import PrintCertificateButton from '@/components/certificates/PrintCertificateButton'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Uthibitisho wa Cheti | SmartNekam' }
export const dynamic = 'force-dynamic'
type CertResult = { is_valid:boolean; certificate_code:string|null; holder_name:string|null; certificate_title:string|null; certificate_type:string|null; issuer_name:string|null; issued_at:string|null; expires_at:string|null; verification_result:string }
async function siteUrl() {
  const env=process.env.NEXT_PUBLIC_SITE_URL
  if(env)return env.replace(/\/$/,'')
  const h=await headers();const host=h.get('x-forwarded-host')??h.get('host')??'localhost:3000';const proto=h.get('x-forwarded-proto')??(host.startsWith('localhost')?'http':'https');return `${proto}://${host}`
}
export default async function VerifyPage({params}:{params:Promise<{certId:string}>}) {
  const {certId}=await params;const code=decodeURIComponent(certId).trim().slice(0,40).toUpperCase()
  const supabase=await createClient()
  const {data,error}=await supabase.rpc('verify_smartnekam_certificate',{p_code:code})
  const result=(Array.isArray(data)?data[0]:data) as CertResult|undefined
  if(error||!result?.certificate_code||!result.is_valid) {
    const why=result?.verification_result
    const message=why==='revoked'?'Cheti hiki kimebatilishwa.':why==='expired'?'Muda wa cheti hiki umeisha.':'Namba ya cheti haijapatikana au cheti si halali.'
    return <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-4 text-center"><span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200"><ShieldAlert className="h-8 w-8"/></span><h1 className="text-2xl font-black text-slate-950 dark:text-white">Cheti hakijathibitishwa</h1><p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{message} {error?'Mfumo wa uthibitishaji umeshindwa kwa sasa.':''}</p><p className="rounded-xl bg-slate-100 px-4 py-2 font-mono text-sm dark:bg-slate-800">{code}</p><Link href="/" className="text-sm font-bold text-emerald-700 underline dark:text-emerald-300">Rudi SmartNekam</Link></main>
  }
  const url=`${await siteUrl()}/verify/${encodeURIComponent(result.certificate_code)}`
  const qr=await QRCode.toString(url,{type:'svg',margin:1,width:144,color:{dark:'#4338ca',light:'#ffffff'}})
  const issued=result.issued_at?new Date(result.issued_at).toLocaleDateString('sw-TZ',{day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Dar_es_Salaam'}):'Tarehe haijawekwa'
  return <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 print:max-w-none print:p-0"><p className="flex items-center justify-center gap-2 rounded-xl bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100 print:hidden"><BadgeCheck className="h-5 w-5"/> Cheti hiki ni halali kwenye mfumo wa SmartNekam.</p><section className="relative overflow-hidden rounded-2xl border-4 border-double border-emerald-700 bg-white p-6 text-center text-slate-900 shadow-lg sm:p-10 print:shadow-none"><div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-100"/><div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-amber-100"/><div className="relative"><p className="text-sm font-extrabold uppercase tracking-[.3em] text-emerald-700">SmartNekam</p><h1 className="mt-4 text-3xl font-black text-emerald-950 sm:text-4xl">Cheti cha Mafanikio</h1><p className="mt-1 text-xs uppercase tracking-widest text-slate-500">Certificate verification</p><p className="mt-8 text-sm text-slate-600">Kinathibitisha kwamba</p><p className="mt-2 text-3xl font-black text-slate-900 sm:text-4xl">{result.holder_name??'Mwanafunzi wa SmartNekam'}</p><div className="mx-auto mt-3 h-0.5 w-48 bg-emerald-600"/><p className="mt-5 text-sm text-slate-600">amepatiwa cheti cha</p><p className="mt-2 text-xl font-extrabold text-emerald-800 sm:text-2xl">{result.certificate_title??'Mafanikio ya SmartNekam'}</p><p className="mt-3 text-sm text-slate-600">Aina: {result.certificate_type??'Certificate'} · Mtoa cheti: {result.issuer_name??'SmartNekam'}</p><p className="mt-2 flex items-center justify-center gap-1 text-xs text-slate-500"><CalendarClock className="h-3.5 w-3.5"/> Tarehe ya kutolewa: {issued}</p>{result.expires_at&&<p className="mt-1 text-xs text-slate-500">Inaisha: {new Date(result.expires_at).toLocaleDateString('sw-TZ')}</p>}<div className="mt-7 flex flex-col items-center gap-2"><div className="rounded-xl border border-emerald-100 p-3" dangerouslySetInnerHTML={{__html:qr}}/><p className="font-mono text-sm font-bold tracking-wide">{result.certificate_code}</p><p className="max-w-md break-all text-[11px] text-slate-500">Thibitisha kwa QR code au tembelea <a className="underline" href={url}>{url}</a></p></div><div className="mt-6 flex flex-wrap justify-center gap-3 print:hidden"><span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 px-4 py-2 text-sm font-bold text-emerald-800"><BadgeCheck className="h-4 w-4"/> Verified</span><a href={url} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Verification link <ExternalLink className="h-4 w-4"/></a><PrintCertificateButton /></div></div></section></main>
}
