/**
 * Sintetizador de audio procedural Web Audio API para el Laboratorio ZGerze.
 * Genera el sonido mecánico realista del botón circular rojo y los relés de sintonización.
 */
export class LabAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    const AudioCtor =
      window.AudioContext ||
      (window as unknown as {webkitAudioContext?: typeof AudioContext})
        .webkitAudioContext;
    if (!AudioCtor) return null;

    if (!this.ctx) {
      try {
        this.ctx = new AudioCtor();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Golpe mecánico pesado + clic de resorte al presionar el botón rojo de laboratorio.
   */
  public playButtonPress(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Sub-thump mecánico de carcasa
    const thumpOsc = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thumpOsc.type = 'triangle';
    thumpOsc.frequency.setValueAtTime(145, now);
    thumpOsc.frequency.exponentialRampToValueAtTime(42, now + 0.085);
    thumpGain.gain.setValueAtTime(0.28, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    thumpOsc.connect(thumpGain).connect(ctx.destination);
    thumpOsc.start(now);
    thumpOsc.stop(now + 0.1);

    // 2. Micro-switch metálico nítido
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snapOsc.type = 'square';
    snapOsc.frequency.setValueAtTime(1650, now + 0.008);
    snapOsc.frequency.exponentialRampToValueAtTime(520, now + 0.032);
    snapGain.gain.setValueAtTime(0.09, now + 0.008);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);
    snapOsc.connect(snapGain).connect(ctx.destination);
    snapOsc.start(now + 0.008);
    snapOsc.stop(now + 0.04);

    // 3. Relé de sintonización + tono de confirmación de señal
    const lockOsc = ctx.createOscillator();
    const lockGain = ctx.createGain();
    lockOsc.type = 'sine';
    lockOsc.frequency.setValueAtTime(580, now + 0.06);
    lockOsc.frequency.setValueAtTime(880, now + 0.12);
    lockGain.gain.setValueAtTime(0.0001, now + 0.055);
    lockGain.gain.linearRampToValueAtTime(0.075, now + 0.07);
    lockGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    lockOsc.connect(lockGain).connect(ctx.destination);
    lockOsc.start(now + 0.055);
    lockOsc.stop(now + 0.25);
  }

  /**
   * Retorno del resorte al soltar el botón.
   */
  public playButtonRelease(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.035);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
