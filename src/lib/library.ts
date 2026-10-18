// Vigezo vya Library (vinatumika kwenye kichujio, fomu ya kupakia na kadi)

export const CATEGORIES = [
  { key: 'past_paper', label: 'Past Papers', long: 'Past Papers & Marking Schemes' },
  { key: 'textbook', label: 'TIE & Textbooks', long: 'TIE & National Syllabus Textbooks' },
  { key: 'notes', label: 'Revision Notes', long: 'Revision Notes & Summaries' },
  { key: 'stem', label: 'Global STEM & Tech', long: 'Global STEM & Tech (Programming, AI, Cyber Security)' },
] as const

export const COUNTRIES = [
  { code: 'TZ', label: 'Tanzania', exam: 'NECTA' },
  { code: 'KE', label: 'Kenya', exam: 'KCSE' },
  { code: 'UG', label: 'Uganda', exam: 'UNEB' },
  { code: 'GLOBAL', label: 'Global', exam: 'STEM' },
] as const

export const LEVELS = [
  { key: 'o_level', label: 'O-Level (Form 1-4)' },
  { key: 'a_level', label: 'A-Level (Form 5-6)' },
  { key: 'university', label: 'Chuo Kikuu' },
  { key: 'general', label: 'Kwa wote' },
] as const

export const SUBJECTS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'Kiswahili',
  'History',
  'Geography',
  'Civics',
  'Commerce',
  'Computer Science',
  'Programming',
  'AI',
  'Cyber Security',
  'Nyingine',
] as const

export type LibraryItem = {
  id: string
  title: string
  description: string | null
  category: string
  country_code: string
  level: string
  subject: string | null
  year: number | null
  file_path: string
  mime: string
  cost_points: number
  status: 'pending' | 'approved' | 'rejected'
  uploaded_by: string
  created_at: string
}

export function categoryLabel(key: string) {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key
}
export function countryLabel(code: string) {
  return COUNTRIES.find((c) => c.code === code)?.label ?? code
}
export function levelLabel(key: string) {
  return LEVELS.find((l) => l.key === key)?.label ?? key
}

export const MAX_PDF_MB = 25
export const MAX_IMAGE_MB = 10
export const UPLOAD_REWARD_POINTS = 30
