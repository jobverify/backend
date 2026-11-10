import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
export const civicaCapture = () => JSON.parse(gunzipSync(readFileSync(new URL('../../../scraper/civicaindia/fixtures/native-20261026.json.gz', import.meta.url))))
export const civicaNativeOptions = (fixture = civicaCapture(), mutate = () => {}) => {
  const counts = new Map(), calls = []
  const load = async (url, init = {}) => {
    init.signal?.throwIfAborted()
    const requestBody = init.body ?? null, key = JSON.stringify([url, requestBody]), index = counts.get(key) || 0
    counts.set(key, index + 1); calls.push({ url, requestBody })
    const packet = structuredClone(fixture.packets.filter(p => p.url === url && p.requestBody === requestBody)[index])
    if (!packet) throw Error('Unexpected Civica fixture request: ' + key)
    mutate(packet, index)
    return packet
  }
  return { calls, now: () => fixture.runAt,
    fetchText: async (url, init) => (await load(url, init)).body,
    fetchPage: async (url, init) => { const p = await load(url, init); return { status: p.status, url: p.finalUrl, html: p.body } },
    fetchJson: async (url, init) => { const p = await load(url, init); if (p.status !== 200 || p.finalUrl !== url) throw Error('Civica response unavailable'); return JSON.parse(p.body) },
  }
}
