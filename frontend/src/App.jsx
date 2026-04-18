import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Simulator = lazy(() => import('./pages/Simulator'))
const Analytics = lazy(() => import('./pages/Analytics'))
const ShipmentDetail = lazy(() => import('./pages/ShipmentDetail'))

function App() {
  return (
    <Layout>
      <Suspense
        fallback={
          <div className="card" style={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
            Loading page...
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/shipment/:id" element={<ShipmentDetail />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}

export default App
