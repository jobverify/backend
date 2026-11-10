import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { readNativeData } from './nativeData.js'
import { parseCheckmarxBoard } from './nativeContract.js'

const packet = JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261110/public-board.json.gz', import.meta.url))))
const options = { now: '2026-11-10T02:00:00.000Z' }
const rows = readNativeData(packet.body, 'COMPANY_POSITIONS_DATA')
const singapore = rows.find(row => row.uid === 'FD.471')
const changedCountry = (country, label = 'Singapore') => packet.body.replace(
  /(\bCOMPANY_POSITIONS_DATA\s*=\s*)([^\r\n]+)/,
  (_match, prefix, line) => prefix + JSON.stringify(rows.map(row => row.uid === singapore.uid
    ? { ...row, location: { ...row.location, country, name: label } } : row))
    .replaceAll('<', '\\u003C').replaceAll('>', '\\u003E') + (line.match(/[,;]\s*$/)?.[0] || ''),
)

test('the current Singapore role does not discard two independently typed India postings', () => {
  const board = parseCheckmarxBoard(packet.body, options)
  assert.equal(board.rows.length, 36)
  assert.equal(board.rows.filter(row => row.location.country === 'IN').length, 2)
  assert.equal(board.rows.find(row => row.uid === 'FD.471').location.country, 'SG')
  assert.equal(board.companyIndiaTotal, null)
})

test('Singapore support retains rejection of unknown countries and contradictory India labels', () => {
  assert.throws(() => parseCheckmarxBoard(changedCountry('SG', 'Singapore, India'), options), /contradict/)
  for (const country of ['APAC', 'ZZ', 'sg']) {
    assert.throws(() => parseCheckmarxBoard(changedCountry(country), options), /Unknown\/noncanonical native country/)
  }
})
