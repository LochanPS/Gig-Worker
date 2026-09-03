import { Routes, Route, Navigate } from 'react-router-dom';
import { Login } from '@/routes/auth/Login';
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
