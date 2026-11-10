import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'

const capture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/typography-20261110.json.gz', import.meta.url))))
export const typographyAlias = 'https://cloud.typography.com/7991694/6984012/css/fonts.css'
export const typographyTarget = 'https://fonts.hibob.com/870469/CD5654E174C36B3AC.css'
for (const packet of capture.packets) {
  const raw = Buffer.from(packet.rawBodyBase64, 'base64')
  assert.equal(createHash('sha256').update(raw).digest('hex'), packet.sha256)
  assert.equal(new TextDecoder('utf-8', {fatal: true}).decode(raw), packet.body)
}
export const typographyPacket = name => structuredClone(capture.packets.find(packet => packet.name === name))

// Explicit current availability-failure control for older native replay data.
// This is a November 10 original denial, never a fabricated historical capture.
export const deniedTypographyPacket = url => url === typographyAlias ? typographyPacket('plain') : null
