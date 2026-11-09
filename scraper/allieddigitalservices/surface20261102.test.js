import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { ROOT_URL, hasOfficialRootSignal } from './script.js'

const captures = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/surface-20261102.json.gz', import.meta.url))))
const html = captures.find(row => row.requestedUrl === ROOT_URL).html

test('accepts the current Allied Digital home title while preserving canonical identity and careers handoff', () => {
  assert.equal(hasOfficialRootSignal(html), true)
  assert.equal(hasOfficialRootSignal(html.replaceAll('https://www.allieddigital.net/careers/', 'https://other.example/careers/')), false)
  assert.equal(hasOfficialRootSignal(html.replaceAll('href="https://www.allieddigital.net/"', 'href="https://other.example/"')), false)
})
