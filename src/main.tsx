import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import './index.css'
import App from './App'
import { Analytics } from "@vercel/analytics/react"

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined

const root = createRoot(document.getElementById('root')!)

if (!convexUrl) {
  root.render(
    <StrictMode>
      <div className="login-container">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div className="login-logo">🔌</div>
          <h1 className="login-title">System Not Connected</h1>
          <p className="login-subtitle" style={{ marginTop: 8 }}>
            Mission Control requires a Convex backend to function.
          </p>
          <div style={{
            marginTop: 20,
            padding: '14px 18px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            textAlign: 'left',
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.8,
          }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Setup required:</div>
            <div>1. Set <code style={{ background: 'var(--bg-glass)', padding: '2px 6px', borderRadius: 4 }}>VITE_CONVEX_URL</code> environment variable</div>
            <div>2. Redeploy the application</div>
          </div>
          <p style={{ marginTop: 16, fontSize: 11, color: 'var(--text-tertiary)' }}>
            Run <code style={{ background: 'var(--bg-glass)', padding: '2px 6px', borderRadius: 4 }}>npx convex dev</code> locally to get your URL
          </p>
        </div>
      </div>
    </StrictMode>
  )
} else {
  const convex = new ConvexReactClient(convexUrl)
  root.render(
    <StrictMode>
      <ConvexProvider client={convex}>
        <App />
      </ConvexProvider>
    
        <Analytics />
      </StrictMode>,
  )
}

