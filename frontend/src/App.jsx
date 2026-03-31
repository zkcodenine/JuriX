import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import Layout from './components/layout/Layout';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Dashboard from './pages/dashboard/Dashboard';
import ProcessosList from './pages/processos/ProcessosList';
import ProcessoDetail from './pages/processos/ProcessoDetail';
import Tarefas from './pages/tarefas/Tarefas';
import Notificacoes from './pages/notificacoes/Notificacoes';
import Honorarios from './pages/honorarios/Honorarios';
import Agenda from './pages/agenda/Agenda';
import Planos from './pages/planos/Planos';
import Perfil from './pages/perfil/Perfil';
import EscritorioConfig from './pages/configuracoes/EscritorioConfig';
import ModelosDocumentos from './pages/configuracoes/ModelosDocumentos';

function PrivateRoute({ children }) {
  const { isAuth } = useAuthStore();
  return isAuth() ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { isAuth } = useAuthStore();
  return !isAuth() ? children : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Públicas */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/registrar" element={<PublicRoute><Register /></PublicRoute>} />

        {/* Privadas */}
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="processos" element={<ProcessosList />} />
          <Route path="processos/:id" element={<ProcessoDetail />} />
          <Route path="tarefas" element={<Tarefas />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="honorarios" element={<Honorarios />} />
          <Route path="notificacoes" element={<Notificacoes />} />
          <Route path="planos" element={<Planos />} />
          <Route path="perfil" element={<Perfil />} />
          <Route path="configuracoes/escritorio" element={<EscritorioConfig />} />
          <Route path="configuracoes/modelos" element={<ModelosDocumentos />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
