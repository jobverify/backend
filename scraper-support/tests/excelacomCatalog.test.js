import assert from 'node:assert/strict'
import test from 'node:test'

globalThis.fetch = async () => { throw new Error('OFFLINE NETWORK TRIPWIRE') }
const {
  buildScrapers,
  createCatalogScraper,
  getScraperCatalog,
} = await import('../providers/index.js')

test('getScraperCatalog binds the Excelacom native script to corporate careers metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'excelacom')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'oracle-taleo')
  assert.equal(provider.companyName, 'Excelacom')
  assert.equal(provider.companyCareerPage, 'https://www.excelacom.com/careers.html')
  assert.equal(provider.companyDomain, 'excelacom.com')
  assert.match(provider.modulePath, /excelacom[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Excelacom scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'excelacom')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'excelacom')
  assert.equal(scraper.provider.atsPlatform, 'oracle-taleo')
  assert.match(scraper.dryRunFile, /excelacom[\\/]jobs\.json$/)
})

test('the selected catalog provider imports and executes the real native scraper with injected offline transport', async () => {
  const provider = getScraperCatalog().find(item => item.source === 'excelacom')
  const calls = []
  await assert.rejects(createCatalogScraper(provider).run({ fetchText: async url => {
    calls.push(url)
    return '<h1>Corporate careers with the native binding removed</h1>'
  } }), /official careers binding/)
  assert.deepEqual(calls, ['https://www.excelacom.com/careers.html'])
})
