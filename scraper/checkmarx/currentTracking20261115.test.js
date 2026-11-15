import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { parseCheckmarxBoard } from './nativeContract.js'
import { readNativeData } from './nativeData.js'

const html = gunzipSync(fs.readFileSync(new URL('./test-inputs/current-board-20261115.html.gz', import.meta.url))).toString('utf8')
const rows = readNativeData(html, 'COMPANY_POSITIONS_DATA')
const options = { now: '2026-11-15T04:10:00.000Z' }
const UID = '35.27F'
const changed = mutate => html.replace(/(\bCOMPANY_POSITIONS_DATA\s*=\s*)([^\r\n]+)/, (_match, before, line) => {
  const next = structuredClone(rows), row = next.find(row => row.uid === UID)
  const url = new URL(row.url_active_page)
  mutate(url)
  row.url_active_page = url.href
  row.url_detected_page = url.href
  return before + JSON.stringify(next).replaceAll('<', '\\u003C').replaceAll('>', '\\u003E') + (line.match(/[,;]\s*$/)?.[0] || '')
})

test('Checkmarx current public employee-share tracking retains the full native board and independently typed India records', () => {
  const board = parseCheckmarxBoard(html, options)
  assert.equal(board.rows.length, 31)
  assert.deepEqual(board.rows.filter(row => row.location.country === 'IN').map(row => row.uid), ['5D.474', 'C7.471'])
  const share = board.rows.find(row => row.uid === UID)
  assert.equal(share.is_internal, false)
  assert.equal(share.location.country, 'IL')
  assert.equal(new URL(share.url_active_page).search, '?Share&employeeShare')
  assert.equal(new URL(share.url_comeet_hosted_page).search, '')
})

for (const [label, mutate] of [
  ['missing share flag', url => url.searchParams.delete('Share')],
  ['nonempty employee share flag', url => url.searchParams.set('employeeShare', 'true')],
  ['nonempty share flag', url => url.searchParams.set('Share', 'true')],
  ['duplicated employee share flag', url => { url.search += '&employeeShare' }],
  ['unknown tracking key', url => { url.search += '&unqualified=true' }],
  ['foreign role path', url => { url.pathname = '/job-openings/position/00.000/' }],
]) test(`Checkmarx still rejects employee-share tracking with ${label}`, () => {
  assert.throws(() => parseCheckmarxBoard(changed(mutate), options), /Checkmarx native contract:/)
})
