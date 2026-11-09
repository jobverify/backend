import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

const loadTredenceModule = async () => {
  try {
    return await import('../../scraper/tredence/script.js')
  } catch {
    return null
  }
}

const SEARCH_RESULTS_XML = `
<JobPageVO>
  <startJobIndex>0</startJobIndex>
  <maxJobSize>10</maxJobSize>
  <totalJobCount>101</totalJobCount>
  <jobVoList>
    <jobVoList>
      <jobSeq>890548</jobSeq>
      <jobTitle>IT Associate</jobTitle>
      <jobLocation>Bangalore</jobLocation>
      <jobReqExp>0 - 2 Years</jobReqExp>
      <jobPostingDate></jobPostingDate>
      <locations>Bangalore</locations>
      <jobId>890548</jobId>
    </jobVoList>
    <jobVoList>
      <jobSeq>888514</jobSeq>
      <jobTitle>Service Level Manager - DataOps Technical Lead - Databricks/Azure</jobTitle>
      <jobLocation>Bangalore</jobLocation>
      <jobReqExp>7 - 12 Years</jobReqExp>
      <jobPostingDate></jobPostingDate>
      <locations>Bangalore</locations>
      <jobId>888514</jobId>
    </jobVoList>
    <jobVoList>
      <jobSeq>887490</jobSeq>
      <jobTitle>Consulting Director_Analytics</jobTitle>
      <jobLocation>Canada</jobLocation>
      <jobReqExp>13 - 18 Years</jobReqExp>
      <jobPostingDate></jobPostingDate>
      <locations>Toronto</locations>
      <jobId>887490</jobId>
    </jobVoList>
    <jobVoList>
      <jobSeq>886735</jobSeq>
      <jobTitle>Staff Data Engineer</jobTitle>
      <jobLocation></jobLocation>
      <jobReqExp>7 - 12 Years</jobReqExp>
      <jobPostingDate></jobPostingDate>
      <locations>San Jose (TR)</locations>
      <jobId>886735</jobId>
    </jobVoList>
  </jobVoList>
</JobPageVO>
`

const JOB_DETAIL_XML = `
<CandidateJobVO>
  <jobVO>
    <jobSeq>890548</jobSeq>
    <jobId>890548</jobId>
    <jobTitle>IT Associate</jobTitle>
    <jobLocation>Bangalore</jobLocation>
    <locations>Bangalore</locations>
    <jobReqExp>0 - 2 Years</jobReqExp>
    <jobType>R</jobType>
    <jobPostingDate>03-Jul-2026</jobPostingDate>
    <jobDesc>&lt;p style="text-align: center;">&lt;strong>Roles and Responsibilities&lt;/strong>&lt;
&lt;p style="line-height: normal;">&lt;strong>Job Role: L1 - Desktop Operations&lt;/strong>&lt;
&lt;p style="line-height: normal;">&lt;strong>Experience: 2-3 Years&lt;/strong>&lt;
&lt;p style="text-indent: -.25in;">&lt;span style="mso-list: Ignore;">1.&lt;span style="font: 7.0pt 'Times New Roman';">&lt;/span>&lt;/span>Should have good communication and interpersonal skill.&lt;/p>&#xd;
&lt;p style="text-indent: -.25in;">&lt;span style="mso-list: Ignore;">2.&lt;span style="font: 7.0pt 'Times New Roman';">&lt;/span>&lt;/span>Handle daily technical support activities on desktop support, data network and server management.&lt;/p>&#xd;
&lt;p style="text-indent: -.25in;">&lt;span style="mso-list: Ignore;">3.&lt;span style="font: 7.0pt 'Times New Roman';">&lt;/span>&lt;/span>Install and test desktop software applications and internet browsers.&lt;/p>&#xd;
&lt;p style="text-indent: -.25in;">&lt;span style="mso-list: Ignore;">4.&lt;span style="font: 7.0pt 'Times New Roman';">&lt;/span>&lt;/span>Test computers to ensure proper functioning of computer systems.&lt;/p>&#xd;
&lt;p style="background: white;">Key Competencies&lt;/p>
&lt;p style="text-indent: -.25in;">&lt;span style="mso-list: Ignore;">1.&lt;span style="font: 7.0pt 'Times New Roman';">&lt;/span>&lt;/span>Hardware and software troubleshooting (Preferred: Office 365, VPN)&lt;/p>&#xd;
&lt;p style="text-indent: -.25in;">&lt;span style="mso-list: Ignore;">2.&lt;span style="font: 7.0pt 'Times New Roman';">&lt;/span>&lt;/span>All operating systems (Windows, Linux, and mac)&lt;/p>&#xd;
    </jobDesc>
    <bussinessUnit></bussinessUnit>
  </jobVO>
</CandidateJobVO>
`

test('buildSearchRequestPayload keeps Tredence listings on the verified public RippleHire board contract', async () => {
  const tredence = await loadTredenceModule()
  assert.ok(tredence)

  assert.deepEqual(tredence.buildSearchRequestPayload(), {
    page: 0,
    search: '*:*',
    campaignSeq: '',
    token: 'rzuz0vttMaz0VxxVzDiY',
    source: 'CAREERSITE',
    pagesize: 10,
  })

  assert.deepEqual(tredence.buildSearchRequestPayload(4), {
    page: 4,
    search: '*:*',
    campaignSeq: '',
    token: 'rzuz0vttMaz0VxxVzDiY',
    source: 'CAREERSITE',
    pagesize: 10,
  })
})

test('isIndiaListing keeps Tredence India roles and excludes foreign locations from the public board', async () => {
  const tredence = await loadTredenceModule()
  assert.ok(tredence)

  assert.equal(tredence.isIndiaListing({ countryCode: 'Bangalore', city: 'Bangalore' }), true)
  assert.equal(tredence.isIndiaListing({ countryCode: 'Gurgaon', city: 'Gurgaon' }), true)
  assert.equal(tredence.isIndiaListing({ countryCode: 'Canada', city: 'Toronto' }), false)
  assert.equal(tredence.isIndiaListing({ countryCode: '', city: 'San Jose (TR)' }), false)
})

test('extractSearchResults parses Tredence RippleHire XML and filters listings to India roles', async () => {
  const tredence = await loadTredenceModule()
  assert.ok(tredence)

  const jobs = tredence.extractSearchResults(SEARCH_RESULTS_XML)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'IT Associate',
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '890548',
    requisitionId: '890548',
    sourceUrl: 'https://tredence.ripplehire.com/candidate/?token=rzuz0vttMaz0VxxVzDiY&source=CAREERSITE#detail/job/890548',
    applyUrl: 'https://tredence.ripplehire.com/candidate/?token=rzuz0vttMaz0VxxVzDiY&source=CAREERSITE#apply/job/890548',
    experienceRequired: '0 - 2 Years',
    postingDate: null,
    department: null,
  })

  assert.deepEqual(jobs[1], {
    title: 'Service Level Manager - DataOps Technical Lead - Databricks/Azure',
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '888514',
    requisitionId: '888514',
    sourceUrl: 'https://tredence.ripplehire.com/candidate/?token=rzuz0vttMaz0VxxVzDiY&source=CAREERSITE#detail/job/888514',
    applyUrl: 'https://tredence.ripplehire.com/candidate/?token=rzuz0vttMaz0VxxVzDiY&source=CAREERSITE#apply/job/888514',
    experienceRequired: '7 - 12 Years',
    postingDate: null,
    department: null,
  })
})

test('extractSearchSummary reads total counts and page offsets from Tredence RippleHire XML', async () => {
  const tredence = await loadTredenceModule()
  assert.ok(tredence)

  assert.deepEqual(tredence.extractSearchSummary(SEARCH_RESULTS_XML), {
    startJobIndex: 0,
    pageSize: 10,
    totalJobCount: 101,
  })
})

test('extractJobDetail pulls Tredence description, posting date, numbered skills, and apply URLs from the detail XML', async () => {
  const tredence = await loadTredenceModule()
  assert.ok(tredence)

  const detail = tredence.extractJobDetail(JOB_DETAIL_XML, {
    title: 'IT Associate',
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '890548',
    requisitionId: '890548',
    sourceUrl: tredence.buildDetailUrl('890548'),
    applyUrl: tredence.buildApplyUrl('890548'),
    experienceRequired: '0 - 2 Years',
  })

  assert.equal(detail.title, 'IT Associate')
  assert.equal(detail.location, 'Bangalore, India')
  assert.equal(detail.city, 'Bangalore')
  assert.equal(detail.jobId, '890548')
  assert.equal(detail.requisitionId, '890548')
  assert.equal(detail.department, null)
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '0 - 2 Years')
  assert.match(detail.jobDescription, /Roles and Responsibilities/i)
  assert.match(detail.jobDescription, /daily technical support activities/i)
  assert.deepEqual(detail.requiredSkills.slice(0, 4), [
    'Should have good communication and interpersonal skill.',
    'Handle daily technical support activities on desktop support, data network and server management.',
    'Install and test desktop software applications and internet browsers.',
    'Test computers to ensure proper functioning of computer systems.',
  ])
  assert.equal(detail.postingDate, '03-Jul-2026')
  assert.equal(detail.applyUrl, tredence.buildApplyUrl('890548'))
  assert.equal(detail.sourceUrl, tredence.buildDetailUrl('890548'))
})

test('normalizeScrapedJob keeps Tredence zero-minimum experience eligible for fresher full-time roles', async () => {
  const tredence = await loadTredenceModule()
  assert.ok(tredence)

  const detail = tredence.extractJobDetail(JOB_DETAIL_XML, {
    title: 'IT Associate',
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '890548',
    requisitionId: '890548',
    sourceUrl: tredence.buildDetailUrl('890548'),
    applyUrl: tredence.buildApplyUrl('890548'),
    experienceRequired: '0 - 2 Years',
  })

  const normalized = normalizeScrapedJob(detail, {
    source: 'tredence',
    companyName: 'Tredence',
    companyCareerPage: 'https://www.tredence.com/careers/greatest-of-ai',
    atsPlatform: 'ripplehire',
  })

  assert.equal(normalized.employmentType, 'Full-time')
  assert.equal(normalized.experienceLevel, 'Entry Level')
  assert.equal(normalized.jobType, 'Full-time Fresher')
  assert.equal(detail.experienceRequired, '0 - 2 Years')
  assert.equal(normalized.experienceRequired, detail.experienceRequired)
  assert.equal(normalized.experienceProfile.minimumYears, 0)
  assert.equal(normalized.experienceProfile.maximumYears, 2)
  assert.equal(normalized.sourceDescription, detail.jobDescription)
})

test('Tredence runtime rejects the obsolete XML negotiation while pure XML parsers remain available', async () => {
  const source = await import('../../scraper/tredence/script.js')
  const requests = []
  await assert.rejects(source.run({ fetchText: async (url, options) => {
    requests.push([url, options.method])
    return SEARCH_RESULTS_XML
  } }), /JSON/)
  assert.deepEqual(requests.map(row => row[1]), ['POST'])
})

// Portable original public JSON captures; modeled controls below are explicit.
const nativeCapture = async name => {
  const { readFile } = await import('node:fs/promises')
  return readFile(new URL(`./test-data/native-captures/ripplehire-2026-11-05/tredence-${name}`, import.meta.url), 'utf8')
}
const modeledNativeRuntime = async ({ countries = ['India', null, 'United States'], pageSize = 10, mutateDetail, mutateClosing } = {}) => {
  const detail = JSON.parse(await nativeCapture('detail.json'))
  const listing = JSON.parse(await nativeCapture('search.json')).jobVoList[0]
  const rows = countries.map((country, i) => ({ ...structuredClone(listing), jobSeq: String(700001 + i), jobId: String(700001 + i),
    jobTitle: `Modeled native role ${i}`, jobLocation: country, locations: i === 1 ? 'Hyderabad' : 'Pune' }))
  const requested = []
  let openingCalls = 0
  const fetchText = async (url, options = {}) => {
    requested.push({ url, options })
    assert.match(options.headers?.Accept || '', /application\/json/, 'native client JSON negotiation is required')
    assert.equal(options.headers['X-Requested-With'], 'XMLHttpRequest')
    if (url.endsWith('/candidatejobsearch')) {
      assert.equal(options.method, 'POST')
      const payload = JSON.parse(options.body.get('careerSiteUrlParams'))
      const isClosing = openingCalls++ >= Math.max(1, Math.ceil(rows.length / pageSize))
      const pageRows = rows.slice(payload.page * pageSize, (payload.page + 1) * pageSize).map(row => structuredClone(row))
      const page = { startJobIndex: payload.page * pageSize, maxJobSize: pageSize, totalJobCount: rows.length,
        jobVoList: pageRows, errorStatus: 'success' }
      if (isClosing) mutateClosing?.(page)
      return JSON.stringify(page)
    }
    const id = new URL(url).searchParams.get('jobSeq')
    const row = rows.find(row => row.jobSeq === id)
    assert.ok(row, `unexpected detail ID ${id}`)
    const response = structuredClone(detail)
    response.jobSeq = id
    response.jobVO.jobSeq = id
    response.jobVO.jobId = id
    response.jobVO.jobTitle = row.jobTitle
    response.jobVO.locations = row.locations
    response.jobVO.jobLocation = row.locations
    mutateDetail?.(response)
    return JSON.stringify(response)
  }
  return { rows, requested, fetchText }
}

test('Tredence runtime uses the published JSON contract, enumerates raw pages beyond ten and checks a closing snapshot', async () => {
  const source = await import('../../scraper/tredence/script.js')
  const modeled = await modeledNativeRuntime({ countries: [...Array(10).fill('United States'), 'India'], pageSize: 1 })
  const jobs = await source.run({ fetchText: modeled.fetchText, pageSize: 1 })
  assert.deepEqual(jobs.map(job => job.jobId), ['700011'])
  assert.equal(modeled.requested.filter(row => row.url.endsWith('candidatejobsearch')).length, 22)
  assert.equal(modeled.requested.filter(row => row.url.includes('candidatejobdetail?')).length, 11)
  assert.equal(jobs.nativeInventory.queryEnumeratedCount, 11)
  assert.equal(jobs.nativeInventory.queryDetailedCount, 11)
  assert.equal(jobs.nativeInventory.closingStable, true)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('Tredence runtime preserves unknown native countries and original full authored descriptions', async () => {
  const source = await import('../../scraper/tredence/script.js')
  const authored = '<p>Responsibilities: retain &lt;jobSeq&gt;, ]]> and A &amp; B; rate < 10% and ratio > 1.</p><p>Qualifications: design reliable systems with observability and ownership.</p>'
  const modeled = await modeledNativeRuntime({ mutateDetail: value => { value.jobVO.jobDesc = authored } })
  const jobs = await source.run({ fetchText: modeled.fetchText })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceDescriptionHtml, authored)
  assert.match(jobs[0].jobDescription, /<jobSeq>, \]\]> and A & B; rate < 10% and ratio > 1/)
  assert.deepEqual(jobs.nativeInventory.unresolvedIds, ['700002'])
  assert.equal(jobs.nativeInventory.nativeRoles.find(job => job.jobId === '700002').country, null)
  const { readSourceObservationEvidence } = await import('../utils/sourceObservationEvidence.js')
  const { readInventoryEvidence, isCompleteScraperAttempt } = await import('../utils/inventoryEvidence.js')
  assert.equal(readSourceObservationEvidence(jobs, 'tredence').observedVacancyCount, 3)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(isCompleteScraperAttempt({ success: true, inventoryEvidence: readInventoryEvidence(jobs) }), false)
})

test('Tredence registered runtime retains preprojection raw observations when country evidence yields an empty array', async () => {
  const { buildScrapers } = await import('../providers/index.js')
  const modeled = await modeledNativeRuntime({ countries: [null] })
  const scraper = buildScrapers().find(row => row.name === 'tredence')
  const jobs = await scraper.run({ fetchText: modeled.fetchText })
  assert.equal(jobs.length, 0)
  const { readSourceObservationEvidence } = await import('../utils/sourceObservationEvidence.js')
  const { extractionRawJobMetrics } = await import('../utils/extractionRawJobMetrics.js')
  const { readInventoryEvidence } = await import('../utils/inventoryEvidence.js')
  assert.equal(readSourceObservationEvidence(jobs, 'tredence').observedVacancyCount, 1)
  assert.deepEqual(extractionRawJobMetrics(scraper.provider, jobs, readInventoryEvidence(jobs)), { rawJobs: 1, rawJobsBasis: 'observed-native-vacancy-rows' })
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

test('Tredence runtime refuses capped native pages before returning a truncated inventory', async () => {
  const source = await import('../../scraper/tredence/script.js')
  const modeled = await modeledNativeRuntime({ pageSize: 1 })
  await assert.rejects(source.run({ fetchText: modeled.fetchText, pageSize: 1, maxPages: 1 }), error => {
    assert.equal(error.failureKind, 'coverage_gap')
    assert.equal(error.inventoryEvidence.listingComplete, false)
    return /limit|incomplete/i.test(error.message)
  })
  assert.equal(modeled.requested.length, 1)
})

test('Tredence runtime independently rejects mismatched identity, missing content, foreign employer and upstream detail errors', async t => {
  const source = await import('../../scraper/tredence/script.js')
  for (const [label, mutateDetail] of [
    ['identity', value => { value.jobVO.jobSeq = '999999' }],
    ['missing-content', value => { value.jobVO.jobDesc = '' }],
    ['error-stub', value => { value.jobVO.jobDesc = 'An unexpected error occurred' }],
    ['employer', value => { value.companyVO.parentCompanyMstrSeq = '999999' }],
    ['deactivated', value => { value.linkDeactivated = true }],
  ]) await t.test(label, async () => {
    const modeled = await modeledNativeRuntime({ countries: ['India'], mutateDetail })
    await assert.rejects(source.run({ fetchText: modeled.fetchText }), error => error.failureKind === 'coverage_gap')
  })
  await t.test('genuine error-bearing XML', async () => {
    const modeled = await modeledNativeRuntime({ countries: ['India'] })
    const nativeError = await nativeCapture('detail-error-bearing.xml')
    await assert.rejects(source.run({ fetchText: (url, options) => url.includes('candidatejobdetail?') ? nativeError : modeled.fetchText(url, options) }), /JSON|detail|native/i)
  })
})

test('Tredence runtime rejects changed closing identity with the same count', async () => {
  const source = await import('../../scraper/tredence/script.js')
  const modeled = await modeledNativeRuntime({ countries: ['India'], mutateClosing: value => { value.jobVoList[0].jobTitle = 'changed role' } })
  await assert.rejects(source.run({ fetchText: modeled.fetchText }), /closing|changed/i)
})

test('Tredence exported runtime races ignored cancellation and preserves exact falsey or opaque caller reasons', async t => {
  const source = await import('../../scraper/tredence/script.js')
  for (const reason of [false, null, Object.freeze({ nativeStop: true })]) await t.test(String(reason), async () => {
    const controller = new AbortController()
    let calls = 0
    const running = source.run({ fetchText: async () => { calls++; return new Promise(() => {}) }, signal: controller.signal })
    await new Promise(resolve => setTimeout(resolve, 5))
    controller.abort(reason)
    const outcome = await Promise.race([running.then(() => ({ resolved: true }), error => ({ error })), new Promise(resolve => setTimeout(() => resolve({ late: true }), 80))])
    assert.equal(outcome.late, undefined)
    assert.strictEqual(outcome.error, reason)
    assert.equal(calls, 1)
  })
})

test('Tredence runtime applies request and collection clocks to injected readers', async () => {
  const source = await import('../../scraper/tredence/script.js')
  for (const options of [{ requestTimeoutMs: 8, collectionBudgetMs: 100 }, { requestTimeoutMs: 100, collectionBudgetMs: 8 }]) {
    let calls = 0
    const outcome = await Promise.race([
      source.run({ ...options, fetchText: async () => { calls++; return new Promise(() => {}) } }).then(() => ({ resolved: true }), error => ({ error })),
      new Promise(resolve => setTimeout(() => resolve({ late: true }), 100)),
    ])
    assert.equal(outcome.late, undefined)
    assert.equal(outcome.error.failureKind, 'coverage_gap')
    assert.equal(calls, 1)
  }
})


test('Tredence runtime retains complete neighboring jobs and reports missing native details honestly', async () => {
  const source = await import('../../scraper/tredence/script.js')
  const modeled = await modeledNativeRuntime({ countries: ['India', 'India'], mutateDetail: value => {
    if (value.jobSeq === '700002') value.jobVO.jobDesc = 'NULL'
  } })
  const jobs = await source.run({ fetchText: modeled.fetchText })
  assert.deepEqual(jobs.map(job => job.jobId), ['700001'])
  assert.equal(jobs.nativeInventory.queryEnumeratedCount, 2)
  assert.equal(jobs.nativeInventory.queryDetailedCount, 2)
  assert.equal(jobs.nativeInventory.closingStable, true)
  assert.equal(jobs[0].nativeCollectionEvidence.failures.length, 1)
  assert.equal(jobs[0].nativeCollectionEvidence.failures[0].jobId, '700002')
  const { extractionDetailHealth } = await import('../utils/extractionDetailHealth.js')
  const health = extractionDetailHealth(jobs)
  assert.equal(health.complete, false)
  assert.equal(health.nativeCollections[0].candidateDetails, 2)
  assert.equal(health.nativeCollections[0].unextractedDetailFailures, 1)
  assert.equal(health.nativeCollections[0].countsReconciled, true)
})

test('Tredence native detail projection preserves the unchanged genuine JSON role and full authored HTML', async () => {
  const source = await import('../../scraper/tredence/script.js')
  const original = JSON.parse(await nativeCapture('detail.json'))
  const listing = JSON.parse(await nativeCapture('search.json')).jobVoList.find(row => row.jobSeq === original.jobSeq)
  assert.ok(listing)
  // This one-row listing is explicitly modeled; the detail body stays unchanged.
  const modeledSearch = JSON.stringify({ startJobIndex: 0, maxJobSize: 10, totalJobCount: 1, jobVoList: [listing], errorStatus: 'success' })
  const originalBody = await nativeCapture('detail.json')
  const jobs = await source.run({ fetchText: async url => url.includes('candidatejobdetail?') ? originalBody : modeledSearch })
  const native = jobs.nativeInventory.nativeRoles[0]
  assert.equal(native.jobId, original.jobSeq)
  assert.equal(native.sourceDescriptionHtml, original.jobVO.jobDesc)
  assert.equal(native.sourceDetailComplete, true)
  assert.ok(native.jobDescription.length > 500)
})


test('Tredence runtime excludes explicitly closed native neighbors and reconciles their original lifecycle state', async () => {
  const source = await import('../../scraper/tredence/script.js')
  const modeled = await modeledNativeRuntime({ countries: ['India', 'India'], mutateDetail: value => {
    if (value.jobSeq === '700002') { value.jobVO.jobStatus = 'CLOSED'; value.enableLink = 'N' }
  } })
  const jobs = await source.run({ fetchText: modeled.fetchText })
  assert.deepEqual(jobs.map(job => job.jobId), ['700001'])
  const native = jobs.nativeInventory.nativeRoles.find(job => job.jobId === '700002')
  assert.equal(native.nativeState.jobStatus, 'CLOSED')
  assert.equal(native.nativeState.enableLink, 'N')
  assert.equal(native.publicationOutcome, 'native-closed')
  assert.deepEqual(jobs.nativeInventory.outcomeCounts, { publishedIndia: 1, nativeClosed: 1, unresolvedCountry: 0, nonIndia: 0, nativeDetailFailure: 0 })
  assert.equal(jobs.nativeInventory.closingStable, true)
  const { extractionDetailHealth } = await import('../utils/extractionDetailHealth.js')
  const collection = extractionDetailHealth(jobs).nativeCollections[0]
  assert.equal(collection.candidateDetails, 2)
  assert.equal(collection.parsedDetails, 1)
  assert.equal(collection.excludedDetails, 1)
  assert.equal(collection.countsReconciled, true)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})


test('Tredence runtime requires visible criteria beyond inert content, repeated placeholders or its own title', async t => {
  const source = await import('../../scraper/tredence/script.js')
  for (const [label, badDescription] of [
    ['inert-template-only', () => '<template><p>Minimum qualifications: degree and five years of distributed systems engineering experience. Design and maintain reliable cloud services.</p></template>'],
    ['hidden-only', () => '<div hidden>Minimum qualifications: degree and five years of distributed systems engineering experience. Design and maintain reliable cloud services.</div>'],
    ['repeated-own-title', row => Array(8).fill(row.jobVO.jobTitle).join(' ')],
    ['repeated-placeholder', () => Array(5).fill('Enter the Job Description').join(' ')],
  ]) await t.test(label, async () => {
    let originalBadDescription
    const modeled = await modeledNativeRuntime({ countries:['India','India'], mutateDetail: value => {
      if (value.jobSeq === '700002') value.jobVO.jobDesc = originalBadDescription = badDescription(value)
    } })
    const jobs = await source.run({fetchText:modeled.fetchText})
    assert.deepEqual(jobs.map(job=>job.jobId),['700001'])
    const excluded = jobs.nativeInventory.nativeRoles.find(job=>job.jobId==='700002')
    assert.equal(excluded.sourceDetailComplete,false)
    assert.equal(excluded.jobDescription,null)
    assert.equal(excluded.sourceDescriptionHtml,originalBadDescription)
    assert.equal(excluded.publicationOutcome,'native-detail-failure')
    assert.deepEqual(jobs.nativeInventory.outcomeCounts,{publishedIndia:1,nativeClosed:0,unresolvedCountry:0,nonIndia:0,nativeDetailFailure:1})
    const {extractionDetailHealth}=await import('../utils/extractionDetailHealth.js')
    const health=extractionDetailHealth(jobs).nativeCollections[0]
    assert.equal(health.countsReconciled,true)
    assert.equal(health.unextractedDetailFailures,1)
    assert.equal(health.complete,false)
  })
})

test('Tredence visible criteria guard preserves all authored literal angles, entities and real role text', async () => {
  const source = await import('../../scraper/tredence/script.js')
  const authored='<p>Use the C++ service when rate < 10% and ratio > 1; preserve &lt;T&gt; and A &amp; B. Build reliable data services and write automated tests.</p>'
  const modeled=await modeledNativeRuntime({countries:['India'],mutateDetail:value=>{value.jobVO.jobDesc=authored}})
  const jobs=await source.run({fetchText:modeled.fetchText})
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].sourceDescriptionHtml,authored)
  assert.equal(jobs[0].jobDescription,'Use the C++ service when rate < 10% and ratio > 1; preserve <T> and A & B. Build reliable data services and write automated tests.')
  assert.equal(jobs[0].sourceDetailComplete,true)
})
