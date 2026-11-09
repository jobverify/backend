import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadSuyatiModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Suyati Technologies scraper module at ./script.js')
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const milestoneHomepageHtml = fs.readFileSync(path.join(currentDir, 'fixtures/milestone-homepage.html'), 'utf8')
const milestoneHistoryHtml = fs.readFileSync(path.join(currentDir, 'fixtures/milestone-history.html'), 'utf8')
const milestoneCareersHtml = fs.readFileSync(path.join(currentDir, 'fixtures/milestone-careers.html'), 'utf8')
const milestoneJobsBoardHtml = fs.readFileSync(path.join(currentDir, 'fixtures/milestone-jobs-board.html'), 'utf8')

test('Suyati Technologies scraper validates the verified Milestone handoff and zero-job parent careers surfaces', async () => {
  const suyati = await loadSuyatiModule()

  assert.equal(suyati.SOURCE, 'suyatitechnologies')
  assert.equal(suyati.COMPANY, 'Suyati Technologies')
  assert.equal(suyati.HOMEPAGE_URL, 'https://suyati.com/')
  assert.equal(suyati.HOMEPAGE_REDIRECT_URL, 'https://milestone.tech/')
  assert.equal(suyati.ACQUISITION_HISTORY_URL, 'https://milestone.tech/company/corporate-overview/history/')
  assert.equal(suyati.PARENT_CAREERS_URL, 'https://milestone.tech/careers/join-the-team/')
  assert.equal(
    suyati.PARENT_OPEN_POSITIONS_URL,
    'https://phf.tbe.taleo.net/phf01/ats/careers/v2/searchResults?cws=37&org=COVESTIC2',
  )
  assert.equal(suyati.isExpectedHomepageRedirectUrl('https://milestone.tech/'), true)
  assert.equal(suyati.hasParentHomepageSignal(milestoneHomepageHtml), true)
  assert.equal(suyati.hasAcquisitionHistorySignal(milestoneHistoryHtml), true)
  assert.equal(suyati.hasParentCareersSignal(milestoneCareersHtml), true)
  assert.equal(suyati.hasParentOpenPositionsSignal(milestoneJobsBoardHtml), true)
  assert.equal(suyati.hasBrandSpecificOpeningsSignal(milestoneCareersHtml), false)
  assert.equal(suyati.hasBrandSpecificOpeningsSignal(milestoneJobsBoardHtml), false)
})

test('Suyati Technologies scraper returns no jobs while the Milestone handoff remains generic', async () => {
  const suyati = await loadSuyatiModule()
  const requestedUrls = []

  const jobs = await suyati.createSuyatiTechnologiesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === suyati.HOMEPAGE_URL) {
        return {
          status: 200,
          finalUrl: suyati.HOMEPAGE_REDIRECT_URL,
          url: suyati.HOMEPAGE_REDIRECT_URL,
          html: milestoneHomepageHtml,
        }
      }

      if (url === suyati.ACQUISITION_HISTORY_URL) {
        return {
          status: 200,
          finalUrl: url,
          url,
          html: milestoneHistoryHtml,
        }
      }

      if (url === suyati.PARENT_CAREERS_URL) {
        return {
          status: 200,
          finalUrl: url,
          url,
          html: milestoneCareersHtml,
        }
      }

      if (url === suyati.PARENT_OPEN_POSITIONS_URL) {
        return {
          status: 200,
          finalUrl: url,
          url,
          html: milestoneJobsBoardHtml,
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    suyati.HOMEPAGE_URL,
    suyati.ACQUISITION_HISTORY_URL,
    suyati.PARENT_CAREERS_URL,
    suyati.PARENT_OPEN_POSITIONS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Suyati Technologies scraper fails closed when the redirect or brand-specific opening contract drifts', async () => {
  const suyati = await loadSuyatiModule()

  await assert.rejects(
    suyati.createSuyatiTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === suyati.HOMEPAGE_URL) {
          return {
            status: 200,
            finalUrl: 'https://example.com/',
            url: 'https://example.com/',
            html: milestoneHomepageHtml,
          }
        }

        if (url === suyati.ACQUISITION_HISTORY_URL) {
          return {
            status: 200,
            finalUrl: url,
            url,
            html: milestoneHistoryHtml,
          }
        }

        if (url === suyati.PARENT_CAREERS_URL) {
          return {
            status: 200,
            finalUrl: url,
            url,
            html: milestoneCareersHtml,
          }
        }

        return {
          status: 200,
          finalUrl: url,
          url,
          html: milestoneJobsBoardHtml,
        }
      },
    }),
    /official homepage handoff/i,
  )

  await assert.rejects(
    suyati.createSuyatiTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === suyati.HOMEPAGE_URL) {
          return {
            status: 200,
            finalUrl: suyati.HOMEPAGE_REDIRECT_URL,
            url: suyati.HOMEPAGE_REDIRECT_URL,
            html: milestoneHomepageHtml,
          }
        }

        if (url === suyati.ACQUISITION_HISTORY_URL) {
          return {
            status: 200,
            finalUrl: url,
            url,
            html: milestoneHistoryHtml.replace('acquires Suyati Technologies', 'acquires Another Company'),
          }
        }

        if (url === suyati.PARENT_CAREERS_URL) {
          return {
            status: 200,
            finalUrl: url,
            url,
            html: milestoneCareersHtml,
          }
        }

        return {
          status: 200,
          finalUrl: url,
          url,
          html: milestoneJobsBoardHtml,
        }
      },
    }),
    /acquisition history/i,
  )

  await assert.rejects(
    suyati.createSuyatiTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === suyati.HOMEPAGE_URL) {
          return {
            status: 200,
            finalUrl: suyati.HOMEPAGE_REDIRECT_URL,
            url: suyati.HOMEPAGE_REDIRECT_URL,
            html: milestoneHomepageHtml,
          }
        }

        if (url === suyati.ACQUISITION_HISTORY_URL) {
          return {
            status: 200,
            finalUrl: url,
            url,
            html: milestoneHistoryHtml,
          }
        }

        if (url === suyati.PARENT_CAREERS_URL) {
          return {
            status: 200,
            finalUrl: url,
            url,
            html: milestoneCareersHtml,
          }
        }

        return {
          status: 200,
          finalUrl: url,
          url,
          html: milestoneJobsBoardHtml.replace(
            '</body>',
            '<section><h2>Suyati Technologies Open Positions</h2></section></body>',
          ),
        }
      },
    }),
    /brand-specific openings/i,
  )
})
