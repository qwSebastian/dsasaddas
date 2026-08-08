import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Apply the saved theme before the first paint so the page never flashes the
// wrong palette while React boots.
document.documentElement.setAttribute(
  'data-theme',
  localStorage.getItem('ev_theme') === 'light' ? 'light' : 'dark',
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
