import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import VerifyCertificate from './pages/VerifyCertificate'
import Spinner from './components/ui/Spinner'

// Lazy load pages for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Students = lazy(() => import('./pages/Students'))
const Teachers = lazy(() => import('./pages/Teachers'))
const Courses = lazy(() => import('./pages/Courses'))
const Messages = lazy(() => import('./pages/Messages'))
const Attendance = lazy(() => import('./pages/Attendance'))
const Grades = lazy(() => import('./pages/Grades'))
const Announcements = lazy(() => import('./pages/Announcements'))
const Profile = lazy(() => import('./pages/Profile'))

// New modules
const Languages = lazy(() => import('./pages/Languages'))
const Levels = lazy(() => import('./pages/Levels'))
const Skills = lazy(() => import('./pages/Skills'))
const Groups = lazy(() => import('./pages/Groups'))
const Sessions = lazy(() => import('./pages/Sessions'))
const Certificates = lazy(() => import('./pages/Certificates'))
const Documents = lazy(() => import('./pages/Documents'))
const Notifications = lazy(() => import('./pages/Notifications'))
const PaymentReceipt = lazy(() => import('./pages/PaymentReceipt'))

function PrivateRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" />
  }

  return children
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  )
}

// Wrap a page in Suspense + optional role guard
function guarded(Component, allowedRoles) {
  const element = (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  )

  if (!allowedRoles) return element

  return <PrivateRoute allowedRoles={allowedRoles}>{element}</PrivateRoute>
}

function App() {
  return (
    <ToastProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/verify/certificate/:code" element={<VerifyCertificate />} />
        {/* Printable payment receipt: standalone so it prints without the layout */}
        <Route
          path="/payments/:id/receipt"
          element={
            <PrivateRoute allowedRoles={['admin', 'teacher']}>
              <Suspense fallback={<PageLoader />}>
                <PaymentReceipt />
              </Suspense>
            </PrivateRoute>
          }
        />

        {/* Authenticated app */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={guarded(Dashboard)} />
          <Route path="students" element={guarded(Students, ['admin', 'teacher'])} />
          <Route path="teachers" element={guarded(Teachers, ['admin', 'teacher'])} />
          <Route path="courses" element={guarded(Courses)} />
          <Route path="groups" element={guarded(Groups)} />
          <Route path="sessions" element={guarded(Sessions)} />
          <Route path="certificates" element={guarded(Certificates, ['admin'])} />
          <Route path="documents" element={guarded(Documents, ['admin'])} />
          <Route path="messages" element={guarded(Messages)} />
          <Route path="attendance" element={guarded(Attendance, ['admin', 'teacher'])} />
          <Route path="grades" element={guarded(Grades)} />
          <Route path="announcements" element={guarded(Announcements)} />
          <Route path="notifications" element={guarded(Notifications)} />
          <Route path="profile" element={guarded(Profile)} />

          {/* Administration */}
          <Route path="languages" element={guarded(Languages, ['admin'])} />
          <Route path="levels" element={guarded(Levels, ['admin'])} />
          <Route path="skills" element={guarded(Skills, ['admin'])} />

          {/* Unknown paths fall back to the dashboard instead of a blank page */}
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Route>
      </Routes>
    </ToastProvider>
  )
}

export default App