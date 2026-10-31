/**
 * Audio synthesis engine for Gọi Tên Siêu Cấp AI
 * Uses Web Audio API for 100% offline, zero-latency classroom sound effects.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.8;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted() {
    return this.isMuted;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  public getVolume() {
    return this.volume;
  }

  // Quick tactile button click
  public playClick() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.15 * this.volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch {
      // Audio autoplay policy
    }
  }

  // Futuristic radar scanning blip
  public playScanBeep(progress: number = 0.5) {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Frequency rises slightly as scanning progresses
      const baseFreq = 500 + progress * 600;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(baseFreq * 1.5, this.ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.08 * this.volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.06);
    } catch {
      // ignore
    }
  }

  // Heartbeat / suspense pulse
  public playSuspensePulse(intensity: number = 1) {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140 + intensity * 60, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.3 * this.volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.14);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.14);
    } catch {
      // ignore
    }
  }

  // Heavy sci-fi Target Lock impact
  public playTargetLocked() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Deep impact sub-bass
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(160, now);
      sub.frequency.exponentialRampToValueAtTime(40, now + 0.4);

      subGain.gain.setValueAtTime(0.45 * this.volume, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      sub.connect(subGain);
      subGain.connect(this.ctx.destination);
      sub.start(now);
      sub.stop(now + 0.45);

      // Sci-fi high chime
      const chime = this.ctx.createOscillator();
      const chimeGain = this.ctx.createGain();
      chime.type = 'square';
      chime.frequency.setValueAtTime(880, now);
      chime.frequency.setValueAtTime(1320, now + 0.1);
      chime.frequency.setValueAtTime(1760, now + 0.2);

      chimeGain.gain.setValueAtTime(0.15 * this.volume, now);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      chime.connect(chimeGain);
      chimeGain.connect(this.ctx.destination);
      chime.start(now);
      chime.stop(now + 0.5);
    } catch {
      // ignore
    }
  }

  // Joyful classroom celebration fanfare
  public playFanfare() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      const start = this.ctx.currentTime + 0.05;

      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start + idx * 0.1);

        const duration = idx === notes.length - 1 ? 0.6 : 0.15;
        gain.gain.setValueAtTime(0.25 * this.volume, start + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, start + idx * 0.1 + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(start + idx * 0.1);
        osc.stop(start + idx * 0.1 + duration);
      });
    } catch {
      // ignore
    }
  }
}

export const sound = new SoundEngine();
