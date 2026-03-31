import { create } from 'zustand';
import api from '../services/api';

const useAuthStore = create((set, get) => ({
  usuario: JSON.parse(localStorage.getItem('jurix_user') || 'null'),
  token: localStorage.getItem('jurix_token') || null,
  loading: false,

  login: async (email, senha) => {
    set({ loading: true });
    try {
      const { data } = await api.post('/auth/login', { email, senha });
      localStorage.setItem('jurix_token', data.token);
      localStorage.setItem('jurix_user', JSON.stringify(data.usuario));
      set({ token: data.token, usuario: data.usuario, loading: false });
      return { ok: true };
    } catch (err) {
      set({ loading: false });
      return { ok: false, erro: err.response?.data?.error || 'Erro ao fazer login' };
    }
  },

  registrar: async (dados) => {
    set({ loading: true });
    try {
      const { data } = await api.post('/auth/registrar', dados);
      localStorage.setItem('jurix_token', data.token);
      localStorage.setItem('jurix_user', JSON.stringify(data.usuario));
      set({ token: data.token, usuario: data.usuario, loading: false });
      return { ok: true };
    } catch (err) {
      set({ loading: false });
      return { ok: false, erro: err.response?.data?.error || 'Erro ao criar conta' };
    }
  },

  logout: () => {
    localStorage.removeItem('jurix_token');
    localStorage.removeItem('jurix_user');
    set({ token: null, usuario: null });
  },

  atualizarUsuario: (dados) => {
    const atualizado = { ...get().usuario, ...dados };
    localStorage.setItem('jurix_user', JSON.stringify(atualizado));
    set({ usuario: atualizado });
  },

  isAuth: () => !!get().token,
}));

export default useAuthStore;
