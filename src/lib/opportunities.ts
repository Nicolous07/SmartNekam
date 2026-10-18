// Vigezo vya Opportunities (vichujio, hatua za maombi, gharama za AI)

export const TYPE_LABELS: Record<string, string> = {
  scholarship: 'Scholarship',
  fellowship: 'Fellowship',
  internship: 'Internship',
  bootcamp: 'Bootcamp',
  hackathon: 'Hackathon',
  competition: 'Mashindano',
}

export const DEGREE_LEVELS = [
  { key: 'diploma', label: 'Diploma' },
  { key: 'bachelor', label: "Bachelor's" },
  { key: 'master', label: "Master's" },
  { key: 'phd', label: 'PhD' },
  { key: 'exchange', label: 'High School Exchange' },
] as const

export const COVERAGE_TYPES = [
  { key: 'full', label: 'Fully Funded (100%)' },
  { key: 'partial', label: 'Partial Funded' },
  { key: 'tuition', label: 'Tuition Fee Only' },
] as const

export const STUDY_FIELDS = [
  { key: 'stem', label: 'STEM (CS, AI, Engineering)' },
  { key: 'health', label: 'Health Sciences' },
  { key: 'business', label: 'Business' },
  { key: 'law', label: 'Law' },
  { key: 'other', label: 'Nyingine' },
] as const

export const REGIONS = [
  { key: 'tanzania', label: 'Tanzania' },
  { key: 'east_africa', label: 'East Africa' },
  { key: 'china', label: 'China' },
  { key: 'uk', label: 'UK' },
  { key: 'usa', label: 'USA' },
  { key: 'europe', label: 'Europe' },
  { key: 'global', label: 'Global' },
] as const

export const STAGES = [
  { key: 'wishlist', label: 'Wishlist', hint: 'Vyuo ninavyotamani' },
  { key: 'requirements_met', label: 'Requirements Met', hint: 'Nimevuka vigezo' },
  { key: 'applied', label: 'Applied', hint: 'Nimetuma' },
  { key: 'admitted', label: 'Admitted', hint: 'Nimechaguliwa' },
] as const

// Mchanganyiko wa masomo ya Form 6 (mifano ya kawaida Tanzania)
export const COMBINATIONS = [
  'PCM', 'PCB', 'PGM', 'CBG', 'CBA', 'EGM', 'HGL', 'HGK', 'HGE', 'HKL', 'KLE', 'ECA',
] as const

// Pointi za ACSEE (Tanzania): pointi ndogo ni bora (A=1 ... F=7)
export const GRADE_POINTS: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5, S: 6, F: 7 }

// Division ya ACSEE kulingana na jumla ya pointi za masomo 3 (Tanzania)
export function divisionOf(total: number): { label: string; short: string } {
  if (total <= 9) return { label: 'Division I', short: 'I' }
  if (total <= 12) return { label: 'Division II', short: 'II' }
  if (total <= 17) return { label: 'Division III', short: 'III' }
  if (total <= 19) return { label: 'Division IV', short: 'IV' }
  return { label: 'Division 0', short: '0' }
}

export const SOP_COST_POINTS = 15

export type Opp = {
  id: string | number
  title: string
  organization: string | null
  type: string
  deadline: string | null
  region?: string | null
  degree_level?: string | null
  coverage_type?: string | null
  study_field?: string | null
  is_remote?: boolean | null
  apply_url?: string | null
  details?: string | null
  eligibility?: string | null
}

export function labelFrom(list: readonly { key: string; label: string }[], key?: string | null) {
  return list.find((x) => x.key === key)?.label ?? key ?? ''
}

// Siku zilizobaki hadi deadline (hasi = imeisha)
export function daysLeft(deadline: string | null | undefined): number | null {
  if (!deadline) return null
  const ms = new Date(deadline).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  return Math.ceil(ms / 86_400_000)
}

export function countdownText(days: number | null): string | null {
  if (days === null) return null
  if (days < 0) return 'Imeisha'
  if (days === 0) return 'Mwisho ni leo'
  if (days === 1) return 'Siku 1 imebaki'
  return `Siku ${days} zimebaki`
}

export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return /^https?:\/\//i.test(url) ? url : null
}
