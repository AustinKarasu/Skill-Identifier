import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import AdminLayout from './components/layout/AdminLayout'
import DashboardOverview from './components/dashboard/DashboardOverview'
import EmployeeManagement from './components/dashboard/EmployeeManagement'
import RoleManagement from './components/dashboard/RoleManagement'
import Assessments from './components/dashboard/Assessments'
import Interviews from './components/dashboard/Interviews'
import AuditLogs from './components/dashboard/AuditLogs'
import Reports from './components/dashboard/Reports'
import Leaderboard from './components/dashboard/Leaderboard'
import Settings from './components/dashboard/Settings'
import ResumeReview from './components/dashboard/ResumeReview'
import AssessmentEngine from './components/dashboard/AssessmentEngine'
import ManagerOps from './components/dashboard/ManagerOps'
import PublicOnlyRoute from './components/routing/PublicOnlyRoute'
import RoleProtectedRoute from './components/routing/RoleProtectedRoute'
import AuthShell from './Login/AuthShell'
import ManagerLogin from './Login/ManagerLogin'
import EmployeeAuth from './Login/EmployeeAuth'
import EmployeeLayout from './EmployeeFE/EmployeeLayout'
import EmployeeOnboarding from './EmployeeFE/EmployeeOnboarding'
import EmployeeInterview from './EmployeeFE/EmployeeInterview'
import EmployeeReport from './EmployeeFE/EmployeeReport'
import EmployeeReportHistory from './EmployeeFE/EmployeeReportHistory'
import EmployeeAssessments from './EmployeeFE/EmployeeAssessments'
import ShareReport from './components/share/ShareReport'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/share/:token" element={<ShareReport />} />
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<AuthShell />}>
            <Route index element={<Navigate to="manager" replace />} />
            <Route path="manager" element={<ManagerLogin />} />
            <Route path="employee" element={<EmployeeAuth />} />
          </Route>
        </Route>

        <Route element={<RoleProtectedRoute allowedRoles={['manager']} />}>
          <Route
            path="/"
            element={
              <AdminLayout>
                <DashboardOverview />
              </AdminLayout>
            }
          />
          <Route
            path="/employees"
            element={
              <AdminLayout>
                <EmployeeManagement />
              </AdminLayout>
            }
          />
          <Route
            path="/roles"
            element={
              <AdminLayout>
                <RoleManagement />
              </AdminLayout>
            }
          />
          <Route
            path="/assessments"
            element={
              <AdminLayout>
                <Assessments />
              </AdminLayout>
            }
          />
          <Route
            path="/interviews"
            element={
              <AdminLayout>
                <Interviews />
              </AdminLayout>
            }
          />
          <Route
            path="/manager-ops"
            element={
              <AdminLayout>
                <ManagerOps />
              </AdminLayout>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <AdminLayout>
                <AuditLogs />
              </AdminLayout>
            }
          />
          <Route
            path="/reports"
            element={
              <AdminLayout>
                <Reports />
              </AdminLayout>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <AdminLayout>
                <Leaderboard />
              </AdminLayout>
            }
          />
          <Route
            path="/resumes"
            element={
              <AdminLayout>
                <ResumeReview />
              </AdminLayout>
            }
          />
          <Route
            path="/assessment-engine"
            element={
              <AdminLayout>
                <AssessmentEngine />
              </AdminLayout>
            }
          />
          <Route
            path="/settings"
            element={
              <AdminLayout>
                <Settings />
              </AdminLayout>
            }
          />
        </Route>

        <Route element={<RoleProtectedRoute allowedRoles={['employee']} />}>
          <Route
            path="/employee"
            element={
              <EmployeeLayout>
                <EmployeeOnboarding />
              </EmployeeLayout>
            }
          />
          <Route
            path="/employee/interview"
            element={
              <EmployeeLayout>
                <EmployeeInterview />
              </EmployeeLayout>
            }
          />
          <Route
            path="/employee/assessments"
            element={
              <EmployeeLayout>
                <EmployeeAssessments />
              </EmployeeLayout>
            }
          />
          <Route
            path="/employee/reports"
            element={
              <EmployeeLayout>
                <EmployeeReportHistory />
              </EmployeeLayout>
            }
          />
          <Route
            path="/employee/report/:assessmentId"
            element={
              <EmployeeLayout>
                <EmployeeReport />
              </EmployeeLayout>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/login/manager" replace />} />
      </Routes>
    </Router>
  )
}

export default App
