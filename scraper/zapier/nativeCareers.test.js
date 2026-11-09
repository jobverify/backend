import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createZapierScraper } from './script.js'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'
import { isIndiaJob } from '../../scraper-support/utils/indiaLocationFilter.js'

globalThis.fetch = async () => { throw Error('Offline source tests prohibit HTTP') }
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/actual-http-20261031.json.gz', import.meta.url))))
const indiaID = '7dd68291-3696-4fd0-a5d0-24ab73d22fff'
const now = () => '2026-10-31T02:00:00.000Z'
for (const row of fixture.responses) assert.equal(createHash('sha256').update(Buffer.from(row.bodyBase64, 'base64')).digest('hex'), row.sha256)
const execute = async ({ mutate = p => p, signal, onAudit, repeatRoleDetails = false } = {}) => {
  const queues = new Map(), calls = [], missing = [], audits = [], seen = new Map(), replayedDetails = []
  for (const row of fixture.responses) {
    if (!queues.has(row.url)) queues.set(row.url, [])
    queues.get(row.url).push(row)
  }
  const get = async url => {
    calls.push(url)
    let row = queues.get(url)?.shift()
    // Explicit offline refresh control only; repeated genuine bytes are not a
    // second physical closing response or source evidence.
    if (!row && repeatRoleDetails && /^https:\/\/jobs.ashbyhq.com\/zapier\/[a-f\d-]+$/.test(url)) {
      row = fixture.responses.find(row => row.url === url)
      if (row) replayedDetails.push(url)
    }
    if (!row) { missing.push(url);throw Error('No retained response for ' + url) }
    const html = Buffer.from(row.bodyBase64, 'base64').toString('utf8')
    const count = (seen.get(url) || 0) + 1;seen.set(url, count)
    const page = mutate({ url: row.finalURL, status: row.status, headers: structuredClone(row.responseHeaders), html,
      bodyBase64: row.bodyBase64, count, purpose: row.purpose })
    // Mutations below are artificial controls, never a native feed or current proof.
    if (page.html !== html) page.bodyBase64 = Buffer.from(page.html).toString('base64')
    return page
  }
  const jobs = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'zapier')).run({ now, signal, fetchPage: get,
    fetchJson: async url => JSON.parse((await get(url)).html), fetchText: async url => (await get(url)).html,
    onAudit: async audit => { audits.push(audit);await onAudit?.(audit) } })
  assert.deepEqual(missing, [])
  return { jobs, calls, replayedDetails, audit: audits[0], evidence: readInventoryEvidence(jobs) }
}

test('all eleven current native postings retain complete role objects and exact raw HTTP responses', async () => {
  const { audit, calls, evidence } = await execute()
  assert.equal(audit?.observations.length, 11)
  assert.equal(audit.rawPages.length, 17)
  assert.ok(audit.rawPages.every(page => page.bodyBase64 && page.bodySHA256))
  assert.ok(audit.observations.every(job => job.sourceNativePosting && job.sourceNativeAPIRecord && job.sourceNativeJobPosting))
  assert.equal(calls.filter(url => /^https:\/\/jobs.ashbyhq.com\/zapier\/[a-f\d-]+$/.test(url)).length, 11)
  assert.ok(audit.observations.every(job => job.sourceNativeRoleDetail.bound && job.jobDescription))
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
})

test('a genuine application deadline is retained even while the publisher still lists the role', async () => {
  const { jobs, audit } = await execute()
  const job = audit?.observations.find(job => job.jobId === indiaID) || jobs.find(job => job.jobId === indiaID)
  assert.ok(job)
  assert.equal(job.closingDate, '2026-10-30T07:00:00.000Z')
  assert.equal(job.sourceNativeAvailability.deadlinePassed, true)
  assert.equal(job.sourceNativeAvailability.nativeIsListed, true)
  assert.equal(job.sourceNativeAvailability.activeRecruitmentVerified, false)
})

test('native posting UUIDs do not become invented requisition IDs', async () => {
  const { jobs, audit } = await execute()
  const roles = audit?.observations || jobs
  assert.ok(roles.length > 0)
  assert.ok(roles.every(job => job.jobId && job.requisitionId === null))
})

test('India secondary location and conflicting applicant country stay visible without claiming eligibility', async () => {
  const { jobs, audit } = await execute()
  const job = audit?.observations.find(job => job.jobId === indiaID) || jobs.find(job => job.jobId === indiaID)
  assert.ok(job)
  assert.equal(job.country, null)
  assert.equal(job.location, null)
  assert.deepEqual(job.locations, [])
  assert.ok(job.sourceNativePosting.secondaryLocationNames.includes('India'))
  assert.equal(job.sourceNativeJobPosting.applicantLocationRequirements.name, 'United States')
  assert.equal(job.sourceCountryScopeUnresolved, true)
  assert.equal(isIndiaJob(normalizeScrapedJob(job, { source: 'zapier', companyName: 'Zapier' })), false)
})

test('full role criteria include native application limits and compensation text, not just the API description', async () => {
  const { jobs, audit } = await execute()
  const job = audit?.observations.find(job => job.jobId === indiaID) || jobs.find(job => job.jobId === indiaID)
  assert.ok(job)
  assert.ok(job.sourceNativePosting?.applicationLimitCalloutHtml.includes('90 days'))
  assert.ok(job.jobDescription.includes('90 days'))
  assert.ok(job.jobDescription.includes('Equitable: Consistent pay practices; Pay for impact'))
  assert.ok(job.jobDescription.includes('CA$174.2K'))
  assert.equal(job.sourceDetailComplete, false)
})

test('current corporate handoff loss cannot leave previously assumed source authority', async () => {
  const { jobs, audit } = await execute({ mutate: page => {
    if (page.url === 'https://zapier.com/jobs') page.html = page.html.replaceAll('https://jobs.ashbyhq.com/zapier/', 'https://unrelated.example/zapier/')
    return page
  } })
  assert.equal(jobs.length, 0)
  assert.equal(audit.sourceScopeComplete, false)
  assert.ok(audit.issues.some(issue => /delegation|handoff/.test(issue.kind)))
})

test('a role title mismatch clears normalized authority without losing its original criteria', async () => {
  const { audit } = await execute({ mutate: page => {
    if (page.url.endsWith('/' + indiaID)) page.html = page.html.replace('"title":"Manager, Analytics & Strategy"', '"title":"Artificial conflicting role"')
    return page
  } })
  const job = audit?.observations.find(job => job.sourceNativeAPIRecord.id === indiaID)
  assert.ok(job)
  assert.equal(job.sourceNativeRoleDetail.bound, false)
  assert.equal(job.country, null)
  assert.ok(job.sourceNativePosting.descriptionHtml.length > 1000)
})

test('an awaited audit sink failure propagates after all genuine criteria observations', async () => {
  const reason = Error('Audit storage failed')
  await assert.rejects(execute({ onAudit: audit => { assert.equal(audit.observations.length, 11);throw reason } }), error => error === reason)
})

test('caller cancellation before entry propagates without a public fetch', async () => {
  const reason = Error('Caller cancelled')
  await assert.rejects(execute({ signal: AbortSignal.abort(reason) }), error => error === reason)
})

test('a bad API role URL cannot abort healthy roles or gain normalized link authority', async () => {
  const { audit, calls } = await execute({ mutate: page => {
    if (page.url.includes('/posting-api/job-board/')) {
      const data = JSON.parse(page.html), role = data.jobs.find(job => job.id === indiaID)
      role.jobUrl = 'https://unrelated.example/zapier/' + indiaID
      role.applyUrl = 'http://jobs.ashbyhq.com/zapier/' + indiaID + '/application'
      page.html = JSON.stringify(data)
    }
    return page
  } })
  assert.equal(audit.observations.length, 11)
  assert.equal(audit.observations.filter(job => job.sourceNativeRoleDetail.bound).length, 10)
  const job = audit.observations.find(job => job.jobId === indiaID)
  assert.equal(job.sourceNativeRoleDetail.bound, false)
  assert.equal(job.sourceUrl, 'https://jobs.ashbyhq.com/zapier/' + indiaID)
  assert.notEqual(job.applyUrl, job.sourceNativeAPIRecord.applyUrl)
  assert.ok(!calls.some(url => url.startsWith('https://unrelated.example/')))
})

test('known corporate and board positives are inspected even when both API snapshots omit them', async () => {
  const { audit, calls } = await execute({ mutate: page => {
    if (page.url.includes('/posting-api/job-board/')) {
      const data = JSON.parse(page.html);data.jobs = data.jobs.filter(job => job.id !== indiaID);page.html = JSON.stringify(data)
    }
    return page
  } })
  assert.equal(audit.observations.length, 11)
  const job = audit.observations.find(job => job.jobId === indiaID)
  assert.equal(job.sourceNativeAPIRecord, null)
  assert.ok(job.sourceNativePosting.descriptionHtml.length > 1000)
  assert.ok(calls.includes('https://jobs.ashbyhq.com/zapier/' + indiaID))
})

test('a failed closing API snapshot preserves all opening positive criteria and continues other closing checks', async () => {
  const { audit, calls, evidence } = await execute({ mutate: page => {
    if (page.url.includes('/posting-api/job-board/') && page.count === 2) page.status = 503
    return page
  } })
  assert.equal(audit.observations.length, 11)
  assert.ok(audit.observations.every(job => job.sourceNativePosting.descriptionHtml))
  assert.equal(calls.filter(url => url === 'https://zapier.com/jobs').length, 2)
  assert.equal(evidence.listingComplete, false)
  assert.ok(audit.issues.some(issue => /closing/.test(issue.kind)))
})

test('duplicate API identities preserve both originals without dropping the other ten native roles', async () => {
  const { audit } = await execute({ mutate: page => {
    if (page.url.includes('/posting-api/job-board/')) {
      const data = JSON.parse(page.html), copy = structuredClone(data.jobs.find(job => job.id === indiaID))
      copy.title = 'Artificial conflicting duplicate';data.jobs.push(copy);page.html = JSON.stringify(data)
    }
    return page
  } })
  assert.equal(audit.observations.length, 11)
  const job = audit.observations.find(job => job.jobId === indiaID)
  assert.equal(job.sourceNativeRoleDetail.bound, false)
  assert.equal(job.sourceNativeAPIConflicts.length, 2)
  assert.equal(audit.observations.filter(job => job.sourceNativeRoleDetail.bound).length, 10)
})

test('an impossible native deadline stays raw and unknown, rather than rolling into a real date', async () => {
  const { audit } = await execute({ mutate: page => {
    if (page.url.endsWith('/' + indiaID)) page.html = page.html.replace('"applicationDeadline":"2026-10-30T07:00:00.000Z"', '"applicationDeadline":"2026-02-30T07:00:00.000Z"')
    return page
  } })
  const job = audit.observations.find(job => job.jobId === indiaID)
  assert.equal(job.closingDate, null)
  assert.equal(job.sourceNativeAvailability.deadlinePassed, null)
  assert.equal(job.sourceNativeAvailability.originalApplicationDeadline, '2026-02-30T07:00:00.000Z')
})

test('a foreign canonical cannot promote a genuine native role to conflicting link authority', async () => {
  const { audit } = await execute({ mutate: page => {
    if (page.url.endsWith('/' + indiaID)) page.html = page.html.replace('<head>', '<head><link rel="canonical" href="https://unrelated.example/zapier/' + indiaID + '">')
    return page
  } })
  const job = audit.observations.find(job => job.jobId === indiaID)
  assert.equal(job.sourceNativeRoleDetail.bound, false)
  assert.ok(job.applyUrl.startsWith('https://jobs.ashbyhq.com/zapier/'))
})

test('a decoded duplicate app-data key cannot select its last role title', async () => {
  const { audit } = await execute({ mutate: page => {
    if (page.url.endsWith('/' + indiaID)) page.html = page.html.replace('"title":"Manager, Analytics & Strategy"', '"title":"Manager, Analytics & Strategy","titl\\u0065":"Artificial conflicting duplicate"')
    return page
  } })
  const job = audit.observations.find(job => job.jobId === indiaID)
  assert.equal(job.sourceNativeRoleDetail.bound, false)
  assert.equal(audit.observations.filter(job => job.sourceNativeRoleDetail.bound).length, 10)
})

test('changed same-ID closing records request a fresh detail rather than reuse an unqualified opening result', async () => {
  const { audit, replayedDetails, calls } = await execute({ repeatRoleDetails: true, mutate: page => {
    if (page.url.includes('/posting-api/job-board/') && page.count === 1) {
      const data = JSON.parse(page.html);data.jobs.find(job => job.id === indiaID).title = 'Artificial opening title';page.html = JSON.stringify(data)
    }
    return page
  } })
  const job = audit.observations.find(job => job.jobId === indiaID)
  assert.equal(job.sourceNativeRoleDetail.bound, true)
  assert.equal(job.title, 'Manager, Analytics & Strategy')
  assert.equal(calls.filter(url => url.endsWith('/' + indiaID)).length, 2)
  assert.deepEqual(replayedDetails, ['https://jobs.ashbyhq.com/zapier/' + indiaID])
})

test('a role-owned schema country contradiction cannot be ignored in favor of the API country', async () => {
  const id = 'cb1aec2c-05cd-4598-8117-bd1f7ed9a49f'
  let changed = 0
  const { audit, jobs } = await execute({ mutate: page => {
    if (page.url.endsWith('/' + id)) page.html = page.html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/,
      (_, start, raw, end) => { const data = JSON.parse(raw);data.jobLocation.address.addressCountry = 'India';changed++;return start + JSON.stringify(data) + end })
    return page
  } })
  assert.equal(changed, 1)
  const job = audit.observations.find(job => job.jobId === id)
  assert.equal(job.sourceNativeJobPosting.jobLocation.address.addressCountry, 'India')
  assert.equal(job.sourceNativeAPIRecord.address.postalAddress.addressCountry, 'United States')
  assert.equal(job.country, null)
  assert.equal(job.sourceCountryScopeUnresolved, true)
  assert.ok(jobs.some(job => job.jobId === id))
})

for (const surface of ['https://api.ashbyhq.com/posting-api/job-board/zapier', 'https://jobs.ashbyhq.com/zapier']) {
  test(`F1 unavailable opening ${surface.includes('api.') ? 'API' : 'board'} preserves all other known positive role data`, async () => {
    const { audit, calls } = await execute({ repeatRoleDetails: true, mutate: page => {
      if (page.url === surface && page.count === 1) page.status = 503
      return page
    } })
    assert.equal(audit.observations.length, 11)
    assert.ok(audit.observations.every(job => job.sourceNativePosting?.descriptionHtml))
    assert.equal(new Set(calls.filter(url => /^https:\/\/jobs.ashbyhq.com\/zapier\/[a-f\d-]+$/.test(url))).size, 11)
    assert.ok(audit.issues.some(issue => /opening/.test(issue.kind)))
  })
}

for (const unavailable of [true, false]) {
  test(`F2 closing board ${unavailable ? 'outage' : 'omission'} preserves the earlier full observations`, async () => {
    const { audit, jobs, calls } = await execute({ repeatRoleDetails: true, mutate: page => {
      if (page.url === 'https://jobs.ashbyhq.com/zapier' && page.count === 2) {
        if (unavailable) page.status = 503
        else {
          const marker = /window\.__appData\s*=\s*/.exec(page.html), start = marker.index + marker[0].length
          let end = start, depth = 0, quoted = false, escaped = false
          for (; end < page.html.length; end++) {
            const char = page.html[end]
            if (quoted) { if (escaped) escaped = false;else if (char === '\\') escaped = true;else if (char === '"') quoted = false }
            else if (char === '"') quoted = true
            else if (char === '{' || char === '[') depth++
            else if ((char === '}' || char === ']') && --depth === 0) { end++;break }
          }
          const model = JSON.parse(page.html.slice(start, end));model.jobBoard.jobPostings = model.jobBoard.jobPostings.filter(job => job.id !== indiaID)
          page.html = page.html.slice(0, start) + JSON.stringify(model) + page.html.slice(end)
        }
      }
      return page
    } })
    assert.equal(audit.observations.length, 11)
    assert.ok(audit.observations.every(job => job.jobDescription))
    assert.equal(jobs.length, 7)
    assert.equal(calls.filter(url => /^https:\/\/jobs.ashbyhq.com\/zapier\/[a-f\d-]+$/.test(url)).length, 11)
  })
}

test('F3 genuine board router shape recovers a positive absent from API and corporate links', async () => {
  const role = 'https://jobs.ashbyhq.com/zapier/' + indiaID
  const { audit, calls } = await execute({ mutate: page => {
    if (page.url.includes('/posting-api/job-board/')) {
      const value = JSON.parse(page.html);value.jobs = value.jobs.filter(job => job.id !== indiaID);page.html = JSON.stringify(value)
    }
    if (page.url === 'https://zapier.com/jobs') page.html = page.html.replaceAll(role, 'https://unrelated.example/' + indiaID)
    return page
  } })
  const job = audit.observations.find(job => job.jobId === indiaID)
  assert.equal(job.sourceNativeAPIRecord, null)
  assert.ok(job.sourceNativePosting?.descriptionHtml)
  assert.ok(calls.includes(role))
  assert.equal(job.sourceNativeDiscovery.URLDerivedFromNativeRouter, true)
})

test('F4 a later corporate link retries a failed opening role even when API is absent and brief unchanged', async () => {
  const role = 'https://jobs.ashbyhq.com/zapier/' + indiaID
  const { audit, calls } = await execute({ repeatRoleDetails: true, mutate: page => {
    if (page.url.includes('/posting-api/job-board/')) {
      const value = JSON.parse(page.html);value.jobs = value.jobs.filter(job => job.id !== indiaID);page.html = JSON.stringify(value)
    }
    if (page.url === 'https://zapier.com/jobs' && page.count === 1) page.html = page.html.replaceAll(role, 'https://unrelated.example/' + indiaID)
    if (page.url === role && page.count === 1) page.status = 404
    return page
  } })
  const job = audit.observations.find(job => job.jobId === indiaID)
  assert.ok(job.sourceNativePosting?.descriptionHtml)
  assert.ok(job.jobDescription)
  assert.equal(calls.filter(url => url === role).length, 2)
})

test('F5 coherent multiple known countries including India stay in registered discovery', async () => {
  const { nativePlaces } = await import('./nativeData.js')
  const original = JSON.parse(Buffer.from(fixture.responses.find(row => row.url.includes('/posting-api/job-board/')).bodyBase64, 'base64').toString('utf8')).jobs.find(job => job.id === indiaID)
  const known = { ...original, location: 'United States', address: { postalAddress: { addressCountry: 'United States' } },
    secondaryLocations: [{ location: 'India', address: { addressCountry: 'India' } }] }
  const schema = { jobLocation: { address: { addressCountry: 'United States' } }, applicantLocationRequirements: [{ name: 'United States' }, { name: 'India' }] }
  const geo = nativePlaces(known, schema)
  assert.deepEqual(geo.countries, ['United States', 'India'])
  assert.equal(geo.unresolved, false)
  // The immutable reviewer scenario exercises this through the actual
  // registered source; acceptance checks its targetReturned result separately.
})

test('F5 the actual registered filter retains coherent explicit US-plus-India scope', async () => {
  const rewriteApp = (html, change) => {
    const marker = /window\.__appData\s*=\s*/.exec(html), start = marker.index + marker[0].length
    let end = start, depth = 0, quoted = false, escaped = false
    for (; end < html.length; end++) {
      const char = html[end]
      if (quoted) { if (escaped) escaped = false;else if (char === '\\') escaped = true;else if (char === '"') quoted = false }
      else if (char === '"') quoted = true
      else if (char === '{' || char === '[') depth++
      else if ((char === '}' || char === ']') && --depth === 0) { end++;break }
    }
    const model = JSON.parse(html.slice(start, end));change(model)
    return html.slice(0, start) + JSON.stringify(model) + html.slice(end)
  }
  const { audit, jobs } = await execute({ mutate: page => {
    if (page.url.includes('/posting-api/job-board/')) {
      const value = JSON.parse(page.html), record = value.jobs.find(job => job.id === indiaID)
      record.location = 'United States';record.address = { postalAddress: { addressCountry: 'United States' } }
      record.secondaryLocations = [{ location: 'India', address: { addressCountry: 'India' } }]
      page.html = JSON.stringify(value)
    }
    if (page.url === 'https://jobs.ashbyhq.com/zapier') page.html = rewriteApp(page.html, data => {
      const brief = data.jobBoard.jobPostings.find(job => job.id === indiaID)
      brief.locationName = 'United States';brief.secondaryLocations = [{ locationName: 'India' }]
    })
    if (page.url.endsWith('/' + indiaID)) {
      page.html = rewriteApp(page.html, data => {
        data.posting.locationName = 'United States';data.posting.secondaryLocationNames = ['India'];data.posting.applicationDeadline = '2027-01-01T00:00:00.000Z'
      }).replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/, (_, start, raw, end) => {
        const schema = JSON.parse(raw);schema.applicantLocationRequirements = [{ name: 'United States' }, { name: 'India' }]
        schema.jobLocation = { address: { addressCountry: 'United States' } }
        return start + JSON.stringify(schema) + end
      })
    }
    return page
  } })
  const job = audit.observations.find(job => job.jobId === indiaID)
  assert.equal(job.sourceNativeRoleDetail.bound, true)
  assert.deepEqual(job.sourceNativeCountryCodes, ['United States', 'India'])
  assert.equal(job.sourceCountryScopeUnresolved, false)
  assert.ok(jobs.some(job => job.jobId === indiaID))
})

for (const statement of ['window["__appData"] = {organization:{name:"Other"},posting:{id:"other-role"}};',
  'window.__appData.posting.id = "other-role";']) {
  test(`F6 active app-data write is unqualified: ${statement.startsWith('window[') ? 'computed root' : 'nested property'}`, async () => {
    const { audit } = await execute({ mutate: page => {
      if (page.url.endsWith('/' + indiaID)) page.html = page.html.replace('</body>', '<script>' + statement + '</script></body>')
      return page
    } })
    const job = audit.observations.find(job => job.jobId === indiaID)
    assert.equal(job.sourceNativeRoleDetail.bound, false)
    assert.equal(job.sourceNativePostingIdentityQualified, false)
    assert.ok(audit.rawPages.some(page => page.originalText?.includes(statement)))
  })
}

test('F6 app-data-looking literal text in another script remains terminal data', async () => {
  const { audit } = await execute({ repeatRoleDetails: true, mutate: page => {
    if (page.url.endsWith('/' + indiaID)) page.html = page.html.replace('</body>', '<script>const example = "window.__appData = {}";</script></body>')
    return page
  } })
  const job = audit.observations.find(job => job.jobId === indiaID)
  assert.equal(job.sourceNativeRoleDetail.bound, true)
  assert.ok(job.sourceNativePosting.descriptionHtml)
})
