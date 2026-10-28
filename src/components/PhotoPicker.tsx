import { useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { useT } from '../i18n'
import { compressImage } from '../lib/image'
import { toast } from './ui'

/** Button that takes a photo (camera on phones) or picks one from the gallery, compressed on the device. */
export function PhotoPicker({
  onPhotos,
  multiple,
  label,
  iconOnly,
}: {
  onPhotos: (dataUrls: string[]) => void
  multiple?: boolean
  label?: string
  iconOnly?: boolean
}) {
  const t = useT()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const pick = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try {
      const out: string[] = []
      for (const f of Array.from(files).slice(0, 8)) out.push(await compressImage(f))
      onPhotos(out)
    } catch {
      toast(t('kb.photoError'))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple={multiple}
        hidden
        onChange={(e) => void pick(e.target.files)}
      />
      <button
        type="button"
        className={iconOnly ? 'btn icon' : 'btn small'}
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={label ?? t('kb.addPhoto')}
      >
        {busy ? <Loader2 size={16} className="spin" /> : <Camera size={16} />}
        {!iconOnly && (label ?? t('kb.addPhoto'))}
      </button>
    </>
  )
}
