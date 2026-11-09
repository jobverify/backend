import assert from 'node:assert/strict'
import test from 'node:test'
import { createLiciousScraper } from '../../scraper/licious/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { liciousCapture, liciousNativeOptions } from './fixtures/liciousNativeOptions.js'

test('Licious resolves its current MyNextHire iframe and full native roles instead of declaring the footer empty', async () => {
  const fixture = liciousCapture(), options = liciousNativeOptions(fixture)
  const jobs = await createLiciousScraper({ now: options.now }).run(options)
  assert.equal(jobs.length, 33)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 33)
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete === true))
  assert.ok(jobs.every(job => job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
  assert.ok(!jobs.some(job => String(job.jobId) === '1505'))
  assert.ok(!jobs.some(job => String(job.jobId) === '1557'))
  const native = JSON.parse(fixture.packets.find(p => p.url.endsWith('/requisition/object') && JSON.parse(p.requestBody).reqId === 1573).body).data.reqDetailsBO
  const first = jobs.find(job => String(job.jobId) === '1573')
  assert.equal(first.sourceDescription, native.jdDisplay)
  assert.ok(first.sourceDescription.length > 8000)
  assert.equal(first.sourceNativeCountryEvidence.rawCountry, null)
  assert.equal(first.postingDate, new Date(1792394113227).toISOString())
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.reportedTotal, 35)
  assert.equal(evidence.listingComplete, false)
  assert.match(evidence.reason, /location|scope/i)
})

const jsonBody = (packet, change) => {
  const value = JSON.parse(packet.body)
  change(value)
  packet.body = JSON.stringify(value)
}
const execute = async (mutate = () => {}, extra = {}) => {
  const options = liciousNativeOptions(liciousCapture(), mutate)
  return { jobs: await createLiciousScraper({ now: options.now }).run({ ...options, ...extra }), options }
}

test('Licious retains all publication events and uses the last native displayed event without duplicating jobs', async () => {
  const { jobs } = await execute()
  const job = jobs.find(job => String(job.jobId) === '204')
  assert.equal(job.sourceNativeDates.publicationEvents.length, 5)
  assert.equal(job.postingDate, new Date(1782201107727).toISOString())
  assert.equal(job.sourceNativeDates.firstPublishedOn, 1781873033884)
  const context = JSON.parse(Buffer.from(new URL(job.applyUrl).searchParams.get('p'), 'base64').toString())
  assert.equal(context.reqId, 204)
  assert.equal(context.pageType, 'application')
  assert.equal(new URL(job.applyUrl).origin, 'https://www.licious.in')
})

for (const [label, replacement] of [
  ['hidden iframe', html => html.replace('id="mnhembedded"', 'id="mnhembedded" hidden')],
  ['stylesheet-hidden iframe', html => html.replace('</head>', '<style>#mnhembedded{display:none}</style></head>')],
  ['transparent iframe', html => html.replace('id="mnhembedded"', 'id="mnhembedded" style="opacity:0"')],
  ['inert iframe', html => html.replace('id="mnhembedded"', 'id="mnhembedded" inert')],
  ['template-only iframe', html => html.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/, match => `<template>${match}</template>`)],
  ['different frame source', html => html.replace('id="mnhembedded"', 'srcdoc="foreign" id="mnhembedded"')],
]) test(`Licious refuses to certify an empty footer with a ${label}`, async () => {
  await assert.rejects(execute(packet => { if (packet.url === 'https://www.licious.in/careers/jobs') packet.body = replacement(packet.body) }), /Licious native.*(?:frame|handoff)/i)
})

test('Licious checks reciprocal tenant employer identity even when the listing is empty', async () => {
  await assert.rejects(execute(packet => {
    if (packet.url.includes('details_by_shortname')) jsonBody(packet, value => { value.clientName = 'Other Employer' })
  }), /Licious native.*employer/i)
})

test('Licious rejects unsupported client code rather than using stale hard-coded endpoints', async () => {
  await assert.rejects(execute(packet => {
    if (packet.url.includes('/chunks/pages/content/careers/jobs-')) packet.body += '\n// changed handoff'
  }), /Licious native.*client/i)
})

test('Licious rejects full-detail identity changes and redirected native responses', async () => {
  await assert.rejects(execute(packet => {
    if (packet.url.endsWith('/requisition/object') && JSON.parse(packet.requestBody).reqId === 1573) jsonBody(packet, value => { value.data.reqDetailsBO.reqId = 99999 })
  }), /Licious native.*identity/i)
  await assert.rejects(execute(packet => {
    if (packet.url.includes('details_by_shortname')) packet.finalUrl = 'https://other.mynexthire.com/'
  }), /Licious native.*response/i)
})

test('Licious retains healthy jobs while excluding missing, closed or country-conflicting full details', async () => {
  for (const change of [
    value => { value.data.reqDetailsBO.jdDisplay = '<p>JD attached</p>' },
    value => { value.data.reqDetailsBO.requisitionPublished = false },
    value => { value.data.reqDetailsBO.countryCode = 'US' },
  ]) {
    const { jobs } = await execute(packet => {
      if (packet.url.endsWith('/requisition/object') && JSON.parse(packet.requestBody).reqId === 1573) jsonBody(packet, change)
    })
    assert.equal(jobs.length, 32)
    assert.ok(!jobs.some(job => String(job.jobId) === '1573'))
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  }
})

test('Licious does not substitute approval or scrape time for a missing or future publication date', async () => {
  for (const change of [
    value => { value.data.careersJobPostingDatesList = value.data.careersJobPostingDatesList.filter(row => row.requisitionId !== 1573) },
    value => { value.data.careersJobPostingDatesList.find(row => row.requisitionId === 1573).publishedOn = Date.parse('2099-01-01') },
  ]) {
    const { jobs } = await execute(packet => { if (packet.url.includes('job-posting-dates/list')) jsonBody(packet, change) })
    assert.equal(jobs.length, 32)
    assert.ok(!jobs.some(job => String(job.jobId) === '1573'))
    assert.match(readInventoryEvidence(jobs).reason, /publication/i)
  }
})

test('Licious drops a role if its closing listing location changes and still checks every native detail before a cap', async () => {
  const { jobs, options } = await execute((packet, index) => {
    if (packet.url.endsWith('/reqlist/get') && index === 1) jsonBody(packet, value => {
      const row = value.reqDetailsBOList.find(row => row.reqId === 1573)
      row.locationList = [{ office: 'Remote', address: 'Remote' }]
    })
  }, { maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.notEqual(jobs[0].jobId, '1573')
  assert.equal(options.calls.filter(call => call.url.endsWith('/requisition/object')).length, 35)
  assert.match(readInventoryEvidence(jobs).reason, /closing/)
})

test('Licious verifies an empty inventory only through current employer binding and matching full native arrays', async () => {
  const fixture = liciousCapture()
  for (const packet of fixture.packets) {
    if (packet.url.includes('job-posting-dates/list')) packet.requestBody = JSON.stringify({ srcShortName: 'careers', requisitionIdList: [] })
  }
  const options = liciousNativeOptions(fixture, packet => {
    // Remove the additional corporate careers routes for this isolated empty
    // board case. The live pages keep those routes and remain partial.
    if (packet.url === 'https://www.licious.in/careers' || packet.url === 'https://www.licious.in/careers/jobs') {
      packet.body = packet.body.replace(/href="\/careers\/(?:why-join|culture|technology|teams|life)"/g, 'href="/careers"')
    }
    if (packet.url.endsWith('/reqlist/get')) jsonBody(packet, value => { value.reqDetailsBOList = [] })
    if (packet.url.includes('job-posting-dates/list')) jsonBody(packet, value => { value.data.careersJobPostingDatesList = [] })
  })
  const jobs = await createLiciousScraper({ now: options.now }).run(options)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('Licious honors cancellation before making a public request', async () => {
  const signal = AbortSignal.abort(new Error('cancelled source'))
  await assert.rejects(execute(() => {}, { signal }), /cancelled source/)
})

test('Licious preserves healthy roles when an individual detail endpoint is unavailable', async () => {
  const { jobs } = await execute(packet => {
    if (packet.url.endsWith('/requisition/object') && JSON.parse(packet.requestBody).reqId === 1573) packet.status = 503
  })
  assert.equal(jobs.length, 32)
  assert.match(readInventoryEvidence(jobs).reason, /native-detail-unavailable:1573/)
})

test('Licious reconciles publication history again before returning a role', async () => {
  const { jobs } = await execute((packet, index) => {
    if (packet.url.includes('job-posting-dates/list') && index === 1) jsonBody(packet, value => {
      value.data.careersJobPostingDatesList.find(row => row.requisitionId === 1573).publishedOn += 1000
    })
  })
  assert.equal(jobs.length, 32)
  assert.ok(!jobs.some(job => job.jobId === '1573'))
  assert.match(readInventoryEvidence(jobs).reason, /closing-native-role-or-publication-changed/)
})

test('Licious rejects duplicate listing IDs rather than accepting a reduced inventory', async () => {
  await assert.rejects(execute(packet => {
    if (packet.url.endsWith('/reqlist/get')) jsonBody(packet, value => { value.reqDetailsBOList[1].reqId = value.reqDetailsBOList[0].reqId })
  }), /listing role identity repeats/)
})
