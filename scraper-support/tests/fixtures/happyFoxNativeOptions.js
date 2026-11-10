import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
export const happyFoxCapture = () => JSON.parse(gunzipSync(readFileSync(new URL('../../../scraper/happyfox/fixtures/native-20261026.json.gz', import.meta.url))))
export const happyFoxNativeOptions = (mutate = () => {}) => {
  const fixture = happyFoxCapture(), counts = new Map(), calls = []
  const fetchPage = async (url, init = {}) => {
    init.signal?.throwIfAborted(); calls.push(url)
    const index = counts.get(url) || 0; counts.set(url, index + 1)
    const packet = structuredClone(fixture.packets.filter(packet => packet.url === url)[index])
    if (!packet) throw Error('Unexpected HappyFox fixture request: ' + url)
    mutate(packet, index)
    return { ...packet, url: packet.finalUrl }
  }
  return { calls, now: () => fixture.runAt, fetchPage, fetchText: async (url, init) => (await fetchPage(url, init)).body }
}
