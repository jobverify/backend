import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
export const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./current-native-20261101.json.gz', import.meta.url))))
export const now = () => new Date(fixture.capture.completedAt)
export const response = (body, url, { status = 200, headers = {} } = {}) => {
  const value = new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', ...headers } })
  Object.defineProperty(value, 'url', { value: url })
  return value
}
export const replay = (change = value => value) => {
  const requested = []
  return { requested, now,
    fetchImpl: async (url, options) => {
      requested.push(url)
      const packet = fixture.packets.find(value => value.url === url)
      if (!packet) throw new Error('Unplanned native fixture request: ' + url)
      if (options.redirect !== 'manual') throw new Error('Native redirects must be manual')
      return response(change(packet.body, url), url)
    },
  }
}
