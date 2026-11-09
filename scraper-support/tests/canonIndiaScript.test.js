import assert from 'node:assert/strict'
import test from 'node:test'

const loadCanonIndiaModule = async () => {
  try {
    return await import('../../scraper/canonindia/script.js')
  } catch {
    assert.fail('Expected Canon India scraper module at ../../scraper/scraper/canonindia/script.js')
  }
}

const careerPageHtml = `
  <html>
    <head>
      <title>Careers - Canon India</title>
    </head>
    <body>
      <h1>Come Join Us</h1>
      <p>Canon is a global brand with an excellent business plan and workforce.</p>
      <a href="https://career.asia.canon">View Openings</a>
    </body>
  </html>
`

const oracleBoardHtml = `
  <html><head>
    <title>Canon Career Site</title>
    <base href="/en/sites/CX_1" data-apibaseurl="https://cmaonehr-iaeatj.fa.ocs.oraclecloud.com:443" data-sitenumber="CX_1" />
  </head><body><div class="app"></div></body></html>
`

const emptyInventory = JSON.stringify({
  items: [{ SiteNumber: 'CX_1', Location: null, TotalJobsCount: 0, requisitionList: [] }],
})

test('run verifies Canon India official Oracle board and its complete zero-job inventory', async () => {
  const canonIndia = await loadCanonIndiaModule()
  const requestedUrls = []

  const jobs = await canonIndia.createCanonIndiaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === canonIndia.CAREER_PAGE_URL) {
        return { status: 200, url, html: careerPageHtml }
      }

      if (url === canonIndia.EXTERNAL_PORTAL_URL) {
        return { status: 200, url: canonIndia.ORACLE_BOARD_URL, html: oracleBoardHtml }
      }

      if (url === canonIndia.ORACLE_LISTING_URL) {
        return { status: 200, url, html: emptyInventory }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    canonIndia.CAREER_PAGE_URL,
    canonIndia.EXTERNAL_PORTAL_URL,
    canonIndia.ORACLE_LISTING_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Canon India fails closed when the official Oracle inventory changes or becomes unavailable', async () => {
  const canonIndia = await loadCanonIndiaModule()

  for (const payload of [
    JSON.stringify({ items: [{ SiteNumber: 'CX_1', TotalJobsCount: 1, requisitionList: [{}] }] }),
    '<html>No Access</html>',
  ]) {
    await assert.rejects(
      canonIndia.createCanonIndiaScraper().run({
        fetchPage: async (url) => {
          if (url === canonIndia.CAREER_PAGE_URL) return { status: 200, url, html: careerPageHtml }
          if (url === canonIndia.EXTERNAL_PORTAL_URL) {
            return { status: 200, url: canonIndia.ORACLE_BOARD_URL, html: oracleBoardHtml }
          }
          if (url === canonIndia.ORACLE_LISTING_URL) return { status: 200, url, html: payload }
          throw new Error(`Unexpected URL: ${url}`)
        },
      }),
    )
  }
})

const singaporeJob = (id) => ({
  Id: String(id), Title: 'Admin Executive', PrimaryLocationCountry: 'SG',
  PrimaryLocation: 'Singapore', secondaryLocations: [],
})

const canonFixtureFetch = (canonIndia, inventories, requested = []) => async (url) => {
  requested.push(url)
  if (url === canonIndia.CAREER_PAGE_URL) return { status: 200, url, html: careerPageHtml }
  if (url === canonIndia.EXTERNAL_PORTAL_URL) return { status: 200, url: canonIndia.ORACLE_BOARD_URL, html: oracleBoardHtml }
  const offset = Number(url.match(/offset=(\d+)/)?.[1])
  if (!inventories.has(offset)) throw new Error('Unexpected inventory page: ' + url)
  return { status: 200, url, html: JSON.stringify({ items: [inventories.get(offset)] }) }
}

const singaporeInventory = (records, total, offset = 0) => ({
  SiteNumber: 'CX_1', Location: null, Offset: offset, Limit: 5,
  TotalJobsCount: total, requisitionList: records,
})

test('Canon verifies all pages of the current Singapore-only board before reporting no India jobs', async () => {
  const canonIndia = await loadCanonIndiaModule()
  const requested = []
  const jobs = await canonIndia.createCanonIndiaScraper().run({
    fetchPage: canonFixtureFetch(canonIndia, new Map([
      [0, singaporeInventory([1, 2, 3, 4, 5].map(singaporeJob), 9)],
      [5, singaporeInventory([6, 7, 8, 9].map(singaporeJob), 9, 5)],
    ]), requested),
  })
  assert.deepEqual(jobs, [])
  assert.equal(requested.filter(url => url.includes('recruitingCEJobRequisitions')).length, 2)
  assert.match(requested.at(-1), /offset=5$/)
})

test('Canon rejects incomplete or changing Singapore inventory and does not silently drop India jobs', async () => {
  const canonIndia = await loadCanonIndiaModule()
  for (const inventories of [
    new Map([[0, singaporeInventory([singaporeJob(1)], 9)]]),
    new Map([[0, singaporeInventory([1, 2, 3, 4, 5].map(singaporeJob), 9)], [5, singaporeInventory([5, 6, 7, 8].map(singaporeJob), 9, 5)]]),
    new Map([[0, singaporeInventory([1, 2, 3, 4, 5].map(singaporeJob), 9)], [5, singaporeInventory([6, 7, 8, 9].map(singaporeJob), 10, 5)]]),
    new Map([[0, singaporeInventory([{ ...singaporeJob(1), PrimaryLocationCountry: 'IN', PrimaryLocation: 'Mumbai, India' }], 1)]]),
    new Map([[0, singaporeInventory([{ ...singaporeJob(1), secondaryLocations: [{ Name: 'Mumbai, India' }] }], 1)]]),
    new Map([[0, { ...singaporeInventory([singaporeJob(1)], 1), SiteNumber: 'CX_2' }]]),
  ]) {
    await assert.rejects(canonIndia.createCanonIndiaScraper().run({ fetchPage: canonFixtureFetch(canonIndia, inventories) }), /Canon India Oracle career inventory changed or is unavailable/)
  }
})
