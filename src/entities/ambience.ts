import rainUrl from '../assets/rain.mp3'

// Background music: a low drone plus a worn-out synth pad warbling like an
// old tape, over the sound of rain outside. It starts on the first input
// on the menu and keeps playing into the game.
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

// Rain outside, from a recording. Each pass fades in at its start and out at
// its end, and the next pass starts during that fade-out, so the loop point
// is a crossfade rather than a gap or a click.
const RAIN_FADE = 2.5
const rainBuffer = fetch(rainUrl)
  .then((r) => r.arrayBuffer())
  .then((data) => ctx.decodeAudioData(data))

function rain(bus: AudioNode, level: number) {
  const out = ctx.createGain()
  out.gain.value = level
  out.connect(bus)
  let alive = true
  let timer = 0
  const sources: AudioBufferSourceNode[] = []

  rainBuffer.then((buffer) => {
    if (!alive) return
    const fade = Math.min(RAIN_FADE, buffer.duration / 4)
    const period = buffer.duration - fade
    let next = ctx.currentTime + 0.05
    const playPass = (start: number) => {
      const source = ctx.createBufferSource()
      source.buffer = buffer
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(1, start + fade)
      gain.gain.setValueAtTime(1, start + buffer.duration - fade)
      gain.gain.linearRampToValueAtTime(0, start + buffer.duration)
      source.connect(gain).connect(out)
      source.start(start)
      sources.push(source)
      source.onended = () => sources.splice(sources.indexOf(source), 1)
    }
    // keep the next pass scheduled a little ahead of time
    const schedule = () => {
      if (!alive) return
      while (next < ctx.currentTime + 1) {
        playPass(next)
        next += period
      }
      timer = window.setTimeout(schedule, 500)
    }
    schedule()
  })

  return () => {
    alive = false
    window.clearTimeout(timer)
    for (const source of sources) source.stop()
  }
}

// Warped synth: a slow, worn-out pad playing an 80s chord loop through a
// dull, warbling tape
const CHORDS = [
  [220, 261.6, 329.6], // Am
  [174.6, 220, 261.6], // F
  [261.6, 329.6, 392], // C
  [196, 246.9, 293.7], // G
]
function warpedSynthLayer(bus: GainNode): Layer {
  const stopRain = rain(bus, 0.6)
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
      stopRain()
      stopChords()
      wobble.stop()
    },
  }
}

function startLayer() {
  const bus = ctx.createGain()
  bus.connect(master)
  warpedSynthLayer(bus)
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

