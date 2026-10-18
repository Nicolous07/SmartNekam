// Inatengeneza SQL ya kozi/masomo kutoka src/lib/learn/courses.ts ili database
// na app vibaki sawa (points, idadi ya masomo). Endesha:
//   node --experimental-strip-types scripts/gen-learn-seed.mjs > supabase/learn-seed.sql
import { COURSES } from '../src/lib/learn/courses.ts'

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'"
const out = []
out.push('-- IMETENGENEZWA KIOTOMATIKI na scripts/gen-learn-seed.mjs. Usihariri kwa mkono.')
for (const c of COURSES) {
  out.push(
    `insert into public.learn_courses (slug, title, track, badge_emoji, badge_name, bonus_points) values (${q(c.slug)}, ${q(c.title)}, ${q(c.track)}, ${q(c.emoji)}, ${q(c.badge)}, ${c.bonusPoints})\n  on conflict (slug) do update set title = excluded.title, track = excluded.track, badge_emoji = excluded.badge_emoji, badge_name = excluded.badge_name, bonus_points = excluded.bonus_points;`
  )
}
const rows = []
for (const c of COURSES) c.lessons.forEach((l, i) => rows.push(`  (${q(c.slug)}, ${q(l.slug)}, ${i + 1}, ${l.points})`))
out.push(
  `insert into public.learn_lessons (course_slug, slug, position, points) values\n${rows.join(',\n')}\non conflict (course_slug, slug) do update set position = excluded.position, points = excluded.points;`
)
console.log(out.join('\n'))
