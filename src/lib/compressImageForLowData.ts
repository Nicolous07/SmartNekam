export async function compressImageForLowData(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file

  try {
    const bitmap = await createImageBitmap(file)
    const maxDimension = 1280
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 450 * 1024) {
      bitmap.close()
      return file
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return file
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.78))
    if (!blob || blob.size >= file.size) return file

    const extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/png' ? 'png' : 'webp'
    const baseName = file.name.replace(/\\.[^.]+$/, '') || 'smartnekam-image'
    return new File([blob], `${baseName}.${extension}`, {
      type: blob.type || 'image/webp',
      lastModified: Date.now(),
    })
  } catch {
    // Unsupported formats or older browsers fall back to the original file.
    return file
  }
}
