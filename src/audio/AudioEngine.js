/**
 * Audio engine adapted from PixelSphere (pixelsphere/html5/src/audio.ts).
 * Uses Web Audio API for ambient underwater sounds and music.
 */

// Ambient music tracks from pixelsphere that work for underwater
const AMBIENT_TRACKS = [
  'aqua',      // perfect fit
  'dark09',
  'koto8',
  'radius',
  'starRise',
  'synthWave',
];

// Underwater SFX
const WATER_SFX = {
  bubble: { frequencies: [800, 1200, 600], duration: 0.15, type: 'sine' },
  ambientHum: { frequency: 60, duration: 0, type: 'sine' }, // continuous
  waterFlow: { frequency: 200, duration: 0, type: 'sawtooth' },
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicSource = null;
    this.musicBuffer = null;
    this.muted = false;
    this.currentTrack = null;

    // Ambient layers
    this.ambientNodes = [];
  }

  async init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.25;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.3;
    this.sfxGain.connect(this.masterGain);

    // Start ambient underwater hum
    this._createAmbientHum();
  }

  _createAmbientHum() {
    if (!this.ctx) return;

    // Deep ocean hum
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 55;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.04;

    // Filter to make it muffled
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 100;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();

    this.ambientNodes.push({ osc, gain, filter });

    // Water noise layer (filtered white noise)
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.01;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 300;
    noiseFilter.Q.value = 0.5;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.value = 0.08;

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start();

    this.ambientNodes.push({ source: noise, gain: noiseGain, filter: noiseFilter });
  }

  async playMusic(trackName) {
    if (!this.ctx) await this.init();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    // Stop current
    if (this.musicSource) {
      this.musicSource.stop();
      this.musicSource = null;
    }

    // Path to pixelsphere music
    const path = `/music/${trackName}.mp3`;
    try {
      const response = await fetch(path);
      const arrayBuffer = await response.arrayBuffer();
      this.musicBuffer = await this.ctx.decodeAudioData(arrayBuffer);

      this.musicSource = this.ctx.createBufferSource();
      this.musicSource.buffer = this.musicBuffer;
      this.musicSource.loop = true;
      this.musicSource.connect(this.musicGain);
      this.musicSource.start();
      this.currentTrack = trackName;
    } catch (e) {
      console.warn('Music load failed:', trackName, e);
    }
  }

  playBubbleSound() {
    if (!this.ctx || this.muted) return;
    const freq = 600 + Math.random() * 800;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, this.ctx.currentTime + 0.1);

    const gain = this.ctx.createGain();
    gain.gain.value = 0.02;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  toggle() {
    this.muted = !this.muted;
    this.masterGain.gain.value = this.muted ? 0 : 0.5;
  }

  setMusicVolume(v) {
    if (this.musicGain) this.musicGain.gain.value = v;
  }

  setSfxVolume(v) {
    if (this.sfxGain) this.sfxGain.gain.value = v;
  }

  getTrackList() {
    return AMBIENT_TRACKS;
  }
}
