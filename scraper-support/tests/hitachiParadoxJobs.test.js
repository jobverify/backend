import assert from 'node:assert/strict'
import test from 'node:test'

import { fetchHitachiParadoxJobs } from '../shared/hitachiParadoxJobs.js'
import { run as runHitachiIndia } from '../../scraper/hitachiindia/script.js'
import { run as runHitachiVantaraIndia } from '../../scraper/hitachivantaraindia/script.js'

const job = (id, legalName) => ({
  requisitionID: id,
  title: 'Example Role ' + id,
  brandName: 'Hitachi Vantara Global',
  locations: [{ city: 'Hyderabad', state: 'Telangana', country: 'India', locationText: 'Hyderabad, Telangana, India' }],
  applyURL: 'https://hitachi.wd1.myworkdayjobs.com/hitachi/job/Hyderabad/Example_' + id + '/apply',
  originalURL: 'example-role/job/' + id,
  customFields: [{ cfKey: 'cf_legal_name', value: legalName }],
})
const page = (jobs, total, number) => '<script>window.__PRELOAD_STATE__ = ' + JSON.stringify({
  jobSearch: {
    params: { filter: { brand: ['Hitachi Vantara Global'], country: ['India'] }, page_number: String(number) },
    totalJob: total,
    jobs,
  },
}) + '; window.__BUILD__ = "test";</script>'

test('Hitachi Paradox feed reads every page and retains only the exact India legal entity', async () => {
  const pages = [
    page([job('R1', 'HITACHI VANTARA INDIA PRIVATE LIMITED'), job('R2', 'HITACHI VANTARA LLC')], 3, 1),
    page([job('R3', 'HITACHI VANTARA INDIA PRIVATE LIMITED')], 3, 2),
  ]
  const urls = []
  const jobs = await fetchHitachiParadoxJobs({
    brand: 'Hitachi Vantara Global',
    country: 'India',
    legalName: 'HITACHI VANTARA INDIA PRIVATE LIMITED',
    pageSize: 2,
    fetchText: async (url) => {
      urls.push(url)
      return pages[urls.length - 1]
    },
  })
  assert.deepEqual(jobs.map((item) => item.requisitionID), ['R1', 'R3'])
  assert.equal(urls.length, 2)
  assert.ok(urls[0].includes('filter%5Bbrand%5D%5B0%5D=Hitachi+Vantara+Global'))
  assert.ok(urls[1].includes('page_number=2'))
})

test('Hitachi Paradox feed rejects a partial listing', async () => {
  await assert.rejects(fetchHitachiParadoxJobs({
    brand: 'Hitachi Vantara Global',
    country: 'India',
    legalName: 'HITACHI VANTARA INDIA PRIVATE LIMITED',
    pageSize: 10,
    fetchText: async () => page([job('R1', 'HITACHI VANTARA INDIA PRIVATE LIMITED')], 2, 1),
  }), /incomplete|count/i)
})

test('Hitachi India and Vantara India recover from retired search routes with exact company jobs', async () => {
  for (const [run, brand, legalName] of [
    [runHitachiIndia, 'Hitachi India Pvt. Ltd', 'HITACHI INDIA PVT. LTD'],
    [runHitachiVantaraIndia, 'Hitachi Vantara Global', 'HITACHI VANTARA INDIA PRIVATE LIMITED'],
  ]) {
    const role = { ...job('R12345', legalName), brandName: brand }
    const html = '<script>window.__PRELOAD_STATE__ = ' + JSON.stringify({
      jobSearch: {
        params: { filter: { brand: [brand], country: ['India'] }, page_number: 1 },
        totalJob: 1,
        jobs: [role],
      },
    }) + '; window.__BUILD__ = "test";</script>'
    const jobs = await run({
      useLegacySearchPage: true,
      fetchPage: async (url) => ({ status: 404, url, html: '' }),
      fetchText: async (url) => {
        assert.ok(url.startsWith('https://careers.hitachi.com/jobs?'))
        return html
      },
      now: () => '2026-10-03T00:00:00.000Z',
    })
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].jobId, 'R12345')
    assert.equal(jobs[0].country, 'India')
    assert.equal(jobs[0].scrapedAt, '2026-10-03T00:00:00.000Z')
  }
})
