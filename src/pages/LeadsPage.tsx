import { useT } from '../i18n'
import { PageHead } from '../components/ui'

export function LeadsPage() {
  const t = useT()
  return <PageHead title={t('nav.leads')} />
}
