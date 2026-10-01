import { lazy, Suspense } from 'react'
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'

const Router = import.meta.env.VITE_HASH_ROUTER ? HashRouter : BrowserRouter
import { AuthProvider } from '@/context/AuthContext'
import { LocationProvider } from '@/context/LocationContext'
import { UserDataProvider } from '@/context/UserDataContext'
import { NotificationsProvider } from '@/context/NotificationsContext'
import { ToastProvider } from '@/components/ui/toast'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ProtectedRoute, PublicOnlyRoute, RequireRole } from '@/components/layout/RouteGuards'
import { AppLayout } from '@/components/layout/AppLayout'
import { SplashScreen } from '@/components/layout/PageFallback'
import HomePage from '@/pages/Home'

// Everything behind the landing page is code-split so the first paint stays fast.
const LoginPage = lazy(() => import('@/pages/Login'))
const SignupPage = lazy(() => import('@/pages/Signup'))
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPassword'))
const TrackPage = lazy(() => import('@/pages/Track'))
const DashboardPage = lazy(() => import('@/pages/Dashboard'))
const LiveMapPage = lazy(() => import('@/pages/LiveMap'))
const RoutesPage = lazy(() => import('@/pages/Routes'))
const BusesPage = lazy(() => import('@/pages/Buses'))
const BusDetailsPage = lazy(() => import('@/pages/BusDetails'))
const FavoritesPage = lazy(() => import('@/pages/Favorites'))
const NotificationsPage = lazy(() => import('@/pages/Notifications'))
const ProfilePage = lazy(() => import('@/pages/Profile'))
const DriverPage = lazy(() => import('@/pages/driver/Driver'))
const OperatorLayout = lazy(() => import('@/pages/operator/OperatorLayout').then((m) => ({ default: m.OperatorLayout })))
const OpOverview = lazy(() => import('@/pages/operator/Overview'))
const OpFleet = lazy(() => import('@/pages/operator/Fleet'))
const OpRoutes = lazy(() => import('@/pages/operator/RoutesStops'))
const OpAlerts = lazy(() => import('@/pages/operator/Alerts'))
const OpTrips = lazy(() => import('@/pages/operator/Trips'))
const OpAnalytics = lazy(() => import('@/pages/operator/Analytics'))
const OpUsers = lazy(() => import('@/pages/operator/Users'))
const StopPage = lazy(() => import('@/pages/StopPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFound'))

export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
      <Router>
        <ToastProvider>
          <AuthProvider>
            <LocationProvider>
              <UserDataProvider>
                <NotificationsProvider>
                  <Suspense fallback={<SplashScreen />}>
                    <Routes>
                      <Route path="/" element={<HomePage />} />

                      {/* Public: QR links land here and expose bus data only. */}
                      <Route path="/track/:id" element={<TrackPage />} />

                      <Route element={<PublicOnlyRoute />}>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<SignupPage />} />
                        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                      </Route>

                      {/* Private: requires a session. Server must still authorise every API request. */}
                      <Route element={<ProtectedRoute />}>
                        <Route path="/app" element={<AppLayout />}>
                          <Route index element={<DashboardPage />} />
                          <Route path="map" element={<LiveMapPage />} />
                          <Route path="routes" element={<RoutesPage />} />
                          <Route path="buses" element={<BusesPage />} />
                          <Route path="buses/:id" element={<BusDetailsPage />} />
                          <Route path="stops/:id" element={<StopPage />} />
                          <Route path="favorites" element={<FavoritesPage />} />
                          <Route path="notifications" element={<NotificationsPage />} />
                          <Route path="profile" element={<ProfilePage />} />
                          <Route path="*" element={<NotFoundPage />} />
                        </Route>
                      </Route>

                      <Route element={<ProtectedRoute />}>
                        <Route element={<RequireRole role="driver" />}>
                          <Route path="/driver" element={<DriverPage />} />
                        </Route>
                        <Route element={<RequireRole role={['operator', 'admin']} />}>
                          <Route path="/operator" element={<OperatorLayout />}>
                            <Route index element={<OpOverview />} />
                            <Route path="fleet" element={<OpFleet />} />
                            <Route path="routes" element={<OpRoutes />} />
                            <Route path="alerts" element={<OpAlerts />} />
                            <Route path="trips" element={<OpTrips />} />
                            <Route path="analytics" element={<OpAnalytics />} />
                            <Route path="users" element={<RequireRole role="admin" />}>
                              <Route index element={<OpUsers />} />
                            </Route>
                            <Route path="*" element={<NotFoundPage />} />
                          </Route>
                        </Route>
                      </Route>

                      <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                  </Suspense>
                </NotificationsProvider>
              </UserDataProvider>
            </LocationProvider>
          </AuthProvider>
        </ToastProvider>
      </Router>
      </MotionConfig>
    </ErrorBoundary>
  )
}
