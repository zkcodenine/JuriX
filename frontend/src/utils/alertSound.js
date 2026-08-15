// ══════════════════════════════════════════════════════
//  JuriX — Som de alerta (Web Audio API)
//  Gera um "bip" tecnológico curto sem depender de arquivo
//  de áudio. Usado nos lembretes de agenda.
// ══════════════════════════════════════════════════════

export function playAlertSound() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    // Alguns ambientes suspendem o contexto até um gesto do usuário.
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    // Arpejo ascendente "tech": A5 → D6 → G6, repetido uma vez.
    const notas = [880, 1174.66, 1567.98, 1174.66, 1567.98, 2093.0];
    notas.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t0 = now + i * 0.13;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.22, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.26);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.28);
    });

    // Encerra o contexto após o som terminar.
    setTimeout(() => ctx.close().catch(() => {}), 1800);
  } catch {
    // Áudio indisponível — silencioso.
  }
}

// ══════════════════════════════════════════════════════
//  Som SUAVE — usado nas notificações de processo/mensagem.
//  Dois toques macios e descendentes (G5 → C5), ondas senoidais,
//  volume baixo e decaimento longo: um "ding" discreto, nada estridente.
// ══════════════════════════════════════════════════════
export function playSoftAlert() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    const notas = [
      { freq: 783.99, t: 0.0 },   // G5
      { freq: 523.25, t: 0.16 },  // C5
    ];

    notas.forEach(({ freq, t }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      // Um leve harmônico uma oitava acima, bem baixinho, dá "brilho" de sino.
      const brilho = ctx.createOscillator();
      const brilhoGain = ctx.createGain();
      brilho.type = 'sine';
      brilho.frequency.value = freq * 2;

      const t0 = now + t;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.10, t0 + 0.05);          // ataque suave
      gain.gain.exponentialRampToValueAtTime(0.0006, t0 + 0.9);    // decaimento longo
      brilhoGain.gain.setValueAtTime(0, t0);
      brilhoGain.gain.linearRampToValueAtTime(0.02, t0 + 0.05);
      brilhoGain.gain.exponentialRampToValueAtTime(0.0004, t0 + 0.7);

      osc.connect(gain); gain.connect(ctx.destination);
      brilho.connect(brilhoGain); brilhoGain.connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.95);
      brilho.start(t0); brilho.stop(t0 + 0.75);
    });

    setTimeout(() => ctx.close().catch(() => {}), 2500);
  } catch {
    // Áudio indisponível — silencioso.
  }
}
