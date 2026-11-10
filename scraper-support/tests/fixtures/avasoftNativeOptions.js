import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
export const avasoftCapture = () => JSON.parse(gunzipSync(readFileSync(new URL('../../../scraper/avasoft/test-data/current-public-20261103.json.gz', import.meta.url))))
export const avasoftNativeOptions = (mutate = () => {}, fixture = avasoftCapture()) => {
  const calls = [], counts = new Map()
  const fetchPage = async (url, init = {}) => {
    init.signal?.throwIfAborted()
    const index = counts.get(url) || 0
    counts.set(url, index + 1); calls.push({ url, method: init.method || 'GET' })
    const packet = structuredClone(fixture.packets.filter(packet => packet.url === url)[index])
    if (!packet) throw Error('Unexpected Avasoft fixture request: ' + url)
    mutate(packet, index)
    return { ...packet, url: packet.finalUrl }
  }
  return { now: () => fixture.runAt, calls, fetchPage, fetchText: async (url, init) => (await fetchPage(url, init)).body }
}
// Synthetic reactivation only. The current live six-card wrapper is hidden on
// every breakpoint, so these three India results are not live recovery evidence.
export const avasoftVisibleOpenings = packet => {
  if (!packet.name.endsWith('-careers')) return
  packet.body = packet.body.replace(/<div\b[^>]*\bopen-positions\b[^>]*>/g, tag => tag.replace(/\belementor-hidden-(?:desktop|laptop|tablet|mobile)\b/g, ''))
}
