import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../services/api';

const PERFIS = [
  { valor: 'USUARIO',       label: 'Usuário' },
  { valor: 'ADMIN_UNIDADE', label: 'Admin da unidade' },
  { valor: 'ADMIN_GLOBAL',  label: 'Admin global' },
];

const perfilBadge = {
  USUARIO:       { bg: 'rgba(99,102,241,.1)', cor: '#818cf8', label: 'Usuário' },
  ADMIN_UNIDADE: { bg: 'rgba(201,168,76,.1)', cor: '#C9A84C', label: 'Admin da unidade' },
  ADMIN_GLOBAL:  { bg: 'rgba(16,185,129,.1)', cor: '#34d399', label: 'Admin global' },
};

const mascaraCpf = (v) => {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const formatarData = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Nunca entrou';

function EditarModal({ usuario, unidades, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nome: usuario.nome || '',
    cpf: mascaraCpf(usuario.cpf || ''),
    oab: usuario.oab || '',
    telefone: usuario.telefone || '',
    perfil: usuario.perfil,
    unidadeId: usuario.unidade?.id || '',
    ativo: usuario.ativo,
  });

  const salvar = useMutation({
    mutationFn: (dados) => api.put(`/admin/usuarios/${usuario.id}`, dados),
    onSuccess: () => {
      qc.invalidateQueries(['admin-usuarios']);
      qc.invalidateQueries(['admin-unidades']);
      toast.success('Usuário atualizado!');
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Erro ao salvar'),
  });

  // Admin global fica acima de todas as unidades — sem vínculo.
  const ehGlobal = form.perfil === 'ADMIN_GLOBAL';

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.6)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-6" style={{ background: 'var(--bg-card, #0f1b3d)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Editar usuário</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{usuario.email}</p>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            salvar.mutate({
              ...form,
              cpf: form.cpf.replace(/\D/g, ''),
              unidadeId: ehGlobal ? null : (form.unidadeId || null),
            });
          }}
        >
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Nome</label>
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>CPF</label>
              <input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: mascaraCpf(e.target.value) })}
                placeholder="000.000.000-00"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Permite entrar com CPF além do e-mail.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>OAB</label>
              <input value={form.oab} onChange={(e) => setForm({ ...form, oab: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Perfil</label>
              <select value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                {PERFIS.map((p) => <option key={p.valor} value={p.valor} style={{ background: '#0f1b3d' }}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Unidade</label>
              <select value={form.unidadeId} disabled={ehGlobal} onChange={(e) => setForm({ ...form, unidadeId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                <option value="" style={{ background: '#0f1b3d' }}>Sem unidade</option>
                {unidades.map((u) => <option key={u.id} value={u.id} style={{ background: '#0f1b3d' }}>{u.nome}</option>)}
              </select>
              {ehGlobal && <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>O admin global fica acima de todas.</p>}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
            Conta ativa
          </label>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>Cancelar</button>
            <button type="submit" disabled={salvar.isPending} className="flex-1 py-2 rounded-lg text-sm font-bold" style={{ background: 'var(--accent)', color: '#0a1128' }}>
              {salvar.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetarSenhaModal({ usuario, onClose }) {
  const [senha, setSenha] = useState('');
  const resetar = useMutation({
    mutationFn: () => api.post(`/admin/usuarios/${usuario.id}/resetar-senha`, { novaSenha: senha }),
    onSuccess: () => {
      toast.success('Senha redefinida! Informe a nova senha ao usuário.');
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Erro ao redefinir'),
  });

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.6)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: 'var(--bg-card, #0f1b3d)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Redefinir senha</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{usuario.nome} — {usuario.email}</p>
        <form onSubmit={(e) => { e.preventDefault(); if (senha.length < 8) return toast.error('Mínimo de 8 caracteres'); resetar.mutate(); }}>
          <input
            type="text" value={senha} onChange={(e) => setSenha(e.target.value)}
            placeholder="Nova senha (mín. 8 caracteres)" autoFocus
            className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-3"
            style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
          <p className="text-[11px] mb-4" style={{ color: 'var(--text-muted)' }}>
            Anote e entregue esta senha ao usuário — ela não fica visível depois.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>Cancelar</button>
            <button type="submit" disabled={resetar.isPending} className="flex-1 py-2 rounded-lg text-sm font-bold" style={{ background: 'var(--accent)', color: '#0a1128' }}>
              {resetar.isPending ? 'Salvando...' : 'Redefinir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Usuarios() {
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState(null);
  const [resetando, setResetando] = useState(null);

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['admin-usuarios', busca],
    queryFn: () => api.get('/admin/usuarios', { params: { busca: busca || undefined } }).then((r) => r.data),
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ['admin-unidades'],
    queryFn: () => api.get('/admin/unidades').then((r) => r.data),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Usuários</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Perfis de acesso, unidades e senhas</p>
      </div>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome, e-mail ou CPF..."
        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none mb-4"
        style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
      />

      {isLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 720 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,.03)' }}>
                  {['Nome', 'CPF', 'Perfil', 'Unidade', 'Último login', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => {
                  const badge = perfilBadge[u.perfil] || perfilBadge.USUARIO;
                  return (
                    <tr key={u.id} style={{ borderTop: '1px solid var(--border)', opacity: u.ativo ? 1 : 0.45 }}>
                      <td className="px-4 py-3">
                        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{u.nome}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{u.cpf ? mascaraCpf(u.cpf) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-md text-[10px] font-bold" style={{ background: badge.bg, color: badge.cor }}>{badge.label}</span>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{u.unidade?.nome || '—'}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{formatarData(u.ultimoLogin)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => setEditando(u)} title="Editar" className="px-2.5 py-1.5 rounded-lg text-xs" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                            <i className="fas fa-pen" />
                          </button>
                          <button onClick={() => setResetando(u)} title="Redefinir senha" className="px-2.5 py-1.5 rounded-lg text-xs" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                            <i className="fas fa-key" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editando && <EditarModal usuario={editando} unidades={unidades} onClose={() => setEditando(null)} />}
      {resetando && <ResetarSenhaModal usuario={resetando} onClose={() => setResetando(null)} />}
    </div>
  );
}
