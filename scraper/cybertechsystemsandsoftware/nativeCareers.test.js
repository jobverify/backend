import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createCybertechSystemsAndSoftwareScraper, CAREERS_URL, PROVIDER_METADATA } from './script.js'
import { inspectDetail } from './nativeCareers.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'
import { isIndiaJob } from '../../scraper-support/utils/indiaLocationFilter.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/actual-http-20261030.json.gz', import.meta.url))))
const keep = new Set(['careers-opening', 'role-detail', 'declared-role-json', 'native-job-collection-opening',
  'native-job-collection-next', 'role-native-taxonomy:job-type', 'role-native-taxonomy:job-location',
  'additional-native-role-detail', 'additional-native-role-json', 'additional-role-taxonomy:job-type',
  'additional-role-taxonomy:job-location', 'full-native-job-collection-final-closing',
  'full-native-job-collection-final-closing-next', 'careers-complete-research-closing'])
const retained = fixture.responses.filter(row => keep.has(row.purpose))
for (const row of fixture.responses) {
  const bytes = Buffer.from(row.bodyBase64, 'base64')
  assert.equal(bytes.length, row.bytes)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256)
}
const ids = [16035, 12739, 8670, 8664, 8662, 8658, 8654, 8650, 7415, 1507, 1506, 1505, 1503, 1456].map(String)
const leadURL = 'https://cybertech.com/job/lead-public-cloud-devops-automation-specialist/'
const basisURL = 'https://cybertech.com/job/sap-basis-consultant/'
const execute = async ({ mutate = response => response, firstCareerString = false, signal, onAudit, maxJobs, beforeReturn } = {}) => {
  const queues = new Map()
  for (const row of retained) {
    if (!queues.has(row.url)) queues.set(row.url, [])
    queues.get(row.url).push(row)
  }
  const requests = [], unexpected = [], audits = []
  const jobs = await createCybertechSystemsAndSoftwareScraper({ maxJobs }).run({ signal,
    fetchText: async (url, options = {}) => {
      requests.push(url)
      const row = queues.get(url)?.shift()
      if (!row) { unexpected.push(url);throw Error('No complete retained response for ' + url) }
      const original = Buffer.from(row.bodyBase64, 'base64').toString('utf8')
      const response = await mutate({ html: original, status: row.status, url: row.finalURL,
        headers: structuredClone(row.responseHeaders), bodyBase64: row.bodyBase64, purpose: row.purpose })
      await beforeReturn?.(row, options)
      if (firstCareerString && row.purpose === 'careers-opening') return response.html
      // Changed bytes are artificial offline negative inputs, never native/live data.
      if (response.html !== original) response.bodyBase64 = Buffer.from(response.html).toString('base64')
      return response
    },
    onAudit: async audit => { audits.push(audit);await onAudit?.(audit) },
  })
  assert.deepEqual(unexpected, [])
  return { jobs, audit: audits[0], evidence: readInventoryEvidence(jobs), requests }
}

test('the actual complete corpus yields all fourteen published job observations beyond six career links', async () => {
  const { jobs, audit, evidence } = await execute({ firstCareerString: true })
  assert.equal(jobs.length, 14)
  assert.deepEqual(new Set(jobs.map(job => job.jobId)), new Set(ids))
  assert.equal(jobs.every(job => job.requisitionId === null), true)
  assert.equal(jobs.every(job => typeof job.jobDescription === 'string' && job.jobDescription.length > 200), true)
  assert.equal(audit.observations.length, 14)
  assert.equal(jobs.filter(job => job.sourceListedOnCareersPage === true).length, 6)
  assert.equal(jobs.filter(job => job.sourceListedOnCareersPage === false).length, 8)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.notEqual(evidence.status, 'verified-empty')
})

test('original template requirements outside the REST description are retained', async () => {
  const { jobs } = await execute()
  const lead = jobs.find(job => job.jobId === '8670')
  assert.match(lead.jobDescription, /Key Responsibilities/)
  assert.match(lead.jobDescription, /Qualification/)
  assert.match(lead.jobDescription, /Shift Timings/)
  assert.match(lead.jobDescription, /12\+ years/)
  assert.equal(lead.sourceNativeWordPressPost.content.rendered.includes('Shift Timings'), false)
  assert.equal(lead.sourceDetailComplete, false)
  assert.equal(lead.sourceListingComplete, false)
  assert.equal(lead.lifecycleCleanupAllowed, false)
})

test('real WordPress IDs, complete raw fields and original content dates remain separate from recruitment claims', async () => {
  const { jobs } = await execute()
  const senior = jobs.find(job => job.jobId === '8664')
  assert.equal(senior.title, 'Sr.DBA (MSSQL)')
  assert.equal(senior.sourceNativeWordPressPost.id, 8664)
  assert.equal(senior.sourceNativeWordPressPost.type, 'job')
  assert.equal(senior.sourceNativeWordPressPost.date_gmt, '2024-09-19T05:16:39')
  assert.equal(senior.postingDate, null)
  assert.equal(senior.closingDate, null)
  assert.equal(senior.requisitionId, null)
  assert.equal(jobs.find(job => job.jobId === '12739').title, 'Enterprise Architect & Engagement Manager – SAP Practice')
})

test('native application controls and role-specific hidden fields are retained without submitting a form', async () => {
  const { jobs, requests } = await execute()
  const lead = jobs.find(job => job.jobId === '8670')
  assert.equal(lead.sourceNativeApplication.boundToRole, true)
  const controls = lead.sourceNativeApplication.forms.flatMap(form => form.controls)
  assert.equal(controls.find(field => field.attrs.name === 'input_11').attrs.value, lead.title)
  assert.equal(controls.find(field => field.attrs.name === 'input_12').attrs.value, leadURL)
  assert.equal(controls.find(field => field.attrs.name === 'MAX_FILE_SIZE').attrs.value, '41943040')
  assert.equal(controls.find(field => field.attrs.name === 'input_4').attrs['aria-required'], 'true')
  assert.equal(lead.sourceNativeApplication.activationVerified, false)
  assert.equal(requests.every(url => !url.includes('gf_2') && !url.includes('/feedback')), true)
})

test('city, remote and applicant phone-country data cannot manufacture India through actual consumers', async () => {
  const { jobs } = await execute()
  for (const job of jobs) {
    assert.equal(job.country, null)
    assert.equal(job.location, null)
    assert.equal(job.city, null)
    assert.equal(job.state, null)
    assert.deepEqual(job.locations, [])
    assert.equal(isIndiaJob(job), false)
    const normalized = normalizeScrapedJob(job, { ...PROVIDER_METADATA, countryFilter: 'India' })
    assert.equal(normalized.country, null)
    assert.equal(isIndiaJob(normalized), false)
  }
})

test('one missing role detail preserves all models and the other thirteen descriptions', async () => {
  const { jobs, evidence } = await execute({ mutate: response => response.url === basisURL ? { ...response, status: 404 } : response })
  assert.equal(jobs.length, 14)
  assert.equal(jobs.filter(job => job.jobDescription).length, 13)
  assert.equal(evidence.listingComplete, false)
})

test('a changed same-role H1 cannot assign another title its HTML criteria', async () => {
  const { jobs } = await execute({ mutate: response => response.url === basisURL
    ? { ...response, html: response.html.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/i, '<h1>Unrelated role</h1>') } : response })
  assert.equal(jobs.length, 14)
  assert.equal(jobs.find(job => job.sourceNativeWordPressPost?.id === 8658).jobDescription, null)
  assert.equal(jobs.find(job => job.sourceNativeWordPressPost?.id === 8658).experienceRequired, null)
  assert.equal(jobs.filter(job => job.jobDescription).length, 13)
})

test('an application hidden URL conflict stays unbound without discarding independent criteria', async () => {
  const { jobs } = await execute({ mutate: response => response.url === leadURL
    ? { ...response, html: response.html.replace(/(<input\b[^>]*name=['"]input_12['"][^>]*value=)(['"])[^'"]*\2/i,
      (_, prefix, quote) => prefix + quote + 'https://cybertech.com/' + quote) } : response })
  const lead = jobs.find(job => job.sourceNativeWordPressPost?.id === 8670)
  assert.equal(lead.sourceNativeApplication.boundToRole, false)
  assert.equal(lead.sourceDetailComplete, false)
  assert.match(lead.jobDescription, /Shift Timings/)
})

test('a native head URL conflict cannot borrow another role while the other thirteen criteria survive', async () => {
  const { jobs } = await execute({ mutate: response => response.url === basisURL
    ? { ...response, html: response.html.replace(/(<meta\b[^>]*property=['"]og:url['"][^>]*content=)(['"])[^'"]*\2/i,
      (_, prefix, quote) => prefix + quote + leadURL + quote) } : response })
  assert.equal(jobs.length, 14)
  assert.equal(jobs.find(job => job.sourceNativeWordPressPost?.id === 8658).jobDescription, null)
  assert.equal(jobs.filter(job => job.jobDescription).length, 13)
})

test('a missing opening second page retains later native observations and never claims completeness', async () => {
  const { jobs, evidence } = await execute({ mutate: response => {
    if (response.purpose === 'native-job-collection-next') throw Error('Retained opening page unavailable')
    return response
  } })
  assert.equal(jobs.length, 14)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.listingComplete, false)
})

test('closing transport failure preserves genuine opening observations without zero promotion', async () => {
  const { jobs, evidence } = await execute({ mutate: response => {
    if (response.purpose === 'full-native-job-collection-final-closing') throw Error('Retained closing unavailable')
    return response
  } })
  assert.equal(jobs.length, 14)
  assert.equal(jobs.filter(job => job.jobDescription).length, 14)
  assert.notEqual(evidence.status, 'verified-empty')
})

test('unavailable native collection falls back to available career observations without slug requisition IDs', async () => {
  const { jobs, evidence } = await execute({ mutate: response => {
    if (response.purpose.includes('native-job-collection')) throw Error('Native collection unavailable')
    return response
  } })
  assert.equal(jobs.length, 6)
  assert.equal(jobs.every(job => job.requisitionId === null), true)
  assert.equal(evidence.reportedTotal, null)
})

test('decoded duplicate JSON keys never select a last-wins invented native ID', async () => {
  const { jobs, audit } = await execute({ mutate: response => response.purpose === 'declared-role-json' && response.url.endsWith('/16035')
    ? { ...response, html: response.html.replace('"id":16035', '"id":16035,"\\u0069d":999999') } : response })
  assert.equal(jobs.some(job => job.jobId === '999999'), false)
  assert.ok(audit.issues.some(issue => issue.kind === 'native-json-duplicate-keys'))
})

test('duplicate native IDs remain an explicit inventory defect and do not collide emitted role identities', async () => {
  const { jobs, audit, evidence } = await execute({ mutate: response => {
    if (response.purpose !== 'native-job-collection-opening') return response
    const data = JSON.parse(response.html);data[1].id = data[0].id
    return { ...response, html: JSON.stringify(data) }
  } })
  const qualified = jobs.map(job => job.jobId).filter(Boolean)
  assert.equal(new Set(qualified).size, qualified.length)
  assert.equal(new Set(jobs.map(job => job.sourceUrl)).size, jobs.length)
  assert.ok(audit.issues.some(issue => issue.kind === 'native-id-duplicate'))
  assert.equal(evidence.listingComplete, false)
})

test('a foreign pagination link is never requested as a guessed native endpoint', async () => {
  const { requests, evidence } = await execute({ mutate: response => response.purpose === 'native-job-collection-opening'
    ? { ...response, headers: { ...response.headers, link: '<https://example.invalid/foreign>; rel="next"' } } : response })
  assert.equal(requests.every(url => new URL(url).origin === 'https://cybertech.com'), true)
  assert.equal(evidence.reportedTotal, null)
})

test('a non-job native record is not emitted as a qualified WordPress job model', async () => {
  const { jobs } = await execute({ mutate: response => {
    if (response.purpose !== 'native-job-collection-opening') return response
    const data = JSON.parse(response.html);data[1].type = 'page'
    return { ...response, html: JSON.stringify(data) }
  } })
  assert.equal(jobs.every(job => !job.sourceNativeWordPressPost || job.sourceNativeWordPressPost.type === 'job'), true)
})

test('quoted JSON-looking description examples do not become duplicate record properties', async () => {
  const { audit } = await execute({ mutate: response => {
    if (response.purpose !== 'native-job-collection-opening') return response
    const data = JSON.parse(response.html);data[0].content.rendered += '<pre>{"x":1,"x":2}</pre>'
    return { ...response, html: JSON.stringify(data) }
  } })
  assert.equal(audit.issues.some(issue => issue.kind === 'native-json-duplicate-keys'), false)
})

test('a cap limits output while retaining the entire native observation audit', async () => {
  const { jobs, audit, evidence } = await execute({ maxJobs: 2 })
  assert.equal(jobs.length, 2)
  assert.equal(audit.observations.length, 14)
  assert.equal(evidence.listingComplete, false)
})

test('caller abort before entry requests nothing and propagates its reason', async () => {
  const controller = new AbortController(), reason = Error('Stop before source');controller.abort(reason)
  await assert.rejects(createCybertechSystemsAndSoftwareScraper().run({ signal: controller.signal,
    fetchText: async () => { assert.fail('No request after abort') } }), error => error === reason)
})

test('caller abort during native transport is not converted into empty or partial success', async () => {
  const controller = new AbortController(), reason = Error('Stop native transport')
  await assert.rejects(execute({ signal: controller.signal, beforeReturn: row => {
    if (row.purpose === 'native-job-collection-opening') controller.abort(reason)
  } }), error => error === reason)
})

const changeBasisPosts = (response, change, closingOnly = false) => {
  const phases = closingOnly ? ['full-native-job-collection-final-closing']
    : ['native-job-collection-opening', 'full-native-job-collection-final-closing']
  if (!phases.includes(response.purpose)) return response
  const posts = JSON.parse(response.html), post = posts.find(row => row.id === 8658)
  if (post) change(post)
  return { ...response, html: JSON.stringify(posts) }
}

test('review R1: malformed bootstrap or later role HTML preserves healthy observations and original bad bytes', async () => {
  for (const badURL of [basisURL, 'https://cybertech.com/job/geospatial-services-account-executive/']) {
    const { jobs, audit } = await execute({ mutate: response => response.url === badURL
      ? { ...response, html: response.html.replace('</head>', '<meta name="bad" name="duplicate" content="offline-negative"></head>') } : response })
    assert.equal(jobs.length, 14)
    assert.equal(jobs.find(job => job.sourceUrl === badURL).jobDescription, null)
    assert.equal(jobs.filter(job => job.jobDescription).length, 13)
    assert.ok(audit.rawPages.some(page => page.url === badURL && page.originalHTML.includes('offline-negative')))
  }
})

test('review R1: malformed taxonomy relations leave role criteria available and employment unknown', async () => {
  const { jobs, audit } = await execute({ mutate: response => changeBasisPosts(response, post => { post._links['wp:term'] = {} }) })
  assert.equal(jobs.length, 14)
  assert.equal(jobs.find(job => job.jobId === '8658').employmentType, null)
  assert.equal(jobs.filter(job => job.jobDescription).length, 14)
  assert.ok(audit.issues.length > 0)
})

test('review R1: a null taxonomy member cannot abort the other native observations', async () => {
  const { jobs, audit } = await execute({ mutate: response => response.url.includes('/job-type?post=8658')
    ? { ...response, html: '[null]' } : response })
  assert.equal(jobs.length, 14)
  assert.equal(jobs.find(job => job.jobId === '8658').employmentType, null)
  assert.ok(audit.rawPages.some(page => page.url.includes('/job-type?post=8658') && page.originalHTML === '[null]'))
})

test('review R2: a contradictory head URL cannot leave a positive application binding', async () => {
  const { jobs } = await execute({ mutate: response => response.url === basisURL
    ? { ...response, html: response.html.replace(/(<meta\b[^>]*property=['"]og:url['"][^>]*content=)(['"])[^'"]*\2/i,
      (_, prefix, quote) => prefix + quote + 'https://cybertech.com/job/sap-abap-developer/' + quote) } : response })
  const job = jobs.find(job => job.jobId === '8658')
  assert.equal(job.sourceNativeRoleDetail.bound, false)
  assert.equal(job.sourceNativeApplication.boundToRole, false)
  assert.equal(job.sourceNativeApplication.forms.length, 1)
})

test('review R2: a changed closing title cannot bind the old title application to the emitted role', async () => {
  const { jobs } = await execute({ mutate: response => changeBasisPosts(response, post => { post.title.rendered = 'Changed closing title' }, true) })
  const job = jobs.find(job => job.jobId === '8658')
  assert.equal(job.title, 'Changed closing title')
  assert.equal(job.jobDescription, null)
  assert.equal(job.experienceRequired, null)
  assert.equal(job.sourceNativeApplication.boundToRole, false)
})

test('review R3: conflicting declared native alternate IDs cannot promote criteria or application binding', () => {
  const row = fixture.responses.find(response => response.url === basisURL)
  const postRow = fixture.responses.find(response => response.url === 'https://cybertech.com/wp-json/wp/v2/job/8658')
  const post = JSON.parse(Buffer.from(postRow.bodyBase64, 'base64'))
  const html = Buffer.from(row.bodyBase64, 'base64').toString('utf8').replace('</head>',
    '<link rel="alternate" type="application/json" href="https://cybertech.com/wp-json/wp/v2/job/8670"></head>')
  const detail = inspectDetail(html, basisURL, post)
  assert.ok(detail.alternates.includes('https://cybertech.com/wp-json/wp/v2/job/8658'))
  assert.ok(detail.alternates.includes('https://cybertech.com/wp-json/wp/v2/job/8670'))
  assert.equal(detail.bound, false)
  assert.equal(detail.application.boundToRole, false)
})

test('review R4: changed closing taxonomy or posting identity cannot inherit opening taxonomy qualification', async () => {
  for (const change of [post => { post['job-type'] = [999999];post['job-location'] = [999999] },
    post => { post.id = 999999;post._links.self[0].href = 'https://cybertech.com/wp-json/wp/v2/job/999999' }]) {
    const { jobs, audit } = await execute({ mutate: response => changeBasisPosts(response, change, true) })
    const job = jobs.find(job => job.sourceUrl === basisURL)
    assert.equal(jobs.length, 14)
    assert.equal(job.employmentType, null)
    assert.equal(job.sourceNativeLocations.coherent, false)
    assert.ok(audit.issues.some(issue => issue.kind === 'native-opening-closing-records-differ'))
  }
})

test('review R1: malformed native title HTML retains the other thirteen criteria and raw native model', async () => {
  const badTitle = '<meta name="bad" name="duplicate" content="offline-negative"><span>Offline malformed native title</span>'
  const { jobs, audit } = await execute({ mutate: response => changeBasisPosts(response, post => { post.title.rendered = badTitle }) })
  assert.equal(jobs.length, 14)
  assert.equal(jobs.find(job => job.sourceUrl === basisURL).jobDescription, null)
  assert.equal(jobs.filter(job => job.jobDescription).length, 13)
  assert.equal(audit.nativeClosing.rows.find(post => post.id === 8658).title.rendered, badTitle)
})

test('review R1: malformed native content HTML cannot abort healthy original role criteria', async () => {
  const badContent = '<meta name="bad" name="duplicate" content="offline-negative"><p>Offline malformed REST component</p>'
  const { jobs } = await execute({ mutate: response => changeBasisPosts(response, post => { post.content.rendered = badContent }) })
  assert.equal(jobs.length, 14)
  assert.equal(jobs.find(job => job.jobId === '8658').jobDescription, null)
  assert.equal(jobs.filter(job => job.jobDescription).length, 13)
  assert.equal(jobs.find(job => job.jobId === '8658').sourceNativeWordPressPost.content.rendered, badContent)
})

test('audit callback failures propagate after original data is retained', async () => {
  const reason = Error('Audit consumer failed')
  await assert.rejects(execute({ onAudit: () => { throw reason } }), error => error === reason)
})
