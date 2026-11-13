import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { decodeHTML } from 'entities'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { decorateJobsWithProviderMetadata, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'

const packets = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261113.json.gz', import.meta.url)))).packets
const replay = async (mutate = () => {}) => {
  const original = globalThis.fetch, visits = new Map()
  globalThis.fetch = async input => {
    const url = String(input), packet = structuredClone(packets.find(row => row.requestedUrl === url))
    assert.ok(packet, 'captured actual public URL ' + url)
    const visit = (visits.get(url) || 0) + 1
    visits.set(url, visit); mutate(packet, url, visit)
    const response = new Response(packet.html, { status: packet.status })
    Object.defineProperty(response, 'url', { value: packet.url }); return response
  }
  try { return await run() } finally { globalThis.fetch = original }
}
const assess = jobs => {
  const provider = getScraperCatalog().find(row => row.source === 'dialpad')
  return assessSoftFailureAcquisition(provider, decorateJobsWithProviderMetadata(jobs, provider))
}

test('Dialpad current corporate declaration and all sixteen native office assignments prove a board India zero', async () => {
  const jobs = await replay(), assessment = assess(jobs), audit = jobs.nativeCollectionEvidence
  assert.equal(jobs.length, 0)
  assert.equal(assessment.runnerOutcome.success, true)
  assert.equal(assessment.zeroJobEvidence, 'fetched-zero')
  assert.equal(assessment.inventoryEvidence.reportedTotal, 16)
  assert.equal(assessment.inventoryEvidence.lifecycleCleanupAllowed, false)
  assert.equal(assessment.cleanupOptions.replaceExisting, false)
  assert.equal(audit.details.length, 16)
  assert.equal(audit.countryProofs.length, 16)
  assert.ok(audit.countryProofs.every(proof => proof.qualified && proof.countries.length && !proof.countries.includes('India')))
  assert.equal(audit.sourceScopeComplete, false)
})

test('Dialpad an unknown native workplace alternative cannot certify a board India zero', async () => {
  const jobs = await replay((packet, url) => {
    if (!url.includes('boards-api') || !url.includes('/jobs')) return
    const value = JSON.parse(packet.html)
    for (const row of value.jobs || [value]) if (row.id === 8880622002) row.location.name += '; Remote'
    packet.html = JSON.stringify(value)
  })
  assert.equal(assess(jobs).zeroJobEvidence, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Dialpad a future fully typed India role remains held until its public application is qualified', async () => {
  const nativeOffices = JSON.parse(packets.find(packet => packet.requestedUrl.endsWith('/offices')).html)
  const india = nativeOffices.offices.find(office => office.id === 4017032002)
  const departmentId = JSON.parse(packets.find(packet => packet.requestedUrl.includes('/jobs?')).html).jobs.find(row => row.id === 8880622002).departments[0].id
  const reference = Object.fromEntries(['id', 'name', 'location', 'child_ids', 'parent_id'].map(key => [key, india[key]]))
  const jobs = await replay((packet, url) => {
    if (!url.includes('boards-api')) return
    const value = JSON.parse(packet.html)
    if (url.includes('/jobs')) for (const row of value.jobs || [value]) if (row.id === 8880622002) {
      row.location.name = 'Bengaluru, India'; row.offices = [reference]
    }
    if (url.endsWith('/offices')) {
      let brief
      for (const office of value.offices) for (const department of office.departments) {
        brief ||= department.jobs.find(row => row.id === 8880622002)
        department.jobs = department.jobs.filter(row => row.id !== 8880622002)
      }
      brief.location.name = 'Bengaluru, India'
      value.offices.find(office => office.id === india.id).departments.find(department => department.id === departmentId).jobs.push(brief)
    }
    packet.html = JSON.stringify(value)
  })
  assert.equal(assess(jobs).zeroJobEvidence, 'coverage-gap')
  const proof = jobs.nativeCollectionEvidence.countryProofs.find(row => row.jobId === '8880622002')
  assert.equal(proof.qualified, true)
  assert.deepEqual(proof.countries, ['India'])
  assert.ok(jobs.nativeCollectionEvidence.failures.some(row => /India public role\/application binding/.test(row.reason)))
})

test('Dialpad concealed original native criteria hold complete board certification', async () => {
  const jobs = await replay((packet, url) => {
    if (!url.includes('boards-api') || !url.includes('/jobs')) return
    const value = JSON.parse(packet.html)
    for (const row of value.jobs || [value]) if (row.id === 8880622002) row.content = '<div style="opacity:0">' + decodeHTML(row.content) + '</div>'
    packet.html = JSON.stringify(value)
  })
  assert.equal(assess(jobs).zeroJobEvidence, 'coverage-gap')
  assert.ok(jobs.nativeCollectionEvidence.failures.some(reason => /criteria/.test(reason.reason)))
})

for (const [label, mutate] of [
  ['metadata value object', row => { row.metadata[0].value = { country: 'India', mandatoryRequirements: 'Must live in India' } }],
  ['metadata country field', row => { row.metadata[0].additionalLocations = ['India'] }],
  ['role department country field', row => { if (row.departments) row.departments[0].additionalLocations = ['India'] }],
  ['native compliance criteria', row => { row.data_compliance[0].mandatoryRequirements = 'Mandatory security clearance' }],
  ['native AI disclaimer criteria', row => { if (Object.hasOwn(row, 'ai_disclaimer')) { row.ai_disclaimer = 'Mandatory security clearance'; row.include_ai_disclaimer = true } }],
]) test('Dialpad unreviewed nested ' + label + ' cannot certify a board India zero', async () => {
  const jobs = await replay((packet, url) => {
    if (!url.includes('boards-api')) return
    const value = JSON.parse(packet.html)
    const rows = url.endsWith('/offices') ? value.offices.flatMap(office => office.departments.flatMap(department => department.jobs)) : value.jobs || [value]
    for (const row of rows) if (row.id === 8880622002) mutate(row)
    packet.html = JSON.stringify(value)
  })
  assert.equal(assess(jobs).zeroJobEvidence, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.ok(jobs.nativeCollectionEvidence.failures.some(row => /schema|criteria|department/.test(row.reason)))
})

test('Dialpad an assigned office department country field cannot certify a board India zero', async () => {
  const jobs = await replay((packet, url) => {
    if (!url.endsWith('/offices')) return
    const value = JSON.parse(packet.html)
    for (const office of value.offices) for (const department of office.departments) {
      if (department.jobs.some(row => row.id === 8880622002)) department.additionalLocations = ['India']
    }
    packet.html = JSON.stringify(value)
  })
  assert.equal(assess(jobs).zeroJobEvidence, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const [label, open, close] of [
  ['closed native dialog', '<dialog>', '</dialog>'],
  ['collapsed native details', '<details><summary>More</summary>', '</details>'],
  ['unknown native class', '<div class="unreviewed-criteria-frame">', '</div>'],
]) test('Dialpad ' + label + ' cannot qualify originally authored criteria', async () => {
  const jobs = await replay((packet, url) => {
    if (!url.includes('boards-api') || !url.includes('/jobs')) return
    const value = JSON.parse(packet.html)
    for (const row of value.jobs || [value]) if (row.id === 8880622002) row.content = open + decodeHTML(row.content) + close
    packet.html = JSON.stringify(value)
  })
  assert.equal(assess(jobs).zeroJobEvidence, 'coverage-gap')
  assert.ok(jobs.nativeCollectionEvidence.failures.some(row => /criteria/.test(row.reason)))
})

test('Dialpad offscreen corporate authority handoff ancestry cannot certify the native board', async () => {
  await assert.rejects(replay((packet, url) => {
    if (!url.includes('www.dialpad.com') || url.includes('/_next/')) return
    const original = packet.html
    packet.html = original.replace('<body', '<body style="position:fixed;left:-9999px"')
    assert.notEqual(packet.html, original)
  }), /handoff|styling|visible|ancestor/i)
})

test('Dialpad a stylesheet displacing all corporate authority ancestry cannot certify the native board', async () => {
  await assert.rejects(replay((packet, url) => {
    if (url.includes('www.dialpad.com') && !url.includes('/_next/')) packet.html = packet.html.replace('</head>', '<style>body{position:fixed;left:-9999px}</style></head>')
  }), /authority|style|handoff|visible/i)
})

test('Dialpad a changed corporate stylesheet declaration requires current qualification', async () => {
  await assert.rejects(replay((packet, url) => {
    if (!url.includes('www.dialpad.com') || url.includes('/_next/')) return
    const original = packet.html
    packet.html = original.replace(/(<link\b(?=[^>]*rel="stylesheet")[^>]*href=")[^"]+/, '$1https://unreviewed.invalid/style.css')
    assert.notEqual(packet.html, original)
  }), /authority|style|handoff|declaration/i)
})

test('Dialpad changed bytes in its declared authority stylesheet cannot certify the native board', async () => {
  await assert.rejects(replay((packet, url) => {
    if (url.endsWith('/645859c2f2901802.css')) packet.html += '\nbody{position:fixed;left:-9999px}'
  }), /authority stylesheet bytes/i)
})

for (const [label, attrs] of [
  ['hidden', 'hidden rel="stylesheet"'],
  ['inert', 'inert rel="stylesheet"'],
  ['aria-hidden', 'aria-hidden="true" rel="stylesheet"'],
  ['uppercase relation', 'rel="STYLESHEET"'],
  ['entity relation whitespace', 'rel="&Tab;stylesheet"'],
  ['style preload', 'rel="preload" as="style" onload="this.rel=\'stylesheet\'"'],
]) test('Dialpad raw potential ' + label + ' stylesheet remains an unqualified authority declaration', async () => {
  await assert.rejects(replay((packet, url) => {
    if (url.includes('www.dialpad.com') && !url.includes('/_next/')) {
      packet.html = packet.html.replace('</head>', '<link ' + attrs + ' href="https://www.dialpad.com/_next/static/css/unreviewed.css"></head>')
    }
  }), /authority|stylesheet|declaration/i)
})

test('Dialpad final native membership after closing full details cannot be fabricated as a zero', async () => {
  const jobs = await replay((packet, url, visit) => {
    if (url.includes('/jobs?') && visit === 3) {
      const value = JSON.parse(packet.html); value.jobs.pop(); value.meta.total--; packet.html = JSON.stringify(value)
    }
  })
  assert.equal(assess(jobs).zeroJobEvidence, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Dialpad caller cancellation bounds an ignoring public reader', async () => {
  const original = globalThis.fetch, controller = new AbortController(), reason = { cancelled: 'dialpad' }
  globalThis.fetch = () => new Promise(() => {})
  try {
    const task = run({ signal: controller.signal }).then(() => null, value => value)
    setTimeout(() => controller.abort(reason), 5)
    const result = await Promise.race([task, new Promise(resolve => setTimeout(() => resolve('unbounded reader'), 60))])
    assert.equal(result, reason)
  } finally { globalThis.fetch = original }
})
