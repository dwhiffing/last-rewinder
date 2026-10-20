import { isSnack } from '../data/snacks'
import clickUrl from '../assets/click.mp3'
import dayEndUrl from '../assets/day-end.mp3'
import dropUrl from '../assets/drop.mp3'
import errorUrl from '../assets/error.mp3'
import failUrl from '../assets/fail.mp3'
import tapUrl from '../assets/tap.mp3'
import wallTapUrl from '../assets/tap-wall.mp3'
import windowTapUrl from '../assets/window-tap.mp3'
import lockedDoorUrl from '../assets/locked-door.mp3'
import pickupUrl from '../assets/pickup.mp3'
import pickupTapeUrl from '../assets/pickup-tape.mp3'
import putDownTapeUrl from '../assets/put-down-tape.mp3'
import typingUrl from '../assets/typing.mp3'
import powerOffUrl from '../assets/power-off2.mp3'
import powerOnUrl from '../assets/power-on.mp3'
import rewindUrl from '../assets/rewind.mp3'
import rewindTapeUrl from '../assets/rewind-tape.mp3'

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
_stepGain.gain.value = 2.025
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

// A tape rewinding as the game starts
export function playGameStart() {
  playClip(rewindClip, 1, 0.45)
}

// Placeholder: short click when interacting with something
export function playInteract() {
  playTone(1200, ctx.currentTime, 0.08, 0.15)
}

// Anything you can't do: a tape that doesn't fit, full hands, an unrewound
// tape you try to shelf, and so on
export function playError() {
  playClip(errorClip, 1, 0.5)
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
// Locked door: the leaf rattling against the latch. The door shakes for the
// length of the clip, then the message shows.
export const DOOR_RATTLE_SECONDS = 0.78
export function playDoorRattle(volume = 0.25) {
  playClip(lockedDoorClip, 1, volume)
}

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
  gain.gain.linearRampToValueAtTime(0.1265, t + 0.08)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
  source.connect(filter).connect(gain).connect(sfxMaster)
  source.start(t)
}

// Recorded clips, decoded once up front
function loadClip(url: string) {
  return fetch(url)
    .then((r) => r.arrayBuffer())
    .then((data) => ctx.decodeAudioData(data))
}
const powerOffClip = loadClip(powerOffUrl)
const powerOnClip = loadClip(powerOnUrl)
const rewindClip = loadClip(rewindUrl)
const rewindTapeClip = loadClip(rewindTapeUrl)
const pickupClip = loadClip(pickupUrl)
const dropClip = loadClip(dropUrl)
const pickupTapeClip = loadClip(pickupTapeUrl)
const putDownTapeClip = loadClip(putDownTapeUrl)
const typingClip = loadClip(typingUrl)
const lockedDoorClip = loadClip(lockedDoorUrl)
const errorClip = loadClip(errorUrl)
const failClip = loadClip(failUrl)

// An order ran out of time
export function playFail() {
  playClip(failClip, 1, 0.5)
}
const clickClip = loadClip(clickUrl)
const tapClip = loadClip(tapUrl)
const windowTapClip = loadClip(windowTapUrl)
const wallTapClip = loadClip(wallTapUrl)

// Knocking on a wall
export function playWallTap() {
  playClip(wallTapClip, 1, 1.3)
}
const dayEndClip = loadClip(dayEndUrl)

// The store closing for the day, as the summary comes up
export function playDayEnd() {
  playClip(dayEndClip)
}

// Knocking on the shop window
export function playWindowTap() {
  playClip(windowTapClip, 1, 1.5)
}

// Tapping on a shelf with nothing in your hands
export function playTap() {
  playClip(tapClip, 1, 0.5)
}

// Closing the order computer
export function playClick() {
  playClip(clickClip, 1, 1.7)
}

// Tapping at the keyboard as you sit down at the order computer
export function playTyping() {
  playClip(typingClip, 1, 0.75)
}

// A tape or snack coming into your hands, and leaving them
// Tapes and snacks each have their own sounds
export function playPickup(itemId: string) {
  if (isSnack(itemId)) playClip(pickupClip, 1, 1.25)
  else playClip(pickupTapeClip)
}
export function playDrop(itemId: string) {
  if (isSnack(itemId)) playClip(dropClip)
  else playClip(putDownTapeClip)
}

function playClip(clip: Promise<AudioBuffer>, rate = 1, volume = 1) {
  clip.then((buffer) => {
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = rate
    const gain = ctx.createGain()
    gain.gain.value = volume
    source.connect(gain).connect(sfxMaster)
    source.start()
  })
}

// The lights going out, sped up 40%
export function playPowerOff() {
  playClip(powerOffClip, 1.4)
}

export function playPowerOn() {
  playClip(powerOnClip)
}

// The rewinder whirring for `seconds`: the clip's first 3 seconds spin it up,
// the middle loops for as long as it takes, and its last 3 seconds spin it down
// just as the tape finishes. Volume is set from outside (it follows how close
// you are) and starts silent until the first setVolume.
const REWIND_EASE = 3
const SPLICE = 0.03
export interface RewindSound {
  setVolume: (volume: number) => void
  stop: () => void
}
export function startRewindSound(seconds: number): RewindSound {
  const out = ctx.createGain()
  out.gain.value = 0
  out.connect(sfxMaster)
  const sources: AudioBufferSourceNode[] = []
  let stopped = false

  rewindTapeClip.then((buffer) => {
    if (stopped) return
    const ease = Math.min(REWIND_EASE, buffer.duration / 3)
    const now = ctx.currentTime
    const tailStart = now + Math.max(seconds, ease * 2) - ease

    // spin-up, then the middle on a loop until the spin-down takes over
    const body = ctx.createBufferSource()
    body.buffer = buffer
    body.loop = true
    body.loopStart = ease
    body.loopEnd = buffer.duration - ease
    const bodyGain = ctx.createGain()
    bodyGain.gain.setValueAtTime(1, tailStart - SPLICE)
    bodyGain.gain.linearRampToValueAtTime(0, tailStart)
    body.connect(bodyGain).connect(out)
    body.start(now)
    body.stop(tailStart)

    // spin-down: the clip's last seconds, crossfaded in over the splice
    const tail = ctx.createBufferSource()
    tail.buffer = buffer
    const tailGain = ctx.createGain()
    tailGain.gain.setValueAtTime(0, tailStart - SPLICE)
    tailGain.gain.linearRampToValueAtTime(1, tailStart)
    tail.connect(tailGain).connect(out)
    tail.start(tailStart - SPLICE, buffer.duration - ease - SPLICE)

    sources.push(body, tail)
  })

  return {
    setVolume: (volume) => out.gain.setTargetAtTime(volume, ctx.currentTime, 0.05),
    stop: () => {
      stopped = true
      const t = ctx.currentTime
      out.gain.cancelScheduledValues(t)
      out.gain.setValueAtTime(out.gain.value, t)
      out.gain.linearRampToValueAtTime(0, t + 0.05)
      for (const source of sources) source.stop(t + 0.06)
    },
  }
}
