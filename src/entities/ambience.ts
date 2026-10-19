// Background music: a low drone that's always there, plus one of a few
// VHS-tape flavoured layers on top. The music starts on the first input on
// the menu and keeps playing into the game. The layer can be switched while
// playing so we can compare versions.
const ctx = new AudioContext()

const master = ctx.createGain()
master.gain.value = 0
master.connect(ctx.destination)

const MUSIC_GAIN = 0.45
let musicMuted = false
let running = false

// Reverb via convolution with noise impulse
function makeReverb(duration = 3, decay = 2): ConvolverNode {
  const rate = ctx.sampleRate
  const len = Math.floor(rate * duration)
  const buffer = ctx.createBuffer(2, len, rate)
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
  }
  const reverb = ctx.createConvolver()
  reverb.buffer = buffer
  return reverb
}

const reverb = makeReverb(3, 2.5)
const reverbGain = ctx.createGain()
reverbGain.gain.value = 0.5
reverb.connect(reverbGain)
reverbGain.connect(master)

function noiseBuffer(seconds: number) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return buffer
}
const NOISE = noiseBuffer(4)

function loopNoise() {
  const source = ctx.createBufferSource()
  source.buffer = NOISE
  source.loop = true
  return source
}

// Tape "wow and flutter": a slow and a fast wobble that can be wired into any
// oscillator's detune (in cents)
function wowFlutter(wowCents: number, flutterCents: number) {
  const out = ctx.createGain()
  out.gain.value = 1
  const wow = ctx.createOscillator()
  wow.frequency.value = 0.35 + Math.random() * 0.2
  const wowDepth = ctx.createGain()
  wowDepth.gain.value = wowCents
  wow.connect(wowDepth).connect(out)
  const flutter = ctx.createOscillator()
  flutter.frequency.value = 6 + Math.random() * 2
  const flutterDepth = ctx.createGain()
  flutterDepth.gain.value = flutterCents
  flutter.connect(flutterDepth).connect(out)
  wow.start()
  flutter.start()
  return { out, stop: () => (wow.stop(), flutter.stop()) }
}

// ---- the drone (always on) ---------------------------------------------

function startDrone() {
  const wobble = wowFlutter(6, 1.5)
  for (const freq of [55, 55.3, 110.1]) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    wobble.out.connect(osc.detune)

    const gain = ctx.createGain()
    gain.gain.value = 0.03

    // slow tremolo
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07 + Math.random() * 0.02
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.01
    lfo.connect(lfoGain)
    lfoGain.connect(gain.gain)
    lfo.start()

    osc.connect(gain)
    gain.connect(reverb)
    gain.connect(master)
    osc.start()
  }
}

// ---- layers ------------------------------------------------------------

interface Layer {
  stop: () => void
}

// Runs `fn` again after whatever delay (seconds) it returns, until stopped
function every(fn: () => number) {
  let alive = true
  let timer = 0
  const loop = () => {
    if (!alive) return
    timer = window.setTimeout(loop, fn() * 1000)
  }
  timer = window.setTimeout(loop, 500)
  return () => {
    alive = false
    window.clearTimeout(timer)
  }
}

// Steady high tape hiss
function hiss(bus: AudioNode, level: number) {
  const source = loopNoise()
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 3500
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 9000
  const gain = ctx.createGain()
  gain.gain.value = level
  source.connect(hp).connect(lp).connect(gain).connect(bus)
  source.start()
  return () => source.stop()
}

// Short burst of filtered noise: clicks, clunks and thumps of the deck
function noiseHit(bus: AudioNode, t: number, freq: number, dur: number, level: number, type: BiquadFilterType = 'lowpass') {
  const source = ctx.createBufferSource()
  source.buffer = NOISE
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.value = freq
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(level, t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  source.connect(filter).connect(gain).connect(bus)
  source.start(t, Math.random() * 3)
  source.stop(t + dur + 0.05)
}

// 1) Tape hiss: hiss, the odd dropout where the sound dips, and soft
// head-switching ticks
function tapeHissLayer(bus: GainNode): Layer {
  const stopHiss = hiss(bus, 0.05)
  const stopDropouts = every(() => {
    const t = ctx.currentTime
    const dip = 0.15 + Math.random() * 0.4
    master.gain.cancelScheduledValues(t)
    const level = musicMuted ? 0 : MUSIC_GAIN
    master.gain.setValueAtTime(level, t)
    master.gain.linearRampToValueAtTime(level * 0.35, t + 0.03)
    master.gain.linearRampToValueAtTime(level, t + dip)
    return 6 + Math.random() * 10
  })
  const stopTicks = every(() => {
    const t = ctx.currentTime
    noiseHit(bus, t, 2500, 0.02, 0.05, 'bandpass')
    return 1.5 + Math.random() * 4
  })
  return {
    stop: () => {
      stopHiss()
      stopDropouts()
      stopTicks()
    },
  }
}

// 2) Machine room: mains hum from the deck motor, mechanical clunks and the
// whirr of a tape rewinding somewhere
function machineLayer(bus: GainNode): Layer {
  const stopHiss = hiss(bus, 0.02)
  const hum = ctx.createOscillator()
  hum.type = 'sawtooth'
  hum.frequency.value = 60
  const humFilter = ctx.createBiquadFilter()
  humFilter.type = 'lowpass'
  humFilter.frequency.value = 240
  const humGain = ctx.createGain()
  humGain.gain.value = 0.025
  hum.connect(humFilter).connect(humGain).connect(bus)
  hum.start()

  const stopClunks = every(() => {
    const t = ctx.currentTime
    // a clunk is a low thump followed by a little latch click
    noiseHit(bus, t, 160, 0.18, 0.35)
    noiseHit(bus, t + 0.09, 1800, 0.03, 0.08, 'bandpass')
    return 5 + Math.random() * 8
  })
  const stopRewinds = every(() => {
    const t = ctx.currentTime
    const dur = 2 + Math.random() * 2
    // rewinding: a whirr that speeds up then stops with a clack
    const whirr = ctx.createOscillator()
    whirr.type = 'sawtooth'
    whirr.frequency.setValueAtTime(90, t)
    whirr.frequency.exponentialRampToValueAtTime(420, t + dur)
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(400, t)
    filter.frequency.exponentialRampToValueAtTime(1600, t + dur)
    filter.Q.value = 3
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.03, t + 0.4)
    gain.gain.setValueAtTime(0.03, t + dur - 0.05)
    gain.gain.linearRampToValueAtTime(0, t + dur)
    whirr.connect(filter).connect(gain).connect(bus)
    gain.connect(reverb)
    whirr.start(t)
    whirr.stop(t + dur)
    noiseHit(bus, t + dur, 1200, 0.05, 0.15, 'bandpass')
    return 14 + Math.random() * 14
  })
  return {
    stop: () => {
      stopHiss()
      hum.stop()
      stopClunks()
      stopRewinds()
    },
  }
}

// 3) Warped synth: a slow, worn-out pad playing an 80s chord loop through a
// dull, warbling tape
const CHORDS = [
  [220, 261.6, 329.6], // Am
  [174.6, 220, 261.6], // F
  [261.6, 329.6, 392], // C
  [196, 246.9, 293.7], // G
]
function warpedSynthLayer(bus: GainNode): Layer {
  const stopHiss = hiss(bus, 0.035)
  const wobble = wowFlutter(18, 4)
  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 900
  tone.connect(bus)
  tone.connect(reverb)
  let chord = 0
  const stopChords = every(() => {
    const t = ctx.currentTime
    const dur = 8
    for (const freq of CHORDS[chord % CHORDS.length]) {
      for (const detune of [-7, 7]) {
        const osc = ctx.createOscillator()
        osc.type = 'triangle'
        osc.frequency.value = freq / 2
        osc.detune.value = detune
        wobble.out.connect(osc.detune)
        const gain = ctx.createGain()
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(0.018, t + 2)
        gain.gain.setValueAtTime(0.018, t + dur - 1)
        gain.gain.linearRampToValueAtTime(0, t + dur + 1)
        osc.connect(gain).connect(tone)
        osc.start(t)
        osc.stop(t + dur + 1.1)
      }
    }
    chord++
    return dur
  })
  return {
    stop: () => {
      stopHiss()
      stopChords()
      wobble.stop()
    },
  }
}

export const MUSIC_VARIANTS = [
  { name: 'Tape hiss', make: tapeHissLayer },
  { name: 'Machine room', make: machineLayer },
  { name: 'Warped synth', make: warpedSynthLayer },
]

let variant = 0
let layer: { bus: GainNode; layer: Layer } | null = null
const listeners = new Set<() => void>()

function startLayer() {
  const bus = ctx.createGain()
  bus.gain.setValueAtTime(0, ctx.currentTime)
  bus.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5)
  bus.connect(master)
  layer = { bus, layer: MUSIC_VARIANTS[variant].make(bus) }
}

function stopLayer() {
  if (!layer) return
  const old = layer
  layer = null
  old.bus.gain.cancelScheduledValues(ctx.currentTime)
  old.bus.gain.setValueAtTime(old.bus.gain.value, ctx.currentTime)
  old.bus.gain.linearRampToValueAtTime(0, ctx.currentTime + 1)
  window.setTimeout(() => {
    old.layer.stop()
    old.bus.disconnect()
  }, 1100)
}

export const getMusicVariant = () => variant

export function onMusicVariantChange(fn: () => void) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

export function cycleMusicVariant() {
  variant = (variant + 1) % MUSIC_VARIANTS.length
  if (running) {
    stopLayer()
    startLayer()
  }
  listeners.forEach((fn) => fn())
}

// Needs a user gesture first (browser autoplay rules); safe to call often
export function startMusic() {
  if (ctx.state === 'suspended') ctx.resume()
  if (running) return
  running = true
  startDrone()
  startLayer()
  if (!musicMuted) {
    master.gain.setValueAtTime(0, ctx.currentTime)
    master.gain.linearRampToValueAtTime(MUSIC_GAIN, ctx.currentTime + 4)
  }
}

export function setMusicMuted(muted: boolean) {
  musicMuted = muted
  master.gain.cancelScheduledValues(ctx.currentTime)
  master.gain.setValueAtTime(master.gain.value, ctx.currentTime)
  master.gain.linearRampToValueAtTime(
    muted || !running ? 0 : MUSIC_GAIN,
    ctx.currentTime + 0.5,
  )
}
