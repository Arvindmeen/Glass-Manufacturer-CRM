import { useT } from '../i18n'
import { Sheet } from './ui'

export function VoiceCommand({ onClose }: { onClose: () => void }) {
  const t = useT()
  return <Sheet title={t('voice.start')} onClose={onClose}>{null}</Sheet>
}
