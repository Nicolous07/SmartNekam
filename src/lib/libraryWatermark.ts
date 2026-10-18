'use client'

const LOGO_URL = '/images/smartnekam-logo.png'
const WORD_REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

function extensionOf(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

function xmlEscape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function loadLogoBytes() {
  const response = await fetch(LOGO_URL, { cache: 'force-cache' })
  if (!response.ok) throw new Error('Imeshindikana kupakia nembo rasmi ya SmartNekam kwa ajili ya watermark.')
  return new Uint8Array(await response.arrayBuffer())
}

function filenameSafe(value: string) {
  return value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'SmartNekam-resource'
}

async function watermarkPdf(input: Blob, logoBytes: Uint8Array) {
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.load(await input.arrayBuffer())
  const logo = await pdf.embedPng(logoBytes)
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize()
    const targetWidth = Math.min(width * 0.38, 250)
    const targetHeight = targetWidth * (logo.height / logo.width)
    page.drawImage(logo, {
      x: (width - targetWidth) / 2,
      y: (height - targetHeight) / 2,
      width: targetWidth,
      height: targetHeight,
      opacity: 0.14,
    })
  }
  const saved = await pdf.save()
  const savedBuffer = new Uint8Array(saved).buffer as ArrayBuffer
  return new Blob([savedBuffer], { type: 'application/pdf' })
}

async function watermarkImage(input: Blob, ext: string, logoBytes: Uint8Array) {
  if (typeof createImageBitmap !== 'function') throw new Error('Kivinjari hiki hakiwezi kuweka watermark kwenye picha. Tumia Chrome, Edge, Firefox au Safari ya kisasa.')
  const source = await createImageBitmap(input)
  const logoBuffer = new ArrayBuffer(logoBytes.byteLength)
  new Uint8Array(logoBuffer).set(logoBytes)
  const logoBlob = new Blob([logoBuffer], { type: 'image/png' })
  const watermark = await createImageBitmap(logoBlob)
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Imeshindikana kuandaa picha kwa watermark.')
  context.drawImage(source, 0, 0, source.width, source.height)
  const width = Math.min(source.width * 0.34, 560)
  const height = width * (watermark.height / watermark.width)
  context.save()
  context.globalAlpha = 0.19
  context.drawImage(watermark, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
  context.restore()
  source.close()
  watermark.close()
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png'
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Imeshindikana kutengeneza picha yenye watermark.')), mime, 0.94)
  })
  return { blob, extension: ext === 'gif' ? 'png' : ext }
}

async function watermarkDocx(input: Blob, logoBytes: Uint8Array) {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(input)
  const documentFile = zip.file('word/document.xml')
  if (!documentFile) throw new Error('Faili la Word halina muundo unaotarajiwa.')
  let documentXml = await documentFile.async('string')
  let documentRels = await zip.file('word/_rels/document.xml.rels')?.async('string')
    ?? '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
  let contentTypes = await zip.file('[Content_Types].xml')?.async('string')
  if (!contentTypes) throw new Error('Faili la Word halina Content Types metadata.')

  const relationships = [...documentRels.matchAll(/<Relationship\b([^>]*?)\/?\s*>/g)].map((match) => {
    const attrs = match[1]
    const get = (name: string) => attrs.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1] ?? ''
    return { id: get('Id'), type: get('Type'), target: get('Target') }
  })
  const mappedHeaders = [...documentXml.matchAll(/<w:headerReference\b([^>]*?)\/?\s*>/g)].map((match) => {
    const rid = match[1].match(/\br:id="([^"]+)"/)?.[1]
    const relation = relationships.find((item) => item.id === rid && item.type.endsWith('/header'))
    if (!rid || !relation?.target) return null
    const parts: string[] = []
    const path = `word/${relation.target}`
    for (const part of path.split('/')) {
      if (!part || part === '.') continue
      if (part === '..') parts.pop()
      else parts.push(part)
    }
    const headerPath = parts.join('/')
    const headerFile = zip.file(headerPath)
    return headerFile ? { headerPath, headerName: headerPath.split('/').pop()!, headerRelsPath: `${headerPath.slice(0, headerPath.lastIndexOf('/') + 1)}_rels/${headerPath.split('/').pop()}.rels` } : null
  })
  const existingHeaders = mappedHeaders.filter((item) => item !== null) as Array<{ headerPath: string; headerName: string; headerRelsPath: string }>

  const uniqueHeaders = [...new Map(existingHeaders.map((item) => [item.headerPath, item])).values()]
  const watermarkParagraph = (id: string) => `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:pict><v:shapetype id="_x0000_t75" coordsize="21600,21600" o:spt="75" o:preferrelative="t" path="m@4@5l@4@11@9@11@9@5xe" filled="f" stroked="f"><v:stroke joinstyle="miter"/><v:formulas><v:f eqn="if lineDrawn pixelLineWidth 0"/><v:f eqn="sum @0 1 0"/><v:f eqn="sum 0 0 @1"/><v:f eqn="prod @2 1 2"/><v:f eqn="prod @3 21600 pixelWidth"/><v:f eqn="prod @3 21600 pixelHeight"/><v:f eqn="sum @0 0 1"/><v:f eqn="prod @6 1 2"/><v:f eqn="prod @7 21600 pixelWidth"/><v:f eqn="sum @8 21600 0"/><v:f eqn="prod @7 21600 pixelHeight"/><v:f eqn="sum @10 21600 0"/></v:formulas><v:path o:extrusionok="f" gradientshapeok="t" o:connecttype="rect"/><o:lock v:ext="edit" aspectratio="t"/></v:shapetype><v:shape id="SmartNekamWatermark" type="#_x0000_t75" style="position:absolute;margin-left:0;margin-top:0;width:250pt;height:228pt;z-index:-251654144;mso-position-horizontal:center;mso-position-horizontal-relative:margin;mso-position-vertical:center;mso-position-vertical-relative:page" o:allowincell="f" stroked="f"><v:fill opacity="14%"/><v:imagedata r:id="${id}" o:title="SmartNekam"/><w10:wrap type="none"/></v:shape></w:pict></w:r></w:p>`
  const ensureNamespaces = (xml: string) => xml.replace(/<w:hdr\b([^>]*)>/, (opening: string) => {
    let result = opening
    if (!/xmlns:r=/.test(result)) result = result.replace('<w:hdr', `<w:hdr xmlns:r="${WORD_REL_NS}"`)
    if (!/xmlns:v=/.test(result)) result = result.replace('<w:hdr', '<w:hdr xmlns:v="urn:schemas-microsoft-com:vml"')
    if (!/xmlns:o=/.test(result)) result = result.replace('<w:hdr', '<w:hdr xmlns:o="urn:schemas-microsoft-com:office:office"')
    if (!/xmlns:w10=/.test(result)) result = result.replace('<w:hdr', '<w:hdr xmlns:w10="urn:schemas-microsoft-com:office:word"')
    return result
  })
  const addImageRelationship = (existing: string | null, imageTarget: string) => {
    let rels = existing ?? '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
    let rid = 'rIdSmartNekamLogo'
    let suffix = 1
    while (rels.includes(`Id="${rid}"`)) rid = `rIdSmartNekamLogo${suffix++}`
    rels = rels.replace('</Relationships>', `<Relationship Id="${rid}" Type="${WORD_REL_NS}/image" Target="${imageTarget}"/></Relationships>`)
    return { rels, rid }
  }

  if (uniqueHeaders.length) {
    for (const header of uniqueHeaders) {
      let headerXml = await zip.file(header.headerPath)!.async('string')
      if (headerXml.includes('SmartNekamWatermark')) continue
      const relsExisting = await zip.file(header.headerRelsPath)?.async('string') ?? null
      const relationship = addImageRelationship(relsExisting, 'media/smartnekam-watermark.png')
      headerXml = ensureNamespaces(headerXml)
      if (!/<\/w:hdr>/i.test(headerXml)) throw new Error('Header ya Word haijakamilika; watermark haikuwekwa.')
      headerXml = headerXml.replace(/<\/w:hdr>/i, `${watermarkParagraph(relationship.rid)}</w:hdr>`)
      zip.file(header.headerPath, headerXml)
      zip.file(header.headerRelsPath, relationship.rels)
    }
  } else {
    const headerId = 'rIdSmartNekamWatermark'
    const headerName = 'headerSmartNekamWatermark.xml'
    documentRels = documentRels.replace(/<\/Relationships>/, `<Relationship Id="${headerId}" Type="${WORD_REL_NS}/header" Target="${headerName}"/></Relationships>`)
    if (!/xmlns:r=/.test(documentXml)) documentXml = documentXml.replace(/<w:document\b/, '<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"')
    if (!/<w:sectPr\b/.test(documentXml)) {
      documentXml = documentXml.replace('</w:body>', '<w:sectPr><w:headerReference w:type="default" r:id="' + headerId + '"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body>')
    } else {
      documentXml = documentXml.replace(/<w:sectPr\b[^>]*>/g, (opening) => `${opening}<w:headerReference w:type="default" r:id="${headerId}"/>`)
    }
    const headerRelationship = 'rIdSmartNekamLogo'
    const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="${WORD_REL_NS}" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w10="urn:schemas-microsoft-com:office:word">${watermarkParagraph(headerRelationship)}</w:hdr>`
    const headerRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="${headerRelationship}" Type="${WORD_REL_NS}/image" Target="media/smartnekam-watermark.png"/></Relationships>`
    zip.file('word/document.xml', documentXml)
    zip.file('word/_rels/document.xml.rels', documentRels)
    zip.file(`word/${headerName}`, header)
    zip.file('word/_rels/headerSmartNekamWatermark.xml.rels', headerRels)
    if (!contentTypes.includes(`/word/${headerName}`)) contentTypes = contentTypes.replace('</Types>', `<Override PartName="/word/${headerName}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>`)
  }

  if (!/<Default\s+[^>]*Extension="png"/i.test(contentTypes)) contentTypes = contentTypes.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>')
  zip.file('word/media/smartnekam-watermark.png', logoBytes)
  zip.file('[Content_Types].xml', contentTypes)
  return new Blob([await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
}
async function watermarkPptx(input: Blob, logoBytes: Uint8Array) {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(input)
  let contentTypes = await zip.file('[Content_Types].xml')?.async('string')
  if (!contentTypes) throw new Error('Faili la PowerPoint halina Content Types metadata.')
  if (!/<Default\s+[^>]*Extension="png"/i.test(contentTypes)) contentTypes = contentTypes.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>')
  zip.file('[Content_Types].xml', contentTypes)
  zip.file('ppt/media/smartnekam-watermark.png', logoBytes)

  const slidePaths = Object.keys(zip.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
  if (!slidePaths.length) throw new Error('Hakuna slide zilizopatikana ndani ya PowerPoint.')
  for (const slidePath of slidePaths) {
    const slideFile = zip.file(slidePath)
    if (!slideFile) continue
    let xml = await slideFile.async('string')
    const slideBase = slidePath.split('/').pop()!
    const relPath = `ppt/slides/_rels/${slideBase}.rels`
    let rels = await zip.file(relPath)?.async('string')
      ?? '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
    const rid = 'rIdSmartNekamWatermark'
    rels = rels.replace(/<\/Relationships>/, `<Relationship Id="${rid}" Type="${WORD_REL_NS}/image" Target="../media/smartnekam-watermark.png"/></Relationships>`)
    const ids = [...xml.matchAll(/\bid="(\d+)"/g)].map((match) => Number(match[1])).filter(Number.isFinite)
    const shapeId = Math.max(2, ...ids) + 1
    const picture = `<p:pic><p:nvPicPr><p:cNvPr id="${shapeId}" name="SmartNekam watermark"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"><a:alphaModFix amt="14000"/></a:blip><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="4114800" y="2286000"/><a:ext cx="3200000" cy="2920000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:ln><a:noFill/></a:ln></p:spPr></p:pic>`
    if (!xml.includes('</p:spTree>')) throw new Error(`Slide haijakamilika: ${slideBase}`)
    xml = xml.replace('</p:spTree>', `${picture}</p:spTree>`)
    zip.file(slidePath, xml)
    zip.file(relPath, rels)
  }
  const archive = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
  return new Blob([archive], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })
}

async function watermarkEpub(input: Blob, logoBytes: Uint8Array) {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(input)
  const opfPath = Object.keys(zip.files).find((path) => path.toLowerCase().endsWith('.opf'))
  if (!opfPath) throw new Error('Faili la EPUB halina metadata ya kitabu (OPF).')
  const opfDir = opfPath.split('/').slice(0, -1).join('/')
  const imagePath = [opfDir, 'smartnekam-watermark.png'].filter(Boolean).join('/')
  let opf = await zip.file(opfPath)!.async('string')
  if (!/id=["']smartnekam-watermark["']/.test(opf)) opf = opf.replace('</manifest>', '<item id="smartnekam-watermark" href="smartnekam-watermark.png" media-type="image/png"/></manifest>')
  zip.file(opfPath, opf)
  zip.file(imagePath, logoBytes)

  const pages = Object.keys(zip.files).filter((path) => /\.(xhtml|html?)$/i.test(path) && !zip.files[path].dir)
  for (const pagePath of pages) {
    const pageFile = zip.file(pagePath)
    if (!pageFile) continue
    let xml = await pageFile.async('string')
    if (xml.includes('id="smartnekam-watermark-overlay"')) continue
    const pageDir = pagePath.split('/').slice(0, -1).join('/')
    const imageRef = relativePosixPath(pageDir, imagePath)
    const overlay = `<div id="smartnekam-watermark-overlay" aria-hidden="true" style="position:fixed;top:34%;left:21%;width:58%;z-index:2147483000;opacity:0.12;pointer-events:none;text-align:center"><img src="${xmlEscape(imageRef)}" alt="SmartNekam watermark" style="width:100%;height:auto"/></div>`
    if (/<\/body>/i.test(xml)) xml = xml.replace(/<\/body>/i, `${overlay}</body>`)
    else if (/<\/html>/i.test(xml)) xml = xml.replace(/<\/html>/i, `${overlay}</html>`)
    zip.file(pagePath, xml)
  }
  // EPUB requires the `mimetype` entry to remain first and uncompressed.
  if (!zip.file('mimetype')) throw new Error('Faili la EPUB halina sehemu ya mimetype; haliwezi kuwekewa watermark kwa usalama.')
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  const archive = await zip.generateAsync({ type: 'arraybuffer' })
  return new Blob([archive], { type: 'application/epub+zip' })
}

function relativePosixPath(from: string, to: string) {
  const fromParts = from ? from.split('/') : []
  const toParts = to ? to.split('/') : []
  while (fromParts.length && toParts.length && fromParts[0] === toParts[0]) {
    fromParts.shift()
    toParts.shift()
  }
  return [...fromParts.map(() => '..'), ...toParts].join('/') || './'
}

export async function watermarkLibraryDownload(input: Blob, fileName: string) {
  const ext = extensionOf(fileName)
  const logoBytes = await loadLogoBytes()
  let blob = input
  let outputName = filenameSafe(fileName)

  if (ext === 'pdf') blob = await watermarkPdf(input, logoBytes)
  else if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
    const result = await watermarkImage(input, ext, logoBytes)
    blob = result.blob
    if (result.extension !== ext) outputName = `${filenameSafe(fileName.replace(/\.[^.]+$/, ''))}.${result.extension}`
  } else if (ext === 'docx') blob = await watermarkDocx(input, logoBytes)
  else if (ext === 'pptx') blob = await watermarkPptx(input, logoBytes)
  else if (ext === 'epub') blob = await watermarkEpub(input, logoBytes)
  else throw new Error(`Watermark haijawezeshwa kwa aina ya faili .${ext}. Pakia nyenzo kama PDF, DOCX, PPTX, EPUB au picha.`)

  return { blob, fileName: outputName }
}
