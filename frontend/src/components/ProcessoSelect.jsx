import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

/* ══════════════════════════════════════════════════════════════════
   Seletor de processo com busca.

   Substitui o <select> nativo, que só listava o número CNJ e obrigava
   o usuário a reconhecer o processo pelo número — inviável com dezenas
   deles. Aqui a busca cobre tudo que o advogado lembra na hora:
   número (com ou sem pontuação), nome do cliente/parte, tipo de ação
   (classe), assunto, tribunal e vara.

   Inclui processos ARQUIVADOS: uma tarefa pode estar vinculada a um, e
   antes ele simplesmente sumia da lista ao editar a tarefa.
   ══════════════════════════════════════════════════════════════════ */

// Normaliza para comparação: sem acento, sem pontuação, minúsculo.
// "5007833-75.2023.8.13.0216" e "500783375" caem no mesmo texto-base, então
// digitar o número com ou sem máscara encontra o processo do mesmo jeito.
const normalizar = (valor) =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/gi, '')
    .toLowerCase()
    .trim();

export const rotuloProcesso = (p) => p?.numeroCnj || p?.numero || 'Processo sem número';

export const clienteDoProcesso = (p) => {
  const autor = p?.partes?.find((parte) => parte.tipo === 'AUTOR');
  return autor?.nome || p?.partes?.[0]?.nome || '';
};

// Tudo que pode ser digitado para achar este processo.
function textoBuscavel(p) {
  return normalizar(
    [
      p.numero,
      p.numeroCnj,
      p.classe,
      p.assunto,
      p.tribunal,
      p.vara,
      ...(p.partes || []).map((parte) => parte.nome),
    ]
      .filter(Boolean)
      .join(' ')
  );
}

export default function ProcessoSelect({ value, onChange, disabled }) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState('');
  const [destacado, setDestacado] = useState(0);
  const [pos, setPos] = useState(null);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listaRef = useRef(null);

  const { data: processos = [], isLoading } = useQuery({
    queryKey: ['processos-select'],
    queryFn: () =>
      api
        .get('/processos', { params: { limite: 500, incluirArquivados: true } })
        .then((r) => r.data?.processos || r.data?.items || []),
    staleTime: 60000,
  });

  // Índice de busca calculado uma vez por lista — não a cada tecla.
  const indexados = useMemo(
    () => processos.map((p) => ({ ...p, _busca: textoBuscavel(p) })),
    [processos]
  );

  const selecionado = useMemo(
    () => processos.find((p) => p.id === value) || null,
    [processos, value]
  );

  // Todos os termos digitados precisam aparecer — "silva danos" acha o
  // processo do Silva por danos morais, em qualquer ordem.
  const filtrados = useMemo(() => {
    const termos = normalizar(termo).split(/\s+/).filter(Boolean);
    if (!termos.length) return indexados;
    return indexados.filter((p) => termos.every((t) => p._busca.includes(t)));
  }, [indexados, termo]);

  // A lista é renderizada em portal (o modal da tarefa tem overflow e cortaria
  // o dropdown). Por isso a posição precisa ser calculada e acompanhar scroll
  // e redimensionamento.
  const recalcularPosicao = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const espacoAbaixo = window.innerHeight - r.bottom;
    const altura = Math.min(280, Math.max(160, espacoAbaixo - 16));
    const abrirAcima = espacoAbaixo < 200 && r.top > espacoAbaixo;
    setPos({
      left: r.left,
      width: r.width,
      top: abrirAcima ? undefined : r.bottom + 4,
      bottom: abrirAcima ? window.innerHeight - r.top + 4 : undefined,
      maxHeight: abrirAcima ? Math.min(280, r.top - 16) : altura,
    });
  }, []);

  useEffect(() => {
    if (!aberto) return;
    recalcularPosicao();
    const onScroll = () => recalcularPosicao();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [aberto, recalcularPosicao]);

  // Fecha ao clicar fora (inclusive sobre a lista em portal, que está fora da
  // árvore do container).
  useEffect(() => {
    if (!aberto) return;
    const aoClicar = (e) => {
      if (containerRef.current?.contains(e.target)) return;
      if (listaRef.current?.contains(e.target)) return;
      fechar();
    };
    document.addEventListener('mousedown', aoClicar);
    return () => document.removeEventListener('mousedown', aoClicar);
  }, [aberto]);

  useEffect(() => setDestacado(0), [termo]);

  const abrir = () => {
    if (disabled) return;
    setTermo('');
    setAberto(true);
    recalcularPosicao();
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const fechar = () => {
    setAberto(false);
    setTermo('');
  };

  const escolher = (processo) => {
    onChange(processo ? processo.id : null);
    fechar();
  };

  // "Nenhum processo" é a primeira opção da lista navegável (índice -1).
  const aoTeclar = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDestacado((i) => Math.min(i + 1, filtrados.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDestacado((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (destacado === -1) escolher(null);
      else if (filtrados[destacado]) escolher(filtrados[destacado]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      fechar();
    }
  };

  const itemStyle = (ativo) => ({
    width: '100%',
    textAlign: 'left',
    padding: '0.5rem 0.75rem',
    background: ativo ? 'rgba(201,168,76,.14)' : 'transparent',
    borderLeft: `2px solid ${ativo ? 'var(--accent)' : 'transparent'}`,
    cursor: 'pointer',
    display: 'block',
  });

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {aberto ? (
        <input
          ref={inputRef}
          className="input-base"
          style={{ fontSize: '0.875rem' }}
          placeholder="Buscar por número, cliente ou tipo de ação..."
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={aoTeclar}
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={abrir}
          className="input-base"
          style={{
            fontSize: '0.875rem',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: selecionado ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            {selecionado ? rotuloProcesso(selecionado) : 'Nenhum processo'}
            {selecionado && clienteDoProcesso(selecionado) && (
              <span style={{ color: 'var(--text-muted)' }}> — {clienteDoProcesso(selecionado)}</span>
            )}
          </span>
          <i className="fas fa-magnifying-glass text-xs" style={{ color: 'var(--accent)', flexShrink: 0 }} />
        </button>
      )}

      {aberto && pos &&
        createPortal(
          <div
            ref={listaRef}
            className="animate-fadeIn"
            style={{
              position: 'fixed',
              left: pos.left,
              top: pos.top,
              bottom: pos.bottom,
              width: pos.width,
              maxHeight: pos.maxHeight,
              overflowY: 'auto',
              zIndex: 10050,
              background: 'var(--glass-bg, rgba(10,17,40,.98))',
              backdropFilter: 'blur(24px) saturate(1.3)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow-lg)',
              padding: '0.25rem 0',
            }}
          >
            <div
              role="option"
              aria-selected={destacado === -1}
              onMouseEnter={() => setDestacado(-1)}
              onClick={() => escolher(null)}
              style={{ ...itemStyle(destacado === -1), fontSize: '0.8rem', color: 'var(--text-muted)' }}
            >
              <i className="fas fa-ban text-xs" style={{ marginRight: 6 }} />
              Nenhum processo
            </div>

            {isLoading && (
              <div style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Carregando processos...
              </div>
            )}

            {!isLoading && filtrados.length === 0 && (
              <div style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Nenhum processo encontrado para “{termo}”.
              </div>
            )}

            {filtrados.map((p, i) => {
              const cliente = clienteDoProcesso(p);
              const detalhes = [cliente, p.classe || p.assunto].filter(Boolean).join(' • ');
              return (
                <div
                  key={p.id}
                  role="option"
                  aria-selected={p.id === value}
                  onMouseEnter={() => setDestacado(i)}
                  onClick={() => escolher(p)}
                  style={itemStyle(destacado === i)}
                >
                  <div
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: p.id === value ? 'var(--accent)' : 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {rotuloProcesso(p)}
                    </span>
                    {p.status === 'ARQUIVADO' && (
                      <span
                        style={{
                          fontSize: '0.6rem',
                          textTransform: 'uppercase',
                          letterSpacing: '.05em',
                          padding: '1px 5px',
                          borderRadius: 4,
                          background: 'rgba(255,255,255,.08)',
                          color: 'var(--text-muted)',
                          flexShrink: 0,
                        }}
                      >
                        Arquivado
                      </span>
                    )}
                  </div>
                  {detalhes && (
                    <div
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {detalhes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
