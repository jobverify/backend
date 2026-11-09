import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { createRipplingScraper, CAREERS_URL, OPEN_ROLES_URL } from '../../scraper/rippling/script.js'
import { extractionDetailHealth } from '../utils/extractionDetailHealth.js'

const native = () => JSON.parse(readFileSync(new URL('./fixtures/rippling/native-role.json', import.meta.url), 'utf8'))
const role = native().props.pageProps.apiData.jobPost
const hit = { objectID: `${role.uuid}__bangalore-india`, jobId: role.uuid, name: role.name, url: role.url,
  locations: [{ name: 'Bangalore, India', country: 'India', countryCode: 'IN' }] }
const careers = '<title>Rippling Careers</title>Work will never be the same. Neither will you.<a href="/careers/open-roles">Open roles</a>'
const openRoles = 'Open roles @rippling.com email addresses<script id="__NEXT_DATA__" type="application/json">'
  + JSON.stringify({ props: { pageProps: { data: { algoliaIndexName: 'careers_en-US_production', listMode: 'pagination' } } } }) + '</script>'
const receipt = (value = native(), url = role.url, status = 200) => ({ url, status,
  html: `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(value)}</script>` })
const run = ({ detail = async () => receipt(), signal, listing = hit } = {}) => createRipplingScraper().run({
  signal,
  fetchText: async (url, options) => url === CAREERS_URL ? careers : url === OPEN_ROLES_URL ? openRoles : detail(url, options),
  fetchJson: async () => ({ hits: [listing], nbPages: 1, nbHits: 1 }),
})

test('Rippling returns verified native descriptions before runner extraction-health diagnostics', async () => {
  const jobs = await run()
  assert.equal(jobs[0].sourceDescription, `${role.description.company}\n${role.description.role}`)
  assert.deepEqual(extractionDetailHealth(jobs), { complete: true, inspectedJobs: 1, incompleteJobs: 0, missingDescriptions: 0, failureKinds: {} })
})

test('Rippling retains partial jobs without certifying descriptions after detail denial or identity drift', async () => {
  const wrong = native()
  wrong.props.pageProps.apiData.jobPost.uuid = 'another-role'
  for (const detail of [async () => receipt(native(), role.url, 403), async () => receipt(wrong), async () => { throw new Error('upstream unavailable') }]) {
    const jobs = await run({ detail })
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].sourceDetailComplete, false)
    assert.equal(extractionDetailHealth(jobs).missingDescriptions, 1)
  }
})

test('Rippling does not request an external detail URL supplied by its search feed', async () => {
  const jobs = await run({ listing: { ...hit, url: 'https://unrelated.example/private' }, detail: async () => { assert.fail('external role URL must not be fetched') } })
  assert.equal(jobs[0].sourceDetailComplete, false)
})

test('Rippling cannot certify native location conflicts using a competing JobPosting schema', async () => {
  const value = native()
  value.props.pageProps.apiData.jobPost.workLocations = ['London, United Kingdom']
  value.props.pageProps.apiData.workLocations = ['London, United Kingdom']
  const page = receipt(value)
  page.html += '<script type="application/ld+json">' + JSON.stringify({
    '@type': 'JobPosting', title: role.name, url: role.url, identifier: { value: role.uuid },
    hiringOrganization: { name: 'Rippling' }, description: '<p>Responsibilities: lead the tax platform product team.</p>',
  }) + '</script>'
  const jobs = await run({ detail: async () => page })
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDescription, undefined)
})

test('Rippling propagates cancellation during native detail recovery', async () => {
  const controller = new AbortController()
  const error = new Error('cancel this source')
  await assert.rejects(run({ signal: controller.signal, detail: async () => { controller.abort(error); throw error } }), value => value === error)
})
