import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
export function rmkCountryFacetFixture(change = () => {}, source = 'newellbrands') {
  const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('../fixtures/recruitment-rmk-country-facet-20261115.json.gz', import.meta.url))))
  const calls = []
  const fetchImpl = async (value, init = {}) => {
    const url = String(value), packet = structuredClone((fixture.sources?.[source] || fixture).urls[url])
    if (!packet) throw Error('Unexpected public URL: ' + url)
    calls.push({ url, init, ordinal: calls.filter(call => call.url === url).length + 1 })
    change(packet, calls.at(-1), calls)
    const response = new Response(packet.body, { status: packet.status, headers: { 'Content-Type': packet.type, ...(url.endsWith('/search/') ? { 'Set-Cookie': 'JSESSIONID=anonymous-fixture; Path=/' } : {}) } })
    Object.defineProperty(response, 'url', { value: packet.url })
    return response
  }
  return { fixture, calls, fetchImpl }
}
