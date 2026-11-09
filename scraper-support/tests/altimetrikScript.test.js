import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadAltimetrikModule = async () => {
  try {
    return await import('../../scraper/altimetrik/script.js')
  } catch {
    return null
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'altimetrik',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const buildTwoListingFixture = () => {
  const xml = readFixture('search-results-page-0.xml')
  const blocks = [...xml.matchAll(/<jobVoList>\s*<jobSeq>[\s\S]*?<\/jobVoList>/gi)]

  if (blocks.length < 2) {
    throw new Error('Expected at least two Altimetrik listing blocks in the fixture')
  }

  const startIndex = blocks[0].index ?? 0
  const lastBlock = blocks.at(-1)
  const endIndex = (lastBlock?.index ?? startIndex) + (lastBlock?.[0].length ?? 0)

  return xml
    .slice(0, startIndex)
    .concat(blocks[0][0], blocks[1][0], xml.slice(endIndex))
    .replace('<totalJobCount>225</totalJobCount>', '<totalJobCount>2</totalJobCount>')
}

test('buildSearchRequestPayload keeps Altimetrik listings on the official RippleHire tokenized endpoint contract', async () => {
  const altimetrik = await loadAltimetrikModule()
  assert.ok(altimetrik)

  assert.deepEqual(altimetrik.buildSearchRequestPayload(), {
    page: 0,
    search: '*:*',
    campaignSeq: '',
    token: 'SWCslMw2ct8eSm7LyqVb',
    source: 'CAREERSITE',
    pagesize: 10,
  })

  assert.deepEqual(altimetrik.buildSearchRequestPayload(5), {
    page: 5,
    search: '*:*',
    campaignSeq: '',
    token: 'SWCslMw2ct8eSm7LyqVb',
    source: 'CAREERSITE',
    pagesize: 10,
  })
})

test('extractSearchResults parses Altimetrik RippleHire XML and keeps India jobs with tokenized URLs', async () => {
  const altimetrik = await loadAltimetrikModule()
  assert.ok(altimetrik)

  const xml = readFixture('search-results-page-0.xml')
  const jobs = altimetrik.extractSearchResults(xml)

  assert.equal(jobs.length, 10)
  assert.deepEqual(jobs[0], {
    title: 'Developer-Software',
    location: 'Pune, India',
    city: 'Pune',
    jobId: '882121',
    requisitionId: '882121',
    sourceUrl: 'https://altimetrik.ripplehire.com/candidate/?token=SWCslMw2ct8eSm7LyqVb&source=CAREERSITE#detail/job/882121',
    applyUrl: 'https://altimetrik.ripplehire.com/candidate/?token=SWCslMw2ct8eSm7LyqVb&source=CAREERSITE#apply/job/882121',
    experienceRequired: '0 - 0 Years',
    postingDate: null,
    department: null,
  })
  assert.equal(jobs[1].title, 'Senior Developer-Software')
  assert.equal(jobs[1].city, 'Bangalore')
})

test('extractSearchSummary reads total counts and page offsets from Altimetrik RippleHire XML', async () => {
  const altimetrik = await loadAltimetrikModule()
  assert.ok(altimetrik)

  const xml = readFixture('search-results-page-0.xml')

  assert.deepEqual(altimetrik.extractSearchSummary(xml), {
    startJobIndex: 0,
    pageSize: 10,
    totalJobCount: 225,
  })
})

test('extractJobDetail pulls Altimetrik description, posting date, skills, and apply URLs from the job detail XML', async () => {
  const altimetrik = await loadAltimetrikModule()
  assert.ok(altimetrik)

  const detail = altimetrik.extractJobDetail(readFixture('job-detail-882121.xml'), {
    title: 'Developer-Software',
    location: 'Pune, India',
    city: 'Pune',
    jobId: '882121',
    requisitionId: '882121',
    sourceUrl: altimetrik.buildDetailUrl('882121'),
    applyUrl: altimetrik.buildApplyUrl('882121'),
    experienceRequired: '0 - 0 Years',
  })

  assert.equal(detail.title, 'Developer-Software')
  assert.equal(detail.location, 'Pune, India')
  assert.equal(detail.city, 'Pune')
  assert.equal(detail.jobId, '882121')
  assert.equal(detail.requisitionId, '882121')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '0 - 0 Years')
  assert.equal(detail.department, null)
  assert.match(detail.jobDescription, /Build, test, and maintain software solutions/i)
  assert.match(detail.jobDescription, /Experience with REST\/SOAP web services/i)
  assert.deepEqual(detail.requiredSkills, ['Java fullstack', 'J2EE'])
  assert.equal(detail.postingDate, '09-Jun-2026')
  assert.equal(detail.closingDate, null)
  assert.equal(detail.applyUrl, altimetrik.buildApplyUrl('882121'))
  assert.equal(detail.sourceUrl, altimetrik.buildDetailUrl('882121'))
})

test('Altimetrik runtime rejects the obsolete XML negotiation while pure XML parsers remain available', async () => {
  const source = await import('../../scraper/altimetrik/script.js')
  const requests = []
  await assert.rejects(source.run({ fetchText: async (url, options) => {
    requests.push([url, options.method])
    return buildTwoListingFixture()
  } }), /JSON/)
  assert.deepEqual(requests.map(row => row[1]), ['POST'])
})

// Portable original public JSON captures; modeled controls below are explicit.
const nativeCapture = async name => {
  const { readFile } = await import('node:fs/promises')
  return readFile(new URL(`./test-data/native-captures/ripplehire-2026-11-05/altimetrik-${name}`, import.meta.url), 'utf8')
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

test('Altimetrik runtime uses the published JSON contract, enumerates raw pages beyond ten and checks a closing snapshot', async () => {
  const source = await import('../../scraper/altimetrik/script.js')
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

test('Altimetrik runtime preserves unknown native countries and original full authored descriptions', async () => {
  const source = await import('../../scraper/altimetrik/script.js')
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
  assert.equal(readSourceObservationEvidence(jobs, 'altimetrik').observedVacancyCount, 3)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(isCompleteScraperAttempt({ success: true, inventoryEvidence: readInventoryEvidence(jobs) }), false)
})

test('Altimetrik registered runtime retains preprojection raw observations when country evidence yields an empty array', async () => {
  const { buildScrapers } = await import('../providers/index.js')
  const modeled = await modeledNativeRuntime({ countries: [null] })
  const scraper = buildScrapers().find(row => row.name === 'altimetrik')
  const jobs = await scraper.run({ fetchText: modeled.fetchText })
  assert.equal(jobs.length, 0)
  const { readSourceObservationEvidence } = await import('../utils/sourceObservationEvidence.js')
  const { extractionRawJobMetrics } = await import('../utils/extractionRawJobMetrics.js')
  const { readInventoryEvidence } = await import('../utils/inventoryEvidence.js')
  assert.equal(readSourceObservationEvidence(jobs, 'altimetrik').observedVacancyCount, 1)
  assert.deepEqual(extractionRawJobMetrics(scraper.provider, jobs, readInventoryEvidence(jobs)), { rawJobs: 1, rawJobsBasis: 'observed-native-vacancy-rows' })
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

test('Altimetrik runtime refuses capped native pages before returning a truncated inventory', async () => {
  const source = await import('../../scraper/altimetrik/script.js')
  const modeled = await modeledNativeRuntime({ pageSize: 1 })
  await assert.rejects(source.run({ fetchText: modeled.fetchText, pageSize: 1, maxPages: 1 }), error => {
    assert.equal(error.failureKind, 'coverage_gap')
    assert.equal(error.inventoryEvidence.listingComplete, false)
    return /limit|incomplete/i.test(error.message)
  })
  assert.equal(modeled.requested.length, 1)
})

test('Altimetrik runtime independently rejects mismatched identity, missing content, foreign employer and upstream detail errors', async t => {
  const source = await import('../../scraper/altimetrik/script.js')
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

test('Altimetrik runtime rejects changed closing identity with the same count', async () => {
  const source = await import('../../scraper/altimetrik/script.js')
  const modeled = await modeledNativeRuntime({ countries: ['India'], mutateClosing: value => { value.jobVoList[0].jobTitle = 'changed role' } })
  await assert.rejects(source.run({ fetchText: modeled.fetchText }), /closing|changed/i)
})

test('Altimetrik exported runtime races ignored cancellation and preserves exact falsey or opaque caller reasons', async t => {
  const source = await import('../../scraper/altimetrik/script.js')
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

test('Altimetrik runtime applies request and collection clocks to injected readers', async () => {
  const source = await import('../../scraper/altimetrik/script.js')
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


test('Altimetrik runtime retains complete neighboring jobs and reports missing native details honestly', async () => {
  const source = await import('../../scraper/altimetrik/script.js')
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

test('Altimetrik native detail projection preserves the unchanged genuine JSON role and full authored HTML', async () => {
  const source = await import('../../scraper/altimetrik/script.js')
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


test('RippleHire native configured query parameters remain identical in opening and closing requests', async () => {
  const { createRipplehireInventoryScraper } = await import('../../scraper/altimetrik/ripplehireInventory.js')
  const modeled = await modeledNativeRuntime({ countries: ['India'] })
  const parameters = []
  const jobs = await createRipplehireInventoryScraper({ source: 'altimetrik', company: 'Altimetrik',
    origin: 'https://altimetrik.ripplehire.com', token: 'SWCslMw2ct8eSm7LyqVb', parentCompanyId: 264,
    searchParameters: { geo: 'India', campaignSeq: undefined },
  }).run({ fetchText: async (url, options) => {
    if (url.endsWith('candidatejobsearch')) parameters.push(JSON.parse(options.body.get('careerSiteUrlParams')))
    return modeled.fetchText(url, options)
  } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs.nativeInventory.queryParameters.geo, 'India')
  assert.match(jobs.nativeInventory.queryScope, /#list\/geo=India$/)
  assert.deepEqual(parameters, [
    { page: 0, search: '*:*', token: 'SWCslMw2ct8eSm7LyqVb', source: 'CAREERSITE', pagesize: 10, geo: 'India' },
    { page: 0, search: '*:*', token: 'SWCslMw2ct8eSm7LyqVb', source: 'CAREERSITE', pagesize: 10, geo: 'India' },
  ])
  await assert.rejects(createRipplehireInventoryScraper({ source: 'altimetrik', company: 'Altimetrik',
    origin: 'https://altimetrik.ripplehire.com', token: 'SWCslMw2ct8eSm7LyqVb', parentCompanyId: 264,
    searchParameters: { page: 9 },
  }).run({ fetchText: async () => assert.fail('reserved native query override must stop before I/O') }), /query|reserved|parameter/i)
})

test('RippleHire capped inventory failures retain actually observed native rows before India projection', async () => {
  const source = await import('../../scraper/altimetrik/script.js')
  const modeled = await modeledNativeRuntime({ countries: [null, 'India'], pageSize: 1 })
  await assert.rejects(source.run({ fetchText: modeled.fetchText, pageSize: 1, maxPages: 1 }), error => {
    assert.equal(error.nativeInventory.observedListingCount, 1)
    assert.equal(error.nativeInventory.queryReportedTotal, 2)
    return true
  })
})


test('Altimetrik runtime excludes explicitly closed native neighbors and reconciles their original lifecycle state', async () => {
  const source = await import('../../scraper/altimetrik/script.js')
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


test('RippleHire native runtime rejects an upstream error envelope even when it includes a copied full jobVO', async () => {
  const source = await import('../../scraper/altimetrik/script.js')
  const modeled = await modeledNativeRuntime({ countries: ['India'], mutateDetail: value => { value.error = 'An unexpected error occurred' } })
  await assert.rejects(source.run({ fetchText: modeled.fetchText }), error => error.failureKind === 'coverage_gap')
})

test('RippleHire default transport cancels an ignored body reader and preserves the exact caller reason', async () => {
  const source = await import('../../scraper/altimetrik/script.js')
  const previousFetch = globalThis.fetch
  const controller = new AbortController(), reason = Object.freeze({ stopBodyReader: true })
  let requests = 0, cancellations = 0, bodyReads = 0
  try {
    globalThis.fetch = async () => {
      requests++
      return { status: 200, headers: new Headers({ 'content-type': 'application/json' }),
        body: { cancel: () => { cancellations++; return Promise.reject(new Error('reader cancel rejection is observed')) } },
        text: async () => { bodyReads++; return new Promise(() => {}) } }
    }
    const running = source.run({ signal: controller.signal, requestTimeoutMs: 500, collectionBudgetMs: 1000 })
    await new Promise(resolve => setTimeout(resolve, 10))
    controller.abort(reason)
    const outcome = await Promise.race([running.then(() => ({ resolved: true }), error => ({ error })), new Promise(resolve => setTimeout(() => resolve({ late: true }), 100))])
    assert.equal(outcome.late, undefined)
    assert.strictEqual(outcome.error, reason)
    assert.equal(bodyReads, 1)
    assert.equal(cancellations, 1)
    assert.equal(requests, 1)
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(requests, 1)
  } finally { globalThis.fetch = previousFetch }
})

test('RippleHire detail transport failure preserves full neighboring roles with reconciled native health', async () => {
  const source = await import('../../scraper/altimetrik/script.js')
  const modeled = await modeledNativeRuntime({ countries: ['India', 'India'] })
  const jobs = await source.run({ fetchText: async (url, options) => {
    if (url.includes('candidatejobdetail?') && new URL(url).searchParams.get('jobSeq') === '700002') throw new Error('modeled native timeout')
    return modeled.fetchText(url, options)
  } })
  assert.deepEqual(jobs.map(job => job.jobId), ['700001'])
  assert.equal(jobs.nativeInventory.queryDetailAttemptCount, 2)
  assert.equal(jobs.nativeInventory.queryDetailedCount, 1)
  assert.equal(jobs.nativeInventory.queryDetailFailureCount, 1)
  assert.equal(jobs.nativeInventory.closingStable, true)
  const { extractionDetailHealth } = await import('../utils/extractionDetailHealth.js')
  const collection = extractionDetailHealth(jobs).nativeCollections[0]
  assert.equal(collection.countsReconciled, true)
  assert.equal(collection.unextractedDetailFailures, 1)
  assert.equal(collection.complete, false)
})

test('RippleHire refuses a resolver that contradicts this role typed native listing country', async () => {
  const { createRipplehireInventoryScraper } = await import('../../scraper/altimetrik/ripplehireInventory.js')
  const modeled = await modeledNativeRuntime({ countries: ['India'] })
  await assert.rejects(createRipplehireInventoryScraper({ source:'altimetrik', company:'Altimetrik',
    origin:'https://altimetrik.ripplehire.com', token:'SWCslMw2ct8eSm7LyqVb', parentCompanyId:264,
    countryResolver: () => ({ country:'United States', evidence:'modeled-typed-native-country-master' }),
  }).run({ fetchText:modeled.fetchText }), /contradictory native country/)
})


test('RippleHire independent CLOSED status and disabled enableLink each prevent role publication', async t => {
  const source = await import('../../scraper/altimetrik/script.js')
  for (const [name, state] of [['closed-status-only', { jobStatus:'CLOSED', enableLink:'Y' }], ['disabled-link-only', { jobStatus:'ACTIVE', enableLink:'N' }]]) await t.test(name, async () => {
    const modeled = await modeledNativeRuntime({ countries:['India','India'], mutateDetail: value => {
      if (value.jobSeq==='700002') { value.jobVO.jobStatus=state.jobStatus; value.enableLink=state.enableLink }
    } })
    const jobs = await source.run({fetchText:modeled.fetchText})
    assert.deepEqual(jobs.map(job=>job.jobId),['700001'])
    assert.equal(jobs.nativeInventory.outcomeCounts.nativeClosed,1)
    assert.equal(jobs.nativeInventory.outcomeCounts.publishedIndia,1)
    assert.equal(jobs.nativeInventory.nativeRoles[1].publicationOutcome,'native-closed')
  })
})


test('RippleHire registered decoration preserves detached immutable full unknown-country role observations', async () => {
  const { buildScrapers } = await import('../providers/index.js')
  const modeled = await modeledNativeRuntime({ countries:['India',null] })
  const jobs = await buildScrapers().find(scraper=>scraper.name==='altimetrik').run({fetchText:modeled.fetchText})
  const unknown = jobs[0].nativeCollectionEvidence.unresolvedRoles
  assert.equal(unknown.length,1)
  assert.equal(unknown[0].jobId,'700002')
  assert.equal(unknown[0].country,null)
  assert.equal(unknown[0].sourceDescriptionHtml,JSON.parse(await nativeCapture('detail.json')).jobVO.jobDesc)
  assert.equal(unknown[0].sourceDetailComplete,true)
  assert.equal(Object.isFrozen(unknown),true)
  assert.equal(Object.isFrozen(unknown[0]),true)
  assert.doesNotThrow(()=>JSON.stringify(jobs))
  const { extractionDetailHealth } = await import('../utils/extractionDetailHealth.js')
  const collection = extractionDetailHealth(jobs).nativeCollections[0]
  assert.equal(collection.candidateDetails,2)
  assert.equal(collection.parsedDetails,1)
  assert.equal(collection.excludedDetails,1)
  assert.equal(collection.countsReconciled,true)
})


test('Altimetrik runtime requires visible criteria beyond inert content, repeated placeholders or its own title', async t => {
  const source = await import('../../scraper/altimetrik/script.js')
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

test('Altimetrik visible criteria guard preserves all authored literal angles, entities and real role text', async () => {
  const source = await import('../../scraper/altimetrik/script.js')
  const authored='<p>Use the C++ service when rate < 10% and ratio > 1; preserve &lt;T&gt; and A &amp; B. Build reliable data services and write automated tests.</p>'
  const modeled=await modeledNativeRuntime({countries:['India'],mutateDetail:value=>{value.jobVO.jobDesc=authored}})
  const jobs=await source.run({fetchText:modeled.fetchText})
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].sourceDescriptionHtml,authored)
  assert.equal(jobs[0].jobDescription,'Use the C++ service when rate < 10% and ratio > 1; preserve <T> and A & B. Build reliable data services and write automated tests.')
  assert.equal(jobs[0].sourceDetailComplete,true)
})


test('RippleHire default streaming reader rejects an oversized chunk before collecting it and cancels the native reader', async () => {
  const source=await import('../../scraper/altimetrik/script.js'),previousFetch=globalThis.fetch
  let requests=0,reads=0,cancels=0,textReads=0
  try {
    globalThis.fetch=async()=>{
      requests++
      return {status:200,headers:new Headers({'content-type':'application/json'}),body:{getReader:()=>({
        read:async()=>{reads++;return {done:false,value:new Uint8Array(65)}},
        cancel:()=>{cancels++;return Promise.reject(new Error('modeled cancellation rejection'))},releaseLock:()=>{},
      })},text:async()=>{textReads++;return JSON.stringify({startJobIndex:0,maxJobSize:10,totalJobCount:0,jobVoList:[],errorStatus:'success'})}}
    }
    await assert.rejects(source.run({maxResponseBytes:64,maxTotalBytes:1024}),error=>error.code==='RIPPLEHIRE_BODY_BYTE_LIMIT')
    assert.equal(requests,1)
    assert.equal(reads,1)
    assert.equal(cancels,1)
    assert.equal(textReads,0)
  } finally {globalThis.fetch=previousFetch}
})

test('RippleHire native byte limits account for opening and closing responses together', async () => {
  const source=await import('../../scraper/altimetrik/script.js'),previousFetch=globalThis.fetch
  const body=JSON.stringify({startJobIndex:0,maxJobSize:10,totalJobCount:0,jobVoList:[],errorStatus:'success'}),bytes=Buffer.from(body)
  let requests=0,cancels=0
  try {
    globalThis.fetch=async()=>{
      requests++
      let read=false
      return {status:200,headers:new Headers({'content-type':'application/json'}),body:{getReader:()=>({
        read:async()=>read?{done:true}:(read=true,{done:false,value:bytes}),
        cancel:()=>{cancels++},releaseLock:()=>{},
      })},text:async()=>body}
    }
    await assert.rejects(source.run({maxResponseBytes:bytes.length,maxTotalBytes:bytes.length*2-1}),error=>error.code==='RIPPLEHIRE_BODY_BYTE_LIMIT'&&/aggregate/i.test(error.message))
    assert.equal(requests,2)
    assert.equal(cancels,1)
  } finally {globalThis.fetch=previousFetch}
})

test('RippleHire byte limits validate injected UTF-8 reader output before JSON projection', async () => {
  const source=await import('../../scraper/altimetrik/script.js')
  await assert.rejects(source.run({maxResponseBytes:64,fetchText:async()=> '\u754c'.repeat(30)}),error=>error.code==='RIPPLEHIRE_BODY_BYTE_LIMIT')
  for (const maxResponseBytes of [0,-1,null,Infinity]) await assert.rejects(source.run({maxResponseBytes,fetchText:async()=>assert.fail('invalid byte limits must reject before I/O')}),/byte|limit/i)
})

test('RippleHire streaming cancellation stops an ignored reader and preserves a false caller reason', async () => {
  const source=await import('../../scraper/altimetrik/script.js'),previousFetch=globalThis.fetch,controller=new AbortController()
  let requests=0,readerCancels=0,bodyCancels=0
  try {
    globalThis.fetch=async()=>{
      requests++
      return {status:200,headers:new Headers({'content-type':'application/json'}),body:{
        cancel:()=>{bodyCancels++},getReader:()=>({read:async()=>new Promise(()=>{}),cancel:()=>{readerCancels++;return Promise.reject(new Error('modeled reader cancel rejection'))},releaseLock:()=>{}}),
      },text:async()=>new Promise(()=>{})}
    }
    const running=source.run({signal:controller.signal})
    await new Promise(resolve=>setTimeout(resolve,5));controller.abort(false)
    const outcome=await Promise.race([running.then(()=>({resolved:true}),error=>({error})),new Promise(resolve=>setTimeout(()=>resolve({late:true}),80))])
    assert.equal(outcome.late,undefined)
    assert.strictEqual(outcome.error,false)
    assert.equal(readerCancels,1)
    assert.equal(bodyCancels,0)
    await new Promise(resolve=>setTimeout(resolve,10));assert.equal(requests,1)
  } finally {globalThis.fetch=previousFetch}
})


test('RippleHire default stream rejects unsupported chunk representations', async t => {
  const source=await import('../../scraper/altimetrik/script.js')
  for(const [name,chunk] of [['string','not a native byte chunk'],['array-buffer',new ArrayBuffer(8)],['array',[123,125]]]) await t.test(name,async()=>{
    const previousFetch=globalThis.fetch
    let requests=0,cancels=0
    try {
      globalThis.fetch=async()=>{
        requests++
        return {status:200,headers:new Headers({'content-type':'application/json'}),body:{getReader:()=>({read:async()=>({done:false,value:chunk}),cancel:()=>{cancels++},releaseLock:()=>{}})},text:async()=>assert.fail('unsupported stream cannot fall back to text')}
      }
      await assert.rejects(source.run(),/native response byte chunk/i)
      assert.equal(requests,1)
      assert.equal(cancels,1)
    } finally {globalThis.fetch=previousFetch}
  })
})
