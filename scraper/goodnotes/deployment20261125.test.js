import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { readCurrentGoodnotesBoard, readCurrentGoodnotesDetail, BOARD_URL } from './currentNative.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261125.json.gz', import.meta.url))))
const board = fixture.responses.find(row => row.url === BOARD_URL).body

test('Goodnotes current deployment retains all four native identities and complete same-role criteria', () => {
  const inventory = readCurrentGoodnotesBoard(board)
  assert.equal(inventory.records.length, 4)
  for (const record of inventory.records) {
    const html = fixture.responses.find(row => row.url === record.absolute_url).body
    const detail = readCurrentGoodnotesDetail(html, record)
    assert.equal(detail.post.company_name, 'Goodnotes')
    assert.equal(detail.post.public_url, record.absolute_url)
    assert.equal(detail.criteria.sourceDetailComplete, true)
    assert.ok(detail.criteria.jobDescription.length > 300)
  }
})

for (const [name, edit] of [
  ['an unreviewed environment change', html => html.replace('window.ENV = {', 'window.ENV = {"UNREVIEWED":true,')],
  ['an older renderer paired with the current environment', html => html.replaceAll('manifest-a77419c5.js', 'manifest-8f9a546d.js')],
  ['a replacement external board module', html => html.replaceAll('_url_token-BzmBGdVX.js', '_url_token-REPLACED.js')],
]) test('Goodnotes current deployment rejects ' + name, () => {
  const changed = edit(board)
  assert.notEqual(changed, board)
  assert.throws(() => readCurrentGoodnotesBoard(changed), /supporting program|renderer/)
})

test('Goodnotes current deployment still rejects a conflicting role identity and changed visible criteria', () => {
  const record = readCurrentGoodnotesBoard(board).records[0]
  const html = fixture.responses.find(row => row.url === record.absolute_url).body
  assert.throws(() => readCurrentGoodnotesDetail(html, { ...record, id: 1 }), /identity|disagree/)
  const changed = html.replace('Our Values', 'Different visible qualifications')
  assert.notEqual(changed, html)
  assert.throws(() => readCurrentGoodnotesDetail(changed, record), /criteria|data/i)
})
