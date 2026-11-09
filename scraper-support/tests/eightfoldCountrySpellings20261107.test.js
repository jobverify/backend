import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { readEightfoldLocationScope } from '../apiPortal/eightfoldLocations.js'

const capture = JSON.parse(readFileSync(new URL('./test-data/eightfold-country-spellings-20261107.json', import.meta.url), 'utf8'))
const bytes = Buffer.from(capture.response.bodyBase64, 'base64')
const positions = JSON.parse(new TextDecoder().decode(bytes)).data.positions
const pair = (location, standardized) => readEightfoldLocationScope({
  locations: [location], ...(standardized === undefined ? {} : { standardizedLocations: [standardized] }),
})

test('Tektronix country examples retain the exact original public listing response', () => {
  assert.equal(capture.source, 'tektronix')
  assert.equal(capture.response.status, 200)
  assert.equal(capture.response.url, 'https://ralliant.eightfold.ai/api/pcsx/search?domain=ralliant.com&sort_by=relevance&filter_efcustom_text_operatingcompany=tektronix&start=30&limit=10')
  assert.equal(createHash('sha256').update(bytes).digest('hex'), capture.response.bodySHA256)
  assert.equal(bytes.length, capture.response.bodyBytes)
  assert.equal(positions.length, 10)
})

test('the native Germany/France role keeps both foreign workplaces without a false country conflict', () => {
  const row = positions.find(position => position.id === 1133916583964)
  assert.equal(row.name, 'Manager EMEAI for Services Sales')
  assert.deepEqual(row.locations, ['Bayern, Germany', 'Paris, Ile-de-France, France'])
  assert.deepEqual(row.standardizedLocations, ['BY,DE', 'Île-de-France,FR'])
  const result = readEightfoldLocationScope(row)
  assert.equal(result.country, 'DE')
  assert.deepEqual(result.indiaLocations, [])
  assert.equal(result.unresolved, false)
  assert.deepEqual(result.nativeLocations, row.locations)
  assert.deepEqual(result.standardizedLocations, row.standardizedLocations)
})

test('the native full Korean country name corroborates its own regional KR fields', () => {
  const row = positions.find(position => position.id === 1133912749870)
  assert.equal(row.name, 'Account Manager')
  assert.deepEqual(row.locations, ['Seoul, Korea, Republic of', 'Gyeongsangbuk-do, Korea, Republic of'])
  assert.deepEqual(row.standardizedLocations, ['Seoul,KR', 'Gyeongsangbuk-do,KR'])
  const result = readEightfoldLocationScope(row)
  assert.equal(result.country, 'KR')
  assert.deepEqual(result.indiaLocations, [])
  assert.equal(result.unresolved, false)
  assert.deepEqual(result.nativeLocations, row.locations)
  assert.deepEqual(result.standardizedLocations, row.standardizedLocations)
})

for (const [raw, standardized, expected] of [
  ['Paris, France', 'Paris, IDF, FR', 'FR'],
  ['London, United Kingdom', 'London, England, GB', 'GB'],
  ['Paris, France', undefined, 'FR'],
  ['London, United Kingdom', undefined, 'GB'],
  ['Frankfurt, Germany', 'Frankfurt, HE, DE', 'DE'],
  ['Bangalore, India', 'Bengaluru, KA, IN', 'India'],
  ['Korea, Republic of', 'KR', 'KR'],
  ['India - Bangalore (India)', 'Bengaluru, KA, IN', 'India'],
  ['United Kingdom - London, United Kingdom', 'London, England, GB', 'GB'],
]) test(`explicit country ${raw} retains canonical country ${expected}`, () => {
  const result = pair(raw, standardized)
  assert.equal(result.country, expected)
  assert.equal(result.unresolved, false)
  if (expected !== 'India') assert.deepEqual(result.indiaLocations, [])
})

for (const [raw, standardized] of [
  ['Paris, France', 'Paris, IDF, IN'],
  ['London, United Kingdom', 'London, England, IN'],
  ['Seoul, Korea, Republic of', 'Seoul,IN'],
  ['Seoul, Korea, Republic of', 'Seoul,KP'],
  ['Bangalore, India', 'Bengaluru, KA, FR'],
  ['Paris, France', 'Paris, IDF, FX'],
  ['Seoul, Korea, Republic of', 'Seoul,ZZ'],
  ['Seoul, Korea Republic of', 'Seoul,KR'],
  ['Seoul, Republic of', 'Seoul,KR'],
  ['Korea', 'Seoul,KR'],
  ['Seoul, Korea, Republic of, unrelated', 'Seoul,KR'],
  ['India - Seoul, Korea, Republic of', 'Seoul,KR'],
  ['India - Seoul, Korea, Republic of', 'Seoul,IN'],
  ['India - Paris, France', 'Paris, IDF, IN'],
  ['France - Paris (India)', 'Paris, IDF, IN'],
  ['Seoul, Korea, Republic of (India)', 'Seoul,IN'],
  ['Korea, Republic of - Seoul (India)', 'Seoul,IN'],
  ['Korea, Republic of - Seoul, India', 'Seoul,IN'],
  ['India - Seoul, Korea, Republic of (India)', 'Seoul,IN'],
  ['Seoul (Korea, Republic of), India', 'Seoul,IN'],
  ['Korea, Republic of; Seoul (India)', 'Seoul,IN'],
  ['Korea, Republic of \u2013 Seoul (India)', 'Seoul,IN'],
  ['Korea, Republic of \u2014 Seoul (India)', 'Seoul,IN'],
]) test(`country parser still rejects conflicting or unqualified pair ${raw} / ${standardized}`, () => {
  assert.throws(() => pair(raw, standardized), error => error.incompleteScope === true && /native location scope/.test(error.message))
})
