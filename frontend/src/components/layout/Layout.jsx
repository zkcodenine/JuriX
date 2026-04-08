import { Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Sidebar from './Sidebar';
import Header from './Header';
import api from '../../services/api';
import useConnectionStore from '../../store/connectionStore';

const pageTitles = {
  '/dashboard':               { titulo: 'Dashboard',              subtitulo: 'Visão geral do seu escritório'     },
  '/processos':               { titulo: 'Processos',              subtitulo: 'Gerencie seus processos judiciais' },
  '/tarefas':                 { titulo: 'Tarefas',                subtitulo: 'Organize suas atividades'          },
  '/agenda':                  { titulo: 'Agenda',                 subtitulo: 'Prazos, tarefas e compromissos'    },
  '/honorarios':              { titulo: 'Honorários',             subtitulo: 'Controle financeiro'               },
  '/notificacoes':            { titulo: 'Notificações',           subtitulo: 'Central de alertas'                },
  '/planos':                  { titulo: 'Planos',                 subtitulo: 'Gerencie sua assinatura'           },
  '/configuracoes':           { titulo: 'Configurações',          subtitulo: 'Personalize o sistema'             },
};

export default function Layout() {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const qc = useQueryClient();
  const syncRef = useRef(false);

  const { isOnline, wasOffline, showReconnected, isUsingCache, connectionQuality, needsSync, setSynced, dismissReconnected } = useConnectionStore();

  // ── Full data refresh when coming back online ──────────
  const refreshAllData = useCallback(async () => {
    try {
      // Clear SW API cache to force fresh data
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage('clearApiCache');
      }
      // Invalidate all queries to force refetch from API
      await qc.invalidateQueries();
      // Sync processes with tribunals
      await api.post('/processos/sincronizar-todos', {}, { timeout: 300000 }).catch(() => {});
      setSynced();
    } catch {
      // Silent — will retry on next opportunity
    }
  }, [qc, setSynced]);

  // Auto-refresh when connection is restored
  useEffect(() => {
    if (isOnline && needsSync) {
      refreshAllData();
    }
  }, [isOnline, needsSync, refreshAllData]);

  // Auto-sync: sync on mount (app open) + adaptive interval
  // Good connection: every 30 min | Slow: every 60 min | Offline: disabled
  useEffect(() => {
    const doSync = async () => {
      if (!isOnline) return;
      // Skip heavy sync on slow connections — just refresh cached queries
      if (connectionQuality === 'slow') {
        qc.invalidateQueries({ queryKey: ['processos'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
        qc.invalidateQueries({ queryKey: ['notif-count'] });
        return;
      }
      try {
        await api.post('/processos/sincronizar-todos', {}, { timeout: 300000 });
        qc.invalidateQueries({ queryKey: ['processos'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
        qc.invalidateQueries({ queryKey: ['notif-count'] });
      } catch {
        // Silent fail — sync is background operation
      }
    };

    if (!syncRef.current) {
      syncRef.current = true;
      // Delay initial sync by 5s to let the UI load first on slow connections
      setTimeout(doSync, 5000);
    }

    const syncInterval = connectionQuality === 'slow' ? 60 * 60 * 1000 : 30 * 60 * 1000;
    const interval = setInterval(doSync, syncInterval);
    return () => clearInterval(interval);
  }, [qc, isOnline, connectionQuality]);

  // Adaptive polling: slower on slow/4G connections, disabled when offline
  const notifInterval = connectionQuality === 'offline' ? false : connectionQuality === 'slow' ? 120000 : 45000;
  const alertInterval = connectionQuality === 'offline' ? false : connectionQuality === 'slow' ? 180000 : 90000;

  const { data: notifData } = useQuery({
    queryKey: ['notif-count'],
    queryFn: () => api.get('/notificacoes?apenasNaoLidas=true&limite=1').then(r => r.data),
    refetchInterval: notifInterval,
  });

  // Count processes with unseen movimentações for sidebar badge
  const { data: processosAlertData } = useQuery({
    queryKey: ['processos-alertas'],
    queryFn: () => api.get('/processos', { params: { limite: 200 } }).then(r => r.data.processos || []),
    refetchInterval: alertInterval,
  });

  const processosComAlertas = useMemo(() => {
    if (!processosAlertData) return 0;
    const agora = Date.now();
    return processosAlertData.filter(p => {
      if (!p.dataUltimaAtualizacao || !p.novasMovimentacoes) return false;
      if ((agora - new Date(p.dataUltimaAtualizacao).getTime()) > 48 * 3600 * 1000) return false;
      const lastViewed = parseInt(localStorage.getItem(`mov_viewed_${p.id}`) || '0', 10);
      return new Date(p.dataUltimaAtualizacao).getTime() > lastViewed;
    }).length;
  }, [processosAlertData]);

  const base = '/' + location.pathname.split('/')[1];
  const pageInfo = pageTitles[base] || { titulo: 'JuriX', subtitulo: '' };
  const sidebarWidth = sidebarCollapsed ? 72 : 240;
  const isFullWidth = base === '/agenda';

  return (
    <div className="flex min-h-screen bg-gold-gradient">
      <Sidebar naoLidas={notifData?.naoLidas || 0} processosAlertas={processosComAlertas} onCollapse={setSidebarCollapsed} />
      <main
        className="flex-1 flex flex-col min-h-screen transition-all duration-300"
        style={{ marginLeft: sidebarWidth }}
      >
        <Header titulo={pageInfo.titulo} subtitulo={pageInfo.subtitulo} />

        {/* ── Connection Status Banners ─────────────────── */}

        {/* Offline banner */}
        {!isOnline && (
          <div
            className="flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-medium animate-fadeIn"
            style={{
              background: 'linear-gradient(135deg, rgba(239,68,68,.15), rgba(239,68,68,.08))',
              borderBottom: '1px solid rgba(239,68,68,.25)',
              color: '#fca5a5',
            }}
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#ef4444' }} />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: '#ef4444' }} />
              </span>
              <i className="fas fa-wifi-slash text-xs" style={{ color: '#ef4444' }} />
              <span>Sem conexão — usando dados salvos localmente</span>
            </div>
            <span className="text-xs opacity-60">O sistema tentará reconectar automaticamente</span>
          </div>
        )}

        {/* Slow connection banner */}
        {isOnline && connectionQuality === 'slow' && (
          <div
            className="flex items-center justify-center gap-3 px-4 py-2 text-xs font-medium animate-fadeIn"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,.12), rgba(245,158,11,.05))',
              borderBottom: '1px solid rgba(245,158,11,.2)',
              color: '#fbbf24',
            }}
          >
            <i className="fas fa-signal text-xs" />
            <span>Conexão lenta — os dados podem demorar mais para carregar</span>
          </div>
        )}

        {/* Using cached data indicator */}
        {isOnline && isUsingCache && connectionQuality !== 'slow' && (
          <div
            className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium animate-fadeIn"
            style={{
              background: 'rgba(34,211,238,.06)',
              borderBottom: '1px solid rgba(34,211,238,.15)',
              color: '#67e8f9',
            }}
          >
            <i className="fas fa-database text-[10px]" />
            <span>Exibindo dados em cache — atualizando...</span>
          </div>
        )}

        {/* Reconnected banner */}
        {showReconnected && (
          <div
            className="flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-medium animate-fadeIn"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,.15), rgba(16,185,129,.05))',
              borderBottom: '1px solid rgba(16,185,129,.25)',
              color: '#6ee7b7',
            }}
          >
            <div className="flex items-center gap-2">
              <i className="fas fa-wifi text-xs" style={{ color: '#10b981' }} />
              <span>Conexão restabelecida — atualizando todos os dados...</span>
            </div>
            <button
              onClick={dismissReconnected}
              className="text-xs opacity-60 hover:opacity-100 transition-opacity ml-2"
            >
              <i className="fas fa-times" />
            </button>
          </div>
        )}

        <div className={`flex-1 ${isFullWidth ? 'p-0' : 'p-6'} animate-fadeIn`}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
