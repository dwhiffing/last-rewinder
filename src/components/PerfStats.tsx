// Dev-only measurements of how hard the 3D view is working, as a stand-in
// for energy use (browsers can't read power draw). PerfProbe sits inside the
// Canvas and times every frame; PerfPanel shows the numbers once a second.
//
// - Draws/s: how many frames the 3D view actually rendered
// - CPU ms: JavaScript time per frame (game logic, hover, three.js setup)
// - GPU ms: GPU time per frame, if the browser exposes timer queries
//   (Chrome does; Safari doesn't)
// - busy %: share of each second spent on that work - the closest thing to
//   an energy figure here; lower is better
// - calls / tris: draw calls and triangles in the last frame
//
// Not counted: the browser's own compositing of the page (CSS filters,
// blend modes, animated overlays). Use the toggles to compare those, with
// Activity Monitor's Energy Impact or Chrome's Task Manager (GPU column).
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'

const stats = {
  frames: 0,
  cpuMs: 0,
  gpuMs: 0,
  gpuSamples: 0,
  gpuSupported: false,
  calls: 0,
  triangles: 0,
  programs: 0,
  textures: 0,
  geometries: 0,
}

export function PerfProbe() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    // several passes render each frame (scene, warp, output); count them all
    gl.info.autoReset = false
    return () => void (gl.info.autoReset = true)
  }, [gl])
  const ctx = gl.getContext() as WebGL2RenderingContext
  const ext = useMemo(() => ctx.getExtension('EXT_disjoint_timer_query_webgl2'), [ctx])
  stats.gpuSupported = !!ext
  // kept across re-renders: the frame's start time and GPU queries in flight
  const t = useMemo(() => ({ start: 0, pending: [] as WebGLQuery[], active: null as WebGLQuery | null }), [])
  useFrame(() => {
    const { pending } = t
    t.start = performance.now()
    gl.info.reset()
    if (ext) {
      // collect finished GPU timings from earlier frames
      while (pending.length) {
        const q = pending[0]
        if (!ctx.getQueryParameter(q, ctx.QUERY_RESULT_AVAILABLE)) break
        pending.shift()
        if (!ctx.getParameter(ext.GPU_DISJOINT_EXT)) {
          stats.gpuMs += ctx.getQueryParameter(q, ctx.QUERY_RESULT) / 1e6
          stats.gpuSamples++
        }
        ctx.deleteQuery(q)
      }
      t.active = ctx.createQuery()
      if (t.active) ctx.beginQuery(ext.TIME_ELAPSED_EXT, t.active)
    }
  }, -1000)
  useFrame(() => {
    if (ext && t.active) {
      ctx.endQuery(ext.TIME_ELAPSED_EXT)
      t.pending.push(t.active)
      t.active = null
    }
    stats.frames++
    stats.cpuMs += performance.now() - t.start
    stats.calls = gl.info.render.calls
    stats.triangles = gl.info.render.triangles
    stats.programs = gl.info.programs?.length ?? 0
    stats.textures = gl.info.memory.textures
    stats.geometries = gl.info.memory.geometries
  }, 1000)
  return null
}

interface Reading {
  fps: number
  cpuMs: number
  gpuMs: number | null
  cpuBusy: number
  gpuBusy: number | null
  calls: number
  triangles: number
  programs: number
  textures: number
  geometries: number
}

export function PerfPanel() {
  const [reading, setReading] = useState<Reading | null>(null)
  useEffect(() => {
    let last = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const seconds = (now - last) / 1000
      last = now
      const frames = stats.frames || 1
      const gpuPerFrame = stats.gpuSamples ? stats.gpuMs / stats.gpuSamples : null
      setReading({
        fps: stats.frames / seconds,
        cpuMs: stats.cpuMs / frames,
        gpuMs: gpuPerFrame,
        cpuBusy: (stats.cpuMs / (seconds * 1000)) * 100,
        gpuBusy: gpuPerFrame === null ? null : ((gpuPerFrame * stats.frames) / (seconds * 1000)) * 100,
        calls: stats.calls,
        triangles: stats.triangles,
        programs: stats.programs,
        textures: stats.textures,
        geometries: stats.geometries,
      })
      stats.frames = 0
      stats.cpuMs = 0
      stats.gpuMs = 0
      stats.gpuSamples = 0
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])
  if (!reading) return null
  const r = reading
  const na = stats.gpuSupported ? '…' : 'n/a'
  return (
    <div className="perf-panel">
      <div>
        Draws/s <b>{r.fps.toFixed(0)}</b>
      </div>
      <div>
        CPU <b>{r.cpuMs.toFixed(2)}</b> ms · busy <b>{r.cpuBusy.toFixed(1)}%</b>
      </div>
      <div>
        GPU <b>{r.gpuMs === null ? na : r.gpuMs.toFixed(2)}</b> ms · busy{' '}
        <b>{r.gpuBusy === null ? na : `${r.gpuBusy.toFixed(1)}%`}</b>
      </div>
      <div>
        calls <b>{r.calls}</b> · tris <b>{(r.triangles / 1000).toFixed(0)}k</b>
      </div>
      <div>
        shaders <b>{r.programs}</b> · tex <b>{r.textures}</b> · geo <b>{r.geometries}</b>
      </div>
    </div>
  )
}
