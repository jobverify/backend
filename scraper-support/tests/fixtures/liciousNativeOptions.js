import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

export const liciousCapture = () => JSON.parse(gunzipSync(readFileSync(new URL('../../../scraper/licious/fixtures/native-20261026.json.gz', import.meta.url))))
export const liciousNativeOptions = (fixture = liciousCapture(), mutate = () => {}) => {
  const counts = new Map(), calls = []
  const load = async (url, init = {}) => {
    init.signal?.throwIfAborted()
    const body = init.body ?? null
    calls.push({ url, body })
    const key = JSON.stringify([url, body]), index = counts.get(key) || 0
    counts.set(key, index + 1)
    // The retired entry URL redirects to the current corporate careers page.
    const requested = url === 'https://careers.licious.com/' ? 'https://www.licious.in/careers' : url
    const packet = structuredClone(fixture.packets.filter(p => p.url === requested && p.requestBody === body)[index])
    if (!packet) throw Error(`Unexpected Licious fixture request: ${url}`)
    mutate(packet, index)
    return packet
  }
  return { calls, now: () => fixture.runAt,
    fetchText: async (url, init) => (await load(url, init)).body,
    fetchPage: async (url, init) => {
      const p = await load(url, init)
      return { status: p.status, url: p.finalUrl, contentType: p.contentType, body: p.body }
    },
  }
}
