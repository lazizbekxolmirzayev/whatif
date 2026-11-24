/** Honest placeholder: no video-generation provider is integrated yet, so nothing is faked. */
export default function VideoPanel() {
  return (
    <div className="rounded-xl border border-white/10 bg-midnight-900 p-5">
      <p className="text-xs uppercase tracking-widest text-gold-400">Cinematic AI video</p>
      <p className="mt-2 text-sm text-parchment/70">
        Not available yet. No video-generation service has been connected to WHATIF, so this scene cannot be rendered. When it ships, generated clips will be labelled as fictional.
      </p>
      <button disabled className="mt-3 cursor-not-allowed rounded-md border border-white/10 px-3 py-1.5 text-sm text-parchment/40">
        Generate scene (unavailable)
      </button>
    </div>
  )
}
