import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { CompaniesPage } from './pages/CompaniesPage'
import { CompanyPage } from './pages/CompanyPage'
import { PeoplePage } from './pages/PeoplePage'
import { PersonPage } from './pages/PersonPage'
import { TasksPage } from './pages/TasksPage'
import { KnowledgePage } from './pages/KnowledgePage'
import { InboxPage } from './pages/InboxPage'
import { LeadsPage } from './pages/LeadsPage'
import { SimapPage } from './pages/SimapPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/companies" replace />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="companies/:id" element={<CompanyPage />} />
        <Route path="people" element={<PeoplePage />} />
        <Route path="people/:id" element={<PersonPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="knowledge/*" element={<KnowledgePage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="inbox/:id" element={<InboxPage />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="simap" element={<SimapPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/companies" replace />} />
      </Route>
    </Routes>
  )
}
