import assert from 'node:assert/strict'
import test from 'node:test'
import {createVerifiedRecruitmentScraper, RECRUITMENT_OBSERVATIONS} from '../utils/verifiedRecruitment.js'
import {SOURCE_OBSERVATION_EVIDENCE} from '../utils/sourceObservationEvidence.js'

// Synthetic transport controls verify ownership only; no employer inventory
// or current public role is claimed by these fixtures.
const config = {source: 'final-caller-fixture', companyName: 'Example Corporation',
  companyDomain: 'employer.test', companyCareerPage: 'https://employer.test/careers'}
const roleURL = 'https://employer.test/careers/jobs/native-control'
const description = '<p>Maintain production software, review service contracts, investigate failures and collaborate with the engineering team on releases.</p>'
const row = {'@type': 'JobPosting', identifier: {value: 'native-control'}, title: 'Software Engineer',
  url: roleURL, hiringOrganization: {name: config.companyName}, description, datePosted: '2026-11-16',
  jobLocation: {address: {addressCountry: 'US', addressLocality: 'San Francisco'}}}
const fetchPage = async url => ({url, status: 200, html: url === roleURL
  ? '<h1>Software Engineer</h1>' + description + '<script type="application/ld+json">' + JSON.stringify(row) + '</script>'
  : '<h1>Example Corporation Careers</h1><a href="' + roleURL + '">Open job</a>'})
const run = options => createVerifiedRecruitmentScraper(config).run({now: () => '2026-11-17T00:00:00.000Z', fetchPage, ...options})
const reasons = () => [Object.freeze({owner: 'final-audit-caller'}), null]

for (const marker of [RECRUITMENT_OBSERVATIONS, SOURCE_OBSERVATION_EVIDENCE, 'nativeCollectionEvidence']) {
  test('final ' + String(marker) + ' attachment cannot return after exact caller cancellation', async t => {
    t.mock.method(globalThis, 'fetch', () => assert.fail('Network forbidden in ownership controls'))
    for (const reason of reasons()) {
      const caller = new AbortController(), define = Object.defineProperty
      let attached = 0
      const hook = t.mock.method(Object, 'defineProperty', (target, key, descriptor) => {
        const result = define(target, key, descriptor)
        if (Array.isArray(target) && key === marker) { attached++; caller.abort(reason) }
        return result
      })
      try {
        await assert.rejects(run({signal: caller.signal}), error => error === reason)
        assert.equal(attached, 1)
      } finally { hook.mock.restore() }
    }
  })
}

test('final unavailable-inventory diagnostic attachment preserves exact caller cancellation', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Network forbidden in ownership controls'))
  for (const reason of reasons()) {
    const caller = new AbortController(), assign = Object.assign
    let attached = 0
    const hook = t.mock.method(Object, 'assign', (target, ...values) => {
      const result = assign(target, ...values)
      if (target instanceof Error && values.some(value => value?.recruitmentObservations?.source === config.source)) {
        attached++; caller.abort(reason)
      }
      return result
    })
    try {
      await assert.rejects(run({signal: caller.signal, fetchPage: async url => ({url, status: 200,
        html: '<h1>Example Corporation Careers</h1>'})}), error => error === reason)
      assert.equal(attached, 1)
    } finally { hook.mock.restore() }
  }
})
