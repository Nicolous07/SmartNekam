'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowLeftRight, BookMarked, Check, ChevronLeft, ChevronRight, LoaderCircle, Plus, RotateCcw, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Deck = { id:string; owner_id:string; title:string; description:string; level:string|null; visibility:string; status:string; created_at:string }
type Card = { id:string; deck_id:string; owner_id:string; front:string; back:string; position:number; updated_at:string }
function labelLevel(level:string|null){return level==='O_LEVEL'?'O-Level':level==='A_LEVEL'?'A-Level':level==='UNIVERSITY'?'University':'All levels'}

export default function Flashcards() {
  const supabase=useMemo(()=>createClient(),[])
  const [decks,setDecks]=useState<Deck[]>([])
  const [cards,setCards]=useState<Card[]>([])
  const [selectedDeck,setSelectedDeck]=useState('all')
  const [deckTitle,setDeckTitle]=useState('Kadi zangu')
  const [deckDescription,setDeckDescription]=useState('')
  const [level,setLevel]=useState('O_LEVEL')
  const [front,setFront]=useState('')
  const [back,setBack]=useState('')
  const [showForm,setShowForm]=useState(false)
  const [flipped,setFlipped]=useState(false)
  const [index,setIndex]=useState(0)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [reviewing,setReviewing]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')

  const load=useCallback(async()=>{
    setLoading(true);setError('')
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){setError('Ingia tena ili kuona flashcards zako.');setLoading(false);return}
    const {data:deckData,error:deckError}=await supabase.from('flashcard_decks').select('id,owner_id,title,description,level,visibility,status,created_at').or(`owner_id.eq.${user.id},and(visibility.eq.public,status.eq.published)`).order('updated_at',{ascending:false}).limit(100)
    if(deckError){setError(deckError.message);setLoading(false);return}
    const list=(deckData??[]) as Deck[];setDecks(list)
    const ids=list.map(d=>d.id)
    if(ids.length){const {data:cardData,error:cardError}=await supabase.from('flashcards').select('id,deck_id,owner_id,front,back,position,updated_at').in('deck_id',ids).order('position',{ascending:true});if(cardError)setError(cardError.message);setCards((cardData??[]) as Card[])}else setCards([])
    setLoading(false)
  },[supabase])
  useEffect(()=>{void load()},[load])
  const filtered=cards.filter(c=>selectedDeck==='all'||c.deck_id===selectedDeck)
  const current=filtered[index]
  useEffect(()=>{setIndex(0);setFlipped(false)},[selectedDeck])
  useEffect(()=>{if(index>=filtered.length&&filtered.length)setIndex(filtered.length-1)},[filtered.length,index])

  async function addCard(e:FormEvent){
    e.preventDefault();setSaving(true);setError('');setNotice('')
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){setError('Ingia tena kwanza.');setSaving(false);return}
    try{
      let deck=decks.find(d=>d.id===selectedDeck&&d.owner_id===user.id)
      if(!deck){
        const title=deckTitle.trim()
        if(title.length<2)throw new Error('Jina la deck linahitajika.')
        const {data,error:createError}=await supabase.from('flashcard_decks').insert({owner_id:user.id,title,description:deckDescription.trim(),level,visibility:'private',status:'draft'}).select('id,owner_id,title,description,level,visibility,status,created_at').single()
        if(createError)throw createError
        deck=data as Deck
      }
      const {data:existing}=await supabase.from('flashcards').select('position').eq('deck_id',deck.id).order('position',{ascending:false}).limit(1).maybeSingle()
      const position=(existing?.position??0)+1
      const {error:cardError}=await supabase.from('flashcards').insert({deck_id:deck.id,owner_id:user.id,front:front.trim(),back:back.trim(),position})
      if(cardError)throw cardError
      setFront('');setBack('');setNotice('Flashcard imehifadhiwa kwenye deck yako binafsi.');setShowForm(false);setSelectedDeck(deck.id);await load()
    }catch(e){setError(e instanceof Error?e.message:'Imeshindikana kuhifadhi kadi.')}
    setSaving(false)
  }
  async function markGrade(grade:number){if(!current)return;setReviewing(true);setError('');setNotice('');const {error:rpcError}=await supabase.rpc('review_flashcard',{p_flashcard_id:current.id,p_grade:grade});if(rpcError)setError(rpcError.message);else{setNotice(grade>=3?'Umeweka kuwa umelikumbuka. Marudio yajayo yamepangwa.':'Umeweka kuwa unahitaji kulirudia. Kadi limepangwa tena.');move(1)}setReviewing(false)}
  function move(direction:number){if(!filtered.length)return;setIndex(i=>(i+direction+filtered.length)%filtered.length);setFlipped(false)}
  const deckOptions=decks.map(d=><option key={d.id} value={d.id}>{d.title}{d.owner_id?'': ''}</option>)
  return <div className="mx-auto max-w-3xl space-y-5">
    <Link href="/learn" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-700 dark:text-slate-300"><ArrowLeft className="h-4 w-4"/> Rudi Learn</Link>
    <section className="geometric-hero relative overflow-hidden rounded-3xl p-6 text-white sm:p-8"><div className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full border-[30px] border-white/10"/><div className="relative flex flex-wrap items-end justify-between gap-4"><div><span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold"><BookMarked className="h-3.5 w-3.5"/> ACTIVE RECALL</span><h1 className="mt-3 text-3xl font-black sm:text-4xl">Flashcards</h1><p className="mt-2 max-w-xl text-sm text-emerald-50">Tengeneza deck, geuza kadi kuona jibu na rekodi mapitio yako ili kuratibu marudio.</p></div><button type="button" onClick={()=>setShowForm(v=>!v)} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50"><Plus className="h-4 w-4"/>{showForm?'Funga fomu':'Tengeneza kadi'}</button></div></section>
    {showForm&&<section className="geometric-card p-4 sm:p-5"><h2 className="font-bold text-slate-900 dark:text-white">Ongeza flashcard</h2><form onSubmit={addCard} className="mt-4 space-y-3"><label className="block"><span className="mb-1 block text-xs font-semibold text-slate-500">Ongeza kwenye deck</span><select value={selectedDeck} onChange={e=>setSelectedDeck(e.target.value)} className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="all">Tengeneza deck mpya</option>{decks.filter(d=>d.owner_id).map(d=><option value={d.id} key={d.id}>{d.title}</option>)}</select></label>{selectedDeck==='all'&&<><label className="block"><span className="mb-1 block text-xs font-semibold text-slate-500">Jina la deck</span><input value={deckTitle} onChange={e=>setDeckTitle(e.target.value)} maxLength={180} required className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" placeholder="Mf. Biology Form Four"/></label><div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1 block text-xs font-semibold text-slate-500">Kiwango</span><select value={level} onChange={e=>setLevel(e.target.value)} className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="O_LEVEL">O-Level</option><option value="A_LEVEL">A-Level</option><option value="UNIVERSITY">University</option></select></label><label className="block"><span className="mb-1 block text-xs font-semibold text-slate-500">Maelezo (hiari)</span><input value={deckDescription} onChange={e=>setDeckDescription(e.target.value)} maxLength={1200} className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" placeholder="Mada / topic"/></label></div></>}<label className="block"><span className="mb-1 block text-xs font-semibold text-slate-500">Swali / upande wa mbele</span><textarea value={front} onChange={e=>setFront(e.target.value)} required rows={2} maxLength={2000} placeholder="Mitochondria hufanya kazi gani?" className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"/></label><label className="block"><span className="mb-1 block text-xs font-semibold text-slate-500">Jibu / upande wa nyuma</span><textarea value={back} onChange={e=>setBack(e.target.value)} required rows={3} maxLength={5000} placeholder="Huzalisha nishati kupitia cellular respiration." className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"/></label><button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{saving?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Plus className="h-4 w-4"/>} Hifadhi kadi</button></form></section>}
    {error&&<p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">{error}</p>}{notice&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{notice}</p>}
    <section className="geometric-card flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="text-xs font-semibold text-slate-500">Deck / mkusanyiko</p><select value={selectedDeck} onChange={e=>setSelectedDeck(e.target.value)} className="mt-1 max-w-full rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="all">Zote</option>{deckOptions}</select></div><div className="text-right"><p className="text-xs text-slate-500">Kadi zilizopo</p><p className="text-2xl font-black text-slate-900 dark:text-white">{filtered.length}</p></div></section>
    {loading?<div className="geometric-card flex items-center gap-3 p-6 text-sm text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin text-emerald-600"/> Inapakia kadi zako...</div>:!current?<section className="geometric-card p-8 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><BookMarked className="h-7 w-7"/></span><h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">Anza na flashcard yako ya kwanza</h2><p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">Tengeneza kadi binafsi za fomula, msamiati au dhana unazotaka kukumbuka.</p><button type="button" onClick={()=>setShowForm(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white"><Plus className="h-4 w-4"/> Tengeneza kadi</button></section>:<section className="space-y-3"><button type="button" onClick={()=>setFlipped(v=>!v)} aria-label="Geuza flashcard" className={`group relative flex min-h-[280px] w-full flex-col items-center justify-center overflow-hidden rounded-3xl border p-7 text-center shadow-sm transition duration-300 sm:min-h-[340px] ${flipped?'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/60':'border-emerald-100 bg-white dark:border-slate-700 dark:bg-slate-950'}`}><span className="absolute left-5 top-5 rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">{flipped?'JIBU':'SWALI'} · {index+1}/{filtered.length}</span><span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 transition group-hover:scale-105 dark:bg-emerald-900 dark:text-emerald-200"><ArrowLeftRight className="h-6 w-6"/></span><p className="max-w-xl whitespace-pre-wrap text-xl font-extrabold leading-relaxed text-slate-900 dark:text-white sm:text-2xl">{flipped?current.back:current.front}</p><p className="mt-6 text-xs font-semibold text-slate-400">Gusa kubadilisha upande</p></button><div className="flex flex-wrap items-center justify-between gap-2"><button type="button" onClick={()=>move(-1)} className="inline-flex items-center gap-1 rounded-xl border border-emerald-100 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-emerald-50 dark:border-slate-700 dark:text-slate-200"><ChevronLeft className="h-4 w-4"/> Iliyotangulia</button><button type="button" onClick={()=>setFlipped(false)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"><RotateCcw className="h-4 w-4"/> Anza upya</button><button type="button" onClick={()=>move(1)} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-500">Inayofuata <ChevronRight className="h-4 w-4"/></button></div>{flipped&&<div className="grid grid-cols-2 gap-2"><button type="button" disabled={reviewing} onClick={()=>void markGrade(1)} className="rounded-xl border border-amber-200 px-3 py-3 text-sm font-extrabold text-amber-800 hover:bg-amber-50 disabled:opacity-60 dark:border-amber-900 dark:text-amber-200">Nirudie tena</button><button type="button" disabled={reviewing} onClick={()=>void markGrade(4)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-extrabold text-white disabled:opacity-60">{reviewing?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Check className="h-4 w-4"/>} Nilikumbuka</button></div>}</section>}
    <p className="flex items-center gap-2 text-xs text-slate-400"><Sparkles className="h-4 w-4"/> Mapitio huhifadhiwa kwenye flashcard_reviews na kupanga tarehe inayofuata ya marudio.</p>
  </div>
}
