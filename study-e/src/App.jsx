import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Login } from './pages/auth/Login'
import { SignUp } from './pages/auth/SignUp'
import { Home } from './pages/Home'
import { Room } from './pages/Room'
import { supabase } from './lib/supabase'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return null
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            session ? <Home /> : <Navigate to="/login" />
          }
        />
        <Route
          path="/room/:id"
          element={
            session ? <Room /> : <Navigate to="/login" />
          }
        />
        <Route
          path="/login"
          element={session ? <Navigate to="/" /> : <Login />}
        />
        <Route
          path="/signup"
          element={session ? <Navigate to="/" /> : <SignUp />}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
