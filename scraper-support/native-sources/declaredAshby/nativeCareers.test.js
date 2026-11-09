import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { getScraperCatalog, createCatalogScraper } from '../../providers/index.js'
import { readInventoryEvidence } from '../../utils/inventoryEvidence.js'
import { normalizeScrapedJob } from '../../utils/normalizeScrapedJob.js'
import { isIndiaJob } from '../../utils/indiaLocationFilter.js'

globalThis.fetch = async () => { throw Error('Offline genuine-response tests prohibit all HTTP') }
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/actual-http-20261031.json.gz', import.meta.url))))
const artificialJSONScript = (html, pattern, change) => {
  let found = false
  const result = html.replace(pattern, (_match, prefix, body, suffix) => {
    found = true
    const model = JSON.parse(body);change(model)
    return prefix + JSON.stringify(model).replace(/</g, '\\u003c') + suffix
  })
  assert.equal(found, true, 'Missing original literal in artificial offline control')
  return result
}
const artificialAppData = (html, change) => {
  const assignment = /window\.__appData\s*=\s*/.exec(html)
  assert.ok(assignment)
  const start = assignment.index + assignment[0].length
  let depth = 0, quoted = false, escaped = false, end = -1
  for (let at = start; at < html.length; at++) {
    const character = html[at]
    if (quoted) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') quoted = false
    } else if (character === '"') quoted = true
    else if (character === '{' || character === '[') depth++
    else if ((character === '}' || character === ']') && --depth === 0) { end = at + 1;break }
  }
  assert.ok(end > start)
  const data = JSON.parse(html.slice(start, end));change(data)
  // Preserve the source's trailing Vite setup verbatim as inert syntax data.
  return html.slice(0, start) + JSON.stringify(data).replace(/</g, '\\u003c') + html.slice(end)
}
for (const row of fixture.responses)
  assert.equal(createHash('sha256').update(Buffer.from(row.bodyBase64, 'base64')).digest('hex'), row.sha256)
export const execute = async (source, { mutate = page => page, replayKnownRoleBytes = false, signal, maxJobs, onAudit } = {}) => {
  const queues = new Map(), calls = [], counts = new Map(), audits = [], missing = []
  const rows = fixture.responses.filter(row => row.source === source)
  for (const row of rows) {
    if (!queues.has(row.url)) queues.set(row.url, [])
    queues.get(row.url).push(row)
  }
  const get = async url => {
    calls.push(url)
    // Explicit offline retry controls may replay an unchanged genuine role
    // response. This is artificial control routing, never current native HTTP.
    const row = queues.get(url)?.shift() || (replayKnownRoleBytes && rows.find(row => row.url === url && row.purpose === 'actual-native-feed-linked-role'))
    if (!row) { missing.push(url);throw Error('No retained genuine URL: ' + url) }
    const count = (counts.get(url) || 0) + 1;counts.set(url, count)
    const original = Buffer.from(row.bodyBase64, 'base64').toString('utf8')
    const page = mutate({ html: original, bodyBase64: row.bodyBase64, url: row.finalURL, status: row.status,
      headers: structuredClone(row.responseHeaders), count, purpose: row.purpose })
    if (page.html !== original) page.bodyBase64 = Buffer.from(page.html).toString('base64')
    return page
  }
  const provider = getScraperCatalog().find(row => row.source === source)
  const jobs = await createCatalogScraper(provider).run({ signal, maxJobs, now: () => '2026-10-31T05:30:00.000Z',
    fetchPage: get, fetchText: async url => (await get(url)).html, fetchJson: async url => JSON.parse((await get(url)).html),
    onAudit: async audit => { audits.push(audit);await onAudit?.(audit) } })
  assert.deepEqual(missing, [])
  return { jobs, audit: audits[0], calls, provider, evidence: readInventoryEvidence(jobs) }
}
for (const [source, expected] of [['cohere', 122], ['oyster', 24]]) {
  const first = fixture.responses.find(row => row.source === source && row.purpose === 'actual-native-feed-linked-role')
  const id = new URL(first.url).pathname.split('/')[2]
  test(source + ' retains every real feed/board role observation and full native criteria before India selection', async () => {
    const { audit, evidence } = await execute(source)
    assert.ok(audit, 'The registered adapter must retain native observations, not only an empty India array')
    assert.equal(audit.observations.length, expected)
    assert.ok(audit.observations.every(job => job.jobDescription && job.sourceNativeRoleDetail.bound))
    assert.equal(new Set(audit.observations.map(job => job.jobId)).size, expected)
    for (const job of audit.observations) {
      assert.equal(job.sourceNativePosting.descriptionHtml, job.sourceNativeAPIRecord.descriptionHtml)
      assert.equal(job.sourceNativeJobPosting.description, job.sourceNativeAPIRecord.descriptionHtml)
      assert.equal(job.requisitionId, null)
      assert.equal(job.sourceDetailComplete, false);assert.equal(job.lifecycleCleanupAllowed, false)
    }
    assert.equal(evidence.listingComplete, false);assert.equal(evidence.reportedTotal, null);assert.equal(evidence.indiaFacetCount, null)
  })
  test(source + ' preserves literal geography without turning global/remote/foreign postings into India', async () => {
    const { audit, provider } = await execute(source)
    assert.equal(audit?.observations.length, expected)
    for (const job of audit.observations) {
      assert.equal(isIndiaJob(normalizeScrapedJob(job, provider)), false)
      assert.equal(job.sourceNativeApplication.activationVerified, false)
      assert.equal(job.sourceNativeAvailability.activeRecruitmentVerified, false)
    }
  })
  test(source + ' artificial secondary India worksite survives the real predicate without relabelling its foreign primary', async () => {
    const india = { location: 'Bengaluru', address: { postalAddress: { addressCountry: 'India', addressLocality: 'Bengaluru', addressRegion: 'Karnataka' } } }
    const { audit, provider, jobs } = await execute(source, { replayKnownRoleBytes: true, mutate: page => {
      // Artificial future geography control only; no changed document is a
      // native HTTP response, actual opening or current India-job observation.
      if (page.url.includes('api.ashbyhq.com')) {
        const data = JSON.parse(page.html)
        data.jobs.find(job => job.id === id).secondaryLocations.push(structuredClone(india))
        page.html = JSON.stringify(data)
      }
      if (page.url === 'https://jobs.ashbyhq.com/' + source || page.url === first.url)
        page.html = artificialAppData(page.html,
          data => {
            if (data.posting?.id === id) data.posting.secondaryLocationNames.push('Bengaluru')
            const brief = data.jobBoard?.jobPostings?.find(job => job.id === id)
            if (brief) brief.secondaryLocations.push({ locationName: 'Bengaluru' })
          })
      if (page.url === first.url) page.html = artificialJSONScript(page.html,
        /(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/,
        schema => {
          const original = schema.applicantLocationRequirements
          schema.applicantLocationRequirements = [...(Array.isArray(original) ? original : original ? [original] : []), { '@type': 'Country', name: 'India' }]
        })
      return page
    } })
    const job = audit.observations.find(job => job.jobId === id)
    assert.equal(job.sourceNativeRoleDetail.bound, true, JSON.stringify({ role: job.sourceNativeRoleDetail.issues,
      transport: audit.issues.filter(issue => issue.url === first.url) }))
    assert.equal(isIndiaJob(normalizeScrapedJob(job, provider)), true)
    assert.equal(job.country, 'India');assert.equal(job.city, 'Bengaluru')
    assert.equal(job.sourceNativeAPIRecord.address.postalAddress.addressCountry, source === 'cohere' ? 'Canada' : 'Spain')
    assert.equal(job.sourceNativeCountryEvidence.originalPlaces[0].country, source === 'cohere' ? 'Canada' : 'Spain')
    assert.ok(jobs.some(job => job.jobId === id))
  })
  test(source + ' retains exact source timestamps with +00:00 and unknown workplace fields', async () => {
    const { audit, provider } = await execute(source)
    assert.equal(audit?.observations.length, expected)
    for (const job of audit.observations) {
      const native = job.sourceNativeAPIRecord, normalized = normalizeScrapedJob(job, provider)
      assert.equal(Date.parse(job.postingDate), Date.parse(native.publishedAt))
      assert.equal(new Date(normalized.postingDate).toISOString(), new Date(native.publishedAt).toISOString())
      assert.equal(job.sourceNativePosting.employmentType, native.employmentType)
      assert.equal(normalized.sourceEmploymentType, native.employmentType)
      if (!job.sourceNativePosting.workplaceType) {
        assert.equal(job.remoteStatus, null)
        assert.equal(normalized.remoteStatus, null)
      }
    }
    if (source === 'oyster') {
      const role = audit.observations.find(job => job.jobId === '0d6fef86-5e4b-4bca-aff7-8dd7ae2e0519')
      assert.equal(role.closingDate, '2026-11-05T22:00:00.000Z')
      assert.equal(role.sourceNativeAvailability.deadlinePassed, false)
    }
  })
  for (const label of ['Other', 'PartTime']) test(source + ' artificial unknown employment label cannot acquire a full-time default: ' + label, async () => {
    const { audit, provider } = await execute(source, { mutate: page => {
      // Explicit artificial future-label controls only, never actual native
      // posting observations. All unchanged source fixture files remain exact.
      if (page.url.includes('api.ashbyhq.com')) {
        const payload = JSON.parse(page.html)
        payload.jobs.find(job => job.id === id).employmentType = label
        page.html = JSON.stringify(payload)
      }
      if (page.url === first.url) page.html = page.html
        .replaceAll('"employmentType":"FullTime"', '"employmentType":"' + label + '"')
        .replaceAll('"employmentType":"FULL_TIME"', '"employmentType":"' + (label === 'Other' ? 'OTHER' : 'PART_TIME') + '"')
      return page
    } })
    const job = audit.observations.find(job => job.jobId === id)
    const model = normalizeScrapedJob(job, provider)
    assert.equal(model.sourceEmploymentType, label)
    assert.equal(model.employmentType, null)
    assert.ok(!/^Full-time/.test(model.jobType || ''))
    assert.equal(job.sourceEmploymentTypeUnresolved, true)
  })
  test(source + ' native board still recovers own roles when the opening API fails', async () => {
    const { audit } = await execute(source, { replayKnownRoleBytes: true, mutate: page => {
      if (page.url.includes('api.ashbyhq.com') && page.count === 1) page.status = 503
      return page
    } })
    assert.equal(audit?.observations.length, expected)
    assert.ok(audit.observations.every(job => job.jobDescription))
  })
  test(source + ' final-review R1 recovered corporate delegation rechecks unchanged roles with separate history', async () => {
    const { audit, calls } = await execute(source, { replayKnownRoleBytes: true, mutate: page => {
      if (page.purpose === 'official-primary-opening') page.status = 503
      return page
    } })
    assert.equal(audit.closingCompany.qualified, true)
    assert.equal(audit.observations.filter(job => job.sourceNativeRoleDetail.bound && job.jobDescription).length, expected)
    for (const job of audit.observations) {
      assert.equal(job.sourceNativeObservationHistory.length, 2)
      assert.equal(job.sourceNativeObservationHistory[0].sourceNativeRoleDetail.bound, false)
      assert.equal(job.sourceNativeObservationHistory[1].sourceNativeRoleDetail.bound, true)
      assert.equal(job.sourceCurrentNativeRoleQualified, true)
    }
    assert.equal(calls.filter(url => url === first.url).length, 2)
  })
  test(source + ' final-review R1 failed fresh retry stays unqualified after corporate recovery', async () => {
    const { audit, calls, jobs } = await execute(source, { replayKnownRoleBytes: true, mutate: page => {
      if (page.purpose === 'official-primary-opening' || page.url === first.url && page.count === 2) page.status = 503
      return page
    } })
    assert.equal(audit.observations.filter(job => job.sourceNativeRoleDetail.bound && job.jobDescription).length, expected - 1)
    const job = audit.observations.find(job => job.jobId === id)
    assert.equal(calls.filter(url => url === first.url).length, 2)
    assert.equal(job.sourceNativeRoleDetail.bound, false)
    assert.equal(job.sourceCurrentNativeRoleQualified, false)
    assert.equal(job.sourceNativeObservationHistory.length, 2)
    assert.ok(!jobs.some(job => job.jobId === id))
  })
  for (const [label, code] of [
    ['organization mutating call', 'Object.assign(window.__appData.organization,{name:"Foreign employer"});'],
    ['posting alias', 'const posting=window.__appData.posting;posting.title="Other role";'],
  ]) test(source + ' final-review R2 artificial ' + label + ' cannot acquire role identity', async () => {
    const { audit, jobs } = await execute(source, { mutate: page => {
      if (page.url === first.url) page.html = page.html.replace('</body>', '<script>' + code + '</script></body>')
      return page
    } })
    const job = audit.observations.find(job => job.jobId === id)
    assert.equal(audit.observations.length, expected)
    assert.equal(job.sourceNativeAPIRecord.id, id)
    assert.equal(job.sourceNativeRoleDetail.bound, false)
    assert.equal(job.sourceCurrentNativeRoleQualified, false)
    assert.ok(!jobs.some(job => job.jobId === id))
  })
  for (const contradictory of [true, false]) test(source + ' final-review R3 '
    + (contradictory ? 'contradictory' : 'reordered coherent') + ' schema places reach the real India predicate', async () => {
    const india = { location: 'Bengaluru', address: { postalAddress: {
      addressCountry: 'India', addressLocality: 'Bengaluru', addressRegion: 'Karnataka',
    } } }
    const { audit, provider } = await execute(source, { replayKnownRoleBytes: true, mutate: page => {
      if (page.url.includes('api.ashbyhq.com')) {
        const data = JSON.parse(page.html)
        data.jobs.find(job => job.id === id).secondaryLocations.push(structuredClone(india))
        page.html = JSON.stringify(data)
      }
      if (page.url === 'https://jobs.ashbyhq.com/' + source || page.url === first.url)
        page.html = artificialAppData(page.html, data => {
          if (data.posting?.id === id) data.posting.secondaryLocationNames.push('Bengaluru')
          const brief = data.jobBoard?.jobPostings?.find(job => job.id === id)
          if (brief) brief.secondaryLocations.push({ locationName: 'Bengaluru' })
        })
      if (page.url === first.url) page.html = artificialJSONScript(page.html,
        /(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/,
        schema => {
          const original = Array.isArray(schema.jobLocation) ? schema.jobLocation : [schema.jobLocation]
          const address = { ...structuredClone(india.address.postalAddress),
            addressCountry: contradictory ? source === 'cohere' ? 'Canada' : 'Spain' : 'India' }
          schema.jobLocation = [{ '@type': 'Place', address }, ...original]
          const applicants = schema.applicantLocationRequirements
          schema.applicantLocationRequirements = [...(Array.isArray(applicants) ? applicants : applicants ? [applicants] : []),
            { '@type': 'Country', name: 'India' }]
        })
      return page
    } })
    const job = audit.observations.find(job => job.jobId === id)
    assert.equal(job.sourceNativeRoleDetail.bound, true)
    assert.equal(job.sourceNativeCountryEvidence.schemaConflict, contradictory)
    assert.equal(isIndiaJob(normalizeScrapedJob(job, provider)), !contradictory)
    assert.equal(job.sourceNativeAPIRecord.address.postalAddress.addressCountry, source === 'cohere' ? 'Canada' : 'Spain')
  })
  test(source + ' native API still recovers own roles when the opening board fails', async () => {
    const { audit } = await execute(source, { replayKnownRoleBytes: true, mutate: page => {
      if (page.url === 'https://jobs.ashbyhq.com/' + source && page.count === 1) page.status = 503
      return page
    } })
    assert.equal(audit?.observations.length, expected)
    assert.ok(audit.observations.every(job => job.jobDescription))
  })
  test(source + ' failed closing collections preserve all earlier meaningful criteria', async () => {
    const { audit, evidence } = await execute(source, { mutate: page => {
      if (page.count === 2 && (page.url.includes('api.ashbyhq.com') || page.url === 'https://jobs.ashbyhq.com/' + source)) page.status = 503
      return page
    } })
    assert.equal(audit?.observations.length, expected)
    assert.ok(audit.observations.every(job => job.jobDescription && !job.sourceCurrentNativeRoleQualified))
    assert.equal(evidence.listingComplete, false);assert.equal(audit.lifecycleCleanupAllowed, false)
  })
  test(source + ' failed closing corporate page preserves earlier bound literal role metadata', async () => {
    const { audit } = await execute(source, { mutate: page => {
      if (page.purpose === 'official-primary-closing') page.status = 503
      return page
    } })
    assert.equal(audit?.observations.length, expected)
    assert.ok(audit.observations.every(job => job.jobDescription && job.sourceNativeRoleDetail.bound
      && !job.sourceCurrentNativeRoleQualified && job.sourceNativeTemporalQualification))
    const job = audit.observations.find(job => job.jobId === id)
    assert.equal(job.country, source === 'cohere' ? 'Canada' : null)
    assert.ok(job.sourceNativeCountryCodes.includes(source === 'cohere' ? 'Canada' : 'Spain'))
    assert.ok(job.sourceNativeCountryCodes.length > 0)
    assert.equal(job.sourceNativeClosingDelegation.qualified, false)
  })
  test(source + ' a foreign native organization cannot qualify the original role data', async () => {
    const { audit } = await execute(source, { mutate: page => {
      if (page.url === first.url) page.html = page.html.replace('"hostedJobsPageSlug":"' + source + '"', '"hostedJobsPageSlug":"foreign-account"')
      return page
    } })
    const job = audit?.observations.find(job => job.jobId === id)
    assert.ok(job);assert.equal(job.sourceNativeRoleDetail.bound, false)
    assert.ok(job.sourceNativePosting.descriptionHtml)
    assert.equal(job.country, null)
  })
  test(source + ' computed nested app-data writes cannot gain native identity', async () => {
    const { audit } = await execute(source, { mutate: page => {
      if (page.url === first.url) page.html = page.html.replace('</body>', '<script>window["__appData"]["organization"]=null;</script></body>')
      return page
    } })
    const job = audit?.observations.find(job => job.jobId === id)
    assert.ok(job);assert.equal(job.sourceNativeRoleDetail.bound, false)
    assert.equal(job.jobDescription, null)
    assert.ok(audit.rawPages.find(page => page.url === first.url)?.bodyBase64)
  })
  test(source + ' failed opening role transport receives a fresh closing retry', async () => {
    const { audit, calls } = await execute(source, { replayKnownRoleBytes: true, mutate: page => {
      if (page.url === first.url && page.count === 1) page.status = 503
      return page
    } })
    const job = audit?.observations.find(job => job.jobId === id)
    assert.ok(job?.jobDescription);assert.equal(job.sourceNativeRoleDetail.bound, true)
    assert.equal(calls.filter(url => url === first.url).length, 2)
  })
  test(source + ' changed closing metadata retains both positive temporal observations', async () => {
    const { audit, calls } = await execute(source, { replayKnownRoleBytes: true, mutate: page => {
      if (page.url.includes('api.ashbyhq.com') && page.count === 2) {
        const data = JSON.parse(page.html);data.jobs[0].descriptionPlain += ' Explicit artificial offline closing control.'
        page.html = JSON.stringify(data)
      }
      return page
    } })
    const job = audit?.observations.find(job => job.jobId === id)
    assert.ok(job?.jobDescription)
    assert.equal(calls.filter(url => url === first.url).length, 2)
    assert.equal(job.sourceNativeObservationHistory.length, 2)
    assert.ok(job.sourceNativeObservationHistory.every(row => row.jobDescription))
  })
  test(source + ' awaited audit errors propagate and pre-entry cancellation performs no request', async () => {
    const reason = Error('offline sink failure')
    await assert.rejects(execute(source, { onAudit: () => { throw reason } }), error => error === reason)
    await assert.rejects(execute(source, { signal: AbortSignal.abort(reason) }), error => error === reason)
  })
}

for (const [label, type, noModule, qualified] of [
  ['JSON data MIME', 'application/json', false, false],
  ['JSON-LD data MIME', 'application/ld+json', false, false],
  ['nomodule suppression', 'text/javascript', true, false],
  ['omitted active MIME', null, false, true],
  ['active module MIME', 'module', false, true],
]) test('oyster final-review R4 artificial embed ' + label + ' preserves independent delegation rules', async () => {
  const { audit } = await execute('oyster', { mutate: page => {
    if (page.purpose.startsWith('official-primary-')) {
      let replaced = 0
      page.html = page.html.replace(/<script\b[^>]*\bsrc=["']https:\/\/jobs\.ashbyhq\.com\/oyster\/embed["'][^>]*>/gi, tag => {
        replaced++
        const stripped = tag.replace(/\s+(?:type|nomodule)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, '')
        return stripped.replace(/>$/, (type ? ' type="' + type + '"' : '') + (noModule ? ' nomodule' : '') + '>')
      })
      assert.equal(replaced, 1, 'Artificial control must modify the actual declared embed')
    }
    return page
  } })
  assert.equal(audit.openingCompany.qualified, qualified)
  assert.equal(audit.closingCompany.qualified, qualified)
  assert.equal(audit.observations.filter(job => job.sourceNativeRoleDetail.bound).length, qualified ? 24 : 0)
  assert.equal(audit.sourceScopeComplete, false)
})
