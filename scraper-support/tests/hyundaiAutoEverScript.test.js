import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadHyundaiAutoEverModule = async () => {
  try {
    return await import('../../scraper/hyundaiautoever/script.js')
  } catch {
    assert.fail('Expected Hyundai AutoEver scraper module at ../../scraper/hyundaiautoever/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'hyundaiautoever',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('Hyundai AutoEver scraper targets the official openings page and detail/apply URL patterns', async () => {
  const {
    APPLY_PAGE_URL,
    buildDetailUrl,
    buildApplyUrl,
  } = await loadHyundaiAutoEverModule()

  assert.equal(APPLY_PAGE_URL, 'https://career.hyundai-autoever.com/en/apply')
  assert.equal(
    buildDetailUrl(226439),
    'https://career.hyundai-autoever.com/en/o/226439',
  )
  assert.equal(
    buildApplyUrl(226439),
    'https://career.hyundai-autoever.com/en/o/226439/apply/new',
  )
})

test('extractNextData and extractOpenings read Hyundai AutoEver public openings from the official Next.js page', async () => {
  const {
    extractNextData,
    extractOpenings,
  } = await loadHyundaiAutoEverModule()
  const nextData = extractNextData(readFixture('apply-page.html'))
  const openings = extractOpenings(nextData)

  assert.equal(typeof nextData, 'object')
  assert.equal(openings.length, 34)
  assert.equal(openings[0].openingId, 226439)
  assert.match(openings[0].title, /IDC Architect/i)
})

test('openingHasIndiaLocation stays false for the currently visible Hyundai AutoEver openings', async () => {
  const {
    extractNextData,
    extractOpenings,
    openingHasIndiaLocation,
  } = await loadHyundaiAutoEverModule()
  const openings = extractOpenings(extractNextData(readFixture('apply-page.html')))

  assert.equal(openings.some((opening) => openingHasIndiaLocation(opening)), false)
})

test('run returns no jobs while Hyundai AutoEver has no India-visible public openings', async () => {
  const {
    APPLY_PAGE_URL,
    createHyundaiAutoEverScraper,
  } = await loadHyundaiAutoEverModule()
  const requestedUrls = []

  const jobs = await createHyundaiAutoEverScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === APPLY_PAGE_URL) return readFixture('apply-page.html')
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [APPLY_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('run fails closed when Hyundai AutoEver begins surfacing India roles', async () => {
  const {
    APPLY_PAGE_URL,
    createHyundaiAutoEverScraper,
  } = await loadHyundaiAutoEverModule()

  const indiaApplyHtml = readFixture('apply-page.html')
    .replace('대한민국', 'India')

  await assert.rejects(
    createHyundaiAutoEverScraper().run({
      fetchText: async (url) => {
        if (url === APPLY_PAGE_URL) return indiaApplyHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /India-visible openings/i,
  )
})
