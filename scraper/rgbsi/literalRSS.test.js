import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { readNativeRSS } from './literalRSS.js'

test('literal XML reads the complete genuine200-record RSS body without truncating CDATA', () => {
  const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/actual-http-20261031.json.gz', import.meta.url))))
  const row = fixture.responses.find(row => row.purpose === 'declared-public-RSS-opening')
  const parsed = readNativeRSS(Buffer.from(row.bodyBase64, 'base64').toString('utf8'))
  assert.equal(parsed.channel.fields.title, 'Zobility Jobs')
  assert.equal(parsed.items.length, 200)
  assert.match(parsed.items[0].fields.link, /id=29562619/)
  assert.match(parsed.items.at(-1).fields.link, /id=29360128/)
  assert.ok(parsed.items.every(item => item.originalXML.includes('<description>') && item.fields.description.length > 700))
})
test('XML entities and terminal CDATA remain separate declared encoding layers', () => {
  // Artificial syntax control; never presented as a native response.
  const parsed = readNativeRSS('<rss><channel><title>R&amp;D</title><item><title>A &lt; B</title><description><![CDATA[<p>&amp; &lt;tag&gt;</p>]]></description></item></channel></rss>')
  assert.equal(parsed.channel.fields.title, 'R&D')
  assert.equal(parsed.items[0].fields.title, 'A < B')
  assert.equal(parsed.items[0].fields.description, '<p>&amp; &lt;tag&gt;</p>')
})
test('duplicate fields are explicit and never a last-winner title', () => {
  const parsed = readNativeRSS('<rss><channel><item><title>First</title><title>Second</title></item></channel></rss>')
  assert.deepEqual(parsed.items[0].duplicateFields, ['title'])
  assert.equal(parsed.items[0].fields.title, 'First')
})
test('external declarations, malformed nesting and unsupported entities remain invalid data', () => {
  for (const text of ['<!DOCTYPE rss SYSTEM "https://unrelated.invalid/"><rss><channel/></rss>',
    '<rss><channel></rss>', '<rss><channel><title>&unknown;</title></channel></rss>',
    '<rss><channel><title>&#x110000;</title></channel></rss>', '<rss version="2" version="3"><channel/></rss>']) {
    assert.throws(() => readNativeRSS(text))
  }
})
