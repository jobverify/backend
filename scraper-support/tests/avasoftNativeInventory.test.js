import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { createAvasoftScraper } from '../../scraper/avasoft/script.js'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { avasoftNativeOptions, avasoftVisibleOpenings } from './fixtures/avasoftNativeOptions.js'
const originalFetch = globalThis.fetch
before(() => { globalThis.fetch = async () => { throw Error('Implicit network request forbidden in captured Avasoft regressions') } })
after(() => { globalThis.fetch = originalFetch })
const execute = async (mutate = () => {}, extra = {}) => {
  const options = avasoftNativeOptions(mutate)
  return { jobs: await createAvasoftScraper().run({ ...options, ...extra }), options }
}
const visible = mutate => packet => { avasoftVisibleOpenings(packet); mutate?.(packet) }

test('Avasoft excludes all currently responsive-hidden cards without certifying an empty India inventory', async () => {
  const { jobs, options } = await execute()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.match(readInventoryEvidence(jobs).reason, /responsive-hidden/)
  assert.equal(options.calls.length, 20)
  assert.equal(options.calls.filter(call => /architect|trainee|executive|human-resource/.test(call.url)).length, 12)
  assert.ok(options.calls.every(call => call.method === 'GET'))
})

test('Avasoft supports reactivated India cards with full candidate criteria, benefits and interview content', async () => {
  const { jobs } = await execute(visible())
  assert.equal(jobs.length, 3)
  const job = jobs.find(job => job.jobId === 'trainee-engineer')
  assert.equal(job.country, 'India'); assert.equal(job.city, 'Chennai')
  assert.equal(job.requisitionId, null)
  assert.equal(job.employmentType, null)
  assert.equal(job.experienceRequired, null)
  assert.equal(job.postingDate, null)
  assert.equal(job.sourcePublicationDateUnavailable, true)
  assert.match(job.sourceDescription, /Who can apply\?[\s\S]*What are we looking for[\s\S]*What can a candidate expect[\s\S]*Interview Process:/)
  assert.match(job.sourceDescription, /Each intern will be provided with a new laptop/)
  assert.ok(job.sourceDescription.length > 1500)
  assert.equal(job.jobDescription, job.sourceDescription)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 6)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 3)
})

test('Avasoft preserves the actual career-enquiry method rather than inventing a role-specific application form', async () => {
  const { jobs } = await execute(visible())
  const job = jobs[0]
  assert.equal(job.applyUrl, 'https://avasoft.com/contact-us/')
  assert.equal(job.applicationMethod, 'career-enquiry')
  assert.equal(job.sourceNativeApplicationEvidence.careerEnquiryEmail, 'career@avasoft.com')
  assert.equal(job.sourceNativeApplicationEvidence.roleSpecificForm, false)
})

test('Avasoft does not substitute WordPress document metadata or the graduating-class year for job publication', async () => {
  const { jobs } = await execute(visible())
  assert.ok(jobs.every(job => job.postingDate === null && job.sourcePublicationDateUnavailable))
  assert.ok(jobs.every(job => job.sourceNativeDates.documentDatePublished && job.sourceNativeDates.documentDateModified))
  assert.match(jobs[0].sourceDescription, /2025 passing outstudents/)
})

test('Avasoft refuses another employer in the native organization metadata', async () => {
  await assert.rejects(execute(visible(packet => {
    if (packet.name === 'detail-3') packet.body = packet.body.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/,
      (all, start, raw, end) => { const value = JSON.parse(raw); value['@graph'].find(node => node['@type'] === 'Organization').name = 'Other Company'; return start + JSON.stringify(value) + end })
  })), /Avasoft.*(?:employer|identity)/i)
})

test('Avasoft rejects a native role title that differs from its current card', async () => {
  await assert.rejects(execute(visible(packet => {
    if (packet.name === 'detail-3') packet.body = packet.body.replace('>Trainee Engineer</h1>', '>Another Position</h1>')
  })), /Avasoft.*(?:title|identity)/i)
})

test('Avasoft rejects a different native country and city rather than filling the card location', async () => {
  await assert.rejects(execute(visible(packet => {
    if (packet.name === 'detail-3') packet.body = packet.body.replaceAll('Chennai, TN, India', 'Toronto, ON, Canada')
  })), /Avasoft.*(?:country|location|identity)/i)
})

test('Avasoft never defaults a Remote-only card and detail to India', async () => {
  const { jobs } = await execute(visible(packet => {
    packet.body = packet.body.replaceAll('Chennai, TN, India', 'Remote')
  }))
  assert.ok(!jobs.some(job => job.jobId === 'trainee-engineer'))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Avasoft accepts unfamiliar city labels only with explicit matching India country evidence', async () => {
  const { jobs } = await execute(visible(packet => { packet.body = packet.body.replaceAll('Chennai', 'Pune') }))
  assert.equal(jobs.length, 3)
  assert.ok(jobs.every(job => job.country === 'India' && job.city === 'Pune'))
})

test('Avasoft keeps a hidden candidate section nullable and incomplete rather than certifying the remaining paragraph', async () => {
  const { jobs } = await execute(visible(packet => {
    if (packet.name.endsWith('detail-3')) packet.body = packet.body.replace('data-id="b63cf22"', 'data-id="b63cf22" style="opacity:0"')
  }))
  const job = jobs.find(job => job.jobId === 'trainee-engineer')
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDescription, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Avasoft cannot certify a permanently invisible role body without its declared animation', async () => {
  const { jobs } = await execute(visible(packet => {
    if (packet.name.endsWith('detail-3')) packet.body = packet.body.replace(/<div\b[^>]*data-id="837c8c8"[^>]*>/,
      tag => tag.replace('fadeInUp', 'none'))
  }))
  assert.equal(jobs.find(job => job.jobId === 'trainee-engineer').sourceDetailComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Avasoft rejects an application destination that is not the role-declared employer career-enquiry page', async () => {
  await assert.rejects(execute(visible(packet => {
    if (packet.name === 'detail-3') packet.body = packet.body.replace(/<a\b[^>]*>[\s\S]*?<\/a>/g,
      tag => /Apply Here/.test(tag) ? tag.replace('href="/contact-us/"', 'href="https://other.example/apply"') : tag)
  })), /Avasoft.*(?:application|identity)/i)
})

test('Avasoft refuses a generic sales contact as the career-enquiry destination', async () => {
  await assert.rejects(execute(visible(packet => {
    if (packet.name.endsWith('-contact')) packet.body = packet.body.replaceAll('For career enquiries', 'For sales enquiries')
  })), /Avasoft.*(?:career|application|enquiry)/i)
})

test('Avasoft retains partial scope for a changed native loading client', async () => {
  const { jobs } = await execute(visible(packet => {
    if (packet.name.endsWith('-careers')) packet.body = packet.body.replaceAll('var LoadMorePushAjax=function', 'var changedClient=true;var LoadMorePushAjax=function')
  }))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Avasoft retains partial scope for an activated job-loading target', async () => {
  const { jobs } = await execute(visible(packet => {
    if (packet.name.endsWith('-careers')) packet.body = packet.body.replace('</main>', '<button class="ald-ajax-btn" data-alm-click-selector=".open-position">Load more jobs</button></main>')
  }))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const [label, markup] of [
  ['Workday account', '<a href="https://avasoft.wd5.myworkdayjobs.com/External">Learn More</a>'],
  ['unassigned role page', '<h4><a href="/another-position/">Another Position</a></h4>'],
  ['recruiting frame', '<iframe src="https://example.com/jobs"></iframe>'],
]) test('Avasoft retains partial evidence for an additional ' + label, async () => {
  const { jobs } = await execute(visible(packet => {
    if (packet.name.endsWith('-careers')) packet.body = packet.body.replace('</main>', markup + '</main>')
  }))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Avasoft excludes a role hidden again in the closing career inventory', async () => {
  const { jobs } = await execute(packet => { if (packet.name !== 'closing-careers') avasoftVisibleOpenings(packet) })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Avasoft applies output caps only after all discovered details and closing application checks', async () => {
  const { jobs, options } = await execute(visible(), { maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(options.calls.length, 20)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('Avasoft registered execution preserves incomplete inventory evidence for current hidden cards', async () => {
  const jobs = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'avasoft')).run(avasoftNativeOptions())
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('Avasoft propagates caller cancellation before any native request', async () => {
  const options = avasoftNativeOptions(), controller = new AbortController()
  controller.abort(Error('Avasoft caller cancelled'))
  await assert.rejects(createAvasoftScraper().run({ ...options, signal: controller.signal }), /caller cancelled/)
  assert.equal(options.calls.length, 0)
})

test('Avasoft cannot reactivate a dormant card through an unrelated visible link to the same URL', async () => {
  const { jobs } = await execute(packet => {
    if (packet.name.endsWith('-careers')) packet.body = packet.body.replace('</main>', '<a href="/trainee-engineer/">Learn more</a></main>')
  })
  assert.equal(jobs.length, 0)
})

for (const attributes of ['type="application/json"', 'nomodule']) test('Avasoft does not qualify animation content through a non-executable frontend: ' + attributes, async () => {
  const { jobs } = await execute(visible(packet => {
    if (packet.name.endsWith('detail-3')) packet.body = packet.body.replace(/<script\b([^>]*src="https:\/\/avasoft\.com\/wp-content\/plugins\/elementor\/assets\/js\/frontend(?:-modules)?\.min\.js\?ver=4\.3\.5"[^>]*)>/g,
      (all, attrs) => '<script ' + attrs.replace(/\btype="[^"]*"/g, '') + ' ' + attributes + '>')
  }))
  assert.equal(jobs.find(job => job.jobId === 'trainee-engineer').sourceDetailComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

const addRoleMetadata = (packet, mutate) => {
  if (!packet.name.endsWith('detail-3')) return
  const metadata = { '@context': 'https://schema.org', '@type': 'JobPosting', title: 'Trainee Engineer', url: 'https://avasoft.com/trainee-engineer/',
    hiringOrganization: { name: 'AVASOFT', sameAs: 'https://avasoft.com/' },
    jobLocation: { address: { addressLocality: 'Chennai', addressRegion: 'TN', addressCountry: 'IN' } } }
  mutate(metadata)
  packet.body = packet.body.replace('</head>', '<script type="application/ld+json">' + JSON.stringify(metadata) + '</script></head>')
}
for (const [label, mutate] of [
  ['another employer', metadata => { metadata.hiringOrganization = { name: 'Other Employer', sameAs: 'https://other.example/' } }],
  ['another country', metadata => { metadata.jobLocation.address = { addressLocality: 'Toronto', addressCountry: 'CA' } }],
  ['another city in the same country', metadata => { metadata.jobLocation.address.addressLocality = 'Pune' }],
]) test('Avasoft rejects role-owned structured metadata declaring ' + label, async () => {
  await assert.rejects(execute(visible(packet => addRoleMetadata(packet, mutate))), /Avasoft.*(?:employer|country|location|city|identity)/i)
})

test('Avasoft preserves an explicitly bound native job date when one becomes available', async () => {
  const { jobs } = await execute(visible(packet => addRoleMetadata(packet, metadata => { metadata.datePosted = '2024-10-01' })))
  const job = jobs.find(job => job.jobId === 'trainee-engineer')
  assert.equal(job.postingDate, '2024-10-01')
  assert.equal(job.sourcePublicationDateUnavailable, false)
  assert.equal(job.sourceNativeDates.originalJobPublicationDate, '2024-10-01')
})

test('Avasoft excludes records when the closing career-enquiry destination changes', async () => {
  const { jobs } = await execute(visible(packet => {
    if (packet.name === 'closing-contact') packet.body = packet.body.replaceAll('career@avasoft.com', 'recruiting@avasoft.com')
  }))
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Avasoft excludes a role whose complete native content changes in the closing snapshot', async () => {
  const { jobs } = await execute(visible(packet => {
    if (packet.name === 'closing-detail-3') packet.body = packet.body.replace('Each intern will be provided with a new laptop', 'Each intern will be provided with a secure workstation')
  }))
  assert.equal(jobs.length, 2)
  assert.ok(!jobs.some(job => job.jobId === 'trainee-engineer'))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Avasoft does not accept a nomodule-only loading client as current executable loading proof', async () => {
  const { jobs } = await execute(visible(packet => {
    if (packet.name.endsWith('-careers')) packet.body = packet.body.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/g,
      (all, start, body, end) => body.includes('LoadMorePushAjax') ? start.replace('<script', '<script nomodule') + body + end : all)
  }))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Avasoft excludes an explicitly expired role even while its card remains visible', async () => {
  const { jobs } = await execute(visible(packet => addRoleMetadata(packet, metadata => { metadata.validThrough = '2025-02-01T00:00:00Z' })))
  assert.equal(jobs.length, 2)
  assert.ok(!jobs.some(job => job.jobId === 'trainee-engineer'))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Avasoft preserves a qualified future native deadline without substituting document modification', async () => {
  const { jobs } = await execute(visible(packet => addRoleMetadata(packet, metadata => { metadata.validThrough = '2099-02-01T00:00:00Z' })))
  const job = jobs.find(job => job.jobId === 'trainee-engineer')
  assert.equal(job.closingDate, '2099-02-01T00:00:00.000Z')
  assert.equal(job.sourceNativeDates.originalJobValidThrough, '2099-02-01T00:00:00Z')
})

test('Avasoft excludes a role whose native deadline changes in the closing document', async () => {
  const { jobs } = await execute(visible(packet => addRoleMetadata(packet, metadata => {
    metadata.validThrough = packet.name.startsWith('closing-') ? '2099-03-01T00:00:00Z' : '2099-02-01T00:00:00Z'
  })))
  assert.equal(jobs.length, 2)
  assert.ok(!jobs.some(job => job.jobId === 'trainee-engineer'))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Avasoft retains calendar-day expiry precision and unresolved timezone instead of inventing a deadline clock', async () => {
  const { jobs } = await execute(visible(packet => addRoleMetadata(packet, metadata => { metadata.validThrough = '2099-02-01' })))
  const job = jobs.find(job => job.jobId === 'trainee-engineer')
  assert.equal(job.closingDate, '2099-02-01')
  assert.equal(job.sourceNativeDates.closingTimezoneUnavailable, true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
