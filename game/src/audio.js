// A whisper of synthesized sound — no audio files. A low room tone under
// everything, a soft tick for intel, a rising sting when a guard is sure,
// and a flat buzz when the night goes wrong. All of it can be muted.

export function createAudio() {
  let context = null;
  let muted = false;
  let roomTone = null;

  function ensure() {
    if (context) return true;
    try {
      context = new (window.AudioContext || window.webkitAudioContext)();
      const gain = context.createGain();
      gain.gain.value = 0.015;
      const osc = context.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 58;
      osc.connect(gain).connect(context.destination);
      osc.start();
      roomTone = { osc, gain };
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, seconds, type = 'sine', volume = 0.08, slideTo = null) {
    if (muted || !ensure()) return;
    const t = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + seconds);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    osc.connect(gain).connect(context.destination);
    osc.start(t);
    osc.stop(t + seconds + 0.02);
  }

  return {
    unlock() { ensure(); },
    toggleMute() {
      muted = !muted;
      if (roomTone) roomTone.gain.gain.value = muted ? 0 : 0.015;
      return muted;
    },
    get muted() { return muted; },
    intel() { tone(1180, 0.14, 'sine', 0.07); setTimeout(() => tone(1560, 0.18, 'sine', 0.06), 60); },
    suspect() { tone(340, 0.16, 'triangle', 0.05, 420); },
    camera() { tone(1560, 0.09, 'square', 0.03); setTimeout(() => tone(1560, 0.09, 'square', 0.03), 130); },
    spotted() { tone(220, 0.4, 'sawtooth', 0.07, 520); },
    caught() { tone(160, 0.7, 'square', 0.08, 60); },
    clear() { tone(660, 0.16, 'sine', 0.06); setTimeout(() => tone(880, 0.24, 'sine', 0.06), 110); },
    step() { tone(90, 0.03, 'sine', 0.012); },
  };
}
