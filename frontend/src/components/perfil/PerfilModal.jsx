import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

/* ── Avatar Crop Modal ─────────────────────────────────── */
function AvatarCropModal({ imageSrc, onClose, onSave }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [saving, setSaving] = useState(false);

  const SIZE = 280;

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, SIZE, SIZE);

    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const x = (SIZE - w) / 2 + offset.x;
    const y = (SIZE - h) / 2 + offset.y;

    ctx.save();
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();

    // Draw circle border
    ctx.strokeStyle = 'rgba(201,168,76,.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
  }, [scale, offset]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => { imgRef.current = img; drawCanvas(); };
    img.src = imageSrc;
  }, [imageSrc, drawCanvas]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  const handleMouseDown = (e) => {
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const handleMouseMove = (e) => {
    if (!dragging) return;
    setOffset({
      x: dragStart.current.ox + (e.clientX - dragStart.current.x),
      y: dragStart.current.oy + (e.clientY - dragStart.current.y),
    });
  };
  const handleMouseUp = () => setDragging(false);

  const handleSave = async () => {
    setSaving(true);
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = 256;
    exportCanvas.height = 256;
    const ctx = exportCanvas.getContext('2d');
    const img = imgRef.current;
    if (!img) return;

    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const x = (SIZE - w) / 2 + offset.x;
    const y = (SIZE - h) / 2 + offset.y;
    const ratio = 256 / SIZE;

    ctx.beginPath();
    ctx.arc(128, 128, 128, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, x * ratio, y * ratio, w * ratio, h * ratio);

    exportCanvas.toBlob(async (blob) => {
      if (!blob) { setSaving(false); return; }
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      await onSave(file);
      setSaving(false);
    }, 'image/jpeg', 0.92);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.9)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="animate-scaleIn rounded-2xl overflow-hidden" style={{ background: '#131a2b', border: '1px solid rgba(255,255,255,.1)', maxWidth: 380, width: '100%' }}>
        <div className="flex justify-between items-center px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="font-bold text-sm">Ajustar foto</h3>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><i className="fas fa-xmark" /></button>
        </div>

        <div className="flex flex-col items-center p-5 gap-4">
          <div
            style={{ width: SIZE, height: SIZE, borderRadius: '50%', overflow: 'hidden', cursor: dragging ? 'grabbing' : 'grab', background: '#0a0a0a' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ width: SIZE, height: SIZE }} />
          </div>

          <div className="flex items-center gap-3 w-full px-4">
            <i className="fas fa-search-minus text-xs" style={{ color: 'var(--text-muted)' }} />
            <input
              type="range"
              min="0.2"
              max="3"
              step="0.05"
              value={scale}
              onChange={e => setScale(parseFloat(e.target.value))}
              className="flex-1"
              style={{ accentColor: '#C9A84C' }}
            />
            <i className="fas fa-search-plus text-xs" style={{ color: 'var(--text-muted)' }} />
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Arraste para mover, use o slider para redimensionar</p>
        </div>

        <div className="flex gap-2 justify-end px-5 py-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="btn btn-ghost text-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-gold text-sm">
            {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <i className="fas fa-check" />}
            Salvar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Avatar Upload ─────────────────────────────────────── */
function AvatarUpload({ usuario, avatarUrl, onUpdate }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [hover, setHover] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);

  const initials = (usuario?.nome || 'U')
    .split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCropSrc(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropSave = async (croppedFile) => {
    setUploading(true);
    setCropSrc(null);
    try {
      const form = new FormData();
      form.append('avatar', croppedFile);
      const { data } = await api.post('/auth/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUpdate({ avatar: data.avatar });
      toast.success('Foto atualizada!');
    } catch {
      toast.error('Erro ao enviar foto.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative cursor-pointer select-none"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => inputRef.current?.click()}
        style={{ transition: 'transform .2s', transform: hover ? 'scale(1.04)' : 'scale(1)' }}
      >
        <div
          className="flex items-center justify-center rounded-full overflow-hidden"
          style={{
            width: 80, height: 80,
            background: 'linear-gradient(135deg,#C9A84C,#A8873A)',
            fontSize: 28, color: '#0c0c0e', fontWeight: 700,
            boxShadow: hover ? '0 0 0 3px rgba(201,168,76,.35)' : '0 0 0 2px rgba(201,168,76,.15)',
            transition: 'box-shadow .25s',
          }}
        >
          {avatarUrl
            ? <img src={`${avatarUrl}?t=${Date.now()}`} alt="avatar" className="w-full h-full object-cover" />
            : initials}
        </div>
        <div
          className="absolute inset-0 rounded-full flex items-center justify-center transition-all"
          style={{ background: hover ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,0)' }}
        >
          {hover && (
            <i className="fas fa-camera text-white text-lg animate-scaleIn" />
          )}
        </div>
        {uploading && (
          <div className="absolute inset-0 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,.6)' }}>
            <span className="spinner" style={{ width: 20, height: 20 }} />
          </div>
        )}
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 transition-transform"
          style={{ width: 14, height: 14, background: '#22c55e', borderColor: 'var(--bg-secondary)', transform: hover ? 'scale(1.2)' : 'scale(1)' }}
        />
      </div>
      <div className="text-center">
        <p className="font-bold text-sm">{usuario?.nome}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{usuario?.email}</p>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
      {cropSrc && <AvatarCropModal imageSrc={cropSrc} onClose={() => setCropSrc(null)} onSave={handleCropSave} />}
    </div>
  );
}

/* ── Campo com label flutuante ─────────────────────────── */
function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

/* ── Perfil Modal ──────────────────────────────────────── */
export default function PerfilModal({ onClose }) {
  const { usuario, atualizarUsuario, alternarTema } = useAuthStore();
  const [tab, setTab] = useState('dados'); // dados | aparencia | seguranca
  const [dados, setDados] = useState({ nome: usuario?.nome || '', oab: usuario?.oab || '', telefone: usuario?.telefone || '' });
  const [senhas, setSenhas] = useState({ senhaAtual: '', novaSenha: '', confirmar: '' });
  const [showSenhas, setShowSenhas] = useState({ atual: false, nova: false, conf: false });
  const temaAtual = usuario?.tema || 'ESCURO';

  const avatarUrl = usuario?.avatar ? `http://localhost:3001${usuario.avatar}` : null;

  // Fechar com ESC
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const { mutate: salvarDados, isPending: salvando } = useMutation({
    mutationFn: () => api.put('/auth/perfil', dados),
    onSuccess: ({ data }) => { atualizarUsuario(data); toast.success('Dados atualizados!'); },
    onError: (err) => toast.error(err.response?.data?.error || 'Erro ao salvar'),
  });

  const { mutate: alterarSenha, isPending: alterando } = useMutation({
    mutationFn: () => api.post('/auth/alterar-senha', { senhaAtual: senhas.senhaAtual, novaSenha: senhas.novaSenha }),
    onSuccess: () => { toast.success('Senha alterada!'); setSenhas({ senhaAtual: '', novaSenha: '', confirmar: '' }); },
    onError: (err) => toast.error(err.response?.data?.error || 'Erro ao alterar senha'),
  });

  const handleSenha = (e) => {
    e.preventDefault();
    if (senhas.novaSenha !== senhas.confirmar) return toast.error('As senhas não coincidem.');
    if (senhas.novaSenha.length < 6) return toast.error('Senha deve ter pelo menos 6 caracteres.');
    alterarSenha();
  };

  const planBadge = {
    GRATUITO:  { bg: 'rgba(99,102,241,.15)',  color: '#818cf8', label: 'GRATUITO' },
    MENSAL:    { bg: 'rgba(201,168,76,.15)',  color: '#C9A84C', label: 'MENSAL' },
    ANUAL:     { bg: 'rgba(201,168,76,.15)',  color: '#C9A84C', label: 'ANUAL' },
    VITALICIO: { bg: 'rgba(16,185,129,.15)',  color: '#34d399', label: '★ VITALÍCIO' },
  };
  const ps = planBadge[usuario?.plano] || planBadge.GRATUITO;

  const TABS = [
    { id: 'dados',     icon: 'fa-user',           label: 'Dados' },
    { id: 'aparencia', icon: 'fa-palette',         label: 'Aparência' },
    { id: 'seguranca', icon: 'fa-shield-halved',   label: 'Segurança' },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-3xl overflow-hidden animate-scaleIn flex flex-col"
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          boxShadow: '0 32px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(201,168,76,.08)',
          maxHeight: '90vh',
        }}
      >
        {/* ─── Cabeçalho com avatar ─────────────────── */}
        <div
          className="relative px-6 pt-8 pb-6 flex flex-col items-center"
          style={{
            background: 'linear-gradient(180deg, rgba(201,168,76,.06) 0%, transparent 100%)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex items-center justify-center rounded-xl transition-all hover:opacity-70"
            style={{ width: 30, height: 30, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            <i className="fas fa-xmark text-sm" />
          </button>

          <AvatarUpload usuario={usuario} avatarUrl={avatarUrl} onUpdate={atualizarUsuario} />

          <span
            className="text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest mt-3"
            style={{ background: ps.bg, color: ps.color }}
          >
            {ps.label}
          </span>
        </div>

        {/* ─── Tabs ─────────────────────────────────── */}
        <div className="flex border-b" style={{ borderColor: 'var(--border)', flexShrink: 0 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-all relative"
              style={{ color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)' }}
            >
              <i className={`fas ${t.icon} text-sm`} />
              {t.label}
              {tab === t.id && (
                <span
                  className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full animate-scaleIn"
                  style={{ background: 'var(--accent)' }}
                />
              )}
            </button>
          ))}
        </div>

        {/* ─── Conteúdo ─────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Dados ──────────────────────────────── */}
          {tab === 'dados' && (
            <div className="space-y-4 animate-fadeIn">
              <Field label="Nome completo">
                <input
                  className="input-base"
                  value={dados.nome}
                  onChange={e => setDados(d => ({ ...d, nome: e.target.value }))}
                  placeholder="Seu nome completo"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="OAB">
                  <input
                    className="input-base"
                    value={dados.oab}
                    onChange={e => setDados(d => ({ ...d, oab: e.target.value }))}
                    placeholder="XX000000"
                  />
                </Field>
                <Field label="Telefone">
                  <input
                    className="input-base"
                    value={dados.telefone}
                    onChange={e => setDados(d => ({ ...d, telefone: e.target.value }))}
                    placeholder="(00) 00000-0000"
                  />
                </Field>
              </div>
              <Field label="E-mail">
                <input
                  className="input-base"
                  value={usuario?.email || ''}
                  disabled
                  style={{ opacity: .45, cursor: 'not-allowed' }}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>E-mail não pode ser alterado.</p>
              </Field>
              <button onClick={() => salvarDados()} disabled={salvando} className="btn btn-gold w-full mt-2">
                {salvando ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <i className="fas fa-check" />}
                {salvando ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          )}

          {/* ── Aparência ──────────────────────────── */}
          {tab === 'aparencia' && (
            <div className="space-y-4 animate-fadeIn">
              <div
                className="flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all hover:border-opacity-60 group"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                onClick={alternarTema}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center rounded-xl transition-transform group-hover:scale-105"
                    style={{ width: 42, height: 42, background: temaAtual === 'ESCURO' ? 'rgba(99,102,241,.12)' : 'rgba(245,158,11,.12)' }}
                  >
                    <i
                      className={`fas ${temaAtual === 'ESCURO' ? 'fa-moon' : 'fa-sun'} text-sm`}
                      style={{ color: temaAtual === 'ESCURO' ? '#818cf8' : '#f59e0b' }}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Tema {temaAtual === 'ESCURO' ? 'Escuro' : 'Claro'}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {temaAtual === 'ESCURO' ? 'Clique para mudar para claro' : 'Clique para mudar para escuro'}
                    </p>
                  </div>
                </div>
                {/* Toggle switch */}
                <div
                  className="relative rounded-full transition-all"
                  style={{ width: 48, height: 26, background: temaAtual === 'CLARO' ? 'var(--accent)' : 'var(--border)', flexShrink: 0 }}
                >
                  <span
                    className="absolute top-1 rounded-full transition-all"
                    style={{ width: 18, height: 18, background: '#fff', left: temaAtual === 'CLARO' ? 26 : 4, boxShadow: '0 1px 4px rgba(0,0,0,.3)' }}
                  />
                </div>
              </div>

              {/* Preview tema */}
              <div className="rounded-2xl p-4 space-y-2" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Prévia</p>
                <div className="flex gap-2">
                  {['gold','blue','green','red','purple'].map(c => (
                    <div key={c} className="flex-1 h-6 rounded-lg" style={{
                      background: {
                        gold:'linear-gradient(135deg,#C9A84C,#A8873A)',
                        blue:'linear-gradient(135deg,#60a5fa,#2563eb)',
                        green:'linear-gradient(135deg,#34d399,#059669)',
                        red:'linear-gradient(135deg,#f87171,#dc2626)',
                        purple:'linear-gradient(135deg,#a78bfa,#7c3aed)',
                      }[c]
                    }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Segurança ──────────────────────────── */}
          {tab === 'seguranca' && (
            <form onSubmit={handleSenha} className="space-y-4 animate-fadeIn">
              {[
                { key: 'senhaAtual', label: 'Senha atual',         show: 'atual' },
                { key: 'novaSenha',  label: 'Nova senha',           show: 'nova'  },
                { key: 'confirmar',  label: 'Confirmar nova senha', show: 'conf'  },
              ].map(({ key, label, show }) => (
                <Field key={key} label={label}>
                  <div className="relative">
                    <input
                      className="input-base pr-12"
                      type={showSenhas[show] ? 'text' : 'password'}
                      value={senhas[key]}
                      onChange={e => setSenhas(s => ({ ...s, [key]: e.target.value }))}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenhas(s => ({ ...s, [show]: !s[show] }))}
                      className="absolute right-4 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-60"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <i className={`fas fa-eye${showSenhas[show] ? '-slash' : ''} text-sm`} />
                    </button>
                  </div>
                </Field>
              ))}
              <button type="submit" disabled={alterando} className="btn btn-ghost w-full mt-2">
                {alterando ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <i className="fas fa-key" />}
                {alterando ? 'Alterando...' : 'Alterar senha'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
