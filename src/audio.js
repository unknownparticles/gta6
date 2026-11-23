export function audioSystem(settings) {
  const music = new Audio(import.meta.env.BASE_URL + 'media/synth-wave.mp3');
  music.loop = true;
  music.preload = 'none';
  let context;
  let engine;
  let gain;
  let moving = false;
  const playMusic = () => {
    music.volume = Number(settings.music);
    if (music.volume === 0) music.pause();
    else music.play().catch(() => {});
  };
  const unlock = () => {
    playMusic();
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!context) {
      context = new AudioContext();
      engine = context.createOscillator();
      const lowpass = context.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 160;
      engine.type = 'sawtooth';
      engine.frequency.value = 31;
      gain = context.createGain();
      gain.gain.value = 0;
      engine.connect(lowpass).connect(gain).connect(context.destination);
      engine.start();
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
  };
  const tone = (type, from, to, duration, loudness) => {
    if (!context || context.state !== 'running' || settings.effects === 0) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const time = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, time);
    oscillator.frequency.exponentialRampToValueAtTime(to, time + duration);
    envelope.gain.setValueAtTime(loudness * settings.effects, time);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + duration);
    oscillator.connect(envelope).connect(context.destination);
    oscillator.start();
    oscillator.stop(time + duration);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
  };
  return {
    unlock,
    settings: playMusic,
    engine(speed, active, wanted) {
      moving = active;
      if (!context || !gain) return;
      gain.gain.setTargetAtTime(
        active ? (0.025 + Math.min(0.09, Math.abs(speed) * 0.0028)) * settings.effects : 0,
        context.currentTime,
        0.075,
      );
      engine.frequency.setTargetAtTime(28 + Math.abs(speed) * 2.25, context.currentTime, 0.085);
      if (!music.paused) music.playbackRate = wanted ? 1.06 : 1;
    },
    cue(name) {
      const sound = {
        click: ['sine', 610, 430, 0.08, 0.11],
        mark: ['triangle', 430, 660, 0.2, 0.16],
        crash: ['sawtooth', 90, 34, 0.16, 0.19],
        shot: ['sawtooth', 280, 58, 0.14, 0.17],
        alarm: ['triangle', 510, 230, 0.45, 0.16],
        win: ['sine', 420, 990, 0.48, 0.18],
        reload: ['square', 220, 185, 0.12, 0.059],
      }[name];
      if (sound) tone(...sound);
    },
    pause() {
      if (moving && context && gain) gain.gain.setTargetAtTime(0, context.currentTime, 0.05);
      moving = false;
    },
    muteForBackground() {
      music.pause();
      this.pause();
    },
  };
}
