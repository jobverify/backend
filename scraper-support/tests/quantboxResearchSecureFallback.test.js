import assert from 'node:assert/strict'
import test from 'node:test'

import { createQuantboxResearchScraper } from '../../scraper/quantboxresearch/script.js'

const WWW_CAREERS_URL = 'https://www.quantboxresearch.com/careers'
const APEX_CAREERS_URL = 'https://quantboxresearch.com/careers'
const JOBS_API_URL = 'https://boards-api.greenhouse.io/v1/boards/quantboxresearchpte/jobs?content=true'

// The official apex careers page links this exact existing Greenhouse tenant.
// Receipt: https://quantboxresearch.com/careers (retrieved 2026-10-25).
const careersHtml = `<!doctype html><html><head><title>Careers &mdash; Quantbox</title></head><body>
  <h1>Build what markets need next.</h1><a href="#open-roles">See open roles</a>
  <p>Current openings are listed below.</p><p>Stay connected for what&#x27;s next.</p>
  <a href="https://job-boards.eu.greenhouse.io/quantboxresearchpte">View current open roles</a>
  <p>Quantbox recruiting messages will come through our official channels.</p>
</body></html>`

const payload = {
  jobs: [{
    id: 4001033101,
    title: 'Experienced Quantitative Researcher',
    company_name: 'Quantbox Research',
    location: { name: 'Bengaluru, Karnataka, India; Singapore, Central, Singapore' },
    absolute_url: 'https://job-boards.eu.greenhouse.io/quantboxresearchpte/jobs/4001033101',
    content: '<p>Research quantitative trading strategies.</p>',
  }],
}

const expiredCertificateError = () => {
  const certificate = Object.assign(new Error('certificate has expired'), { code: 'CERT_HAS_EXPIRED' })
  const transport = new TypeError('fetch failed', { cause: certificate })
  return Object.assign(new Error('first-party request failed', { cause: transport }), { abortRetries: true })
}

test('Quantbox recovers an expired www certificate through the exact official apex HTTPS page', async () => {
  const textUrls = []
  const jsonUrls = []

  const jobs = await createQuantboxResearchScraper().run({
    fetchText: async (url, options = {}) => {
      textUrls.push(url)
      if (url === WWW_CAREERS_URL) throw expiredCertificateError()
      assert.equal(url, APEX_CAREERS_URL)
      assert.deepEqual(options, { redirect: 'error' })
      return careersHtml
    },
    fetchJson: async (url) => {
      jsonUrls.push(url)
      return payload
    },
  })

  assert.deepEqual(textUrls, [WWW_CAREERS_URL, APEX_CAREERS_URL])
  assert.deepEqual(jsonUrls, [JOBS_API_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Quantbox Research')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].applyUrl, 'https://job-boards.eu.greenhouse.io/quantboxresearchpte/jobs/4001033101')
})

test('Quantbox rejects an apex page that lacks the exact verified Greenhouse handoff', async () => {
  const textUrls = []
  let apiCalls = 0

  await assert.rejects(createQuantboxResearchScraper().run({
    fetchText: async (url) => {
      textUrls.push(url)
      if (url === WWW_CAREERS_URL) throw expiredCertificateError()
      assert.equal(url, APEX_CAREERS_URL)
      return careersHtml.replace('greenhouse.io/quantboxresearchpte', 'greenhouse.io/another-employer')
    },
    fetchJson: async () => { apiCalls += 1; return payload },
  }), /Quantbox Research careers page no longer matches/)

  assert.deepEqual(textUrls, [WWW_CAREERS_URL, APEX_CAREERS_URL])
  assert.equal(apiCalls, 0)
})

test('Quantbox rejects active Greenhouse links with a different exact tenant target or URL identity', async () => {
  for (const href of [
    'https://job-boards.eu.greenhouse.io/quantboxresearchpte-other',
    'https://job-boards.eu.greenhouse.io/quantboxresearchpte?tenant=another-employer',
    'https://job-boards.eu.greenhouse.io/quantboxresearchpte#another-employer',
    'https://user:password@job-boards.eu.greenhouse.io/quantboxresearchpte',
  ]) {
    let apiCalls = 0
    await assert.rejects(createQuantboxResearchScraper().run({
      fetchText: async (url) => {
        if (url === WWW_CAREERS_URL) throw expiredCertificateError()
        assert.equal(url, APEX_CAREERS_URL)
        return careersHtml.replace('https://job-boards.eu.greenhouse.io/quantboxresearchpte', href)
      },
      fetchJson: async () => { apiCalls += 1; return payload },
    }), /Quantbox Research careers page no longer matches/, `Unapproved target must fail closed: ${href}`)
    assert.equal(apiCalls, 0)
  }
})

test('Quantbox rejects the correct board URL when its anchor appears only in inert markup', async () => {
  const anchor = '<a href="https://job-boards.eu.greenhouse.io/quantboxresearchpte">View current open roles</a>'
  for (const markup of [
    `<!-- ${anchor} -->`,
    `<template>${anchor}</template>`,
    `<div hidden>${anchor}</div>`,
    `<div inert>${anchor}</div>`,
    `<div aria-hidden="true">${anchor}</div>`,
    `<div style="display:none">${anchor}</div>`,
    `<object>${anchor}</object>`,
    `<script type="application/json">${JSON.stringify({ link: anchor })}</script>`,
  ]) {
    let apiCalls = 0
    await assert.rejects(createQuantboxResearchScraper().run({
      fetchText: async (url) => {
        if (url === WWW_CAREERS_URL) throw expiredCertificateError()
        assert.equal(url, APEX_CAREERS_URL)
        return careersHtml.replace(anchor, markup)
      },
      fetchJson: async () => { apiCalls += 1; return payload },
    }), /Quantbox Research careers page no longer matches/, 'Inert evidence must not establish the employer handoff')
    assert.equal(apiCalls, 0)
  }
})

test('Quantbox propagates an apex TLS failure without bypassing it or querying the board', async () => {
  const textUrls = []
  const apexError = Object.assign(new Error('unable to verify the first certificate'), {
    code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  })
  let apiCalls = 0

  await assert.rejects(createQuantboxResearchScraper().run({
    fetchText: async (url) => {
      textUrls.push(url)
      if (url === WWW_CAREERS_URL) throw expiredCertificateError()
      assert.equal(url, APEX_CAREERS_URL)
      throw apexError
    },
    fetchJson: async () => { apiCalls += 1; return payload },
  }), (error) => error === apexError)

  assert.deepEqual(textUrls, [WWW_CAREERS_URL, APEX_CAREERS_URL])
  assert.equal(apiCalls, 0)
})

for (const code of [undefined, 'ECONNRESET', 'ERR_TLS_CERT_ALTNAME_INVALID']) {
  test(`Quantbox does not change endpoints for an unrelated failure: ${code || 'fetch failed'}`, async () => {
    const textUrls = []
    const failure = Object.assign(new TypeError('fetch failed'), code ? { code } : {})
    let apiCalls = 0

    await assert.rejects(createQuantboxResearchScraper().run({
      fetchText: async (url) => { textUrls.push(url); throw failure },
      fetchJson: async () => { apiCalls += 1; return payload },
    }), (error) => error === failure)

    assert.deepEqual(textUrls, [WWW_CAREERS_URL])
    assert.equal(apiCalls, 0)
  })
}

test('Quantbox keeps rejecting conflicting employer identity after the apex handoff', async () => {
  await assert.rejects(createQuantboxResearchScraper().run({
    fetchText: async (url) => {
      if (url === WWW_CAREERS_URL) throw expiredCertificateError()
      assert.equal(url, APEX_CAREERS_URL)
      return careersHtml
    },
    fetchJson: async () => ({ jobs: [{ ...payload.jobs[0], company_name: 'Another Employer' }] }),
  }), /no longer maps to the verified company identity/)
})
