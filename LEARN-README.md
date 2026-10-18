# SmartNekam Learn: jinsi ya kuweka

1. Nakili folda zote za zip hii kwenye mradi wako (njia zinafanana na za mradi). Faili `src/app/(app)/learn/page.tsx` litaandikwa juu ya la zamani.
2. Kwenye terminal ya mradi:  npm install qrcode   kisha   npm install -D @types/qrcode
3. Supabase > SQL Editor: endesha `supabase/learn.sql` MARA MOJA (ni salama kurudia).
4. `src/lib/supabase/middleware.ts` (liko kwenye zip). Badiliko ni mstari mmoja, ili /verify iwe wazi kwa umma:
     const isPublic = path === '/' || path.startsWith('/auth') || path.startsWith('/verify')
5. (Hiari) `.env.local`:  NEXT_PUBLIC_SITE_URL=https://smartnekam.com   (QR ya cheti itumie domain yako)
6. npm run dev, kisha fungua /learn.

Kubadilisha kozi/masomo: hariri `src/lib/learn/courses.ts`, kisha
   node --experimental-strip-types scripts/gen-learn-seed.mjs
na endesha SQL itakayotoka kwenye Supabase (points na idadi ya masomo).
Kujaribu masomo yote:  node --experimental-strip-types scripts/verify-learn.mjs
