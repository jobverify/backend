import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
export const haptikCapture = () => JSON.parse(gunzipSync(fs.readFileSync(new URL('./next-native-20261026/haptik.json.gz', import.meta.url))))
export const haptikNativeOptions = (fixture = haptikCapture(), mutate = () => {}) => {
  const counts = new Map(), calls = []
  const load = async (url, init = {}) => {
    init.signal?.throwIfAborted(); calls.push(url)
    const index = counts.get(url) || 0; counts.set(url, index + 1)
    const packet = structuredClone(fixture.packets.filter(p => p.url === url)[index])
    if (!packet) throw Error(`Unexpected native fixture request: ${url}`)
    mutate(packet, index)
    return packet
  }
  return { calls, now: () => fixture.runAt,
    fetchText: async (url, init) => (await load(url, init)).body,
    fetchPage: async (url, init) => { const p = await load(url, init); return { status: p.status, url: p.finalUrl, html: p.body, contentType: p.contentType } },
  }
}
