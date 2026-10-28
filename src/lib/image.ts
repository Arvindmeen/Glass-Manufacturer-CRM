/**
 * Downscale and re-encode a photo on the device before it is stored, so a phone picture
 * (several MB) becomes ~100 KB. Re-encoding through a canvas also drops EXIF data
 * such as the GPS position.
 */
export async function compressImage(file: File, maxSide = 1280, quality = 0.75): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not-an-image')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', quality)
}

/** Only images we produced ourselves are ever rendered. */
export const isSafeImage = (src?: string) => !!src && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src)
