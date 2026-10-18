// Picha za kurasa. Ili kutumia picha mpya:
//  1) iweke kwenye folda public/images/ (mf. library.jpg)
//  2) badilisha "src" hapa chini kuwa '/images/library.jpg'
// "position" inachagua sehemu ya picha itakayoonekana (object-position).
export type ImageKey =
  | 'library'
  | 'communities'
  | 'opportunities'
  | 'applications'
  | 'learn'
  | 'admin'

export const PAGE_IMAGES: Record<ImageKey, { src: string; position: string }> = {
  library: { src: '/images/library-shelf.jpg', position: 'center 45%' },
  communities: { src: '/images/community-globe.jpg', position: 'center 55%' },
  opportunities: { src: '/images/ego-sunrise.jpg', position: 'center 15%' },
  applications: { src: '/images/study-desk.jpg', position: 'right 35%' },
  learn: { src: '/images/learn-hologram.jpg', position: 'right center' },
  admin: { src: '/images/hero-desk.jpg', position: 'center' },
}
