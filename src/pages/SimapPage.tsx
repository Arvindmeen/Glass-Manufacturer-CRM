import { useT } from '../i18n'
import { PageHead } from '../components/ui'

export function SimapPage() {
  const t = useT()
  return <PageHead title={t('nav.simap')} />
}
