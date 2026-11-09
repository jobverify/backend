import assert from 'node:assert/strict'
import test from 'node:test'

import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import { enrichJobWithPublicExperience } from '../utils/publicExperienceEnrichment.js'

const job = {
  title: 'Platform Engineer', company: 'Example Employer', source: 'exampleemployer',
  jobId: 'R100', country: 'India', location: 'Bengaluru, India',
  sourceUrl: 'https://careers.example.com/job/R100',
  sourceDescription: null, description: null, jobDescription: null,
}
const description = '<h2>Responsibilities</h2><p>Design distributed systems and maintain cloud services for our engineering teams.</p>\n<h2>Qualifications</h2><p>5 years of software engineering experience required. Work with product teams to improve reliability and support production services.</p>'
const posting = {
  '@type': 'JobPosting', title: job.title, hiringOrganization: { name: job.company },
  identifier: { value: job.jobId }, url: job.sourceUrl, description,
}
const page = (value) => `<html><head><title>${job.title}</title></head><body><h1>${job.title}</h1><script type="application/ld+json">${JSON.stringify(value)}</script></body></html>`
const response = html => ({ status: 200, url: job.sourceUrl, html })

test('fresh exact role schema fills an explicitly missing source description through normalization', async () => {
  const input = structuredClone(job)
  const enriched = await enrichJobWithPublicExperience(input, { fetchText: async () => response(page(posting)) })
  assert.equal(enriched.sourceDescription, description)
  assert.equal(enriched.publicExperienceChecked, true)
  assert.match(enriched.experienceRequired, /5 years/)
  const normalized = normalizeScrapedJob(enriched)
  assert.equal(normalized.sourceDescription, description)
  assert.equal(hasSourceDescription(normalized), true)
  assert.equal(normalized.country, 'India')
  assert.deepEqual(input, job)
})

test('exact schema recovery preserves original employer HTML over generated display text', async () => {
  const enriched = await enrichJobWithPublicExperience({
    ...job, description: 'AI display summary.', jobDescription: 'AI display summary.',
  }, { fetchText: async () => response(page(posting)) })
  assert.equal(normalizeScrapedJob(enriched).sourceDescription, description)
})

test('rich checked display text cannot short-circuit recovery of a missing employer description', async () => {
  for (const sourceDescription of [null, '', '<p>&nbsp;</p>']) {
    const input = { ...job, sourceDescription, publicExperienceChecked: true,
      description: 'A generated display summary. '.repeat(15),
      jobDescription: 'A generated display summary. '.repeat(15),
      experienceRequired: '5 years' }
    const before = structuredClone(input)
    let requests = 0
    const enriched = await enrichJobWithPublicExperience(input, { fetchText: async () => {
      requests += 1
      return response(page(posting))
    } })
    assert.equal(requests, 1)
    assert.equal(enriched.sourceDescription, description)
    assert.equal(hasSourceDescription(normalizeScrapedJob(enriched)), true)
    assert.deepEqual(input, before)
  }
})

test('failed recovery retains the missing source despite a rich checked display summary', async () => {
  const input = { ...job, sourceDescription: '', publicExperienceChecked: true,
    description: 'A generated display summary. '.repeat(15),
    jobDescription: 'A generated display summary. '.repeat(15), experienceRequired: '5 years' }
  let requests = 0
  const enriched = await enrichJobWithPublicExperience(input, { fetchText: async () => {
    requests += 1
    return response(page({ ...posting, hiringOrganization: { name: 'Other employer' } }))
  } })
  assert.equal(requests, 1)
  assert.equal(hasSourceDescription(normalizeScrapedJob(enriched)), false)
})

test('a matching role schema retains its exact role title despite overlapping page chrome', async () => {
  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async () => response(page(posting).replace('<h1>Platform Engineer</h1>', '<h1>Platform Engineer Talent Community</h1>')),
  })
  assert.equal(enriched.sourceDescription, description)
  assert.equal(enriched.title, job.title)
})

test('another employer, role, identifier, generic URL or ambiguous schema cannot fill missing source content', async () => {
  for (const change of [
    { hiringOrganization: { name: 'Other Employer' } },
    { title: 'Different Role' }, { identifier: { value: 'R101' } }, { identifier: { value: 0 } },
    { url: 'https://careers.example.com/search-jobs' },
  ]) {
    const enriched = await enrichJobWithPublicExperience(job, { fetchText: async () => response(page({ ...posting, ...change })) })
    assert.equal(hasSourceDescription(normalizeScrapedJob(enriched)), false, JSON.stringify(change))
  }
  const enriched = await enrichJobWithPublicExperience(job, { fetchText: async () => response(page([posting, posting])) })
  assert.equal(hasSourceDescription(normalizeScrapedJob(enriched)), false)
})

test('inactive schemas and empty or placeholder native descriptions never supply canonical source content', async () => {
  for (const html of [
    `<template>${page(posting)}</template>`, `<!-- ${page(posting)} -->`,
    `<div hidden>${page(posting)}</div>`, `<textarea>${page(posting)}</textarea>`,
    `<object data="/existing.pdf" type="application/pdf">${page(posting)}</object>`,
    `<div inert>${page(posting)}</div>`,
    page({ ...posting, description: 'Description coming soon' }),
    page({ ...posting, description: '<template>Responsibilities: Build reliable services.</template>' }),
    page({ ...posting, description: '<p>Apply now</p>' }),
  ]) {
    const enriched = await enrichJobWithPublicExperience(job, { fetchText: async () => response(html) })
    assert.equal(hasSourceDescription(normalizeScrapedJob(enriched)), false, html)
  }
})

test('visible page text alone cannot replace an explicitly missing immutable source description', async () => {
  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async () => response(`<html><h1>${job.title}</h1>${description}</html>`),
  })
  assert.equal(hasSourceDescription(normalizeScrapedJob(enriched)), false)
})

test('existing employer source content is retained when a page supplies a different description', async () => {
  const original = '<p>Employer source description with 4 years of relevant engineering experience.</p>'
  const enriched = await enrichJobWithPublicExperience({ ...job, sourceDescription: original }, {
    fetchText: async () => response(page(posting)),
  })
  assert.equal(normalizeScrapedJob(enriched).sourceDescription, original)
})

test('default transport requires an actual successful final role URL before canonical recovery', async t => {
  let finalUrl = 'https://unrelated.example/search-jobs'
  t.mock.method(globalThis, 'fetch', async () => {
    const result = new Response(page(posting), { status: 200, headers: { 'content-type': 'text/html' } })
    Object.defineProperty(result, 'url', { value: finalUrl })
    return result
  })
  const redirected = await enrichJobWithPublicExperience(job)
  assert.equal(hasSourceDescription(normalizeScrapedJob(redirected)), false)
  finalUrl = job.sourceUrl
  const matched = await enrichJobWithPublicExperience(job)
  assert.equal(matched.sourceDescription, description)
})

test('custom text-only fetches lack final URL proof for canonical source recovery', async () => {
  const enriched = await enrichJobWithPublicExperience(job, { fetchText: async () => page(posting) })
  assert.equal(hasSourceDescription(normalizeScrapedJob(enriched)), false)
  for (const change of [{ status: 403 }, { url: 'https://unrelated.example/search-jobs' }]) {
    const failed = await enrichJobWithPublicExperience(job, { fetchText: async () => ({ ...response(page(posting)), ...change }) })
    assert.equal(hasSourceDescription(normalizeScrapedJob(failed)), false)
  }
})

test('embedded role recovery requires an active iframe and verified successful wrapper response', async () => {
  const childUrl = 'https://boards.greenhouse.io/exampleemployer/jobs/100'
  const frame = `<iframe src="${childUrl}"></iframe>`
  const child = { status: 200, url: childUrl, html: page({ ...posting, url: childUrl }) }
  for (const wrapper of [
    response(frame), response(`<!-- ${frame} -->`), response(`<template>${frame}</template>`),
    response(`<div hidden>${frame}</div>`), { ...response(frame), status: 403 },
    response(`<object data="/existing.pdf">${frame}</object>`),
    response(`<iframe src="${childUrl}" srcdoc="<p>Job unavailable</p>"></iframe>`),
    response(`<iframe src="${childUrl}" srcdoc></iframe>`),
    { ...response(frame), url: 'https://unrelated.example/search-jobs' }, frame,
  ]) {
    const calls = []
    const enriched = await enrichJobWithPublicExperience(job, { fetchText: async url => {
      calls.push(url)
      return url === job.sourceUrl ? wrapper : child
    } })
    if (wrapper === frame || wrapper.html !== frame || wrapper.status !== 200 || wrapper.url !== job.sourceUrl) {
      assert.equal(hasSourceDescription(normalizeScrapedJob(enriched)), false)
      assert.deepEqual(calls, [job.sourceUrl])
    } else {
      assert.equal(enriched.sourceDescription, description)
      assert.deepEqual(calls, [job.sourceUrl, childUrl])
    }
  }
})
