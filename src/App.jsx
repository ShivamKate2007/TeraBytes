import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';

// Import global styles
import './styles/index.css';
import './styles/layout.css';
import './styles/dashboard.css';
import './styles/simulator.css';
import './styles/analytics.css';
import './styles/components.css';

// ─── Lazy-load pages for faster initial bundle ─────────────────
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const Simulator     = lazy(() => import('./pages/Simulator'));
const Analytics     = lazy(() => import('./pages/Analytics'));
const ShipmentDetail = lazy(() => import('./pages/ShipmentDetail'));

// Minimal inline loader — no extra component to download
function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '60vh',
      flexDirection: 'column',
      gap: '16px',
    }}>
      <div style={{
        width: '36px',
        height: '36px',
        border: '3px solid rgba(99,102,241,0.2)',
        borderTopColor: '#6366f1',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Loading…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="simulator" element={<Simulator />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="shipments/:id" element={<ShipmentDetail />} />
            <Route path="*" element={
              <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                <div style={{ fontSize: '64px', marginBottom: '16px' }}>🌐</div>
                <h2 style={{ color: 'var(--color-text-primary)', marginBottom: '8px' }}>Page Not Found</h2>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px' }}>This route doesn't exist yet.</p>
                <a href="/" className="btn btn-primary">Back to Dashboard</a>
              </div>
            } />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
