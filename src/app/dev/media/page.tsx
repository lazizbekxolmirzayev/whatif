import { notFound } from 'next/navigation'
import MediaDemo from './MediaDemo'

/** Development-only harness for the MediaPlayer. Not available in production builds. */
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <MediaDemo />
}
