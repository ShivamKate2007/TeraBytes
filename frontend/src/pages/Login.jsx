import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'

const userTypeOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'User' },
]

export default function Login() {
  const { users, login } = useAuth()
  const [userType, setUserType] = useState('admin')
  const [role, setRole] = useState('admin')
  const [email, setEmail] = useState('admin@ssc.local')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const roles = useMemo(() => {
    const filtered = users.filter((user) => (user.role === 'admin' ? 'admin' : 'user') === userType)
    return filtered.map((user) => ({
      value: user.role,
      label: user.roleLabel || user.role,
      email: user.email,
    }))
  }, [userType, users])

  useEffect(() => {
    const first = roles[0]
    if (!first) return
    setRole(first.value)
    setEmail(first.email)
  }, [roles])

  useEffect(() => {
    const selected = roles.find((item) => item.value === role)
    if (selected) {
      setEmail(selected.email)
    }
  }, [role, roles])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    const result = await login({ userType, role, email, password })
    setSubmitting(false)
    if (!result.authenticated) {
      setError(result.error || 'Login failed')
    }
  }

  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="login-brand">
          <div className="login-logo">🚛</div>
          <div>
            <h1>Smart Supply Chain</h1>
            <p>Resilient logistics command center</p>
          </div>
        </div>

        <div className="login-copy">
          <span className="login-kicker">Phase 9A/9B</span>
          <h2>Role-aware access for every supply-chain partner.</h2>
          <p>
            Admins, managers, carriers, drivers, retailers, and analysts enter the same
            platform, but each sees only the shipments, routes, and actions they are
            responsible for.
          </p>
        </div>
      </section>

      <section className="login-card">
        <div className="login-card-header">
          <h2>Sign in</h2>
          <p>Use seeded demo credentials while Firebase Auth is prepared.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            User Type
            <div className="login-segment">
              {userTypeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={userType === option.value ? 'active' : ''}
                  onClick={() => setUserType(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </label>

          <label>
            Role
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              {roles.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </label>

          <label>
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="demo123"
            />
          </label>

          <div className="login-hint">Demo password for every seeded role: <strong>demo123</strong></div>
          {error && <div className="login-error">{error}</div>}

          <button className="login-submit" type="submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Enter Control Tower'}
          </button>
        </form>
      </section>
    </main>
  )
}
