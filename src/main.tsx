import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.tsx'
import TodayPage from './routes/TodayPage.tsx'
import DogsPage from './routes/DogsPage.tsx'
import VisitPage from './routes/VisitPage.tsx'
import SettingsPage from './routes/SettingsPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<TodayPage />} />
          <Route path="today" element={<TodayPage />} />
          <Route path="dogs" element={<DogsPage />} />
          <Route path="visit/:id" element={<VisitPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
