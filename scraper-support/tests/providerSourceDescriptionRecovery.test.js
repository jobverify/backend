import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { enrichJobWithPublicExperience, enrichJobsWithPublicExperience } from '../utils/publicExperienceEnrichment.js'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/public-provider-content/${name}.json`, import.meta.url)))
const receipt = (url, payload) => ({ status: 200, url, payload })
const page = (url, html = '<div id="app"></div>') => ({ status: 200, url, html })
const missing = { sourceDescription: null, jobDescription: null, description: null, country: 'India', publicExperienceChecked: false }
const oracle = () => {
  const detail = fixture('oracle-detail').items[0]
  return { ...missing, title: detail.Title, company: 'Zensar', source: 'zensar', jobId: detail.Id,
    location: detail.PrimaryLocation, siteNumber: 'CX_1',
    sourceUrl: `https://fa-etvl-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/${detail.Id}` }
}
const oracleRun = (job = oracle(), change = value => value) => enrichJobWithPublicExperience(job, {
  fetchText: async url => page(url), fetchJson: async url => change(receipt(url, fixture('oracle-detail'))),
})
const canonical = result => normalizeScrapedJob(result).sourceDescription

test('Oracle exact native detail fills missing canonical content with original employer HTML', async () => {
  const input = oracle()
  const result = await oracleRun(input)
  assert.ok(canonical(result).includes(fixture('oracle-detail').items[0].ExternalDescriptionStr))
  assert.equal(result.title, input.title)
  assert.equal(result.country, 'India')
  assert.equal(hasSourceDescription(result), true)
  assert.equal(input.sourceDescription, null)
})

test('Oracle rejects changed API identity, country, title, duplicate records and failed or redirected responses', async () => {
  for (const change of [
    value => { value.payload.items[0].Id = '0' }, value => { value.payload.items[0].Title = 'Another role' },
    value => { value.payload.items[0].PrimaryLocationCountry = 'US' },
    value => { value.payload.items.push(structuredClone(value.payload.items[0])) },
    value => { value.status = 403 }, value => { value.url = 'https://unrelated.example/api' },
  ]) {
    const result = await oracleRun(oracle(), value => { change(value); return value })
    assert.equal(hasSourceDescription(result), false)
  }
})

test('Oracle input identifiers and site cannot contradict its public role URL', async () => {
  for (const change of [{ jobId: '99999' }, { siteNumber: 'OTHER' }, { sourceUrl: 'https://unrelated.example/hcmUI/CandidateExperience/en/sites/CX_1/job/134637' }]) {
    let calls = 0
    const result = await enrichJobWithPublicExperience({ ...oracle(), ...change }, {
      fetchText: async url => page(url), fetchJson: async url => { calls++; return receipt(url, fixture('oracle-detail')) },
    })
    assert.equal(calls, 0)
    assert.equal(hasSourceDescription(result), false)
  }
})

test('native API recovery retains an existing immutable employer description', async () => {
  const source = '<p>Original employer source: requirements and responsibilities.</p>'
  const result = await oracleRun({ ...oracle(), sourceDescription: source })
  assert.equal(canonical(result), source)
})

test('raw JSON without successful final API URL proof cannot become canonical source content', async () => {
  const result = await oracleRun(oracle(), value => value.payload)
  assert.equal(hasSourceDescription(result), false)
})

test('Oracle recovery preserves native publication and closing clocks rather than inventing a fresh posting', async () => {
  const expected = fixture('oracle-detail').items[0]
  const result = normalizeScrapedJob(await oracleRun())
  assert.equal(new Date(result.postedAt).toISOString(), new Date(expected.ExternalPostedStartDate).toISOString())
  assert.equal(new Date(result.closingDate).toISOString(), new Date(expected.ExternalPostedEndDate).toISOString())
  for (const [field, value] of [['ExternalPostedEndDate','2020-01-01T00:00:00Z'],['ExternalPostedStartDate','2030-01-01T00:00:00Z']]) {
    const changed = normalizeScrapedJob(await oracleRun(oracle(), response => { response.payload.items[0][field] = value; return response }))
    assert.equal(new Date(field.includes('End') ? changed.closingDate : changed.postedAt).toISOString(), new Date(value).toISOString())
  }
})

test('native lifecycle conflicts or malformed dates do not overwrite trusted source dates', async () => {
  for (const change of [{postingDate:'2020-01-01'}, {closingDate:'2020-01-01'}]) {
    const result = await oracleRun({...oracle(),...change})
    assert.equal(hasSourceDescription(result), false)
    assert.equal(result[Object.keys(change)[0]], Object.values(change)[0])
  }
  assert.equal(hasSourceDescription(await oracleRun(oracle(), response => {
    response.payload.items[0].ExternalPostedStartDate = 'not-a-date'
    return response
  })), false)
  // Use the ingestion fallback with its observation provenance. An explicit
  // unmarked postingDate remains a source date even when it equals scrapedAt.
  const observed = normalizeScrapedJob({...oracle(),scrapedAt:'2026-10-24T10:00:00Z'})
  const result = normalizeScrapedJob(await oracleRun(observed))
  assert.equal(new Date(result.postedAt).toISOString(), new Date(fixture('oracle-detail').items[0].ExternalPostedStartDate).toISOString())
})

test('an unmarked source date equal to scrapedAt is not silently replaced during recovery', async () => {
  const result = await oracleRun({...oracle(),postingDate:'2026-10-24T10:00:00Z',scrapedAt:'2026-10-24T10:00:00Z'})
  assert.equal(hasSourceDescription(result), false)
  assert.equal(new Date(result.postingDate).toISOString(), '2026-10-24T10:00:00.000Z')
})

test('invalid native calendar dates and conflicting trusted exact clocks cannot authorize source recovery', async () => {
  assert.equal(hasSourceDescription(await oracleRun(oracle(), response => {
    response.payload.items[0].ExternalPostedStartDate = '2026-09-31T10:00:00Z'
    return response
  })), false)
  const result = await oracleRun({ ...oracle(), closingDate: '2026-10-30T10:00:00Z', sourceClosingDateIsExact: true })
  assert.equal(hasSourceDescription(result), false)
  assert.equal(result.closingDate, '2026-10-30T10:00:00Z')
  assert.equal(hasSourceDescription(await oracleRun({ ...oracle(), closingDate: '2026-10-30', sourceClosingDateIsExact: false })), true)
})

test('independent single-job enrichment calls do not reuse stale or another fetcher native payload', async () => {
  assert.equal(hasSourceDescription(await oracleRun()), true)
  let calls = 0
  const result = await oracleRun(oracle(), value => {
    calls++
    value.payload.items[0].ExternalDescriptionStr = '<p>Current changed employer source.</p>'
    return value
  })
  assert.equal(calls, 1)
  assert.match(canonical(result), /Current changed employer source/)
})

test('one enrichment batch shares duplicate native reads without leaking into a later batch', async () => {
  let calls = 0
  const options = { useBrowserFallback: false, fetchText: async url => page(url), fetchJson: async url => { calls++; return receipt(url, fixture('oracle-detail')) } }
  const first = await enrichJobsWithPublicExperience([oracle(), oracle()], options)
  assert.equal(calls, 1)
  assert.ok(first.every(hasSourceDescription))
  await enrichJobsWithPublicExperience([oracle()], options)
  assert.equal(calls, 2)
})

test('a long batch refreshes expired native receipts before recovering another duplicate role', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-24T10:00:00Z') })
  let reads = 0, pages = 0
  const jobs = await enrichJobsWithPublicExperience([oracle(), oracle(), oracle()], {
    concurrency: 1, useBrowserFallback: false,
    fetchText: async url => { if (++pages === 2) t.mock.timers.tick(300001); return page(url) },
    fetchJson: async url => { reads++; return receipt(url, fixture('oracle-detail')) },
  })
  assert.equal(reads, 2)
  assert.ok(jobs.every(hasSourceDescription))
})

test('native API cancellation remains cancellation after a late successful response', async () => {
  const controller = new AbortController(), reason = new Error('Native enrichment cancelled')
  await assert.rejects(enrichJobWithPublicExperience(oracle(), {
    signal: controller.signal, fetchText: async url => page(url), fetchJson: async url => {
      controller.abort(reason)
      return receipt(url, fixture('oracle-detail'))
    },
  }), error => error === reason)
})

test('default native JSON transport retains response identity for canonical Oracle recovery', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    const result = String(url).includes('/hcmRestApi/') ? Response.json(fixture('oracle-detail')) : new Response('<app-root></app-root>')
    Object.defineProperty(result, 'url', { value: String(url) })
    return result
  })
  assert.equal(hasSourceDescription(await enrichJobWithPublicExperience(oracle())), true)
})

const fountain = () => ({ ...missing, title: fixture('fountain-detail').funnel.title, company: 'CMS Info Systems', source: 'cmscomputers',
  jobId: fixture('fountain-detail').funnel.external_id, companyCareerPage: 'https://www.cms.com/careers',
  sourceUrl: 'https://ap-1.fountain.com/cms/apply/chennai-project-manager-chennai' })
const oldBoard = 'https://careers.ap-1.fountain.com/cms/a9218256-8fbf-40ab-936b-49ff5ff7c900'
const newBoard = 'https://careers.rekrutek.ai/cms/a9218256-8fbf-40ab-936b-49ff5ff7c900'
const newRole = 'https://apply.rekrutek.ai/apply/cms/opening/chennai-project-manager-chennai'
const syntheticFountainDescription = '<p>Lead cash logistics programs and regional operations with 3-5 years of project delivery experience.</p>'
const fountainRun = (change = value => value, changePage = value => value) => {
  const job = fountain()
  return enrichJobWithPublicExperience(job, {
    fetchText: async url => changePage(url === job.companyCareerPage
      ? page(url, `<a href="${oldBoard}">Find your opportunity</a>`)
      : url === oldBoard ? page(newBoard) : page(newRole)),
    fetchJson: async url => {
      const payload = fixture('fountain-detail')
      // The captured live CMS role omits its JD. A nonempty field here tests the
      // verified response contract, without claiming that role currently has it.
      payload.funnel.position_description_html = syntheticFountainDescription
      return change(receipt(url.replace('https://ap-1.fountain.com', 'https://hire.rekrutek.ai'), payload))
    },
  })
}

test('verified Fountain to Rekrutek contract preserves a nonempty employer description', async () => {
  const result = await fountainRun()
  assert.equal(canonical(result), syntheticFountainDescription)
  assert.equal(result.country, 'India')
})

test('the actual captured CMS role remains without content because its native JD is empty', async () => {
  const result = await fountainRun(value => { value.payload = fixture('fountain-detail'); return value })
  assert.equal(hasSourceDescription(result), false)
})

test('Fountain rejects native role, slug, brand, country and active-status conflicts', async () => {
  for (const mutate of [
    value => { value.payload.funnel.external_id = 'wrong' }, value => { value.payload.funnel.slug = 'another-role' },
    value => { value.payload.funnel.active = false }, value => { value.payload.funnel.country_code = 'US' },
    value => { value.payload.brand.external_id = 'another-brand' }, value => { value.url = value.url.replace('/cms/', '/another/') },
  ]) assert.equal(hasSourceDescription(await fountainRun(value => { mutate(value); return value })), false)
})

test('an inactive or failed official Fountain handoff cannot authorize a migrated provider response', async () => {
  for (const mutate of [
    value => { if (value.url === fountain().companyCareerPage) value.html = `<template>${value.html}</template>` },
    value => { if (value.url === fountain().companyCareerPage) value.status = 403 },
    value => { if (value.url === newBoard) value.url = 'https://unrelated.example/board' },
  ]) assert.equal(hasSourceDescription(await fountainRun(value => value, value => { mutate(value); return value })), false)
})

const ceipal = () => ({ ...missing, title: 'Embedded Systems Engineer II', company: 'Example Engineering', source: 'exampleengineering',
  companyCareerPage: 'https://engineering.example/careers-india', jobId: '241',
  sourceUrl: 'https://candidateportal.ceipal.com/job-details/native-role-241', applyUrl: 'https://candidateportal.ceipal.com/apply/native-role-241' })
const ceipalRun = (change = value => value, changePage = value => value) => {
  const job = ceipal()
  return enrichJobWithPublicExperience(job, {
    fetchText: async url => changePage(page(url, url === job.companyCareerPage
      ? '<script src="https://jobsapi.ceipal.com/APISource/widget.js" data-ceipal-api-key="test-key" data-ceipal-career-portal-id="test-portal"></script>' : '<app-root></app-root>')),
    fetchJson: async url => change(receipt(url, { count: 1, num_pages: 1, page_number: 1, next: false, results: [{
      job_id: '241', country: 'India', public_job_title: job.title, public_job_desc: '<p>Requires 5-7 years of embedded systems experience.</p>',
      campus_portal_job_details_url: job.sourceUrl, apply_job: job.applyUrl,
    }] })),
  })
}

test('CEIPAL matching native role and active official widget preserve employer source HTML', async () => {
  assert.equal(canonical(await ceipalRun()), '<p>Requires 5-7 years of embedded systems experience.</p>')
})

test('CEIPAL rejects mismatched IDs, titles, exact country, duplicate identities and unverified response URLs', async () => {
  for (const mutate of [
    value => { value.payload.results[0].job_id = '242' }, value => { value.payload.results[0].public_job_title = 'Another role' },
    value => { value.payload.results[0].country = 'India or United States' },
    value => { value.payload.results.push(structuredClone(value.payload.results[0])) },
    value => { value.url = 'https://unrelated.example/api' },
  ]) assert.equal(hasSourceDescription(await ceipalRun(value => { mutate(value); return value })), false)
})

test('an inert CEIPAL widget or redirected official page cannot authorize canonical content', async () => {
  for (const mutate of [
    value => { if (value.url === ceipal().companyCareerPage) value.html = `<!--${value.html}-->` },
    value => { if (value.url === ceipal().companyCareerPage) value.url = 'https://unrelated.example' },
  ]) assert.equal(hasSourceDescription(await ceipalRun(value => value, value => { mutate(value); return value })), false)
})
