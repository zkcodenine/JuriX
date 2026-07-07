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
