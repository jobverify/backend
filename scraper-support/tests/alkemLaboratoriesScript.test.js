import assert from 'node:assert/strict'
import test from 'node:test'
import {nativeFixture} from '../../scraper/alkemlaboratories/nativeFixture.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const fixture=nativeFixture(new URL('../../scraper/alkemlaboratories/native20261103.test.js',import.meta.url))
globalThis.fetch=async()=>{throw Error('OFFLINE Alkem native source tripwire')}

const loadAlkemModule = async () => {
  try {
    return await import('../../scraper/alkemlaboratories/script.js')
  } catch {
    assert.fail('Expected Alkem Laboratories scraper module at ../../scraper/alkemlaboratories/script.js')
  }
}

const careersPageHtml = `
  <html>
    <head><title>Career | Alkem Laboratories</title></head>
    <body>
      <h1>Career</h1>
      <p>Build your career with Alkem Laboratories.</p>
      <a href="https://careers.alkemlabs.com/">Search Jobs</a>
    </body>
  </html>
`

test('Alkem Laboratories keeps corporate identity and current TurboHire handoff distinct from stale CMS host data', async () => {
  const alkem = await loadAlkemModule()

  assert.equal(alkem.CAREERS_PAGE_URL, 'https://www.alkemlabs.com/career')
  assert.equal(alkem.CAREERS_HANDOFF_URL, 'https://alkem.turbohire.co/')
  assert.equal(alkem.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(alkem.hasOfficialHandoffSignal(careersPageHtml), false)
  assert.equal(alkem.hasOfficialHandoffSignal(fixture.get('https://www.alkemlabs.com/_next/static/chunks/0t0u76_jp6cfa.js')),true)
})

test('Alkem Laboratories run verifies native current public zero and never reads the obsolete unreachable host', async () => {
  const alkem = await loadAlkemModule()
  const requestedUrls = []

  const jobs = await alkem.createAlkemLaboratoriesScraper().run({
    fetchPage: async (url,init) => {
      requestedUrls.push(url)
      return fixture.fetchPage(url,init)
    },
  })

  assert.equal(requestedUrls.filter(url=>url===alkem.CAREERS_PAGE_URL).length,2)
  assert.equal(requestedUrls.filter(url=>url===alkem.CAREERS_HANDOFF_URL).length,2)
  assert.equal(requestedUrls.some(url=>url.includes('careers.alkemlabs.com')),false)
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
})

test('Alkem Laboratories run fails closed when the official careers page or handoff changes', async () => {
  const alkem = await loadAlkemModule()

  await assert.rejects(
    alkem.createAlkemLaboratoriesScraper().run({
      fetchPage: async (url) => {
        if (url === alkem.CAREERS_PAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Careers</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /corporate|SearchJobs|Alkem/i,
  )

  await assert.rejects(
    alkem.createAlkemLaboratoriesScraper().run({
      fetchPage: async (url) => {
        if (url === alkem.CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersPageHtml }
        }

        if (url === alkem.CAREERS_HANDOFF_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Alkem Careers</h1><a href="/jobs">Jobs</a></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /SearchJobs|Alkem/i,
  )
})
