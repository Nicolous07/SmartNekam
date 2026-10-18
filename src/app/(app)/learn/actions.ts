'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getLesson } from '@/lib/learn/courses'

export type CompleteResult = {
  ok: boolean
  error?: string
  points: number
  done: number
  total: number
  courseCompleted: boolean
  newCertificate: boolean
  certificate: string | null
}

const EMPTY: CompleteResult = {
  ok: false,
  points: 0,
  done: 0,
  total: 0,
  courseCompleted: false,
  newCertificate: false,
  certificate: null,
}

// Inaitwa mwanafunzi akipita majaribio/quiz. Database hutoa EduPoints mara ya kwanza tu,
// hutoa cheti kozi ikikamilika, na haiamini points zinazotumwa na browser (inazisoma kwenye learn_lessons).
export async function completeLesson(courseSlug: string, lessonSlug: string): Promise<CompleteResult> {
  if (!getLesson(courseSlug, lessonSlug)) return { ...EMPTY, error: 'Somo halipo.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ...EMPTY, error: 'Tafadhali ingia kwanza.' }

  const { data, error } = await supabase.rpc('complete_lesson', {
    p_course: courseSlug,
    p_lesson: lessonSlug,
  })
  if (error || !data) return { ...EMPTY, error: error?.message ?? 'Imeshindikana kuhifadhi maendeleo.' }

  const d = data as {
    points: number
    done: number
    total: number
    course_completed: boolean
    new_certificate: boolean
    certificate: string | null
  }

  revalidatePath('/learn', 'layout')
  return {
    ok: true,
    points: d.points,
    done: d.done,
    total: d.total,
    courseCompleted: d.course_completed,
    newCertificate: d.new_certificate,
    certificate: d.certificate,
  }
}
