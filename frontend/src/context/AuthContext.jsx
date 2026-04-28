import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supplyChainApi } from '../services/api'

const AuthContext = createContext(null)
const STORAGE_KEY = 'ssc.currentUserId'

export function AuthProvider({ children }) {
  const [users, setUsers] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function loadUsers() {
      setLoading(true)
      const result = await supplyChainApi.getDevUsers()
      if (!mounted) return
      const loadedUsers = result.users || []
      const storedId = localStorage.getItem(STORAGE_KEY)
      const selected = storedId ? loadedUsers.find((user) => user.id === storedId) : null
      setUsers(loadedUsers)
      setCurrentUser(selected || null)
      setLoading(false)
    }
    loadUsers()
    return () => {
      mounted = false
    }
  }, [])

  const value = useMemo(() => {
    const completeLogin = (user) => {
      if (!user) return
      localStorage.setItem(STORAGE_KEY, user.id)
      setCurrentUser(user)
      window.dispatchEvent(new Event('ssc:user-changed'))
    }

    const login = async (credentials) => {
      const result = await supplyChainApi.login(credentials)
      if (result.authenticated && result.user) {
        completeLogin(result.user)
      }
      return result
    }

    const logout = () => {
      localStorage.removeItem(STORAGE_KEY)
      setCurrentUser(null)
      window.dispatchEvent(new Event('ssc:user-changed'))
    }

    const hasRole = (...roles) => roles.includes(currentUser?.role)

    return {
      users,
      currentUser,
      loading,
      login,
      logout,
      hasRole,
    }
  }, [currentUser, loading, users])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return value
}

export function getStoredUserId() {
  return localStorage.getItem(STORAGE_KEY) || 'USR-ADMIN-001'
}
