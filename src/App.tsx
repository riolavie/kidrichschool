import React from 'react';
import { ClassEconomyProvider, useClassEconomy } from './context/ClassEconomyContext';
import { HeaderRoleSwitcher } from './components/HeaderRoleSwitcher';
import { StudentDashboard } from './components/StudentDashboard';
import { TeacherAdmin } from './components/TeacherAdmin';
import { LoginView } from './components/LoginView';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';

const MainContent: React.FC = () => {
  const { role } = useClassEconomy();

  return (
    <div className="min-h-screen bg-[#f7f9fb] font-sans">
      <HeaderRoleSwitcher />
      {role === 'student' && <StudentDashboard />}
      {role === 'teacher' && <TeacherAdmin />}
      {role === 'super_admin' && <SuperAdminDashboard />}
      {role === 'guest' && <LoginView />}
    </div>
  );
};

export default function App() {
  return (
    <ClassEconomyProvider>
      <MainContent />
    </ClassEconomyProvider>
  );
}
