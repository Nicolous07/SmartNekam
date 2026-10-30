import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Activity, AlertTriangle, ArrowRight, BarChart3, BellRing, CalendarCheck, BookOpen, BookMarked, BriefcaseBusiness, Building2, CreditCard, FileText, Flag, GraduationCap, Headset, MessageSquare, ShieldCheck, TrendingUp, Trophy, Users, UserCog, Database, BadgeCheck, LockKeyhole, ReceiptText, Megaphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isStaffUser } from '@/lib/admin'
import { AdminFeedPostActions, ReviewContentActions, ReviewReportActions } from '@/components/admin/AdminReviewActions'
import { AdminNotificationComposer, AdminProfileActions, OpportunityLifecycleActions, ReferralActions, ReviewCourseActions, ReviewFlashcardActions, ReviewMentorActions, SupportTicketActions } from '@/components/admin/AdminOperations'
import { AccountDataRequestActions, CertificateRevokeAction, CommunityModerationActions, InstitutionCreateForm, OpportunityCreateForm, SchoolAnnouncementForm } from '@/components/admin/AdminAdvancedActions'
import AdminDailyChallengeComposer from '@/components/admin/AdminDailyChallengeComposer'
import AdminLearningManager from '@/components/admin/AdminLearningManager'
import AdminPostPromotionManager from '@/components/admin/AdminPostPromotionManager'
import AdminAnalyticsCharts, { type DailyAnalyticsRow } from '@/components/admin/AdminAnalyticsCharts'

type Section = 'overview'|'content'|'reports'|'audit'|'users'|'learning'|'promotions'|'daily-challenge'|'community'|'feed'|'opportunities'|'mentors'|'institutions'|'payments'|'notifications'|'growth'|'support'|'certificates'|'security'|'analytics'
type PendingNote = {id:string;title:string;level:string|null;created_at:string}
type PendingPaper = {id:string;title:string;level:string|null;year:number;exam_type:string;created_at:string}
type PendingTextbook = {id:string;title:string;level:string|null;author:string|null;publication_year:number|null;created_at:string}
type PendingOpportunity = {id:string;title:string;type:string;country:string;deadline:string|null;created_at:string;status:string}
type ReportRow = {id:string;target_type:string;target_id:string;reason_category:string;details:string;status:string;created_at:string}
type AuditRow = {id:string;action_name:string;entity_type:string;created_at:string;details:unknown}
type ProfileRow = {id:string;full_name:string;email:string|null;phone:string|null;role:string;status:string;level:string|null;region:string|null;xp:number;created_at:string;school_id:string|null;university_id:string|null}
type CourseRow = {id:string;title:string;level:string;status:string;created_at:string;access_type:string;price:number;currency:string}
type DeckRow = {id:string;title:string;level:string|null;status:string;created_at:string;visibility:string}
type MentorRow = {id:string;user_id:string;display_name:string|null;headline:string|null;subjects:string[];hourly_rate:number;currency:string;verified:boolean;status:string;rating_average:number;rating_count:number;created_at:string}
type InstitutionRow = {id:string;name:string;region:string|null;country:string;created_at:string;website?:string|null;district?:string|null;school_type?:string|null;admissions_url?:string|null}
type PaymentRow = {id:string;profile_id:string;transaction_type:string;provider:string;status:string;amount:number;currency:string;provider_reference:string|null;description:string;paid_at:string|null;created_at:string}
type NotificationRow = {id:string;user_id:string;title:string;body:string;notification_type:string;is_read:boolean;created_at:string}
type SubscriptionRow = {id:string;profile_id:string;plan_id:string;status:string;current_period_start:string|null;current_period_end:string|null;cancel_at_period_end:boolean;created_at:string}
type PlanRow = {id:string;name:string;slug:string;price:number;currency:string;billing_interval:string;is_active:boolean}
type AnnouncementRow = {id:string;school_id:string;title:string;body:string;audience:string;status:string;publish_at:string;created_at:string}
type ReferralRow = {id:string;referrer_id:string;referred_user_id:string;referral_code_used:string;status:string;reward_xp:number;created_at:string}
type SupportRow = {id:string;user_id:string;subject:string;category:string;priority:string;status:string;assigned_to:string|null;created_at:string;updated_at:string}
type GroupRow = {id:string;name:string;level:string|null;privacy:string;member_count:number;status:string;created_at:string}
type QuestionRow = {id:string;title:string|null;body:string;status:string;created_at:string;user_id:string}
type FeedPostRow = {id:string;author_id:string;category:string;subject:string|null;content:string;is_anonymous:boolean;status:string;created_at:string}
type EventRow = {id:string;title:string;event_type:string;starts_at:string;status:string;created_at:string;venue:string|null}
type CertificateRow = {id:string;certificate_code:string;recipient_id:string;title:string;certificate_type:string;issuer_name:string;issued_at:string;status:string;revoke_reason:string|null}
type DataRequestRow = {id:string;user_id:string;request_type:string;reason:string|null;status:string;submitted_at:string;admin_note:string|null}
type SimpleUser = {id:string;full_name:string;email:string|null}
type ScheduledDailyChallenge = {challenge_date:string;quiz_id:string;assigned_by:string|null;created_at:string}
type DailyQuizAdminRow = {id:string;title:string;description:string|null;level:string|null;duration_minutes:number;status:string}

const sections: {key:Section;label:string}[] = [
  {key:'overview',label:'Muhtasari'},{key:'users',label:'Watumiaji'},{key:'content',label:'Maudhui'},{key:'learning',label:'Learning'},{key:'promotions',label:'Pinned & Ads'},{key:'daily-challenge',label:'Daily Challenge'},
  {key:'community',label:'Jamii & Q&A'},{key:'feed',label:'Home Feed'},{key:'opportunities',label:'Fursa'},{key:'mentors',label:'Mentors'},{key:'institutions',label:'Taasisi'},
  {key:'payments',label:'Malipo'},{key:'notifications',label:'Notifications'},{key:'growth',label:'Referrals'},{key:'support',label:'Support'},
  {key:'reports',label:'Reports'},{key:'certificates',label:'Vyeti'},{key:'security',label:'Usalama & Data'},{key:'analytics',label:'Analytics'},{key:'audit',label:'Audit log'}
]
const typeLabel={note:'Notes',past_paper:'Past papers',textbook:'Vitabu',opportunity:'Fursa'} as const
const dateLabel=(value:string)=>new Date(value).toLocaleString('sw-TZ',{dateStyle:'medium',timeStyle:'short'})
const shortId=(value:string)=>`${value.slice(0,8)}…`
function SectionHeader({title,description}:{title:string;description:string}) { return <div><h2 className="font-heading text-xl font-black text-slate-950 dark:text-white">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p></div> }
function Empty({message}:{message:string}) { return <div className="geometric-card p-8 text-center text-sm text-slate-500">{message}</div> }
function ErrorBox({errors}:{errors:string[]}) { if(!errors.length)return null; return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"><p className="font-extrabold">Baadhi ya taarifa hazikupakiwa</p><ul className="mt-2 list-disc space-y-1 pl-5">{errors.map((err,i)=><li key={`${i}-${err}`}>{err}</li>)}</ul><p className="mt-2 text-xs">Kagua kama migrations zinazohitajika zimeendeshwa na RLS policies zinaruhusu role yako.</p></div> }
function StatCard({label,value,href,icon:Icon}:{label:string;value:string|number;href?:string;icon:typeof Users}) { const body=<div className="geometric-card flex h-full items-center gap-3 p-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"><Icon className="h-5 w-5"/></span><span className="min-w-0"><span className="block text-xs text-slate-500">{label}</span><span className="mt-1 block text-2xl font-black text-slate-950 dark:text-white">{value}</span></span>{href&&<ArrowRight className="ml-auto h-4 w-4 text-emerald-600"/>}</div>; return href?<Link href={href} className="hover-lift">{body}</Link>:body }

export default async function AdminPage({searchParams}:{searchParams:Promise<{section?:string;q?:string;status?:string}>}) {
  const params=await searchParams
  const requestedSection=(params.section||'overview') as Section
  const section=sections.some(item=>item.key===requestedSection)?requestedSection:'overview'
  const search=(params.q||'').trim().slice(0,100)
  const statusFilter=(params.status||'all').trim()
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  if(!user) redirect('/auth')
  const {data:profile}=await supabase.from('profiles').select('role,full_name,status').eq('id',user.id).maybeSingle()
  if(!isStaffUser(profile?.role,user.email) || profile?.status!=='active') redirect('/dashboard')
  if(profile?.role==='school_admin') redirect('/dashboard')
  const canModerate=profile?.role==='moderator'||profile?.role==='super_admin'
  const isSuperAdmin=profile?.status==='active'&&profile?.role==='super_admin'
  if(section==='payments'&&!isSuperAdmin) redirect('/admin?section=overview')
  const visibleSections=sections.filter(item=>isSuperAdmin||item.key!=='payments')
  const errors:string[]=[]

  let notes:PendingNote[]=[]
  let papers:PendingPaper[]=[]
  let textbooks:PendingTextbook[]=[]
  let opportunities:PendingOpportunity[]=[]
  let reports:ReportRow[]=[]
  let audits:AuditRow[]=[]
  let users:ProfileRow[]=[]
  let courses:CourseRow[]=[]
  let decks:DeckRow[]=[]
  let mentors:MentorRow[]=[]
  let mentorProfiles:Record<string,SimpleUser>={}
  let schools:InstitutionRow[]=[]
  let universities:InstitutionRow[]=[]
  let payments:PaymentRow[]=[]
  let subscriptions:SubscriptionRow[]=[]
  let plans:PlanRow[]=[]
  let announcements:AnnouncementRow[]=[]
  let notifications:NotificationRow[]=[]
  let recipients:SimpleUser[]=[]
  let referrals:ReferralRow[]=[]
  let tickets:SupportRow[]=[]
  let ticketUsers:Record<string,SimpleUser>={}
  let groups:GroupRow[]=[]
  let questions:QuestionRow[]=[]
  let events:EventRow[]=[]
  let feedPosts:FeedPostRow[]=[]
  let feedPostAuthors:Record<string,{full_name:string|null;username:string|null}>={}
  let questionAuthors:Record<string,string>={}
  let certificates:CertificateRow[]=[]
  let dataRequests:DataRequestRow[]=[]
  let dailyChallenges:ScheduledDailyChallenge[]=[]
  let dailyQuizDetails:Record<string,DailyQuizAdminRow>={}
  let dailyAnalytics:DailyAnalyticsRow[]=[]
  let totalUsers=0, totalNotes=0, totalPapers=0, totalTextbooks=0, totalCourses=0, totalQuestions=0, totalOpportunities=0, totalTransactions=0, openReportsCount=0
  let pendingNotesCount=0, pendingPapersCount=0, pendingTextbooksCount=0, pendingOpportunitiesCount=0

  if(canModerate && ['overview','analytics'].includes(section)) {
    const countResults=await Promise.all([
      supabase.from('profiles').select('id',{count:'exact',head:true}),
      supabase.from('notes').select('id',{count:'exact',head:true}),
      supabase.from('past_papers').select('id',{count:'exact',head:true}),
      supabase.from('textbooks').select('id',{count:'exact',head:true}),
      supabase.from('courses').select('id',{count:'exact',head:true}),
      supabase.from('questions').select('id',{count:'exact',head:true}),
      supabase.from('opportunities').select('id',{count:'exact',head:true}),
      supabase.from('payment_transactions').select('id',{count:'exact',head:true}),
      supabase.from('content_reports').select('id',{count:'exact',head:true}).in('status',['open','investigating'])
    ])
    const names=['watumiaji','notes','past papers','vitabu','kozi','maswali','fursa','transactions','reports wazi']
    countResults.forEach((result,index)=>{ if(result.error && (index!==7 || isSuperAdmin)) errors.push(`${names[index]}: ${result.error.message}`) })
    totalUsers=countResults[0].count??0;totalNotes=countResults[1].count??0;totalPapers=countResults[2].count??0;totalTextbooks=countResults[3].count??0;totalCourses=countResults[4].count??0;totalQuestions=countResults[5].count??0;totalOpportunities=countResults[6].count??0;totalTransactions=countResults[7].count??0;openReportsCount=countResults[8].count??0
  }

  if(canModerate && section==='analytics') {
    const {data,error}=await supabase.rpc('admin_smartnekam_daily_analytics',{p_days:14})
    dailyAnalytics=(data??[]) as DailyAnalyticsRow[]
    if(error) errors.push(`analytics trends: ${error.message}`)
  }

  if(canModerate && ['overview','content','opportunities'].includes(section)) {
    const [n,p,b,o,nc,pc,bc,oc]=await Promise.all([
      supabase.from('notes').select('id,title,level,created_at').eq('status','pending').order('created_at',{ascending:true}).limit(section==='overview'?10:100),
      supabase.from('past_papers').select('id,title,level,year,exam_type,created_at').eq('status','pending').order('created_at',{ascending:true}).limit(section==='overview'?10:100),
      supabase.from('textbooks').select('id,title,level,author,publication_year,created_at').eq('status','pending').order('created_at',{ascending:true}).limit(section==='overview'?10:100),
      supabase.from('opportunities').select('id,title,type,country,deadline,created_at,status').in('status',['draft','pending_review','active','closed','rejected']).order('created_at',{ascending:false}).limit(section==='overview'?10:100),
      supabase.from('notes').select('id',{count:'exact',head:true}).eq('status','pending'),
      supabase.from('past_papers').select('id',{count:'exact',head:true}).eq('status','pending'),
      supabase.from('textbooks').select('id',{count:'exact',head:true}).eq('status','pending'),
      supabase.from('opportunities').select('id',{count:'exact',head:true}).eq('status','pending_review')
    ])
    notes=(n.data??[]) as PendingNote[];papers=(p.data??[]) as PendingPaper[];textbooks=(b.data??[]) as PendingTextbook[];opportunities=(o.data??[]) as PendingOpportunity[]
    pendingNotesCount=nc.count??0;pendingPapersCount=pc.count??0;pendingTextbooksCount=bc.count??0;pendingOpportunitiesCount=oc.count??0
    for(const err of [n.error,p.error,b.error,o.error,nc.error,pc.error,bc.error,oc.error]) if(err) errors.push(err.message)
  }
  if(canModerate && ['overview','reports'].includes(section)) {
    const {data,error}=await supabase.from('content_reports').select('id,target_type,target_id,reason_category,details,status,created_at').in('status',['open','investigating']).order('created_at',{ascending:false}).limit(section==='overview'?8:100)
    reports=(data??[]) as ReportRow[];if(error)errors.push(error.message)
  }
  if(canModerate&&section==='audit'){
    const {data,error}=await supabase.from('admin_audit_log').select('id,action_name,entity_type,created_at,details').order('created_at',{ascending:false}).limit(100)
    audits=(data??[]) as AuditRow[];if(error)errors.push(error.message)
  }
  if(canModerate&&section==='users'){
    let query=supabase.from('profiles').select('id,full_name,email,phone,role,status,level,region,xp,created_at,school_id,university_id').order('created_at',{ascending:false}).limit(200)
    if(statusFilter!=='all'&&['active','suspended','banned'].includes(statusFilter))query=query.eq('status',statusFilter)
    if(search){const safeSearch=search.replace(/[,%()_*]/g,' ').replace(/\s+/g,' ').trim();if(safeSearch)query=query.or(`full_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%`)}
    const {data,error}=await query;users=(data??[]) as ProfileRow[];if(error)errors.push(error.message)
  }
  if(canModerate&&section==='learning'){
    const [c,d]=await Promise.all([
      supabase.from('courses').select('id,title,level,status,created_at,access_type,price,currency').order('created_at',{ascending:false}).limit(100),
      supabase.from('flashcard_decks').select('id,title,level,status,created_at,visibility').eq('status','pending_review').eq('visibility','public').order('created_at',{ascending:true}).limit(100)
    ])
    courses=(c.data??[]) as CourseRow[];decks=(d.data??[]) as DeckRow[];for(const err of [c.error,d.error])if(err)errors.push(err.message)
  }
  if(canModerate&&section==='daily-challenge'){
    const today=new Intl.DateTimeFormat('en',{timeZone:'Africa/Dar_es_Salaam',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).reduce((acc,part)=>({...acc,[part.type]:part.value}),{} as Record<string,string>)
    const todayText=`${today.year}-${today.month}-${today.day}`
    const [upcoming,past]=await Promise.all([
      supabase.from('daily_challenges').select('challenge_date,quiz_id,assigned_by,created_at').gte('challenge_date',todayText).order('challenge_date',{ascending:true}).limit(30),
      supabase.from('daily_challenges').select('challenge_date,quiz_id,assigned_by,created_at').lt('challenge_date',todayText).order('challenge_date',{ascending:false}).limit(10)
    ])
    dailyChallenges=[...((upcoming.data??[]) as ScheduledDailyChallenge[]),...((past.data??[]) as ScheduledDailyChallenge[])]
    for(const err of [upcoming.error,past.error])if(err)errors.push(err.message)
    const quizIds=[...new Set(dailyChallenges.map(row=>row.quiz_id))]
    if(quizIds.length){const {data,error}=await supabase.from('quizzes').select('id,title,description,level,duration_minutes,status').in('id',quizIds);for(const row of (data??[]) as DailyQuizAdminRow[])dailyQuizDetails[row.id]=row;if(error)errors.push(error.message)}
  }
  if(canModerate&&section==='mentors'){
    const {data,error}=await supabase.from('mentors').select('id,user_id,display_name,headline,subjects,hourly_rate,currency,verified,status,rating_average,rating_count,created_at').order('created_at',{ascending:false}).limit(100)
    mentors=(data??[]) as MentorRow[];if(error)errors.push(error.message)
    if(mentors.length){const ids=[...new Set(mentors.map(m=>m.user_id))];const {data:ps,error:pe}=await supabase.from('profiles').select('id,full_name,email').in('id',ids);if(pe)errors.push(pe.message);for(const p of (ps??[]) as SimpleUser[])mentorProfiles[p.id]=p}
  }
  if(canModerate&&section==='institutions'){
    const [s,u,a]=await Promise.all([
      supabase.from('schools').select('id,name,region,country,created_at,website,district,school_type').order('name').limit(1000),
      supabase.from('universities').select('id,name,region,country,created_at,website,admissions_url').order('name').limit(1000),
      supabase.from('school_announcements').select('id,school_id,title,body,audience,status,publish_at,created_at').order('created_at',{ascending:false}).limit(100)
    ])
    schools=(s.data??[]) as InstitutionRow[];universities=(u.data??[]) as InstitutionRow[];announcements=(a.data??[]) as AnnouncementRow[];for(const err of [s.error,u.error,a.error])if(err)errors.push(err.message)
  }
  if(canModerate&&section==='payments'){
    const [t,subs,pls]=await Promise.all([
      supabase.from('payment_transactions').select('id,profile_id,transaction_type,provider,status,amount,currency,provider_reference,description,paid_at,created_at').order('created_at',{ascending:false}).limit(100),
      supabase.from('user_subscriptions').select('id,profile_id,plan_id,status,current_period_start,current_period_end,cancel_at_period_end,created_at').order('created_at',{ascending:false}).limit(100),
      supabase.from('subscription_plans').select('id,name,slug,price,currency,billing_interval,is_active').order('display_order').limit(100)
    ])
    payments=(t.data??[]) as PaymentRow[];subscriptions=(subs.data??[]) as SubscriptionRow[];plans=(pls.data??[]) as PlanRow[];for(const err of [t.error,subs.error,pls.error])if(err)errors.push(err.message)
  }
  if(canModerate&&section==='notifications'){
    const [ps,ns]=await Promise.all([
      supabase.from('profiles').select('id,full_name,email').eq('status','active').order('full_name').limit(1000),
      supabase.from('notifications').select('id,user_id,title,body,notification_type,is_read,created_at').order('created_at',{ascending:false}).limit(50)
    ])
    recipients=(ps.data??[]) as SimpleUser[];notifications=(ns.data??[]) as NotificationRow[];for(const err of [ps.error,ns.error])if(err)errors.push(err.message)
  }
  if(canModerate&&section==='growth'){
    const {data,error}=await supabase.from('referral_events').select('id,referrer_id,referred_user_id,referral_code_used,status,reward_xp,created_at').order('created_at',{ascending:false}).limit(100)
    referrals=(data??[]) as ReferralRow[];if(error)errors.push(error.message)
  }
  if(canModerate&&section==='support'){
    const {data,error}=await supabase.from('support_tickets').select('id,user_id,subject,category,priority,status,assigned_to,created_at,updated_at').order('created_at',{ascending:false}).limit(100)
    tickets=(data??[]) as SupportRow[];if(error)errors.push(error.message)
    if(tickets.length){const ids=[...new Set(tickets.map(t=>t.user_id))];const {data:ps,error:pe}=await supabase.from('profiles').select('id,full_name,email').in('id',ids);if(pe)errors.push(pe.message);for(const p of (ps??[]) as SimpleUser[])ticketUsers[p.id]=p}
  }
  if(canModerate&&(section==='community'||section==='feed')){
    const [g,q,e,p]=await Promise.all([
      supabase.from('study_groups').select('id,name,level,privacy,member_count,status,created_at').order('created_at',{ascending:false}).limit(100),
      supabase.from('questions').select('id,title,body,status,created_at,user_id').order('created_at',{ascending:false}).limit(100),
      supabase.from('community_events').select('id,title,event_type,starts_at,status,created_at,venue').order('created_at',{ascending:false}).limit(100),
      supabase.from('posts').select('id,author_id,category,subject,content,is_anonymous,status,created_at').in('status',['published','hidden']).order('created_at',{ascending:false}).limit(100)
    ])
    groups=(g.data??[]) as GroupRow[];questions=(q.data??[]) as QuestionRow[];events=(e.data??[]) as EventRow[];feedPosts=(p.data??[]) as FeedPostRow[]
    for(const err of [g.error,q.error,e.error,p.error])if(err)errors.push(err.message)
    const authorIds=[...new Set(feedPosts.map(post=>post.author_id))]
    if(authorIds.length){
      const {data:authors,error:authorError}=await supabase.from('community_profiles').select('id,full_name').in('id',authorIds)
      if(authorError)errors.push(authorError.message)
      for(const author of authors??[])feedPostAuthors[author.id]={full_name:author.full_name,username:null}
    }
    const questionAuthorIds=[...new Set(questions.map(question=>question.user_id))]
    if(questionAuthorIds.length){
      const {data:authors,error:authorError}=await supabase.from('community_profiles').select('id,full_name').in('id',questionAuthorIds)
      if(authorError)errors.push(authorError.message)
      for(const author of authors??[])questionAuthors[author.id]=author.full_name||'Mwanafunzi'
    }
  }
  if(canModerate&&section==='certificates'){
    const {data,error}=await supabase.from('certificates').select('id,certificate_code,recipient_id,title,certificate_type,issuer_name,issued_at,status,revoke_reason').order('issued_at',{ascending:false}).limit(100)
    certificates=(data??[]) as CertificateRow[];if(error)errors.push(error.message)
  }
  if(canModerate&&section==='security'){
    const {data,error}=await supabase.from('account_data_requests').select('id,user_id,request_type,reason,status,submitted_at,admin_note').in('status',['requested','processing']).order('submitted_at',{ascending:true}).limit(100)
    dataRequests=(data??[]) as DataRequestRow[];if(error)errors.push(error.message)
  }

  const totalPending=pendingNotesCount+pendingPapersCount+pendingTextbooksCount+pendingOpportunitiesCount
  const cards:[string,number,Section,typeof Users][]=[['Watumiaji',totalUsers,'users',Users],['Notes',totalNotes,'content',BookOpen],['Past papers',totalPapers,'content',FileText],['Vitabu',totalTextbooks,'content',BookMarked],['Kozi',totalCourses,'learning',GraduationCap],['Maswali',totalQuestions,'community',MessageSquare],['Fursa',totalOpportunities,'opportunities',BriefcaseBusiness],['Transactions',totalTransactions,'payments',CreditCard],['Reports wazi',openReportsCount,'reports',Flag]]


  return <main className="mx-auto max-w-7xl space-y-5 pb-10">
    <header className="geometric-hero isolate relative overflow-hidden rounded-3xl p-5 text-white sm:p-8"><Image src="/images/reference-admin.webp" alt="Teknolojia ya AI na uchambuzi wa taarifa" fill priority sizes="(max-width: 768px) 100vw, 1200px" className="absolute inset-0 z-0 object-cover object-center opacity-90"/><div className="absolute inset-0 z-[1] bg-gradient-to-r from-[#0B0F1A]/95 via-[#0B0F1A]/78 to-[#0B0F1A]/28"/><div className="relative z-10"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-violet-200">SmartNekam · Control Centre</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Admin Panel</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-100">Karibu {profile?.full_name||'Msimamizi'}. Vifungo vinaunganishwa na RPC/query za Supabase; hatua zinazohitaji provider ya nje hazitaonyeshwa kama zimekamilika.</p><div className="mt-4 inline-flex items-center gap-2 rounded-full bg-black/15 px-3 py-1.5 text-xs font-bold"><ShieldCheck className="h-4 w-4"/>{profile?.role} · {profile?.status}</div></div><ShieldCheck className="absolute -bottom-6 -right-4 z-[2] h-36 w-36 text-white/10"/></header>
    <nav aria-label="Admin navigation" className="flex gap-2 overflow-x-auto pb-1">{visibleSections.map(t=><Link key={t.key} href={`/admin?section=${t.key}`} aria-current={section===t.key?'page':undefined} className={`shrink-0 rounded-full px-3.5 py-2.5 text-sm font-extrabold ${section===t.key?'bg-emerald-600 text-white':'geometric-card text-slate-600 dark:text-slate-200'}`}>{t.label}</Link>)}</nav>
    {!canModerate&&<div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">Role yako ni <b>{profile?.role}</b>. Unaweza kuona panel kwa ruhusa zako, lakini vitendo vya global moderation vinahitaji moderator au super_admin active.</div>}
    {canModerate&&<ErrorBox errors={errors}/>}

    {section==='overview'&&<>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.filter(card=>isSuperAdmin||card[2]!=='payments').map(([label,value,href,icon])=><StatCard key={label} label={label} value={value} href={`/admin?section=${href}`} icon={icon}/>)}</section>
      <section className="space-y-3"><SectionHeader title="Vituo vya Admin Panel" description="Kila kadi hapa chini inaelekeza kwenye sehemu inayosomeka au kutekeleza vitendo vilivyounganishwa."/><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[
        {title:'Users & Access',desc:'Tafuta watumiaji, status na roles.',icon:Users,key:'users' as Section},{title:'Content Management',desc:`Foleni ya sasa: ${totalPending} item pending (counts sahihi kutoka Supabase).`,icon:BookMarked,key:'content' as Section},{title:'Learning Management',desc:'Tengeneza kozi na lessons, chapisha Learn content.',icon:GraduationCap,key:'learning' as Section},{title:'Feed Pinning & Ads',desc:'Weka posts muhimu juu na dhibiti matangazo yaliyolipiwa.',icon:Megaphone,key:'promotions' as Section},{title:'Daily Challenge Manager',desc:'Tengeneza maswali 5, chagua tarehe, chapisha na tuma notifications kwa watumiaji.',icon:CalendarCheck,key:'daily-challenge' as Section},{title:'Community Management',desc:'Study groups, Q&A na matukio; maamuzi yana audit.',icon:MessageSquare,key:'community' as Section},{title:'Home Feed Moderation',desc:'Kagua posts zote, ona majina halisi ya anonymous kwa Admin tu, na ondoa zisizofaa.',icon:Flag,key:'feed' as Section},{title:'Opportunities',desc:'Ongeza fursa kwenye pending review na zihakiki.',icon:Trophy,key:'opportunities' as Section},{title:'Mentors',desc:'Review, verify au suspend mentor profiles.',icon:UserCog,key:'mentors' as Section},{title:'Institutions',desc:'Orodha, kuongeza shule/chuo na matangazo ya shule.',icon:Building2,key:'institutions' as Section},{title:'Payments',desc:'Angalia transactions zilizoandikwa; hakuna refund ya kujifanya.',icon:CreditCard,key:'payments' as Section},{title:'Notifications',desc:'Tuma taarifa kwa mtu mmoja, waliochaguliwa au akaunti zote.',icon:BellRing,key:'notifications' as Section},{title:'Growth & Referrals',desc:'Kagua referrals na toa XP kupitia RPC.',icon:TrendingUp,key:'growth' as Section},{title:'Support',desc:'Badili ticket status na priority.',icon:Headset,key:'support' as Section},{title:'Reports',desc:'Chunguza na hitimisha reports.',icon:Flag,key:'reports' as Section},{title:'Certificates',desc:'Hakikisha vyeti na revoke kwa sababu iliyorekodiwa.',icon:BadgeCheck,key:'certificates' as Section},{title:'Privacy & Security',desc:'Kagua maombi ya data na hatua zilizorekodiwa.',icon:LockKeyhole,key:'security' as Section},{title:'Analytics',desc:'Hesabu halisi kutoka database.',icon:BarChart3,key:'analytics' as Section},{title:'Audit Logs',desc:'Fuatilia maamuzi na shughuli za admin.',icon:Database,key:'audit' as Section}
      ].filter(item=>isSuperAdmin||item.key!=='payments').map(item=>{const Icon=item.icon;return <Link key={item.key} href={`/admin?section=${item.key}`} className="geometric-card hover-lift p-4"><div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"><Icon className="h-5 w-5"/></span><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold uppercase text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Fungua</span></div><h3 className="mt-4 font-extrabold text-slate-950 dark:text-white">{item.title}</h3><p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{item.desc}</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-300">Fungua sehemu <ArrowRight className="h-3.5 w-3.5"/></span></Link>})}</div></section>
      <section className="geometric-card p-5"><div className="flex items-start gap-3"><Activity className="mt-1 h-5 w-5 shrink-0 text-emerald-600"/><div><h2 className="font-heading text-lg font-extrabold text-slate-950 dark:text-white">Mipaka ya taarifa sahihi</h2><p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">Takwimu za muhtasari ni counts za database. Push/SMS/email, refunds, export/delete ya data na baadhi ya integrations za nje haziwezi kuthibitishwa na dashboard hii bila provider/backend husika.</p></div></div></section>
    </>}

    {section==='content'&&<section className="space-y-4"><SectionHeader title={`Foleni ya maudhui (${totalPending})`} description="Approve baada ya kukagua source, uhalali na ubora. Vitendo vinatumia review_library_content RPC."/>{[{type:'note' as const,rows:notes,count:pendingNotesCount},{type:'past_paper' as const,rows:papers,count:pendingPapersCount},{type:'textbook' as const,rows:textbooks,count:pendingTextbooksCount},{type:'opportunity' as const,rows:opportunities.filter(o=>o.status==='pending_review'),count:pendingOpportunitiesCount}].map(bucket=><div key={bucket.type} className="space-y-2"><h3 className="font-extrabold text-slate-800 dark:text-slate-100">{typeLabel[bucket.type]} ({bucket.count})</h3>{bucket.rows.length?bucket.rows.map(row=><article key={row.id} className="geometric-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-extrabold text-slate-950 dark:text-white">{row.title}</p><p className="mt-1 text-xs text-slate-500">{('level'in row&&row.level?row.level.replace('_','-')+' · ':'')}{('year'in row?`${row.exam_type} · ${row.year} · `:'')}{('author'in row&&row.author?`Mwandishi: ${row.author} · `:'')}{('publication_year'in row&&row.publication_year?`${row.publication_year} · `:'')}{('country'in row?row.country+' · ':'')}{dateLabel(row.created_at)}</p></div><ReviewContentActions id={row.id} type={bucket.type}/></article>):<p className="px-1 py-2 text-sm text-slate-500">Hakuna {typeLabel[bucket.type].toLowerCase()} pending katika rekodi zilizorudishwa.</p>}</div>)}</section>}

    {section==='opportunities'&&<section className="space-y-4"><SectionHeader title="Fursa" description="Fursa zinazoundwa hapa zinaingia pending_review. Ukaguzi wa chanzo rasmi ndio hatua kabla ya publish."/><OpportunityCreateForm/><div className="space-y-2"><h3 className="font-extrabold">Rekodi za fursa za hivi karibuni ({opportunities.length})</h3>{opportunities.length?opportunities.map(o=><article key={o.id} className="geometric-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-extrabold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">{o.type}</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">{o.status}</span></div><p className="mt-2 font-extrabold text-slate-950 dark:text-white">{o.title}</p><p className="mt-1 text-xs text-slate-500">{o.country} · {o.deadline?`Deadline ${o.deadline}`:'Deadline haijawekwa'} · {dateLabel(o.created_at)}</p></div>{o.status==='pending_review'?<ReviewContentActions id={o.id} type="opportunity"/>:<OpportunityLifecycleActions opportunityId={o.id} status={o.status}/>}</article>):<Empty message="Hakuna rekodi ya fursa iliyorejeshwa na database."/>}</div></section>}

    {section==='reports'&&<section className="space-y-3"><SectionHeader title={`Reports wazi (${reports.length})`} description="Chagua Chunguza, Tatuliwa au Dismiss. Mfumo hifadhi uamuzi kupitia review_content_report."/>{reports.length?reports.map(r=><article key={r.id} className="geometric-card space-y-3 p-4"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-extrabold text-red-700 dark:bg-red-950 dark:text-red-200">{r.reason_category}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{r.target_type}</span><span className="text-xs text-slate-500">{r.status} · {dateLabel(r.created_at)}</span></div><p className="text-sm leading-6 text-slate-700 dark:text-slate-200">{r.details||'Hakuna maelezo zaidi.'}</p><p className="break-all text-[11px] text-slate-400">Target ID: {r.target_id}</p><ReviewReportActions id={r.id}/></article>):<Empty message="Hakuna report zilizo wazi katika query hii."/>}</section>}

    {section==='users'&&<section className="space-y-4"><SectionHeader title="Users & Access" description="Orodha inaonyesha profile records kutoka Supabase. Status/role changes zinahitaji RPC na reason; role changes ni Super Admin tu."/><form className="geometric-card flex flex-col gap-3 p-4 sm:flex-row" action="/admin"><input type="hidden" name="section" value="users"/><label className="flex-1 text-xs font-bold">Tafuta kwa jina, email au simu<input name="q" defaultValue={search} placeholder="mf. jina au email" className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"/></label><label className="text-xs font-bold">Status<select name="status" defaultValue={statusFilter} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="all">Zote</option><option value="active">active</option><option value="suspended">suspended</option><option value="banned">banned</option></select></label><button className="self-end rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white" type="submit">Tafuta</button></form><p className="text-xs text-slate-500">Inaonyesha hadi rekodi 200 kwa matokeo ya query hii.</p>{users.length?users.map(p=><article key={p.id} className="geometric-card space-y-3 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-extrabold text-slate-950 dark:text-white">{p.full_name}</p><p className="mt-1 break-all text-xs text-slate-500">{p.email||'Hakuna email'} · {p.phone||'Hakuna simu'}</p><p className="mt-1 text-xs text-slate-500">{p.level||'Level haijawekwa'} · {p.region||'Mkoa haujawekwa'} · XP {p.xp} · {dateLabel(p.created_at)}</p><p className="mt-1 break-all text-[10px] text-slate-400">User ID: {p.id}</p></div><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold dark:bg-slate-800">{p.role}</span><span className={`rounded-full px-2.5 py-1 font-bold ${p.status==='active'?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-800'}`}>{p.status}</span></div></div>{p.id===user.id?<p className="text-xs font-bold text-amber-700">Vitendo vya kususpend/ban akaunti yako mwenyewe vimezuiwa na database.</p>:<AdminProfileActions userId={p.id} role={p.role} status={p.status} canManageRoles={isSuperAdmin}/>}</article>):<Empty message="Hakuna mtumiaji anayelingana na filter/search."/>}</section>}

    {section==='learning'&&<section className="space-y-4"><SectionHeader title="Learning Management" description="Tengeneza kozi mpya, ongeza modules na lessons, kisha ichapishe au iache pending review."/><AdminLearningManager courses={courses.map(c=>({id:c.id,title:c.title,status:c.status,level:c.level}))}/><div className="space-y-2"><h3 className="font-extrabold">Kozi za hivi karibuni ({courses.length})</h3>{courses.length?courses.map(c=><article key={c.id} className="geometric-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-extrabold text-slate-950 dark:text-white">{c.title}</p><span className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${c.status==='published'?'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200':c.status==='pending_review'?'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200':'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>{c.status}</span></div><p className="mt-1 text-xs text-slate-500">{c.level} · {c.access_type}{c.access_type==='premium'?` · ${c.currency} ${Number(c.price).toLocaleString('en-US')}`:''} · {dateLabel(c.created_at)}</p><p className="mt-1 break-all text-[10px] text-slate-400">{c.id}</p></div>{c.status==='pending_review'?<ReviewCourseActions courseId={c.id}/>:c.status==='published'?<Link href={`/learn/courses/${c.id}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-xs font-extrabold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-200">Fungua kozi <ArrowRight className="h-3.5 w-3.5"/></Link>:null}</article>):<Empty message="Bado hakuna kozi. Tumia Learn Content Studio hapo juu kuongeza kozi ya kwanza."/>}</div><div className="space-y-2"><h3 className="font-extrabold">Public flashcard decks pending ({decks.length})</h3>{decks.length?decks.map(d=><article key={d.id} className="geometric-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-extrabold text-slate-950 dark:text-white">{d.title}</p><p className="mt-1 text-xs text-slate-500">{d.level||'Level zote'} · {d.visibility} · {dateLabel(d.created_at)}</p></div><ReviewFlashcardActions deckId={d.id}/></article>):<Empty message="Hakuna flashcard deck ya umma inayosubiri."/>}</div></section>}
    {section==='promotions'&&<section className="space-y-4"><SectionHeader title="Feed Promotions" description="Weka post muhimu juu ya feed, au dhibiti matangazo ya taasisi/chuo ambayo malipo yake yamethibitishwa."/><AdminPostPromotionManager/></section>}
    {section==='daily-challenge'&&<section className="space-y-5"><SectionHeader title="Daily Challenge Manager" description="Tengeneza changamoto ya siku, chapisha na itume kwa watumiaji. Ni moderator au super admin active pekee anayeruhusiwa."/><AdminDailyChallengeComposer/><div className="space-y-3"><div><h3 className="font-extrabold text-slate-950 dark:text-white">Daily Challenges zilizopangwa ({dailyChallenges.length})</h3><p className="mt-1 text-sm text-slate-500">Changamoto ya leo na ratiba zijazo zinaonekana kwanza; rekodi za karibuni zinafuata.</p></div>{dailyChallenges.length?dailyChallenges.map(row=>{const quiz=dailyQuizDetails[row.quiz_id];const today=new Intl.DateTimeFormat('en',{timeZone:'Africa/Dar_es_Salaam',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).reduce((acc,part)=>({...acc,[part.type]:part.value}),{} as Record<string,string>);const todayText=`${today.year}-${today.month}-${today.day}`;const label=row.challenge_date===todayText?'Leo':row.challenge_date>todayText?'Inakuja':'Imepita';return <article key={row.challenge_date} className="geometric-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${label==='Leo'?'bg-emerald-100 text-emerald-800':label==='Inakuja'?'bg-sky-100 text-sky-800':'bg-slate-100 text-slate-500'} dark:bg-slate-800`}><CalendarCheck className="h-5 w-5"/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="font-extrabold text-slate-950 dark:text-white">{quiz?.title||`Daily Challenge ${row.quiz_id.slice(0,8)}`}</h4><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-extrabold dark:bg-slate-800">{label}</span></div><p className="mt-1 text-xs text-slate-500">Tarehe: {row.challenge_date} · {quiz?.level?quiz.level.replace('_','-'):'Viwango vyote'} · Dakika {quiz?.duration_minutes??5} · {quiz?.status??'schedule'}</p><p className="mt-1 break-all text-[10px] text-slate-400">Quiz ID: {row.quiz_id}</p></div><Link href="/learn/daily-challenge" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-xs font-extrabold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-200 dark:hover:bg-emerald-950/40">Angalia ukurasa <ArrowRight className="h-3.5 w-3.5"/></Link></article>}):<Empty message="Hakuna Daily Challenge iliyopangwa. Tumia fomu hapo juu kutengeneza changamoto ya kwanza."/>}</div></section>}

    {section==='community'&&<section className="space-y-5">
      <SectionHeader title="Community & Q&A" description="Kagua study groups, maswali ya Q&A na matukio ya jumuiya. Posts za Home Feed zina sehemu yake tofauti."/>
      <div className="space-y-2">
        <h3 className="font-extrabold">Study groups ({groups.length})</h3>
        {groups.length?groups.map(g=><article key={g.id} className="geometric-card flex flex-col gap-3 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-extrabold text-slate-950 dark:text-white">{g.name}</p><p className="mt-1 text-xs text-slate-500">{g.level||'All levels'} · {g.privacy} · {g.member_count} members · {dateLabel(g.created_at)}</p><p className="text-xs text-slate-500">Status: {g.status} · {shortId(g.id)}</p></div></div><CommunityModerationActions itemId={g.id} kind="group" status={g.status}/></article>):<Empty message="Hakuna study group iliyopatikana."/>}
      </div>
      <div className="space-y-2">
        <h3 className="font-extrabold">Maswali ya Q&A ({questions.length})</h3>
        {questions.length?questions.map(q=><article key={q.id} className="geometric-card space-y-3 p-4"><div><p className="font-extrabold text-slate-950 dark:text-white">{q.title||'Swali bila kichwa'}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{q.body.length>700?q.body.slice(0,700)+'…':q.body}</p><p className="mt-1 text-xs text-slate-500">{q.status} · {dateLabel(q.created_at)} · Aliuliza: {questionAuthors[q.user_id]||'Mwanafunzi'} · {shortId(q.user_id)}</p></div><CommunityModerationActions itemId={q.id} kind="question" status={q.status}/></article>):<Empty message="Hakuna swali lililopatikana."/>}
      </div>
      <div className="space-y-2"><h3 className="font-extrabold">Matukio ya jumuiya ({events.length})</h3>{events.length?events.map(e=><article key={e.id} className="geometric-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-extrabold text-slate-950 dark:text-white">{e.title}</p><p className="mt-1 text-xs text-slate-500">{e.event_type} · {e.status} · {dateLabel(e.starts_at)} · {e.venue||'Venue haijawekwa'}</p></div><CommunityModerationActions itemId={e.id} kind="event" status={e.status}/></article>):<Empty message="Hakuna event iliyopatikana."/>}</div>
    </section>}

    {section==='feed'&&<section className="space-y-5">
      <SectionHeader title={`Home Feed · Usimamizi (${feedPosts.length})`} description="Kagua posts zote zilizochapishwa au kufichwa. Anonymous hubaki bila jina kwa umma; jina halisi linaonekana kwa Admin pekee. Ondoa post isiyofaa ili isionekane tena kwenye Home Feed."/>
      <div className="space-y-2">
        <div><h3 className="font-extrabold">Posts za Home Feed ({feedPosts.length})</h3><p className="text-xs text-slate-500">Posts zilizochapishwa au zilizofichwa. Mwandishi wa anonymous anaonekana hapa kwa Admin tu.</p></div>
        {feedPosts.length?feedPosts.map(post=>{
          const author=feedPostAuthors[post.author_id]
          const realName=author?.full_name||(author?.username?'@'+author.username:'Mwandishi hajulikani')
          return <article key={post.id} className="geometric-card space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={'rounded-full px-2.5 py-1 text-[10px] font-extrabold '+(post.is_anonymous?'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200':'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200')}>{post.is_anonymous?'Anonymous kwa umma':'Post ya kawaida'}</span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{post.category}</span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{post.status}</span>
              <span className="ml-auto text-[11px] text-slate-400">{dateLabel(post.created_at)}</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-black text-white">{realName.trim().split(/\s+/).slice(0,2).map(part=>part[0]?.toUpperCase()??'').join('')||'M'}</span>
              <div className="min-w-0"><p className="text-xs font-extrabold text-slate-900 dark:text-white">{realName}</p><p className="text-[10px] text-slate-500">{post.is_anonymous?'Jina halisi la mwandishi · halionekani kwa umma':'Mwandishi wa post'}</p></div>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-slate-200">{post.content.length>1200?post.content.slice(0,1200)+'…':post.content}</p>
            <p className="break-all text-[10px] text-slate-400">Post ID: {post.id} · Author ID: {shortId(post.author_id)}</p>
            <AdminFeedPostActions postId={post.id} status={post.status}/>
          </article>
        }):<Empty message="Hakuna post inayosubiri au iliyofichwa kwenye Home Feed."/>}
      </div>
    </section>}

    {section==='mentors'&&<section className="space-y-3"><SectionHeader title="Mentor Management" description="Uamuzi wa review unahifadhi verified/status kwenye mentor profile kupitia review_mentor_profile."/>{mentors.length?mentors.map(m=><article key={m.id} className="geometric-card flex flex-col gap-3 p-4 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><p className="font-extrabold text-slate-950 dark:text-white">{m.display_name||mentorProfiles[m.user_id]?.full_name||'Mentor'}</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{m.headline||'Hakuna headline'}</p><p className="mt-1 text-xs text-slate-500">{m.subjects?.join(', ')||'Subjects hazijawekwa'} · {m.currency} {Number(m.hourly_rate).toLocaleString('en-US')}/hr · Rating {m.rating_average} ({m.rating_count})</p><p className="mt-1 text-xs text-slate-500">{mentorProfiles[m.user_id]?.email||shortId(m.user_id)} · {m.status} · {m.verified?'verified':'not verified'}</p></div><ReviewMentorActions mentorId={m.id} status={m.status}/></article>):<Empty message="Hakuna mentor profile iliyopatikana."/>}</section>}

    {section==='institutions'&&<section className="space-y-5"><SectionHeader title="Schools & Universities" description="Orodha hizi hutoka moja kwa moja kwenye registry ya Supabase. Kuongeza taasisi ni Super Admin pekee na huandikwa kwenye audit log."/>{isSuperAdmin&&<InstitutionCreateForm/>}{isSuperAdmin&&<SchoolAnnouncementForm schools={schools.map(s=>({id:s.id,name:s.name}))}/>}<div className="grid gap-4 xl:grid-cols-2"><div className="space-y-2"><h3 className="font-extrabold">Shule ({schools.length})</h3>{schools.length?schools.map(s=><article key={s.id} className="geometric-card p-3"><p className="font-extrabold text-slate-950 dark:text-white">{s.name}</p><p className="mt-1 text-xs text-slate-500">{s.region||'Region haijawekwa'} · {s.district||'District haijawekwa'} · {s.country} · {s.school_type||'Aina haijawekwa'}</p>{s.website&&<a href={s.website} target="_blank" rel="noreferrer" className="mt-1 block break-all text-xs text-emerald-700 underline">{s.website}</a>}<p className="mt-1 text-[10px] text-slate-400">ID: {s.id}</p></article>):<Empty message="Hakuna shule kwenye registry iliyorejeshwa."/>}</div><div className="space-y-2"><h3 className="font-extrabold">Vyuo vikuu ({universities.length})</h3>{universities.length?universities.map(u=><article key={u.id} className="geometric-card p-3"><p className="font-extrabold text-slate-950 dark:text-white">{u.name}</p><p className="mt-1 text-xs text-slate-500">{u.region||'Region haijawekwa'} · {u.country}</p>{u.website&&<a href={u.website} target="_blank" rel="noreferrer" className="mt-1 block break-all text-xs text-emerald-700 underline">Website</a>}{u.admissions_url&&<a href={u.admissions_url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-xs text-emerald-700 underline">Admissions</a>}<p className="mt-1 text-[10px] text-slate-400">ID: {u.id}</p></article>):<Empty message="Hakuna chuo kikuu kwenye registry iliyorejeshwa."/>}</div></div><div className="space-y-2"><h3 className="font-extrabold">Matangazo ya shule yaliyohifadhiwa ({announcements.length})</h3>{announcements.length?announcements.map(a=>{const school=schools.find(s=>s.id===a.school_id);return <article key={a.id} className="geometric-card p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-extrabold text-slate-950 dark:text-white">{a.title}</p><p className="mt-1 text-xs text-slate-500">{school?.name||shortId(a.school_id)} · audience {a.audience} · {dateLabel(a.publish_at)}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold dark:bg-slate-800">{a.status}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{a.body.length>300?`${a.body.slice(0,300)}…`:a.body}</p></article>}):<Empty message="Hakuna tangazo la shule lililohifadhiwa."/>}</div></section>}

    {section==='payments'&&<section className="space-y-4"><SectionHeader title="Payments & Subscriptions" description="Hii ni ledger/read view ya payment_transactions. Usitumie kuhitimisha malipo kwa kuangalia tu; confirmation ya mwisho lazima itoke provider/webhook. Refund haipatikani hapa mpaka kuwe na provider-specific workflow salama."/><div className="grid gap-3 sm:grid-cols-3"><StatCard label="Transactions zilizoonyeshwa" value={payments.length} icon={ReceiptText}/><StatCard label="Succeeded" value={payments.filter(p=>p.status==='succeeded').length} icon={BadgeCheck}/><StatCard label="Pending/processing" value={payments.filter(p=>['pending','processing'].includes(p.status)).length} icon={Activity}/></div>{payments.length?payments.map(p=><article key={p.id} className="geometric-card flex flex-col gap-2 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-extrabold text-slate-950 dark:text-white">{p.currency} {Number(p.amount).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})} · {p.transaction_type}</p><p className="mt-1 text-xs text-slate-500">Provider: {p.provider} · Status: {p.status} · {dateLabel(p.created_at)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${p.status==='succeeded'?'bg-emerald-100 text-emerald-800':'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>{p.status}</span></div><p className="text-sm text-slate-600 dark:text-slate-300">{p.description||'Hakuna maelezo'} · account {shortId(p.profile_id)}</p><p className="break-all text-[10px] text-slate-400">Reference: {p.provider_reference||'haijawekwa'} · ID: {p.id}</p></article>):<Empty message="Hakuna transaction record iliyopatikana."/>}<div className="space-y-2"><h3 className="font-extrabold">User subscriptions zilizorejeshwa ({subscriptions.length})</h3>{subscriptions.length?subscriptions.map(sub=>{const plan=plans.find(p=>p.id===sub.plan_id);return <article key={sub.id} className="geometric-card p-4"><p className="font-extrabold text-slate-950 dark:text-white">{plan?.name||`Plan ${shortId(sub.plan_id)}`} · {sub.status}</p><p className="mt-1 text-xs text-slate-500">{plan?`${plan.currency} ${Number(plan.price).toLocaleString('en-US')} / ${plan.billing_interval}`:'Plan details hazikupatikana'} · user {shortId(sub.profile_id)}</p><p className="mt-1 text-xs text-slate-500">Period: {sub.current_period_start?dateLabel(sub.current_period_start):'haijaanza'} — {sub.current_period_end?dateLabel(sub.current_period_end):'hakuna mwisho'} · cancel at period end: {sub.cancel_at_period_end?'ndiyo':'hapana'}</p></article>}):<Empty message="Hakuna subscription records zilizorejeshwa."/>}</div><div className="space-y-2"><h3 className="font-extrabold">Subscription plans ({plans.length})</h3>{plans.length?plans.map(plan=><article key={plan.id} className="geometric-card p-3"><div className="flex flex-wrap justify-between gap-2"><p className="font-extrabold text-slate-950 dark:text-white">{plan.name} ({plan.slug})</p><span className="text-xs text-slate-500">{plan.is_active?'active':'inactive'}</span></div><p className="mt-1 text-xs text-slate-500">{plan.currency} {Number(plan.price).toLocaleString('en-US')} · {plan.billing_interval}</p></article>):<Empty message="Hakuna subscription plan zilizorejeshwa."/>}</div></section>}

    {section==='notifications'&&<section className="space-y-4"><SectionHeader title="Notifications & Campaigns" description="Tuma taarifa kwa mtu mmoja, kundi la watumiaji ulilochagua, au watumiaji wote active. Ujumbe wa chat pia huunda taarifa kiotomatiki."/><AdminNotificationComposer recipients={recipients}/><div className="space-y-2"><h3 className="font-extrabold">Notifications za karibuni ({notifications.length})</h3>{notifications.length?notifications.map(n=><article key={n.id} className="geometric-card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-extrabold text-slate-950 dark:text-white">{n.title}</p><span className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">{n.notification_type} · {n.is_read?'read':'unread'}</span></div><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{n.body}</p><p className="mt-2 text-xs text-slate-500">{dateLabel(n.created_at)} · user {shortId(n.user_id)}</p></article>):<Empty message="Hakuna notification zilizohifadhiwa."/>}</div></section>}

    {section==='growth'&&<section className="space-y-3"><SectionHeader title="Growth & Referrals" description="Reward hutoa XP kwa referrer na mwanafunzi kwa kutumia RPC iliyo na idempotency na hukataa referral isiyo pending."/>{referrals.length?referrals.map(r=><article key={r.id} className="geometric-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-extrabold text-slate-950 dark:text-white">Referral code: {r.referral_code_used}</p><p className="mt-1 text-xs text-slate-500">Referrer {shortId(r.referrer_id)} → student {shortId(r.referred_user_id)}</p><p className="mt-1 text-xs text-slate-500">Status: {r.status} · XP {r.reward_xp} · {dateLabel(r.created_at)}</p></div>{r.status==='pending'?<ReferralActions referralId={r.id}/>:<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold dark:bg-slate-800">{r.status}</span>}</article>):<Empty message="Hakuna referral event iliyopatikana."/>}</section>}

    {section==='support'&&<section className="space-y-3"><SectionHeader title="Support Tickets" description="Hifadhi status/priority kupitia admin_update_support_ticket. Hakuna ticket inayofungwa bila RPC kuthibitisha mabadiliko."/>{tickets.length?tickets.map(t=><article key={t.id} className="geometric-card space-y-3 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-extrabold text-slate-950 dark:text-white">{t.subject}</p><p className="mt-1 text-xs text-slate-500">{ticketUsers[t.user_id]?.full_name||shortId(t.user_id)} · {ticketUsers[t.user_id]?.email||''} · {t.category} · {dateLabel(t.created_at)}</p><p className="mt-1 text-[10px] text-slate-400">ID: {t.id}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold dark:bg-slate-800">{t.status} / {t.priority}</span></div><SupportTicketActions ticketId={t.id} status={t.status} priority={t.priority}/></article>):<Empty message="Hakuna support ticket iliyopatikana."/>}</section>}

    {section==='certificates'&&<section className="space-y-3"><SectionHeader title="Certificates & Verification" description="Revoke ni action isiyoweza kurudishwa kutoka panel hii; sababu inaingia kwenye audit log na status itabadilika kuwa revoked."/>{certificates.length?certificates.map(c=><article key={c.id} className="geometric-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-extrabold text-slate-950 dark:text-white">{c.title}</p><p className="mt-1 text-xs text-slate-500">{c.certificate_code} · {c.certificate_type} · {c.issuer_name} · {dateLabel(c.issued_at)}</p><p className="mt-1 text-xs text-slate-500">Recipient: {shortId(c.recipient_id)} · Status: {c.status}{c.revoke_reason?` · Reason: ${c.revoke_reason}`:''}</p></div><CertificateRevokeAction certificateId={c.id} status={c.status}/></article>):<Empty message="Hakuna certificate record iliyopatikana."/>}</section>}

    {section==='security'&&<section className="space-y-3"><SectionHeader title="Privacy & Security Requests" description="Vitendo hivi vinarekodi admin note na status. `completed` haifanyi export/deletion yenyewe; staff lazima athibitishe kazi hiyo imekamilika kwenye trusted backend."/>{dataRequests.length?dataRequests.map(r=><article key={r.id} className="geometric-card space-y-3 p-4"><div><p className="font-extrabold text-slate-950 dark:text-white">{r.request_type==='export'?'Data export request':'Account deletion request'}</p><p className="mt-1 text-xs text-slate-500">{r.status} · user {shortId(r.user_id)} · {dateLabel(r.submitted_at)}</p><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{r.reason||'Hakuna sababu iliyotolewa.'}</p>{r.admin_note&&<p className="mt-1 text-xs text-slate-500">Admin note: {r.admin_note}</p>}</div><AccountDataRequestActions requestId={r.id}/></article>):<Empty message="Hakuna ombi la data linalosubiri review."/>}</section>}

    {section==='analytics'&&<section className="space-y-4"><SectionHeader title="Analytics Overview" description="Mwenendo wa siku 14 wa usajili, ukuaji wa vikundi, maswali na ujumbe wa group. Takwimu ni za jumla; hazionyeshi maudhui ya ujumbe wala kutambua mtu binafsi."/><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.filter(card=>isSuperAdmin||card[2]!=='payments').map(([label,value,href,icon])=><StatCard key={label} label={label} value={value} href={`/admin?section=${href}`} icon={icon}/>)}</div><AdminAnalyticsCharts initialData={dailyAnalytics}/><div className="geometric-card p-4"><h3 className="font-extrabold text-slate-950 dark:text-white">Maana ya hizi metrics</h3><p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Total users ni idadi ya profiles. Graphs zinaonyesha rekodi mpya kwa siku na jumla ya messages za group; si unique active users/DAU/MAU. Hizi hazionyeshi mazungumzo binafsi wala kuthibitisha revenue kutoka kwa payment provider.</p></div></section>}

    {section==='audit'&&<section className="space-y-3"><SectionHeader title="Audit log" description="Historia ya matendo ya admin yaliyorekodiwa na SQL functions. RPC zisizoandika audit zitaonekana kama hazina event hadi log ziongezwe."/>{audits.length?<div className="geometric-card divide-y divide-slate-100 dark:divide-slate-800">{audits.map(a=><div key={a.id} className="p-4"><p className="font-bold text-slate-900 dark:text-white">{a.action_name} · {a.entity_type}</p><p className="mt-1 text-xs text-slate-500">{dateLabel(a.created_at)} · {shortId(a.id)}</p><pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-500">{JSON.stringify(a.details,null,2)}</pre></div>)}</div>:<Empty message="Hakuna audit events katika rekodi zilizorudishwa."/>}</section>}

    <footer className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><p>Usalama wa kweli unategemea Supabase Auth, role/status checks, RLS na RPC functions—si kuficha buttons tu. Baadhi ya vitendo vipya vinahitaji kuendesha SQL-028 kabla ya kutumika. Provider actions (refund, push/SMS/email, file export/deletion) zimeainishwa wazi na hazionyeshwi kama zimekamilika bila integration.</p></footer>
  </main>
}
