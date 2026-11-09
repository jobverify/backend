import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('./native-captures/full-native-20261101.json.gz', import.meta.url))))
const CLOCK = capture.summary.originalObservationClock
const ID = 'acec6038-117b-400b-92e3-0745fbb4cf53'
const ROLE = `https://jobs.ashbyhq.com/cohere/${ID}`
globalThis.fetch = async () => assert.fail('Offline Cohere tests prohibit network reads')

const rewriteApp = (html, change) => {
  const marker = /window\.__appData\s*=\s*/.exec(html)
  assert.ok(marker)
  const start = marker.index + marker[0].length
  let depth = 0, quoted = false, escaped = false, end
  for (let at = start; at < html.length; at++) {
    const char = html[at]
    if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false }
    else if (char === '"') quoted = true
    else if (char === '{' || char === '[') depth++
    else if ((char === '}' || char === ']') && --depth === 0) { end = at + 1; break }
  }
  const data = JSON.parse(html.slice(start, end)); change(data)
  return html.slice(0, start) + JSON.stringify(data).replace(/</g, '\\u003c') + html.slice(end)
}
const rewriteSchema = (html, change) => html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/,
  (_all, open, json, close) => { const data = JSON.parse(json); change(data); return open + JSON.stringify(data).replace(/</g, '\\u003c') + close })

const indiaControl = page => {
  if (page.url.includes('api.ashbyhq.com')) {
    const data = JSON.parse(page.html)
    data.jobs.find(job => job.id === ID).secondaryLocations.push({ location: 'Bengaluru', address: { postalAddress: { addressCountry: 'India', addressLocality: 'Bengaluru', addressRegion: 'Karnataka' } } })
    page.html = JSON.stringify(data)
  }
  if (page.url === ROLE || page.url === 'https://jobs.ashbyhq.com/cohere') page.html = rewriteApp(page.html, data => {
    if (data.posting?.id === ID) data.posting.secondaryLocationNames.push('Bengaluru')
    const brief = data.jobBoard?.jobPostings?.find(job => job.id === ID)
    if (brief) brief.secondaryLocations.push({ locationName: 'Bengaluru' })
  })
  if (page.url === ROLE) page.html = rewriteSchema(page.html, schema => {
    schema.applicantLocationRequirements = [...[schema.applicantLocationRequirements].flat(), { '@type': 'Country', name: 'India' }]
  })
  return page
}

const replay = async ({ mutate = page => page, omitClock = false, replayKnownRoleBytes = false, ...options } = {}) => {
  const queues = new Map(), counts = new Map(), calls = []; let audit
  for (const packet of capture.packets) { if (!queues.has(packet.url)) queues.set(packet.url, []); queues.get(packet.url).push(packet) }
  const jobs = await run({ now: () => CLOCK, ...options,
    fetchPage: async url => {
      calls.push(url)
      const packet = queues.get(url)?.shift() || (replayKnownRoleBytes && capture.packets.find(packet => packet.url === url))
      assert.ok(packet, `No captured response for ${url}`)
      const count = (counts.get(url) || 0) + 1; counts.set(url, count)
      const original = Buffer.from(packet.rawBodyBase64, 'base64').toString('utf8')
      const page = mutate({ url: packet.finalURL, status: packet.status, headers: packet.headers, html: original, count })
      return { ...page, bodyBase64: Buffer.from(page.html).toString('base64'),
        ...(omitClock ? {} : { requestedAt: packet.requestedAt, completedAt: packet.completedAt }) }
    }, onAudit: value => { audit = value },
  })
  return { jobs, audit, calls, evidence: readInventoryEvidence(jobs) }
}

test('Cohere reconciles all current 122 roles and 128 original-clock responses without changing physical unknowns', async () => {
  const { jobs, audit, calls, evidence } = await replay()
  assert.equal(calls.length, 128)
  assert.equal(jobs.length, 0)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(audit.coherePublicInventory.publicNativeRoleCount, 122)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.verifiedAt, capture.packets.at(-1).completedAt)
  assert.equal(audit.observations.length, 122)
  const originalUnknown = audit.observations.find(job => job.jobId === ID)
  assert.equal(originalUnknown.sourceNativeCountryEvidence.originalPlaces.find(place => place.originalLocation === 'North America | Utah').country, null)
  assert.equal(originalUnknown.sourceNativeApplication.activationVerified, false)
  assert.equal(audit.coherePublicInventory.complete, true)
  assert.equal(audit.coherePublicInventory.roles.find(role => role.id === ID).indiaEligibility, 'excluded')
})

test('future explicit India retains original full criteria, AI/pay/native metadata, application URL and publication', async () => {
  const { jobs, audit, evidence } = await replay({ mutate: indiaControl })
  assert.equal(jobs.length, 1)
  const job = jobs[0]
  assert.equal(job.jobId, ID)
  assert.equal(job.country, 'India')
  assert.equal(job.city, 'Bengaluru')
  assert.equal(job.sourceNativeAPIRecord.address.postalAddress.addressCountry, 'Canada')
  assert.equal(job.applyUrl, ROLE + '/application')
  assert.equal(job.postingDate, job.sourceNativeAPIRecord.publishedAt)
  assert.equal(job.sourceNativePosting.descriptionHtml, job.sourceNativeAPIRecord.descriptionHtml)
  assert.equal(job.sourceNativePosting.descriptionHtml, job.sourceNativeJobPosting.description)
  assert.equal(job.sourceNativePosting.automatedProcessingLegalNotice, null)
  assert.ok(Object.hasOwn(job.sourceNativePosting, 'compensationTiers'))
  assert.equal(job.sourceNativeApplication.activationVerified, false)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.sourceListingComplete, true)
  assert.equal(evidence.indiaFacetCount, 1)
  assert.equal(audit.observations.length, 122)
})

test('missing applicant scope cannot let a foreign primary country cover an unknown secondary place', async () => {
  const { jobs, audit, evidence } = await replay({ mutate: page => {
    if (page.url === ROLE) page.html = rewriteSchema(page.html, schema => { delete schema.applicantLocationRequirements })
    return page
  } })
  assert.equal(jobs.length, 0)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(audit.coherePublicInventory.roles.find(role => role.id === ID).indiaEligibility, 'unknown')
})

test('closing scope changes and advertised extra hiring channels preserve positives and forbid complete cleanup', async () => {
  for (const mutation of ['closing-channel', 'closing-inventory', 'invalid-deadline', 'criteria-mismatch', 'unhandled-native-scope']) {
    const { jobs, evidence } = await replay({ mutate: page => {
      indiaControl(page)
      if (mutation === 'closing-channel' && page.url === 'https://cohere.com/careers' && page.count === 2) page.html += '<a href="https://jobs.ashbyhq.com/another-company">See open roles</a>'
      if (mutation === 'closing-inventory' && page.url.includes('api.ashbyhq.com') && page.count === 2) { const data = JSON.parse(page.html); data.jobs.pop(); page.html = JSON.stringify(data) }
      if (mutation === 'invalid-deadline' && page.url.endsWith('/9b596ab8-0df4-41aa-85da-e07578c082b2')) page.html = rewriteApp(page.html, data => { data.posting.applicationDeadline = 'not-a-date' })
      if (mutation === 'criteria-mismatch' && page.url.endsWith('/9b596ab8-0df4-41aa-85da-e07578c082b2')) page.html = rewriteSchema(page.html, schema => { schema.description += ' Different criteria' })
      if (mutation === 'unhandled-native-scope' && page.url.includes('api.ashbyhq.com')) {
        const data = JSON.parse(page.html)
        data.jobs.find(job => job.id === '9b596ab8-0df4-41aa-85da-e07578c082b2').applicantCountryAllowlist = ['India']
        page.html = JSON.stringify(data)
      }
      return page
    } })
    assert.ok(jobs.some(job => job.jobId === ID), mutation)
    assert.equal(evidence.listingComplete, false, mutation)
    assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === false), mutation)
  }
})

test('undated caller responses retain native observations without refreshing complete-check evidence', async () => {
  const { audit, evidence } = await replay({ omitClock: true })
  assert.equal(audit.observations.length, 122)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.verifiedAt, null)
  assert.ok(audit.observations.every(job => job.sourceNativeObservedAt === CLOCK))
})

test('review repair: every schema worksite must reconcile before foreign-only India exclusion', async () => {
  const role = 'https://jobs.ashbyhq.com/cohere/b9306620-a110-46b5-b4c4-7363e1d03a8d'
  const { jobs, audit, evidence } = await replay({ mutate: page => {
    indiaControl(page)
    if (page.url === role) page.html = rewriteSchema(page.html, schema => {
      delete schema.applicantLocationRequirements
      schema.jobLocation = [...[schema.jobLocation].flat(), { '@type': 'Place', address: { '@type': 'PostalAddress', addressCountry: 'India', addressLocality: 'Mumbai' } }]
    })
    return page
  } })
  assert.deepEqual(jobs.map(job => job.jobId), [ID])
  const contradictory = audit.observations.find(job => role.endsWith(job.jobId))
  assert.equal(contradictory.sourceNativeCountryEvidence.schemaConflict, true)
  assert.equal(contradictory.sourceNativeJobPosting.jobLocation.at(-1).address.addressCountry, 'India')
  assert.equal(audit.coherePublicInventory.roles.find(receipt => receipt.id === contradictory.jobId).indiaEligibility, 'unknown')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.verifiedAt, null)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('review repair: optional explicit schema URL binds exactly the same native role and account', async () => {
  for (const [url, complete] of [[ROLE, true], ['https://jobs.ashbyhq.com/another-employer/00000000-0000-4000-8000-000000000101', false]]) {
    const { audit, evidence } = await replay({ mutate: page => {
      if (page.url === ROLE) page.html = rewriteSchema(page.html, schema => { schema.url = url })
      return page
    } })
    assert.equal(audit.observations.find(job => job.jobId === ID).sourceNativeJobPosting.url, url)
    assert.equal(evidence.listingComplete, complete)
  }
})

for (const [name, fragment] of [
  ['iframe', '<iframe src="https://jobs.lever.co/cohere" title="Additional open roles"></iframe>'],
  ['form', '<form action="https://careers.cohere.com/search"><button type="submit">View jobs</button></form>'],
  ['named NBSP link', '<a href="https://careers.cohere.com/search">View&NonBreakingSpace;jobs</a>'],
  ['accessible button', '<button aria-label="View&NonBreakingSpace;jobs">Search</button>'],
  ['hidden ARIA reference', '<span hidden id="extra-jobs-label">View jobs</span><a href="https://careers.cohere.com/search" aria-labelledby="extra-jobs-label">Search</a>'],
  ['inline child document', '<iframe srcdoc="&lt;a href=&quot;https://jobs.lever.co/cohere&quot;&gt;View jobs&lt;/a&gt;" title="Other roles"></iframe>'],
]) test('review repair: unaccounted corporate ' + name + ' retains India but prevents cleanup', async () => {
  const { jobs, evidence } = await replay({ mutate: page => {
    indiaControl(page)
    if (page.url === 'https://cohere.com/careers' && page.count === 2) page.html += fragment
    return page
  } })
  assert.deepEqual(jobs.map(job => job.jobId), [ID])
  assert.ok(jobs[0].sourceNativePosting.descriptionHtml)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.verifiedAt, null)
})

test('review repair: inert frames and forms do not become advertised public hiring channels', async () => {
  const { evidence } = await replay({ mutate: page => {
    if (page.url === 'https://cohere.com/careers' && page.count === 2) page.html += '<template><iframe src="https://jobs.lever.co/cohere"></iframe><form action="https://careers.cohere.com/search">View jobs</form></template><div hidden><iframe src="https://jobs.lever.co/cohere"></iframe></div>'
    return page
  } })
  assert.equal(evidence.listingComplete, true)
})

for (const [name, fragment] of [
  ['ordinary clickable element', '<div onclick="location.href=\'https://careers.cohere.com/search\'">View jobs</div>'],
  ['ordinary accessible keyboard control', '<span onkeydown="openJobs()" aria-label="View jobs">Search</span>'],
  ['abrupt empty comment', '<!--><iframe src="https://jobs.lever.co/cohere" title="Additional open roles"></iframe><!-- -->'],
  ['abrupt hyphen comment', '<!---><iframe src="https://jobs.lever.co/cohere" title="Additional open roles"></iframe><!-- -->'],
  ['bang comment ending', '<!-- banner --!><iframe src="https://jobs.lever.co/cohere" title="Additional open roles"></iframe><!-- -->'],
  ['foreign style boundary', '<svg><style><iframe src="https://jobs.lever.co/cohere" title="Additional open roles"></iframe></style></svg>'],
  ['foreign script boundary', '<svg><script><iframe src="https://jobs.lever.co/cohere" title="Additional open roles"></iframe></script></svg>'],
  ['noncanonical script ending', '<script type="application/json">{}</script=unsupported><iframe src="https://jobs.lever.co/cohere" title="Additional open roles"></iframe>'],
]) test('V3 review repair: ' + name + ' cannot qualify corporate hiring scope', async () => {
  const { jobs, audit, evidence } = await replay({ mutate: page => {
    indiaControl(page)
    if (page.url === 'https://cohere.com/careers' && page.count === 2) page.html += fragment
    return page
  } })
  assert.deepEqual(jobs.map(job => job.jobId), [ID])
  assert.equal(jobs[0].sourceNativePosting.descriptionHtml, jobs[0].sourceNativeAPIRecord.descriptionHtml)
  assert.equal(jobs[0].sourceNativePosting.descriptionHtml, jobs[0].sourceNativeJobPosting.description)
  assert.equal(jobs[0].postingDate, jobs[0].sourceNativeAPIRecord.publishedAt)
  assert.equal(audit.observations.length, 122)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(evidence.verifiedAt, null)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('V3 review repair: real templates, data strings and nonrecruiting ordinary controls retain qualified scope', async () => {
  const { jobs, evidence } = await replay({ mutate: page => {
    indiaControl(page)
    if (page.url === 'https://cohere.com/careers' && page.count === 2) page.html += `
      <template><div onclick="openJobs()">View jobs</div><svg><style><iframe src="https://jobs.lever.co/cohere"></iframe></style></svg></template>
      <script type="application/json">{"example":"<iframe src='https://jobs.lever.co/cohere'></iframe><div onclick='openJobs()'>View jobs</div>"}</script>
      <div hidden onclick="openJobs()">View jobs</div><div onclick="toggleChart()">Toggle chart</div>
      <!-- <iframe src="https://jobs.lever.co/cohere" title="Additional open roles"></iframe> -->`
    return page
  } })
  assert.deepEqual(jobs.map(job => job.jobId), [ID])
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, 1)
  assert.equal(evidence.verifiedAt, capture.packets.at(-1).completedAt)
  assert.equal(jobs[0].lifecycleCleanupAllowed, true)
})

test('Cohere bounds reads and bodies without retrying a denied source through another client', async () => {
  for (const [status, body] of [[403, 'Verify you are human'], [200, ' '.repeat(5 * 1024 * 1024 + 1)]]) {
    let calls = 0
    const jobs = await run({ fetchImpl: async () => { calls++; return new Response(body, { status }) } })
    assert.equal(calls, 1)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  }
  const { calls, evidence } = await replay({ limits: { maxRequests: 1 } })
  assert.equal(calls.length, 1)
  assert.equal(evidence.listingComplete, false)
})

test('Cohere preserves caller cancellation before and during a bounded public read', async () => {
  const controller = new AbortController(), reason = new Error('Caller stopped Cohere')
  controller.abort(reason)
  await assert.rejects(run({ signal: controller.signal }), error => error === reason)
  const inFlight = new AbortController(); let calls = 0
  await assert.rejects(run({ signal: inFlight.signal, fetchImpl: async () => { calls++; inFlight.abort(reason); return new Response('partial') } }), error => error === reason)
  assert.equal(calls, 1)
})

test('the total decoded-byte budget stops parallel native detail streams as bytes arrive', async () => {
  const initialBytes = capture.packets.slice(0, 3).reduce((total, packet) => total + packet.bodyBytes, 0)
  const remaining = 1024, chunkSize = 256
  let roleBytes = 0, calls = 0
  const originals = new Map(capture.packets.map(packet => [packet.url, packet]))
  const jobs = await run({ limits: { maxDecodedBytes: initialBytes + remaining }, fetchImpl: async url => {
    calls++
    const packet = originals.get(url)
    assert.ok(packet)
    const body = Buffer.from(packet.rawBodyBase64, 'base64')
    if (!/\/[0-9a-f-]{36}$/.test(url)) return new Response(body)
    let position = 0
    const stream = new ReadableStream({ pull(controller) {
      if (position === body.length) return controller.close()
      const next = Math.min(position + chunkSize, body.length)
      const chunk = body.subarray(position, next); position = next; roleBytes += chunk.byteLength
      controller.enqueue(chunk)
    } }, { highWaterMark: 0 })
    return new Response(stream)
  } })
  assert.ok(roleBytes <= remaining + 4 * chunkSize, `Parallel bodies consumed ${roleBytes} role bytes beyond a ${remaining}-byte remainder`)
  assert.ok(calls <= 7)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('recovered corporate delegation preserves all 122 original records and full fresh history', async () => {
  const { calls, audit, evidence } = await replay({ replayKnownRoleBytes: true, mutate: page => {
    if (page.url === 'https://cohere.com/careers' && page.count === 1) page.html = page.html.replaceAll('https://jobs.ashbyhq.com/cohere', 'https://example.org/info')
    return page
  } })
  assert.equal(calls.length, 250)
  assert.equal(audit.observations.length, 122)
  assert.ok(audit.observations.every(job => job.sourceNativePosting && job.sourceNativeAPIRecord && job.sourceNativeJobPosting))
  assert.equal(audit.observations.filter(job => job.sourceNativeObservationHistory?.length >= 2).length, 122)
  assert.equal(audit.observations.filter(job => job.sourceNativeRoleDetail.bound).length, 122)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
})

test('the 320-read cap retains earlier native facts when a synthetic larger recovery exhausts it', async () => {
  const API = 'https://api.ashbyhq.com/posting-api/job-board/cohere', BOARD = 'https://jobs.ashbyhq.com/cohere'
  const original = new Map(capture.packets.map(packet => [packet.url, packet]))
  const feed = JSON.parse(Buffer.from(original.get(API).rawBodyBase64, 'base64'))
  const template = feed.jobs.find(job => job.id === ID)
  const additions = Array.from({ length: 58 }, (_, index) => {
    const id = `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
    return { ...structuredClone(template), id, title: `Synthetic future control ${index}`,
      jobUrl: `${BOARD}/${id}`, applyUrl: `${BOARD}/${id}/application` }
  })
  const added = new Map(additions.map(row => [row.jobUrl, row]))
  let calls = 0, homeReads = 0, audit
  const jobs = await run({ now: () => CLOCK, fetchPage: async url => {
    calls++
    const extra = added.get(url), packet = original.get(extra ? ROLE : url)
    assert.ok(packet)
    let html = Buffer.from(packet.rawBodyBase64, 'base64').toString('utf8')
    if (url === 'https://cohere.com/careers' && ++homeReads === 1) html = html.replaceAll('https://jobs.ashbyhq.com/cohere', 'https://example.org/info')
    if (url === API) { const data = JSON.parse(html); data.jobs.push(...additions); html = JSON.stringify(data) }
    if (url === BOARD) html = rewriteApp(html, data => {
      const brief = data.jobBoard.jobPostings.find(row => row.id === ID)
      data.jobBoard.jobPostings.push(...additions.map(row => ({ ...structuredClone(brief), id: row.id, title: row.title })))
    })
    if (extra) html = html.replaceAll(ID, extra.id).replaceAll(template.title, extra.title)
    return { url, status: 200, headers: packet.headers, bodyBase64: Buffer.from(html).toString('base64'),
      requestedAt: packet.requestedAt, completedAt: packet.completedAt }
  }, onAudit: value => { audit = value } })
  assert.equal(calls, 320)
  assert.equal(audit.coherePublicInventory.transport.limits.maxRequests, 320)
  assert.equal(audit.observations.length, 180)
  assert.equal(audit.observations.filter(job => job.sourceNativeRoleDetail.bound).length, 134)
  assert.ok(audit.observations.every(job => job.sourceNativeObservationHistory?.[0]?.sourceNativePosting))
  assert.ok(audit.observations.every(job => job.sourceNativeObservationHistory[0].sourceNativeAPIRecord))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})
