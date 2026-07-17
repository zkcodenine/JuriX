import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

const formVazio = { nome: '', cnpj: '', endereco: '', telefone: '', email: '', observacoes: '' };

function UnidadeModal({ unidade, onClose }) {
  const qc = useQueryClient();
  const editando = Boolean(unidade?.id);
  const [form, setForm] = useState(unidade ? { ...formVazio, ...unidade } : formVazio);

  const salvar = useMutation({
    mutationFn: (dados) =>
      editando
        ? api.put(`/admin/unidades/${unidade.id}`, dados)
        : api.post('/admin/unidades', dados),
    onSuccess: () => {
      qc.invalidateQueries(['admin-unidades']);
      toast.success(editando ? 'Unidade atualizada!' : 'Unidade criada!');
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Erro ao salvar unidade'),
  });

  const campo = (k, label, tipo = 'text') => (
    <div>
      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <input
        type={tipo}
        value={form[k] || ''}
        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{ background: 'var(--bg-input, rgba(255,255,255,.04))', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.6)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-6" style={{ background: 'var(--bg-card, #0f1b3d)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          {editando ? 'Editar unidade' : 'Nova unidade'}
        </h2>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.nome.trim()) return toast.error('Informe o nome da unidade');
            salvar.mutate(form);
          }}
        >
          {campo('nome', 'Nome do escritório *')}
          <div className="grid grid-cols-2 gap-3">
            {campo('cnpj', 'CNPJ')}
            {campo('telefone', 'Telefone')}
          </div>
          {campo('endereco', 'Endereço')}
          {campo('email', 'E-mail', 'email')}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button type="submit" disabled={salvar.isPending} className="flex-1 py-2 rounded-lg text-sm font-bold" style={{ background: 'var(--accent)', color: '#0a1128' }}>
              {salvar.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Unidades() {
  const qc = useQueryClient();
  const { usuario } = useAuthStore();
  const ehAdminGlobal = usuario?.perfil === 'ADMIN_GLOBAL';
  const [editando, setEditando] = useState(null);

  const { data: unidades = [], isLoading } = useQuery({
    queryKey: ['admin-unidades'],
    queryFn: () => api.get('/admin/unidades').then((r) => r.data),
  });

  const excluir = useMutation({
    mutationFn: (id) => api.delete(`/admin/unidades/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['admin-unidades']);
      toast.success('Unidade excluída.');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Erro ao excluir'),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Unidades</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Escritórios cadastrados no sistema</p>
        </div>
        {ehAdminGlobal && (
          <button onClick={() => setEditando({})} className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: 'var(--accent)', color: '#0a1128' }}>
            <i className="fas fa-plus mr-2" />Nova unidade
          </button>
        )}
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
      ) : unidades.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ border: '1px dashed var(--border)' }}>
          <i className="fas fa-building text-3xl mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Nenhuma unidade cadastrada ainda.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {unidades.map((u) => (
            <div key={u.id} className="rounded-xl p-4 flex items-center justify-between" style={{ background: 'var(--bg-card, rgba(255,255,255,.03))', border: '1px solid var(--border)' }}>
              <div>
                <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{u.nome}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {u._count?.usuarios ?? 0} usuário(s)
                  {u.telefone && ` · ${u.telefone}`}
                  {u.endereco && ` · ${u.endereco}`}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditando(u)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  <i className="fas fa-pen mr-1.5" />Editar
                </button>
                {ehAdminGlobal && (
                  <button
                    onClick={() => {
                      if (confirm(`Excluir a unidade "${u.nome}"?`)) excluir.mutate(u.id);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ border: '1px solid rgba(239,68,68,.3)', color: '#ef4444' }}
                  >
                    <i className="fas fa-trash" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editando && <UnidadeModal unidade={editando.id ? editando : null} onClose={() => setEditando(null)} />}
    </div>
  );
}
