import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

const pageTitles = {
  '/': 'Dashboard',
  '/simulator': 'What-If Simulator',
  '/analytics': 'Analytics',
}

export default function Layout({ children }) {
  const location = useLocation()
  const path = location.pathname
  const title = path.startsWith('/shipment') 
    ? 'Shipment Detail' 
    : pageTitles[path] || 'Dashboard'

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Header title={title} />
        <div className="page-content">
          {children}
        </div>
      </div>
    </div>
  )
}
