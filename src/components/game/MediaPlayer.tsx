'use client'
import { useEffect, useRef, useState } from 'react'
import type { MediaRef } from '@/game/types'

type Status = 'loading' | 'ready' | 'error'
const fmt = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00')

/**
 * Cinematic media player for REAL video files. It never invents a source: it renders only the
 * MediaRef it is given and calls onFallback() when the file cannot be played, so the caller can
 * show the real-time 3D cinematic instead.
 */
export default function MediaPlayer({ media, title, fictional, onFallback, onEnded }: { media: MediaRef; title: string; fictional: boolean; onFallback: (reason: string) => void; onEnded?: () => void }) {
  const v = useRef<HTMLVideoElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [err, setErr] = useState('')
  const [playing, setPlaying] = useState(false)
  const [cur, setCur] = useState(0)
  const [dur, setDur] = useState(0)
  const [cc, setCc] = useState(true)
  const [full, setFull] = useState(false)
  const fail = (reason: string) => {
    setStatus('error')
    setErr(reason)
  }

  useEffect(() => {
    const onFs = () => setFull(document.fullscreenElement === box.current)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])
  // The element can load (or fail) before React hydrates and attaches listeners: sync once on mount.
  useEffect(() => {
    const el = v.current
    if (!el) return
    if (el.error) fail('The video file could not be loaded or is not a supported format.')
    else if (el.readyState >= 1) {
      setDur(el.duration)
      setStatus(el.readyState >= 2 ? 'ready' : 'loading')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.videoUrl])
  useEffect(() => {
    const t = v.current?.textTracks[0]
    if (t) t.mode = cc ? 'showing' : 'hidden'
  }, [cc, status])

  const toggle = () => {
    const el = v.current
    if (!el) return
    if (el.paused) void el.play().catch(() => undefined)
    else el.pause()
  }

  return (
    <div ref={box} className="relative w-full overflow-hidden rounded-lg border border-gold-500/20 bg-black" role="region" aria-label={`Video: ${title}`}>
      <div className="relative">
      <video
        ref={v}
        className="aspect-video w-full bg-black"
        src={media.videoUrl}
        poster={media.posterUrl}
        preload="metadata"
        playsInline
        crossOrigin="anonymous"
        onLoadedMetadata={(e) => {
          setDur(e.currentTarget.duration)
          setStatus('ready')
        }}
        onWaiting={() => setStatus('loading')}
        onCanPlay={() => setStatus('ready')}
        onLoadedData={() => setStatus('ready')}
        onPlaying={() => setStatus('ready')}
        onDurationChange={(e) => setDur(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => onEnded?.()}
        onError={() => fail('The video file could not be loaded or is not a supported format.')}
      >
        {media.captionsUrl && <track kind="captions" src={media.captionsUrl} srcLang="en" label="English" default />}
      </video>
      {status === 'loading' && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/50 text-sm text-parchment/80">Loading video…</div>}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-midnight-950/95 p-6 text-center">
          <p className="text-sm text-parchment/85">{err}</p>
          <button onClick={() => onFallback(err)} className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-midnight-950 hover:bg-gold-400">
            Play the real-time 3D cinematic instead
          </button>
        </div>
      )}
      {fictional && <span className="absolute left-3 top-3 rounded bg-black/70 px-2 py-0.5 text-[11px] uppercase tracking-widest text-gold-300">Alternate history · fiction</span>}
      </div>
      <div className="flex items-center gap-3 border-t border-white/10 bg-midnight-950/95 px-3 py-2 text-xs text-parchment/80">
        <button onClick={toggle} aria-label={playing ? 'Pause' : 'Play'} className="w-12 rounded border border-white/15 py-1 hover:border-gold-500/50">
          {playing ? 'Pause' : 'Play'}
        </button>
        <span className="tabular-nums">{fmt(cur)}</span>
        <input
          type="range"
          aria-label="Seek"
          className="h-1 flex-1 accent-[#d4b66c]"
          min={0}
          max={dur || 0}
          step={0.1}
          value={Math.min(cur, dur || 0)}
          onChange={(e) => {
            if (v.current) v.current.currentTime = Number(e.target.value)
          }}
        />
        <span className="tabular-nums">{fmt(dur)}</span>
        {media.captionsUrl && (
          <button onClick={() => setCc((x) => !x)} aria-pressed={cc} className={`rounded border px-2 py-1 ${cc ? 'border-gold-500/60 text-gold-300' : 'border-white/15'}`}>
            CC
          </button>
        )}
        <button onClick={() => (full ? void document.exitFullscreen() : void box.current?.requestFullscreen())} className="rounded border border-white/15 px-2 py-1 hover:border-gold-500/50">
          {full ? 'Exit' : 'Fullscreen'}
        </button>
      </div>
      {media.description && <p className="border-t border-white/5 bg-midnight-950 px-3 py-2 text-xs italic text-parchment/60">Scene: {media.description}</p>}
    </div>
  )
}
