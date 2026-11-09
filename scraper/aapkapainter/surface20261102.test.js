import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { hasOfficialHomepageSignal, extractCareerUrl, hasOfficialCareerPageSignal, CAREER_URL } from './script.js'
const captures = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/surface-20261102.json.gz', import.meta.url))))

test('recognizes the current AapkaPainter Unicode title and keeps its exact corporate careers handoff', () => {
  const home = captures.find(row => row.requestedUrl === 'https://aapkapainter.com/').html
  const careers = captures.find(row => row.requestedUrl === CAREER_URL).html
  assert.equal(hasOfficialHomepageSignal(home), true)
  assert.equal(extractCareerUrl(home), CAREER_URL)
  assert.equal(hasOfficialCareerPageSignal(careers), true)
  assert.equal(hasOfficialHomepageSignal(home.replaceAll('AapkaPainter Solutions Pvt Ltd', 'Another legal employer')), false)
})
