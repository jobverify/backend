import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { createIntechCreativeServicesScraper, CAREERS_URL } from '../../scraper/intechcreativeservices/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const dir = new URL('./fixtures/intechcreativeservices/', import.meta.url)
const pages = await Promise.all([1, 2, 3].map(page => fs.readFile(new URL('careers-page-'+page+'.html', dir), 'utf8')))
const details = JSON.parse(await fs.readFile(new URL('details.json', dir), 'utf8'))
const rows = JSON.parse(await fs.readFile(new URL('inventory.json', dir), 'utf8'))
const firstUrl = rows[0].link
const fixedNow = () => '2026-10-09T20:00:00.000Z'
const fixtures = ({ transformPage = (_, html) => html, transformDetail = (_, html) => html, transformInventory = value => value } = {}) => {
  const calls = []
  return {
    calls,
    fetchText: async url => {
      calls.push(url)
      const page = url === CAREERS_URL ? 1 : Number(url.match(/\/career\/(\d+)\/$/)?.[1])
      if (page) return transformPage(page, pages[page - 1])
      assert.ok(details[url], 'Unexpected first-party request '+url)
      return transformDetail(url, details[url])
    },
    fetchInventory: async url => {
      calls.push(url)
      return transformInventory({ rows: structuredClone(rows), total: 23, totalPages: 1 })
    },
  }
}
const runFixture = (options = {}, scraperOptions = {}) => createIntechCreativeServicesScraper({ now: fixedNow, ...scraperOptions }).run(fixtures(options))

test('current INTECH grid follows all three pages and reconciles all 23 published identities', async () => {
  const mocked = fixtures()
  const jobs = await createIntechCreativeServicesScraper({ now: fixedNow }).run(mocked)
  assert.equal(jobs.length, 20)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 20)
  assert.ok(jobs.every(job => job.company === 'Intech Creative Services' && job.country === 'India' && job.sourceListingComplete === false))
  assert.ok(jobs.every(job => job.jobDescription.length >= 100))
  assert.ok(jobs.some(job => job.sourceUrl.includes('/career/jobs/senior-executive-implementation/')))
  assert.equal(mocked.calls.filter(url => /\/career\/(?:[23]\/)?$/.test(url)).length, 6)
  assert.equal(mocked.calls.filter(url => /\/(?:career\/)?jobs\//.test(url)).length, 23)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, 23)
  assert.equal(evidence.indiaFacetCount, null)
  assert.match(evidence.reason, /20386.*unverified-country/)
  assert.match(evidence.reason, /17285.*unverified-country.*description/)
  assert.match(evidence.reason, /15765.*unverified-country/)
  const remote = jobs.find(job => job.sourceUrl === firstUrl)
  assert.equal(remote.workplaceType, 'Remote')
  assert.equal(remote.city, null)
  assert.match(remote.jobDescription, /Location: India/)
  assert.match(remote.jobDescription, /Preferred Certifications/)
  assert.equal(remote.requisitionId, 'RRF/2026/10/3932')
})

test('caller caps retain the full 23-role reconciliation and preserve coverage gap', async () => {
  const jobs = await runFixture({}, { maxJobs: 2 })
  assert.equal(jobs.length, 2)
  assert.ok(jobs.every(job => job.sourceListingComplete === false))
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 23)
  assert.match(readInventoryEvidence(jobs).reason, /caller-cap/)
})

test('published total mismatch fails closed', async () => {
  await assert.rejects(runFixture({ transformInventory: value => ({ ...value, total: 24 }) }), /count|inventory/i)
})

test('a duplicate published identity fails closed', async () => {
  await assert.rejects(runFixture({ transformInventory: value => ({ ...value, rows: [...value.rows.slice(0, -1), value.rows[0]] }) }), /duplicate|inventory/i)
})

test('missing final-page card cannot silently truncate the inventory', async () => {
  await assert.rejects(runFixture({ transformPage: (page, html) => page === 3 ? html.replace(/<div data-elementor-type="loop-item"[\s\S]*?(?=<div data-elementor-type="loop-item"|<div class="e-load-more-anchor")/, '') : html }), /count|inventory/i)
})

test('foreign paging handoff fails closed', async () => {
  await assert.rejects(runFixture({ transformPage: (_, html) => html.replace('https://theintechgroup.com/career/2/', 'https://other-company.example/career/2/') }), /pag/i)
})

test('changed second inventory snapshot fails closed', async () => {
  let snapshots = 0
  const mocked = fixtures({ transformInventory: value => ++snapshots > 1 ? { ...value, rows: value.rows.slice(1), total: 22 } : value })
  await assert.rejects(createIntechCreativeServicesScraper().run(mocked), /changed|count|inventory/i)
})

test('role application identity mismatch fails closed', async () => {
  await assert.rejects(runFixture({ transformDetail: (url, html) => url === firstUrl ? html.replace('name="queried_id" value="20391"', 'name="queried_id" value="99999"') : html }), /identity|application/i)
})

test('conflicting native role location fails closed', async () => {
  const target = rows.find(row => row.link.includes('senior-software-engineer-10')).link
  await assert.rejects(runFixture({ transformDetail: (url, html) => url === target ? html.replace('Hyderabad', 'London') : html }), /location.*conflict|conflicting.*location/i)
})

test('unknown native location creates a coverage gap instead of an invented India job', async () => {
  const target = rows.find(row => row.link.includes('senior-software-engineer-10')).link
  const jobs = await runFixture({
    transformPage: (page, html) => page === 1 ? html.replace(/(e-loop-item-20390[\s\S]*?)Hyderabad/, '$1Atlantis') : html,
    transformDetail: (url, html) => url === target ? html.replace('Hyderabad', 'Atlantis') : html,
  })
  assert.equal(jobs.length, 19)
  assert.ok(!jobs.some(job => job.sourceUrl === target))
  assert.match(readInventoryEvidence(jobs).reason, /20390.*unverified-country/)
})

test('missing native job description creates a coverage gap without publishing card boilerplate', async () => {
  const jobs = await runFixture({ transformDetail: (url, html) => url === firstUrl ? html.replace(/(<h2[^>]*>Job Description<\/h2>[\s\S]*?<div[^>]*elementor-widget-text-editor[^>]*>)[\s\S]*?(?=\t{8}<\/div>)/, '$1') : html })
  assert.equal(jobs.length, 19)
  assert.ok(!jobs.some(job => job.sourceUrl === firstUrl))
  assert.match(readInventoryEvidence(jobs).reason, /20391.*description/)
})

test('unrelated employer landing page fails closed', async () => {
  await assert.rejects(runFixture({ transformPage: (_, html) => html.replace(/INTECH/g, 'Other Employer') }), /trusted.*surface|verified.*careers/i)
})

const fillLocation = html => html.replace(/(<h6[^>]*>Location:<\/h6>)/, '$1<div class="elementor-widget-text-editor">India</div>')
const completeOptions = {
  transformPage: (_, html) => {
    for (const id of [20386, 15765]) {
      const start = html.indexOf('e-loop-item-'+id)
      if (start < 0) continue
      const end = html.indexOf('data-elementor-type="loop-item"', start)
      html = html.slice(0, start)+fillLocation(html.slice(start, end < 0 ? html.length : end))+html.slice(end < 0 ? html.length : end)
    }
    return html
  },
  transformDetail: (url, html) => {
    if (/senior-software-engineer-6\/|manager-business-development\//.test(url)) html = fillLocation(html)
    if (url.endsWith('assistant-consultant-oracle-fusion-2/')) html = html.replace('Oracle Fusion HCM Consultant.', 'Location: India. Oracle Fusion HCM Consultant. Lead implementation workshops, configure business processes, support integrations and maintain production documentation.')
    return html
  },
}
test('fully specified future native inventory can report all 23 India jobs as complete', async () => {
  const jobs = await runFixture(completeOptions)
  assert.equal(jobs.length, 23)
  assert.ok(jobs.every(job => job.sourceListingComplete === true))
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 23)
})
test('a verified foreign role is excluded while its identity remains in the complete total', async () => {
  const target = rows.find(row => row.link.includes('senior-software-engineer-10')).link
  const jobs = await runFixture({
    transformPage: (page, html) => completeOptions.transformPage(page, html).replace(/(e-loop-item-20390[\s\S]*?)Hyderabad/, '$1London'),
    transformDetail: (url, html) => url === target ? html.replace('Hyderabad', 'London') : completeOptions.transformDetail(url, html),
  })
  assert.equal(jobs.length, 22)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 23)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 22)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
})
test('a cap on complete inventory retains its full India count and cannot claim completeness', async () => {
  const jobs = await runFixture(completeOptions, { maxJobs: 2 })
  assert.equal(jobs.length, 2)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 23)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.ok(jobs.every(job => job.sourceListingComplete === false))
})
