import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Simulator = lazy(() => import('./pages/Simulator'))
const Analytics = lazy(() => import('./pages/Analytics'))
const ShipmentDetail = lazy(() => import('./pages/ShipmentDetail'))
const Contracts = lazy(() => import('./pages/Contracts'))
const ContractDetail = lazy(() => import('./pages/ContractDetail'))

const simulatorRoles = ['admin', 'supply_chain_manager', 'warehouse_manager', 'distributor_manager', 'carrier_partner', 'analyst']
const contractRoles = ['admin', 'supply_chain_manager', 'warehouse_manager', 'distributor_manager', 'retailer_receiver', 'driver', 'carrier_partner', 'analyst']

function AccessDenied() {
  return (
    <div className="card access-denied-card">
      <h2>Access limited for this role</h2>
      <p>
        This page is restricted by backend authorization. Your role can still use the dashboard
        and shipment views that are relevant to your operational scope.
      </p>
    </div>
  )
}

function ProtectedPage({ roles, children }) {
  const { currentUser, loading } = useAuth()
  if (loading) {
    return <div className="card">Loading user scope...</div>
  }
  if (!roles.includes(currentUser?.role)) {
    return <AccessDenied />
  }
  return children
}

function App() {
  const { currentUser, loading } = useAuth()

  if (loading) {
    return (
      <div className="login-page">
        <div className="card" style={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
          Loading secure workspace...
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return <Login />
  }

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
          <Route path="/simulator" element={<ProtectedPage roles={simulatorRoles}><Simulator /></ProtectedPage>} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/contracts" element={<ProtectedPage roles={contractRoles}><Contracts /></ProtectedPage>} />
          <Route path="/contracts/:id" element={<ProtectedPage roles={contractRoles}><ContractDetail /></ProtectedPage>} />
          <Route path="/shipment/:id" element={<ShipmentDetail />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}

export default App
