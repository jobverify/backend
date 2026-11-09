import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const loadCourtclikModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Courtclik scraper module at ./script.js')
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const homepageHtml = fs.readFileSync(path.join(currentDir, 'fixtures/homepage.html'), 'utf8')
const careersHtml = fs.readFileSync(path.join(currentDir, 'fixtures/careers.html'), 'utf8')

test('Courtclik scraper validates the original official page fixtures and their initial empty state', async () => {
  const courtclik = await loadCourtclikModule()

  assert.equal(courtclik.SOURCE, 'courtclik')
  assert.equal(courtclik.COMPANY, 'Courtclik')
  assert.equal(courtclik.HOMEPAGE_URL, 'https://www.courtclick.com/')
  assert.equal(courtclik.CAREERS_URL, 'https://www.courtclick.com/career')
  assert.equal(courtclik.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(courtclik.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(courtclik.hasZeroRolesEmptyState(careersHtml), true)
  assert.equal(courtclik.hasUnexpectedPublicJobsSignal(careersHtml), false)
})

test('Courtclik scraper returns no jobs after an explicitly empty controlled careers API inventory', async () => {
  const courtclik = await loadCourtclikModule()
  const requestedUrls = []

  const jobs = await courtclik.createCourtclikScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === courtclik.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === courtclik.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === courtclik.CAREERS_API_URL) {
        return { status: 200, url, html: '[]' }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [courtclik.HOMEPAGE_URL, courtclik.CAREERS_URL, courtclik.CAREERS_API_URL])
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 0)
})

test('Courtclik default page fetches are bounded with abort signals', async () => {
  const courtclik = await loadCourtclikModule()
  const originalFetch = globalThis.fetch
  const requests = []

  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), signal: init.signal })

    if (url === courtclik.HOMEPAGE_URL) {
      return { status: 200, url, text: async () => homepageHtml }
    }
    if (url === courtclik.CAREERS_URL) {
      return { status: 200, url, text: async () => careersHtml }
    }

    if (url === courtclik.CAREERS_API_URL) {
      return { status: 200, url, text: async () => '[]' }
    }

    assert.fail(`Unexpected Courtclik URL: ${url}`)
  }

  try {
    const jobs = await courtclik.createCourtclikScraper().run()

    assert.deepEqual(jobs, [])
    assert.deepEqual(requests.map(request => request.url), [courtclik.HOMEPAGE_URL, courtclik.CAREERS_URL, courtclik.CAREERS_API_URL])
    assert.ok(requests.every((request) => request.signal), 'each fetch should include an abort signal')
    assert.ok(requests.every((request) => typeof request.signal.aborted === 'boolean'))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('Courtclik scraper rejects changed official page identities and an unavailable careers API', async () => {
  const courtclik = await loadCourtclikModule()

  await assert.rejects(
    courtclik.createCourtclikScraper().run({
      fetchPage: async (url) => {
        if (url === courtclik.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Unexpected</title></head><body></body></html>',
          }
        }

        return { status: 200, url, html: careersHtml }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    courtclik.createCourtclikScraper().run({
      fetchPage: async (url) => {
        if (url === courtclik.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === courtclik.CAREERS_API_URL) {
          return { status: 503, url, html: '[]' }
        }

        return {
          status: 200,
          url,
          html: careersHtml.replace(
            'No roles found',
            '<a href="https://jobs.lever.co/courtclick">Apply now</a>',
          ),
        }
      },
    }),
    /careers API inventory is malformed or unavailable/i,
  )

  await assert.rejects(
    courtclik.createCourtclikScraper().run({
      fetchPage: async (url) => {
        if (url === courtclik.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        return {
          status: 200,
          url,
          html: careersHtml.replace(
            'Careers at Court Click - Join Our Legal-Tech Team | Court Click',
            'Unexpected careers page',
          ),
        }
      },
    }),
    /verified official careers/i,
  )
})

test('Courtclik initial empty HTML cannot qualify an absent, malformed, denied or redirected API response', async () => {
  const courtclik = await loadCourtclikModule()
  const unavailable = new Error('controlled careers API transport unavailable')
  const apiCases = [
    { error: unavailable },
    { status: 200, url: courtclik.CAREERS_API_URL, html: careersHtml },
    { status: 200, url: courtclik.CAREERS_API_URL, html: JSON.stringify({ error: 'Access denied' }) },
    { status: 403, url: courtclik.CAREERS_API_URL, html: '[]' },
    { status: 200, url: 'https://unrelated.example/api/careers', html: '[]' },
  ]
  for (const api of apiCases) {
    const requested = []
    await assert.rejects(courtclik.createCourtclikScraper().run({
      fetchPage: async url => {
        requested.push(url)
        if (url === courtclik.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === courtclik.CAREERS_URL) return { status: 200, url, html: careersHtml }
        assert.equal(url, courtclik.CAREERS_API_URL)
        if (api.error) throw api.error
        return api
      },
    }), error => api.error ? error === unavailable : /careers API inventory is malformed or unavailable/i.test(error.message))
    assert.deepEqual(requested, [courtclik.HOMEPAGE_URL, courtclik.CAREERS_URL, courtclik.CAREERS_API_URL])
  }
})
