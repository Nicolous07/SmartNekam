// =====================================================================
// SMARTNEKAM LEARN - YALIYOMO YA KOZI
// Kila kozi ina masomo; kila somo ni "code" (kodi + majaribio ya kiotomatiki)
// au "quiz" (maswali ya kuchagua). Ongeza kozi/somo hapa, kisha endesha:
//     node --experimental-strip-types scripts/gen-learn-seed.mjs
// ili kupata SQL ya kunakili kwenye supabase/learn.sql (points na idadi ya masomo).
//
// KANUNI ZA KUANDIKA KODI KWENYE FILE HILI:
//  - Sehemu za kodi (starter/tests/solution) zitumie String.raw`...` bila backtick wala ${ }.
//  - Sehemu ya "body" (maelezo) ni Markdown; code block zitumie ~~~ (si ```).
//  - Majaribio (tests) hutumia check("jina", () => ...). Python: __out() ni matokeo ya print.
//    JavaScript: __out() vivyo hivyo. HTML: tumia "doc" (Document iliyochanganuliwa).
// =====================================================================

export type Language = 'python' | 'javascript' | 'html'
export type Track = 'programming' | 'ai' | 'data'

export type QuizQuestion = {
  q: string
  options: string[]
  answer: number // index ya jibu sahihi
  why: string
}

export type Lesson = {
  slug: string
  title: string
  minutes: number
  points: number // EduPoints kwa kupita somo hili (mara ya kwanza tu)
  body: string // Markdown
  kind: 'code' | 'quiz'
  language?: Language
  starter?: string
  tests?: string
  hint?: string
  solution?: string // HAITUMWI kwa browser; inatumika na scripts/verify tu
  packages?: string[] // Python: vifurushi vya Pyodide (mf. 'numpy', 'pandas')
  quiz?: QuizQuestion[]
}

export type Course = {
  slug: string
  title: string
  track: Track
  level: 'Mwanzo' | 'Kati'
  description: string
  emoji: string
  badge: string
  language: Language | 'mixed'
  bonusPoints: number // zawadi ya kukamilisha kozi nzima
  channel: string // channel ya mazungumzo inayohusiana
  lessons: Lesson[]
}

export const TRACKS: { key: Track; label: string; desc: string }[] = [
  { key: 'programming', label: 'Programming', desc: 'Python, JavaScript, HTML na CSS' },
  { key: 'ai', label: 'Artificial Intelligence', desc: 'Misingi ya AI na kujenga apps za Generative AI' },
  { key: 'data', label: 'Data Science', desc: 'Uchambuzi na usafishaji wa data' },
]

export const COURSES: Course[] = [
  // ------------------------------------------------------------------
  // 1. PYTHON
  // ------------------------------------------------------------------
  {
    slug: 'python-msingi',
    title: 'Python Fundamentals',
    track: 'programming',
    level: 'Mwanzo',
    description: 'Logic, masharti, mizunguko, functions na data structures kwa Python.',
    emoji: '🐍',
    badge: 'Python Novice',
    language: 'python',
    bonusPoints: 100,
    channel: '#computing-it',
    lessons: [
      {
        slug: 'vigeu-na-print',
        title: 'Vigeu (variables) na print',
        minutes: 8,
        points: 10,
        kind: 'code',
        language: 'python',
        body: `## Vigeu na print

**Kigeu (variable)** ni jina linalohifadhi thamani. Python ina aina kuu: maandishi (\`str\`), namba kamili (\`int\`), desimali (\`float\`) na ukweli/uongo (\`bool\`).

~~~python
jina = "Neema"
umri = 16
print("Habari,", jina)
~~~

\`print(...)\` huonyesha matokeo chini ya editor.

### Kazi yako
1. Weka jina lako kwenye kigeu \`jina\` (maandishi yasiyo tupu).
2. Weka umri wako kwenye \`umri\` (namba kubwa kuliko 0).
3. Tumia \`print\` kuonyesha jina lako.`,
        starter: String.raw`# Weka jina na umri wako
jina = ""
umri = 0

print("Habari,", jina)
`,
        tests: String.raw`check("jina ni maandishi yasiyo tupu", lambda: isinstance(jina, str) and jina.strip() != "")
check("umri ni namba kamili kubwa kuliko 0", lambda: isinstance(umri, int) and umri > 0)
check("print imeonyesha jina lako", lambda: jina in __out())
`,
        hint: 'Badilisha jina = "" kuwa jina = "Amina" (au jina lako), na umri = 0 kuwa umri = 17.',
        solution: String.raw`jina = "Amina"
umri = 17
print("Habari,", jina)
`,
      },
      {
        slug: 'masharti-if',
        title: 'Masharti: if, elif, else',
        minutes: 10,
        points: 15,
        kind: 'code',
        language: 'python',
        body: `## Masharti

Programu hufanya maamuzi kwa \`if\`. Ulinganisho: \`==\` (sawa), \`!=\`, \`>\`, \`>=\`, \`<\`, \`<=\`.

~~~python
def ni_mtu_mzima(umri):
    if umri >= 18:
        return True
    else:
        return False
~~~

\`def\` huunda **function** (utajifunza zaidi baadaye). \`return\` hurudisha jibu.

### Kazi yako
Kamilisha \`daraja(alama)\`:
- alama **80 au zaidi** → \`"A"\`
- alama **60 hadi 79** → \`"B"\`
- zilizobaki → \`"C"\``,
        starter: String.raw`def daraja(alama):
    # Tumia if / elif / else
    pass
`,
        tests: String.raw`check("daraja(90) = A", lambda: daraja(90) == "A")
check("daraja(80) = A (mpaka)", lambda: daraja(80) == "A")
check("daraja(65) = B", lambda: daraja(65) == "B")
check("daraja(60) = B (mpaka)", lambda: daraja(60) == "B")
check("daraja(20) = C", lambda: daraja(20) == "C")
`,
        hint: 'Anza na: if alama >= 80: return "A". Kisha elif alama >= 60: ... na mwisho else.',
        solution: String.raw`def daraja(alama):
    if alama >= 80:
        return "A"
    elif alama >= 60:
        return "B"
    else:
        return "C"
`,
      },
      {
        slug: 'mizunguko',
        title: 'Mizunguko: for na while',
        minutes: 10,
        points: 15,
        kind: 'code',
        language: 'python',
        body: `## Mizunguko (loops)

\`for\` hurudia kitendo kwa kila kitu kwenye mfuatano. \`range(1, 6)\` hutoa 1, 2, 3, 4, 5 (namba ya mwisho haihesabiwi).

~~~python
jumla = 0
for i in range(1, 6):
    jumla = jumla + i
print(jumla)   # 15
~~~

### Kazi yako
Andika \`jumla_hadi(n)\` inayorudisha jumla ya namba zote kutoka **1 hadi n**.
Mfano: \`jumla_hadi(4)\` = 1+2+3+4 = **10**. Kwa \`n = 0\` jibu ni **0**.`,
        starter: String.raw`def jumla_hadi(n):
    jumla = 0
    # tumia for i in range(...)
    return jumla
`,
        tests: String.raw`check("jumla_hadi(5) = 15", lambda: jumla_hadi(5) == 15)
check("jumla_hadi(1) = 1", lambda: jumla_hadi(1) == 1)
check("jumla_hadi(100) = 5050", lambda: jumla_hadi(100) == 5050)
check("jumla_hadi(0) = 0", lambda: jumla_hadi(0) == 0)
`,
        hint: 'for i in range(1, n + 1): jumla = jumla + i',
        solution: String.raw`def jumla_hadi(n):
    jumla = 0
    for i in range(1, n + 1):
        jumla = jumla + i
    return jumla
`,
      },
      {
        slug: 'functions',
        title: 'Functions',
        minutes: 10,
        points: 20,
        kind: 'code',
        language: 'python',
        body: `## Functions

Function ni kipande cha kodi chenye jina unachoweza kukitumia tena na tena. Inapokea **vigezo (parameters)** na kurudisha **jibu**.

~~~python
def eneo_mraba(upande):
    return upande * upande

print(eneo_mraba(4))   # 16
~~~

Kumbuka: \`%\` hutoa baki ya kugawanya. \`n % 2 == 0\` maana yake n ni shufwa.

### Kazi yako
1. \`eneo_mstatili(urefu, upana)\` → irudishe urefu × upana.
2. \`ni_shufwa(n)\` → irudishe \`True\` kama n ni namba shufwa, vinginevyo \`False\`.`,
        starter: String.raw`def eneo_mstatili(urefu, upana):
    pass


def ni_shufwa(n):
    pass
`,
        tests: String.raw`check("eneo_mstatili(3, 4) = 12", lambda: eneo_mstatili(3, 4) == 12)
check("eneo_mstatili(10, 0) = 0", lambda: eneo_mstatili(10, 0) == 0)
check("ni_shufwa(8) ni True", lambda: ni_shufwa(8) is True)
check("ni_shufwa(7) ni False", lambda: ni_shufwa(7) is False)
check("ni_shufwa(0) ni True", lambda: ni_shufwa(0) is True)
`,
        hint: 'Kwa ni_shufwa: return n % 2 == 0',
        solution: String.raw`def eneo_mstatili(urefu, upana):
    return urefu * upana


def ni_shufwa(n):
    return n % 2 == 0
`,
      },
      {
        slug: 'lists-na-dictionary',
        title: 'Lists na Dictionary',
        minutes: 12,
        points: 20,
        kind: 'code',
        language: 'python',
        body: `## Lists na Dictionary

**List** ni orodha yenye mpangilio: \`["a", "b"]\`. **Dictionary** huhifadhi jozi za *ufunguo → thamani*: \`{"a": 1}\`.

~~~python
majina = ["asha", "juma"]
kubwa = [m.upper() for m in majina]     # ["ASHA", "JUMA"]

idadi = {}
idadi["asha"] = idadi.get("asha", 0) + 1   # {"asha": 1}
~~~

### Kazi yako
1. \`herufi_kubwa(maneno)\` → list mpya yenye maneno yote kwa herufi kubwa.
2. \`hesabu_maneno(maneno)\` → dictionary ya kila neno na mara linapojitokeza.
   Mfano: \`["a","b","a"]\` → \`{"a": 2, "b": 1}\``,
        starter: String.raw`def herufi_kubwa(maneno):
    pass


def hesabu_maneno(maneno):
    pass
`,
        tests: String.raw`check("herufi_kubwa(['a', 'bc']) = ['A', 'BC']", lambda: herufi_kubwa(["a", "bc"]) == ["A", "BC"])
check("herufi_kubwa([]) = []", lambda: herufi_kubwa([]) == [])
check("hesabu_maneno(['a','b','a']) = {'a': 2, 'b': 1}", lambda: hesabu_maneno(["a", "b", "a"]) == {"a": 2, "b": 1})
check("hesabu_maneno([]) = {}", lambda: hesabu_maneno([]) == {})
`,
        hint: 'Tumia idadi[neno] = idadi.get(neno, 0) + 1 ndani ya for.',
        solution: String.raw`def herufi_kubwa(maneno):
    return [m.upper() for m in maneno]


def hesabu_maneno(maneno):
    idadi = {}
    for neno in maneno:
        idadi[neno] = idadi.get(neno, 0) + 1
    return idadi
`,
      },
    ],
  },

  // ------------------------------------------------------------------
  // 2. JAVASCRIPT
  // ------------------------------------------------------------------
  {
    slug: 'javascript-msingi',
    title: 'JavaScript Basics',
    track: 'programming',
    level: 'Mwanzo',
    description: 'Lugha ya mtandao: vigeu, functions, arrays na objects.',
    emoji: '🟨',
    badge: 'JS Builder',
    language: 'javascript',
    bonusPoints: 80,
    channel: '#computing-it',
    lessons: [
      {
        slug: 'console-log',
        title: 'Vigeu na console.log',
        minutes: 8,
        points: 10,
        kind: 'code',
        language: 'javascript',
        body: `## Vigeu na console.log

Kwenye JavaScript tunatumia \`const\` (haibadiliki) na \`let\` (inabadilika). \`console.log(...)\` huonyesha matokeo.

~~~javascript
const jina = "Neema";
console.log("Habari, " + jina);
~~~

### Kazi yako
1. Weka jina lako kwenye \`jina\` (maandishi yasiyo tupu).
2. Tumia \`console.log\` kuonyesha ujumbe unaoanza na "Habari, " ukifuatiwa na jina lako.`,
        starter: String.raw`const jina = "";

console.log("Habari, " + jina);
`,
        tests: String.raw`check("jina ni maandishi yasiyo tupu", () => typeof jina === "string" && jina.trim().length > 0);
check("console.log imeonyesha 'Habari, ' na jina", () => __out().includes("Habari, " + jina));
`,
        hint: 'Badilisha const jina = ""; kuwa const jina = "Amina";',
        solution: String.raw`const jina = "Amina";
console.log("Habari, " + jina);
`,
      },
      {
        slug: 'functions-js',
        title: 'Functions',
        minutes: 10,
        points: 15,
        kind: 'code',
        language: 'javascript',
        body: `## Functions

~~~javascript
function eneoMraba(upande) {
  return upande * upande;
}
// au kwa muundo wa mshale:
const eneoMraba2 = (upande) => upande * upande;
~~~

### Kazi yako
1. \`zidisha(a, b)\` → irudishe a × b.
2. \`niShufwa(n)\` → \`true\` kama n ni shufwa, vinginevyo \`false\`.`,
        starter: String.raw`function zidisha(a, b) {
  // andika kodi yako
}

function niShufwa(n) {
  // andika kodi yako
}
`,
        tests: String.raw`check("zidisha(3, 4) = 12", () => zidisha(3, 4) === 12);
check("zidisha(5, 0) = 0", () => zidisha(5, 0) === 0);
check("niShufwa(10) ni true", () => niShufwa(10) === true);
check("niShufwa(7) ni false", () => niShufwa(7) === false);
`,
        hint: 'return n % 2 === 0;',
        solution: String.raw`function zidisha(a, b) {
  return a * b;
}

function niShufwa(n) {
  return n % 2 === 0;
}
`,
      },
      {
        slug: 'arrays',
        title: 'Arrays: map, filter, reduce',
        minutes: 12,
        points: 20,
        kind: 'code',
        language: 'javascript',
        body: `## Arrays

~~~javascript
const namba = [1, 2, 3, 4];
namba.map((n) => n * 2);          // [2, 4, 6, 8]
namba.filter((n) => n > 2);       // [3, 4]
namba.reduce((jumla, n) => jumla + n, 0);   // 10
~~~

### Kazi yako
1. \`mraba(arr)\` → array ya miraba ya kila namba (tumia \`map\`).
2. \`vikubwa(arr, kikomo)\` → namba zilizo **kubwa kuliko** kikomo (tumia \`filter\`).
3. \`jumla(arr)\` → jumla ya namba zote (tumia \`reduce\`).`,
        starter: String.raw`function mraba(arr) {
}

function vikubwa(arr, kikomo) {
}

function jumla(arr) {
}
`,
        tests: String.raw`check("mraba([1,2,3]) = [1,4,9]", () => JSON.stringify(mraba([1, 2, 3])) === "[1,4,9]");
check("vikubwa([1,5,10], 4) = [5,10]", () => JSON.stringify(vikubwa([1, 5, 10], 4)) === "[5,10]");
check("jumla([1,2,3,4]) = 10", () => jumla([1, 2, 3, 4]) === 10);
check("jumla([]) = 0", () => jumla([]) === 0);
`,
        hint: 'return arr.map((n) => n * n);',
        solution: String.raw`function mraba(arr) {
  return arr.map((n) => n * n);
}

function vikubwa(arr, kikomo) {
  return arr.filter((n) => n > kikomo);
}

function jumla(arr) {
  return arr.reduce((j, n) => j + n, 0);
}
`,
      },
      {
        slug: 'objects',
        title: 'Objects',
        minutes: 12,
        points: 20,
        kind: 'code',
        language: 'javascript',
        body: `## Objects

Object huhifadhi data yenye majina: \`{ jina: "Asha", alama: 70 }\`. Unasoma kwa \`mwanafunzi.alama\`.

### Kazi yako
1. \`tengenezaMwanafunzi(jina, alama)\` → irudishe object yenye \`jina\`, \`alama\` na \`amefaulu\` (true kama alama ≥ 50).
2. \`wastani(wanafunzi)\` → wastani wa alama za wanafunzi wote (array ya objects). Kwa array tupu rudisha 0.`,
        starter: String.raw`function tengenezaMwanafunzi(jina, alama) {
}

function wastani(wanafunzi) {
}
`,
        tests: String.raw`check("tengenezaMwanafunzi('Asha', 70) ana amefaulu = true", () => {
  const m = tengenezaMwanafunzi("Asha", 70);
  return m.jina === "Asha" && m.alama === 70 && m.amefaulu === true;
});
check("alama 49 = amefaulu false", () => tengenezaMwanafunzi("Juma", 49).amefaulu === false);
check("wastani wa 60 na 80 = 70", () => wastani([{ alama: 60 }, { alama: 80 }]) === 70);
check("wastani wa array tupu = 0", () => wastani([]) === 0);
`,
        hint: 'wastani: kama array ni tupu rudisha 0; vinginevyo jumla ya alama / wanafunzi.length.',
        solution: String.raw`function tengenezaMwanafunzi(jina, alama) {
  return { jina: jina, alama: alama, amefaulu: alama >= 50 };
}

function wastani(wanafunzi) {
  if (wanafunzi.length === 0) return 0;
  const jumla = wanafunzi.reduce((j, w) => j + w.alama, 0);
  return jumla / wanafunzi.length;
}
`,
      },
    ],
  },

  // ------------------------------------------------------------------
  // 3. HTML & CSS
  // ------------------------------------------------------------------
  {
    slug: 'html-css-msingi',
    title: 'HTML & CSS Basics',
    track: 'programming',
    level: 'Mwanzo',
    description: 'Jenga ukurasa wako wa kwanza wa mtandao na uuonyeshe papo hapo.',
    emoji: '🎨',
    badge: 'Web Starter',
    language: 'html',
    bonusPoints: 60,
    channel: '#computing-it',
    lessons: [
      {
        slug: 'muundo-wa-html',
        title: 'Muundo wa HTML',
        minutes: 8,
        points: 10,
        kind: 'code',
        language: 'html',
        body: `## Muundo wa HTML

HTML hutumia **tags**: \`<h1>\` kichwa kikuu, \`<p>\` aya, \`<ul>\` orodha na \`<li>\` kila kipengele cha orodha.

~~~html
<h1>Shule Yangu</h1>
<p>Karibu!</p>
<ul>
  <li>Hisabati</li>
</ul>
~~~

### Kazi yako
Andika: kichwa \`<h1>\` chenye maandishi, aya \`<p>\`, na orodha \`<ul>\` yenye angalau **vipengele 3** vya \`<li>\`.`,
        starter: String.raw`<!-- Andika HTML yako hapa -->
`,
        tests: String.raw`check("kuna <h1> yenye maandishi", () => (doc.querySelector("h1")?.textContent || "").trim().length > 0);
check("kuna <p> yenye maandishi", () => (doc.querySelector("p")?.textContent || "").trim().length > 0);
check("kuna <ul> yenye <li> angalau 3", () => doc.querySelectorAll("ul li").length >= 3);
`,
        hint: '<ul><li>Moja</li><li>Mbili</li><li>Tatu</li></ul>',
        solution: String.raw`<h1>Shule Yangu</h1>
<p>Karibu kwenye ukurasa wangu.</p>
<ul>
  <li>Hisabati</li>
  <li>Kiswahili</li>
  <li>Sayansi</li>
</ul>
`,
      },
      {
        slug: 'viungo-na-picha',
        title: 'Viungo na picha',
        minutes: 8,
        points: 10,
        kind: 'code',
        language: 'html',
        body: `## Viungo na picha

~~~html
<a href="https://smartnekam.com">Tembelea SmartNekam</a>
<img src="https://picsum.photos/200" alt="Maelezo ya picha">
~~~

Sifa \`alt\` ni muhimu: huwasaidia wasioona na hutumika picha isipopakia.

### Kazi yako
1. Weka kiungo \`<a>\` chenye \`href\` inayoanza na \`https://\` na maandishi.
2. Weka picha \`<img>\` yenye \`src\` na \`alt\` isiyo tupu.`,
        starter: String.raw`<!-- Weka kiungo na picha -->
`,
        tests: String.raw`check("kuna <a> yenye href ya https://", () => (doc.querySelector("a")?.getAttribute("href") || "").startsWith("https://"));
check("kiungo kina maandishi", () => (doc.querySelector("a")?.textContent || "").trim().length > 0);
check("kuna <img> yenye src", () => (doc.querySelector("img")?.getAttribute("src") || "").length > 0);
check("<img> ina alt isiyo tupu", () => (doc.querySelector("img")?.getAttribute("alt") || "").trim().length > 0);
`,
        hint: 'Kumbuka alt="..." ndani ya <img ...>.',
        solution: String.raw`<a href="https://smartnekam.com">SmartNekam</a>
<img src="https://picsum.photos/200" alt="Picha ya mfano">
`,
      },
      {
        slug: 'css-mtindo',
        title: 'CSS: kupamba ukurasa',
        minutes: 12,
        points: 20,
        kind: 'code',
        language: 'html',
        body: `## CSS

CSS hupamba HTML. Huandikwa ndani ya \`<style>\`:

~~~html
<style>
  h1 { color: darkgreen; }
  .kadi { background: #ecfdf5; padding: 16px; }
</style>
<div class="kadi">Habari</div>
~~~

\`.kadi\` huchagua kila kipengele chenye \`class="kadi"\`.

### Kazi yako
Tengeneza darasa \`.kadi\` lenye **background**, **padding** na **border-radius**, kisha litumie kwenye \`<div class="kadi">\` yenye maandishi.`,
        starter: String.raw`<style>
  /* andika CSS ya .kadi hapa */
</style>

<!-- weka div yenye class="kadi" hapa -->
`,
        tests: String.raw`const css = Array.from(doc.querySelectorAll("style")).map((s) => s.textContent).join("\n");
check("CSS ina .kadi yenye background", () => /\.kadi\s*\{[^}]*background/i.test(css));
check("CSS ina padding", () => /\.kadi\s*\{[^}]*padding/i.test(css));
check("CSS ina border-radius", () => /\.kadi\s*\{[^}]*border-radius/i.test(css));
check("kuna div.kadi yenye maandishi", () => (doc.querySelector("div.kadi")?.textContent || "").trim().length > 0);
`,
        hint: '.kadi { background: #ecfdf5; padding: 16px; border-radius: 12px; }',
        solution: String.raw`<style>
  .kadi { background: #ecfdf5; padding: 16px; border-radius: 12px; }
</style>
<div class="kadi">Habari kutoka kwenye kadi yangu!</div>
`,
      },
    ],
  },

  // ------------------------------------------------------------------
  // 4. AI BASICS
  // ------------------------------------------------------------------
  {
    slug: 'ai-misingi',
    title: 'AI Basics',
    track: 'ai',
    level: 'Mwanzo',
    description: 'Elewa AI, Machine Learning na Neural Networks bila hesabu nzito.',
    emoji: '🤖',
    badge: 'AI Apprentice',
    language: 'mixed',
    bonusPoints: 80,
    channel: '#ai-cohort',
    lessons: [
      {
        slug: 'ai-ni-nini',
        title: 'AI ni nini?',
        minutes: 6,
        points: 10,
        kind: 'quiz',
        body: `## Artificial Intelligence (AI)

**AI** ni mifumo ya kompyuta inayofanya kazi zinazohitaji akili ya binadamu: kutambua picha, kuelewa lugha, kutafsiri, kupendekeza video na kadhalika.

Mifano ya kila siku: kibodi inayokisia neno lako, Google Translate, kamera inayotambua uso, na wasaidizi wa mazungumzo kama Claude.

AI **haina hisia wala ufahamu kama binadamu**; hujifunza *mifumo* kutoka kwenye data.`,
        quiz: [
          {
            q: 'Ipi ni mfano wa AI?',
            options: ['Kikokotoo cha kawaida', 'Programu inayotafsiri Kiswahili kwenda Kiingereza', 'Karatasi ya mtihani', 'Betri ya simu'],
            answer: 1,
            why: 'Kutafsiri lugha kunahitaji kuelewa mifumo ya lugha, jambo ambalo AI hufanya.',
          },
          {
            q: 'AI hujifunza kutoka wapi?',
            options: ['Kutoka kwenye data', 'Kutoka kwenye umeme', 'Kutoka kwenye skrini tu', 'Haijifunzi kamwe'],
            answer: 0,
            why: 'Mifumo ya AI hujifunza mifumo (patterns) kutoka kwenye data nyingi.',
          },
          {
            q: 'Kauli ipi ni sahihi?',
            options: ['AI inajua kila kitu kila wakati', 'AI inaweza kukosea, kwa hiyo majibu yake yahakikiwe', 'AI haitumii data', 'AI ni binadamu aliyejificha'],
            answer: 1,
            why: 'AI inaweza kukosea au kutoa taarifa zisizo sahihi; hakiki muhimu kila wakati.',
          },
        ],
      },
      {
        slug: 'machine-learning',
        title: 'Machine Learning',
        minutes: 8,
        points: 15,
        kind: 'quiz',
        body: `## Machine Learning (ML)

Badala ya kuandika kanuni zote kwa mkono, **tunaonyesha kompyuta mifano** nayo inajifunza kanuni.

- **Supervised learning**: data ina majibu (mf. picha + lebo "paka"/"mbwa").
- **Unsupervised learning**: data haina majibu; mfumo hutafuta makundi yenyewe.
- **Training** ni kujifunza; **testing** ni kupima kwa data mpya ambayo mfumo haujawahi kuiona.

**Overfitting**: mfumo "unakariri" data ya mafunzo na kushindwa kwenye data mpya.`,
        quiz: [
          {
            q: 'Supervised learning inatumia data ya aina gani?',
            options: ['Data isiyo na majibu', 'Data yenye majibu (lebo)', 'Data ya sauti tu', 'Hakuna data'],
            answer: 1,
            why: 'Supervised = kuna "msimamizi": kila mfano una jibu sahihi la kujifunza.',
          },
          {
            q: 'Kwa nini tunapima mfumo kwa data mpya (testing)?',
            options: ['Kuokoa umeme', 'Kuona kama umejifunza kweli na si kukariri', 'Kuongeza ukubwa wa data', 'Hakuna sababu'],
            answer: 1,
            why: 'Data mpya huonyesha uwezo halisi wa mfumo na hubaini overfitting.',
          },
          {
            q: 'Kugawa wateja kwenye makundi bila kuwa na lebo ni mfano wa nini?',
            options: ['Supervised learning', 'Unsupervised learning', 'Overfitting', 'Testing'],
            answer: 1,
            why: 'Bila lebo, mfumo hutafuta makundi wenyewe: hiyo ni unsupervised learning.',
          },
        ],
      },
      {
        slug: 'neural-networks',
        title: 'Utangulizi wa Neural Networks',
        minutes: 8,
        points: 15,
        kind: 'quiz',
        body: `## Neural Networks

Neural network imeundwa na **tabaka (layers)** za "neurons" bandia zilizounganishwa.

1. **Input layer**: hupokea data (mf. pikseli za picha).
2. **Hidden layers**: hubadilisha data hatua kwa hatua kwa kutumia **uzito (weights)**.
3. **Output layer**: hutoa jibu (mf. "paka" kwa 92%).

Wakati wa mafunzo, uzito hurekebishwa mara nyingi ili makosa yapungue. Mtandao wenye hidden layers nyingi huitwa **Deep Learning**.`,
        quiz: [
          {
            q: 'Hidden layers hufanya nini?',
            options: ['Huhifadhi nywila', 'Hubadilisha data hatua kwa hatua kuelekea jibu', 'Huzima mtandao', 'Hufuta data'],
            answer: 1,
            why: 'Hidden layers hutoa vipengele vya ndani vinavyosaidia kufikia jibu la mwisho.',
          },
          {
            q: 'Wakati wa mafunzo, nini hurekebishwa ili kupunguza makosa?',
            options: ['Rangi ya skrini', 'Uzito (weights)', 'Jina la faili', 'Ukubwa wa kibodi'],
            answer: 1,
            why: 'Mafunzo ni kurekebisha weights ili majibu yawe sahihi zaidi.',
          },
          {
            q: 'Deep Learning ni nini?',
            options: ['Kusoma usiku', 'Neural networks zenye hidden layers nyingi', 'Hifadhi ya data', 'Aina ya simu'],
            answer: 1,
            why: '"Deep" inamaanisha tabaka nyingi za ndani.',
          },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------
  // 5. GENERATIVE AI APPS
  // ------------------------------------------------------------------
  {
    slug: 'ai-apps',
    title: 'Building Generative AI Apps',
    track: 'ai',
    level: 'Kati',
    description: 'Prompt engineering na kuunganisha API kwenye app yako.',
    emoji: '✨',
    badge: 'AI Builder',
    language: 'mixed',
    bonusPoints: 100,
    channel: '#ai-cohort',
    lessons: [
      {
        slug: 'anatomia-ya-prompt',
        title: 'Anatomia ya prompt nzuri',
        minutes: 8,
        points: 10,
        kind: 'quiz',
        body: `## Prompt nzuri

**Prompt** ni maelekezo unayompa modeli ya AI. Prompt nzuri huwa na:

1. **Jukumu**: "Wewe ni mwalimu wa Hisabati."
2. **Kazi**: wazi na mahususi ("Eleza ... kwa mifano 2").
3. **Muktadha/data**: maandishi au taarifa ya kutumia.
4. **Muundo wa jibu**: "Jibu kwa orodha ya hoja 3" au "Rudisha JSON".

Prompt isiyo wazi ("niambie kuhusu mimea") hutoa jibu lisilo wazi pia.`,
        quiz: [
          {
            q: 'Ipi ni prompt bora zaidi?',
            options: ['"Mimea"', '"Wewe ni mwalimu wa Biolojia. Eleza photosynthesis kwa aya mbili fupi kwa mwanafunzi wa Form 2."', '"Eleza"', '"???"'],
            answer: 1,
            why: 'Ina jukumu, kazi, hadhira na urefu: kila kitu modeli inahitaji.',
          },
          {
            q: 'Kwa nini kutaja muundo wa jibu (mf. JSON) kuna faida?',
            options: ['Inapunguza gharama ya umeme', 'Programu yako inaweza kusoma jibu kwa urahisi', 'Inafanya modeli ichoke', 'Haina faida'],
            answer: 1,
            why: 'Jibu lenye muundo unaotabirika ni rahisi kuchakatwa na kodi yako.',
          },
          {
            q: 'Ukipata jibu lisilo sahihi, hatua nzuri ni ipi?',
            options: ['Kuacha kabisa', 'Kuboresha prompt kwa kuongeza muktadha na mifano', 'Kubadilisha simu', 'Kuandika kwa herufi kubwa tu'],
            answer: 1,
            why: 'Prompt engineering ni mchakato wa kurudia na kuboresha.',
          },
        ],
      },
      {
        slug: 'prompt-template',
        title: 'Tengeneza prompt template',
        minutes: 10,
        points: 20,
        kind: 'code',
        language: 'python',
        body: `## Prompt template

Apps za AI hutengeneza prompt kwa kodi, ikichanganya sehemu zisizobadilika na data ya mtumiaji.

~~~python
def salamu(jina):
    return f"Habari {jina}!"
~~~

### Kazi yako
Andika \`tengeneza_prompt(jukumu, kazi, maandishi)\` inayorudisha maandishi **haswa** katika muundo huu (mistari 3):

~~~
Jukumu: <jukumu>
Kazi: <kazi>
Maandishi: <maandishi>
~~~`,
        starter: String.raw`def tengeneza_prompt(jukumu, kazi, maandishi):
    pass
`,
        tests: String.raw`check("muundo wa prompt ni sahihi", lambda: tengeneza_prompt("Mwalimu", "Fupisha", "Habari ndefu") == "Jukumu: Mwalimu\nKazi: Fupisha\nMaandishi: Habari ndefu")
check("inafanya kazi kwa data nyingine", lambda: tengeneza_prompt("A", "B", "C") == "Jukumu: A\nKazi: B\nMaandishi: C")
`,
        hint: 'Tumia f-string na \\n kati ya mistari: f"Jukumu: {jukumu}\\nKazi: {kazi}\\n..."',
        solution: String.raw`def tengeneza_prompt(jukumu, kazi, maandishi):
    return f"Jukumu: {jukumu}\nKazi: {kazi}\nMaandishi: {maandishi}"
`,
      },
      {
        slug: 'jibu-la-api',
        title: 'Kusoma jibu la API (JSON)',
        minutes: 12,
        points: 20,
        kind: 'code',
        language: 'python',
        body: `## Majibu ya API

API ya AI hurudisha **JSON**. Python ina moduli ya \`json\`:

~~~python
import json
data = json.loads('{"a": {"b": [10, 20]}}')
print(data["a"]["b"][1])   # 20
~~~

### Kazi yako
Jibu la API lina umbo hili:

~~~json
{"choices": [{"message": {"content": "Habari!"}}]}
~~~

Andika \`toa_jibu(json_text)\` inayorudisha maandishi ya \`content\` ya chaguo la kwanza.
Kama JSON ni batili au haina \`choices\`, rudisha \`None\`.`,
        starter: String.raw`import json


def toa_jibu(json_text):
    pass
`,
        tests: String.raw`check("inatoa content", lambda: toa_jibu('{"choices": [{"message": {"content": "Habari!"}}]}') == "Habari!")
check("inatumia chaguo la kwanza", lambda: toa_jibu('{"choices": [{"message": {"content": "A"}}, {"message": {"content": "B"}}]}') == "A")
check("JSON batili = None", lambda: toa_jibu("si-json") is None)
check("bila choices = None", lambda: toa_jibu('{"x": 1}') is None)
`,
        hint: 'Tumia try/except (json.JSONDecodeError, KeyError, IndexError, TypeError).',
        solution: String.raw`import json


def toa_jibu(json_text):
    try:
        data = json.loads(json_text)
        return data["choices"][0]["message"]["content"]
    except (json.JSONDecodeError, KeyError, IndexError, TypeError):
        return None
`,
      },
      {
        slug: 'usalama-wa-api',
        title: 'Usalama wa API key na gharama',
        minutes: 6,
        points: 10,
        kind: 'quiz',
        body: `## Usalama

- **API key** ni nywila ya app yako kwa huduma ya AI. **Usiiweke kwenye kodi ya browser** wala kwenye GitHub ya umma; itunze upande wa **server** (environment variable).
- Huduma nyingi hutoza kwa **tokens** (vipande vya maneno): prompt ndefu na jibu refu hugharimu zaidi.
- Weka **mipaka** (rate limit, bajeti) ili mtumiaji mmoja asiteketeze akaunti yako.
- Usitume taarifa binafsi za watu (nywila, namba za simu) kwenye prompt bila ulazima.`,
        quiz: [
          {
            q: 'API key ihifadhiwe wapi?',
            options: ['Kwenye kodi ya JavaScript ya browser', 'Kwenye server kama environment variable', 'Kwenye picha ya wasifu', 'Kwenye ujumbe wa WhatsApp'],
            answer: 1,
            why: 'Kila mtu anaweza kuona kodi ya browser; server pekee inaweza kuficha siri.',
          },
          {
            q: 'Tokens ni nini?',
            options: ['Sarafu za michezo', 'Vipande vya maandishi ambavyo modeli huchakata na kutozwa kwa hivyo', 'Aina ya nywila', 'Ukubwa wa skrini'],
            answer: 1,
            why: 'Gharama nyingi za AI hutegemea idadi ya tokens za ingizo na jibu.',
          },
          {
            q: 'Kwa nini kuweka rate limit ni muhimu?',
            options: ['Kuzuia matumizi kupita kiasi na gharama zisizotarajiwa', 'Kupamba app', 'Kuongeza kasi ya intaneti ya mtumiaji', 'Si muhimu'],
            answer: 0,
            why: 'Bila mipaka, mtu mmoja au bot inaweza kutumia bajeti yako yote.',
          },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------
  // 6. DATA ANALYSIS
  // ------------------------------------------------------------------
  {
    slug: 'data-analysis',
    title: 'Data Analysis na Python',
    track: 'data',
    level: 'Kati',
    description: 'Takwimu, kusafisha data, kupanga kwa makundi na kusoma CSV.',
    emoji: '📊',
    badge: 'Data Explorer',
    language: 'python',
    bonusPoints: 100,
    channel: '#data-science',
    lessons: [
      {
        slug: 'takwimu-msingi',
        title: 'Takwimu za msingi',
        minutes: 10,
        points: 15,
        kind: 'code',
        language: 'python',
        body: `## Takwimu za msingi

- **Wastani (mean)** = jumla ÷ idadi.
- **Kati (median)** = thamani ya katikati baada ya kupanga. Idadi ikiwa shufwa, ni wastani wa mbili za katikati.
- **Masafa (range)** = kubwa zaidi − ndogo zaidi.

~~~python
alama = [50, 70, 90]
print(sum(alama) / len(alama))   # 70.0
print(sorted(alama))
~~~

### Kazi yako
Andika \`wastani(namba)\`, \`kati(namba)\` na \`masafa(namba)\`. Orodha haitakuwa tupu.`,
        starter: String.raw`def wastani(namba):
    pass


def kati(namba):
    pass


def masafa(namba):
    pass
`,
        tests: String.raw`check("wastani([50, 70, 90]) = 70", lambda: wastani([50, 70, 90]) == 70)
check("kati([3, 1, 2]) = 2", lambda: kati([3, 1, 2]) == 2)
check("kati([1, 2, 3, 4]) = 2.5", lambda: kati([1, 2, 3, 4]) == 2.5)
check("masafa([4, 10, 7]) = 6", lambda: masafa([4, 10, 7]) == 6)
`,
        hint: 'kati: p = sorted(namba); n = len(p); kama n ni witiri chukua p[n // 2], vinginevyo wastani wa p[n//2 - 1] na p[n//2].',
        solution: String.raw`def wastani(namba):
    return sum(namba) / len(namba)


def kati(namba):
    p = sorted(namba)
    n = len(p)
    if n % 2 == 1:
        return p[n // 2]
    return (p[n // 2 - 1] + p[n // 2]) / 2


def masafa(namba):
    return max(namba) - min(namba)
`,
      },
      {
        slug: 'kusafisha-data',
        title: 'Kusafisha data',
        minutes: 10,
        points: 15,
        kind: 'code',
        language: 'python',
        body: `## Kusafisha data

Data halisi huwa chafu: nafasi za ziada, herufi zisizo sawa, maingizo matupu na yanayojirudia.

~~~python
"  asha mwita ".strip().title()   # "Asha Mwita"
~~~

### Kazi yako
Andika \`safisha(majina)\` inayorudisha list mpya ambapo:
1. nafasi za pembeni zimeondolewa (\`strip\`),
2. kila jina liko katika muundo wa \`title()\`,
3. majina matupu yameondolewa,
4. majina yanayojirudia yameondolewa, **mpangilio wa kwanza ukibaki**.`,
        starter: String.raw`def safisha(majina):
    pass
`,
        tests: String.raw`check("inasafisha nafasi na herufi", lambda: safisha(["  asha ", "JUMA"]) == ["Asha", "Juma"])
check("inaondoa matupu", lambda: safisha(["amina", "", "   "]) == ["Amina"])
check("inaondoa yanayojirudia (mpangilio unabaki)", lambda: safisha(["asha", "Juma", " ASHA ", "juma"]) == ["Asha", "Juma"])
check("list tupu = list tupu", lambda: safisha([]) == [])
`,
        hint: 'Tumia list ya matokeo na ukague "if jina and jina not in matokeo".',
        solution: String.raw`def safisha(majina):
    matokeo = []
    for jina in majina:
        j = jina.strip().title()
        if j and j not in matokeo:
            matokeo.append(j)
    return matokeo
`,
      },
      {
        slug: 'kupanga-kwa-makundi',
        title: 'Kupanga kwa makundi (group by)',
        minutes: 12,
        points: 20,
        kind: 'code',
        language: 'python',
        body: `## Group by

Mara nyingi tunataka jumla au wastani **kwa kila kundi** (mf. wastani wa alama kwa kila somo).

~~~python
rekodi = [{"somo": "Hesabu", "alama": 80}, {"somo": "Hesabu", "alama": 60}]
~~~

### Kazi yako
Andika \`wastani_kwa_somo(rekodi)\` inayorudisha dictionary ya **somo → wastani wa alama zake**.
Mfano hapo juu → \`{"Hesabu": 70.0}\`.`,
        starter: String.raw`def wastani_kwa_somo(rekodi):
    pass
`,
        tests: String.raw`data = [
    {"somo": "Hesabu", "alama": 80},
    {"somo": "Hesabu", "alama": 60},
    {"somo": "Kiswahili", "alama": 90},
]
check("wastani wa Hesabu = 70", lambda: wastani_kwa_somo(data)["Hesabu"] == 70)
check("wastani wa Kiswahili = 90", lambda: wastani_kwa_somo(data)["Kiswahili"] == 90)
check("masomo mawili tu", lambda: len(wastani_kwa_somo(data)) == 2)
check("orodha tupu = {}", lambda: wastani_kwa_somo([]) == {})
`,
        hint: 'Kusanya alama zote za kila somo kwenye dict ya list, kisha kokotoa wastani kwa kila ufunguo.',
        solution: String.raw`def wastani_kwa_somo(rekodi):
    makundi = {}
    for r in rekodi:
        makundi.setdefault(r["somo"], []).append(r["alama"])
    return {somo: sum(a) / len(a) for somo, a in makundi.items()}
`,
      },
      {
        slug: 'kusoma-csv',
        title: 'Kusoma data ya CSV',
        minutes: 12,
        points: 20,
        kind: 'code',
        language: 'python',
        body: `## CSV

CSV ni maandishi yenye safu zilizotenganishwa kwa koma. Moduli ya \`csv\` na \`io.StringIO\` hutusaidia kuisoma:

~~~python
import csv, io
maandishi = "jina,alama\\nAsha,70"
for safu in csv.DictReader(io.StringIO(maandishi)):
    print(safu["jina"], safu["alama"])   # alama ni maandishi!
~~~

### Kazi yako
1. \`soma_csv(maandishi)\` → list ya dictionary, **alama ikiwa namba kamili (int)**.
2. \`wastani_wa_alama(maandishi)\` → wastani wa alama zote (0 kama hakuna safu).`,
        starter: String.raw`import csv
import io


def soma_csv(maandishi):
    pass


def wastani_wa_alama(maandishi):
    pass
`,
        tests: String.raw`sampuli = "jina,alama\nAsha,70\nJuma,90"
check("soma_csv inarudisha safu 2", lambda: len(soma_csv(sampuli)) == 2)
check("alama ni int", lambda: soma_csv(sampuli)[0] == {"jina": "Asha", "alama": 70})
check("wastani = 80", lambda: wastani_wa_alama(sampuli) == 80)
check("bila safu = 0", lambda: wastani_wa_alama("jina,alama") == 0)
`,
        hint: 'int(safu["alama"]) kubadilisha maandishi kuwa namba.',
        solution: String.raw`import csv
import io


def soma_csv(maandishi):
    return [
        {"jina": s["jina"], "alama": int(s["alama"])}
        for s in csv.DictReader(io.StringIO(maandishi))
    ]


def wastani_wa_alama(maandishi):
    safu = soma_csv(maandishi)
    if not safu:
        return 0
    return sum(s["alama"] for s in safu) / len(safu)
`,
      },
    ],
  },
]

// ------------------------------------------------------------------
// Visaidizi
// ------------------------------------------------------------------
export function getCourse(slug: string) {
  return COURSES.find((c) => c.slug === slug)
}

export function getLesson(courseSlug: string, lessonSlug: string) {
  const course = getCourse(courseSlug)
  const index = course ? course.lessons.findIndex((l) => l.slug === lessonSlug) : -1
  if (!course || index < 0) return null
  return {
    course,
    lesson: course.lessons[index],
    index,
    prev: course.lessons[index - 1] ?? null,
    next: course.lessons[index + 1] ?? null,
  }
}

// Toleo la somo linalotumwa kwa browser: bila "solution".
export type ClientLesson = Omit<Lesson, 'solution'>
export function toClientLesson(l: Lesson): ClientLesson {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { solution, ...rest } = l
  return rest
}

