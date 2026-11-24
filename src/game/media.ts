import type { MediaRef } from './types.ts'

/**
 * Integration contract for FUTURE video generation/hosting providers.
 *
 * No provider is configured in this build, so no outcome carries a video and the game always plays
 * the real-time 3D cinematic. Nothing here fabricates a URL or pretends an animation is a video.
 * To integrate a provider: implement VideoProvider (server-side, keys in env vars, never in the
 * client), return a MediaRef with a real video URL, and attach it to Outcome.media.
 */
export interface VideoRequest {
  scenarioId: string
  outcomeTitle: string
  /** human-written scene description the provider can use as a prompt */
  description: string
  fictional: boolean
}

export type VideoStatus = { state: 'unavailable'; reason: string } | { state: 'pending'; jobId: string } | { state: 'ready'; media: MediaRef } | { state: 'failed'; reason: string }

export interface VideoProvider {
  id: string
  name: string
  isConfigured(): boolean
  request(req: VideoRequest): Promise<VideoStatus>
}

/** Registry of configured providers. Intentionally empty. */
export const VIDEO_PROVIDERS: VideoProvider[] = []

export function videoProviderStatus(): { configured: boolean; message: string } {
  const active = VIDEO_PROVIDERS.filter((p) => p.isConfigured())
  return active.length
    ? { configured: true, message: `Video provider: ${active[0].name}` }
    : { configured: false, message: 'No AI video provider is configured. Playing the real-time 3D cinematic.' }
}
