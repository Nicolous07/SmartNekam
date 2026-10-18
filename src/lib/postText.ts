/**
 * Maandishi yanayobandikwa kutoka sehemu nyingine mara nyingi hupoteza mistari mipya, mfano:
 *   "Core Concepts:Allele: ... (Tall).1. Monohybrid Cross (Single Trait):Analyzes ..."
 * Kazi hii inarudisha muundo (aya, vichwa, orodha) KWA MAANDISHI YASIYO NA MSTARI MPYA KABISA.
 * Maandishi yenye mistari mipya tayari hayaguswi.
 */
export function restoreStructure(src: string): string {
  const text = src.trim()
  if (text.length < 120 || text.includes('\n')) return src

  // Sehemu za fomula zisiguswe (mfano "$a:b$" au "$$...$$")
  const stash: string[] = []
  let out = text.replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g, (m) => {
    stash.push(m)
    return `\u0000${stash.length - 1}\u0000`
  })

  // 1) Vichwa vilivyo na namba: "...(Tall).1. Monohybrid Cross" -> aya mpya
  out = out.replace(/([.!?)\u0000])\s*(\d{1,2}\.\s+[A-Z])/g, '$1\n\n$2')

  // 2) Kichwa kipya kinachoanza mara baada ya sentensi/fomula: "...).Specialized Crosses:"
  out = out.replace(
    /([.!?)\u0000])([A-Z][\w&-]*(?: [\w&-]+){0,3}:)(?=\s|[A-Z]|$)/g,
    '$1\n\n$2'
  )

  // 3) Kichwa kikifuatwa moja kwa moja na maandishi: "Concepts:Allele" -> mstari mpya
  out = out.replace(/:(?=[A-Z])/g, ':\n\n')

  // Rudisha fomula
  out = out.replace(/\u0000(\d+)\u0000/g, (_, i: string) => stash[Number(i)])

  return out
}
