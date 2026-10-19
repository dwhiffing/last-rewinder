const ctx = new AudioContext()

const sfxMaster = ctx.createGain()
sfxMaster.gain.value = 1
sfxMaster.connect(ctx.destination)

export function setSfxMuted(muted: boolean) {
  sfxMaster.gain.value = muted ? 0 : 1
}

export function resumeAudioContext() {
  if (ctx.state === 'suspended') ctx.resume()
}

let lastStepTime = 0
const STEP_INTERVAL_MS = 500

// Pre-bake footstep buffers and a persistent filter chain to avoid per-step allocations
const STEP_POOL_SIZE = 8
const _stepBuffers: AudioBuffer[] = (() => {
  const rate = ctx.sampleRate
  const len = Math.floor(rate * 0.05)
  return Array.from({ length: STEP_POOL_SIZE }, () => {
    const buf = ctx.createBuffer(1, len, rate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6)
    }
    return buf
  })
})()
let _stepPoolIdx = 0

const _stepFilter = ctx.createBiquadFilter()
_stepFilter.type = 'lowpass'
_stepFilter.frequency.value = 200
const _stepGain = ctx.createGain()
_stepGain.gain.value = 0.9
_stepFilter.connect(_stepGain)
_stepGain.connect(sfxMaster)

export function tickFootstep(isMoving: boolean, now: number) {
  if (!isMoving || now - lastStepTime < STEP_INTERVAL_MS) return
  lastStepTime = now
  playFootstep()
}

// One footstep, played every time you step to a new spot
export function playFootstep() {
  const source = ctx.createBufferSource()
  source.buffer = _stepBuffers[_stepPoolIdx % STEP_POOL_SIZE]
  _stepPoolIdx++
  source.connect(_stepFilter)
  source.start()
}

function playTone(freq: number, start: number, dur: number, peak = 0.25) {
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = freq

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(peak, start + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur)

  osc.connect(gain)
  gain.connect(sfxMaster)
  osc.start(start)
  osc.stop(start + dur)
}

// Placeholder: two-note shop door chime
export function playGameStart() {
  const now = ctx.currentTime
  playTone(880, now, 0.6)
  playTone(660, now + 0.25, 0.8)
}

// Placeholder: short click when interacting with something
export function playInteract() {
  playTone(1200, ctx.currentTime, 0.08, 0.15)
}

function playBuzz(freq: number, start: number, dur: number, peak = 0.12) {
  const osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.value = freq
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(peak, start)
  gain.gain.setValueAtTime(peak, start + dur - 0.02)
  gain.gain.linearRampToValueAtTime(0, start + dur)
  osc.connect(gain)
  gain.connect(sfxMaster)
  osc.start(start)
  osc.stop(start + dur)
}

// Placeholder: low double buzz when a tape doesn't fit an order
export function playError() {
  const now = ctx.currentTime
  playBuzz(110, now, 0.12)
  playBuzz(98, now + 0.15, 0.18)
}

// Placeholder: rising arpeggio when an order is filled
export function playCash() {
  const now = ctx.currentTime
  playTone(1046, now, 0.15, 0.2)
  playTone(1318, now + 0.07, 0.15, 0.2)
  playTone(1568, now + 0.14, 0.35, 0.2)
}

// Placeholder: computer beep when a new order arrives
export function playOrderIn() {
  const now = ctx.currentTime
  playTone(1500, now, 0.07, 0.12)
  playTone(1500, now + 0.12, 0.07, 0.12)
}

// Placeholder: soft whoosh of filtered noise when turning on the spot
const _whooshBuffer = (() => {
  const len = Math.floor(ctx.sampleRate * 0.3)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return buf
})()
export function playWhoosh() {
  const t = ctx.currentTime
  const source = ctx.createBufferSource()
  source.buffer = _whooshBuffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 1.2
  filter.frequency.setValueAtTime(350, t)
  filter.frequency.exponentialRampToValueAtTime(1400, t + 0.12)
  filter.frequency.exponentialRampToValueAtTime(500, t + 0.25)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.22, t + 0.08)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
  source.connect(filter).connect(gain).connect(sfxMaster)
  source.start(t)
}
