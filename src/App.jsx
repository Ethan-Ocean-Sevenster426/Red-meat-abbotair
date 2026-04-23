import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ResidueMonitoring from './pages/ResidueMonitoring.jsx';
import MasterDatabase from './pages/MasterDatabase.jsx';
import RegisteredAbattoirs from './pages/RegisteredAbattoirs.jsx';
import DocumentLibrary from './pages/DocumentLibrary.jsx';
import Transformation from './pages/Transformation.jsx';
import Government from './pages/Government.jsx';
import TrainingReport from './pages/TrainingReport.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Unauthorized from './pages/Unauthorized.jsx';
import UserManagement from './pages/UserManagement.jsx';
import AcceptInvite from './pages/AcceptInvite.jsx';
import STTTrainingReport from './pages/STTTrainingReport.jsx';
import STTBreakdownReport from './pages/STTBreakdownReport.jsx';
import ARMSDashboard from './pages/ARMSDashboard.jsx';
import FormalTrainingReport from './pages/FormalTrainingReport.jsx';
import LearnerSummary from './pages/LearnerSummary.jsx';
import FeedlotResidue from './pages/FeedlotResidue.jsx';
import Industry from './pages/Industry.jsx';
import AssociatedMembers from './pages/AssociatedMembers.jsx';
import QuotationSystem from './pages/QuotationSystem.jsx';
import NewQuote from './pages/NewQuote.jsx';
import FeeStructure from './pages/FeeStructure.jsx';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/residue-monitoring"
            element={
              <ProtectedRoute>
                <ResidueMonitoring />
              </ProtectedRoute>
            }
          />
          <Route
            path="/master-database"
            element={
              <ProtectedRoute>
                <MasterDatabase />
              </ProtectedRoute>
            }
          />
          <Route
            path="/master-database/registered-abattoirs"
            element={
              <ProtectedRoute>
                <RegisteredAbattoirs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/master-database/transformation"
            element={
              <ProtectedRoute>
                <Transformation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/master-database/government"
            element={
              <ProtectedRoute>
                <Government />
              </ProtectedRoute>
            }
          />
          <Route
            path="/master-database/industry"
            element={
              <ProtectedRoute>
                <Industry />
              </ProtectedRoute>
            }
          />
          <Route
            path="/master-database/associated-members"
            element={
              <ProtectedRoute>
                <AssociatedMembers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/training-report"
            element={
              <ProtectedRoute>
                <TrainingReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/document-library"
            element={
              <ProtectedRoute>
                <DocumentLibrary />
              </ProtectedRoute>
            }
          />
          <Route
            path="/arms-dashboard"
            element={
              <ProtectedRoute>
                <ARMSDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={[ 'admin' ]}>
                <div className="container">
                  <h1>Admin Area</h1>
                  <p>This page is visible to admin users only.</p>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/training-report/stt"
            element={
              <ProtectedRoute>
                <STTTrainingReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/training-report/stt/breakdown"
            element={
              <ProtectedRoute>
                <STTBreakdownReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/training-report/learner-summary"
            element={
              <ProtectedRoute>
                <LearnerSummary />
              </ProtectedRoute>
            }
          />
          <Route
            path="/training-report/formal"
            element={
              <ProtectedRoute>
                <FormalTrainingReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/feedlot-residue"
            element={
              <ProtectedRoute>
                <FeedlotResidue />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quotation-system"
            element={
              <ProtectedRoute>
                <QuotationSystem />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quotation-system/new-quote"
            element={
              <ProtectedRoute>
                <NewQuote />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quotation-system/fee-structure"
            element={
              <ProtectedRoute>
                <FeeStructure />
              </ProtectedRoute>
            }
          />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route
            path="/user-management"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
