import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
export const finzlyCapture = () => JSON.parse(gunzipSync(readFileSync(new URL('../../../scraper/finzly/fixtures/native-20261026.json.gz', import.meta.url))))
export const finzlyNativeOptions = (fixture = finzlyCapture(), mutate = () => {}) => {
  const counts = new Map(), calls = []
  const load = async (url, init = {}) => {
    init.signal?.throwIfAborted(); calls.push(url)
    const index = counts.get(url) || 0; counts.set(url, index + 1)
    const packet = structuredClone(fixture.packets.filter(p => p.url === url)[index])
    if (!packet) throw Error('Unexpected Finzly fixture request: ' + url)
    mutate(packet, index)
    return packet
  }
  return { calls, now: () => fixture.runAt,
    fetchText: async (url, init) => url.startsWith('https://apply.workable.com/finzly/') ? '0 current openings' : (await load(url, init)).body,
    fetchPage: async (url, init) => { const p = await load(url, init); return { status: p.status, url: p.finalUrl, body: p.body, contentType: p.contentType, wpTotal: p.wpTotal, wpTotalPages: p.wpTotalPages } },
  }
}
