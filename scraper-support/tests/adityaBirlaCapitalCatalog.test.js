import assert from 'node:assert/strict'
import test from 'node:test'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import { selectScrapersForRun } from '../runner.js'

// A retired identity is not a runnable provider; this makes no native-source claim.
test('retired Aditya Birla Capital is excluded from the actual catalog and runner admission', () => {
  const catalog = getScraperCatalog(), scrapers = buildScrapers()
  assert.equal(catalog.some(row => row.source === 'adityabirlacapital'), false)
  assert.equal(scrapers.some(row => row.name === 'adityabirlacapital'), false)
  assert.throws(() => selectScrapersForRun(scrapers, { onlySources: 'adityabirlacapital', startAt: null, startAfter: null, firstN: null, dryRun: true }), /unknown|not found/i)
  const active = scrapers.find(row => row.name === 'adityabirlagroup')
  assert.ok(active)
  assert.deepEqual(selectScrapersForRun(scrapers, { onlySources: 'adityabirlagroup', startAt: null, startAfter: null, firstN: null, dryRun: true }).scrapers.map(row => row.name), ['adityabirlagroup'])
})

test('exact company coverage keeps the original Capital backlog unmatched and Group/Fashion identities separate', () => {
  const catalog = getScraperCatalog()
  const report = generateCompanyCoverageReport({ csvText: 'Aditya Birla Capital\n', catalog })
  assert.equal(report.matchedCount, 0)
  assert.equal(report.unmatchedCount, 1)
  assert.equal(report.unmatched[0].companyName, 'Aditya Birla Capital')
  const peers = generateCompanyCoverageReport({ csvText: 'Aditya Birla Group\nAditya Birla Fashion\n', catalog })
  assert.equal(peers.unmatchedCount, 0)
  assert.deepEqual(peers.matched.map(row => [row.companyName, row.source]), [
    ['Aditya Birla Group', 'adityabirlagroup'], ['Aditya Birla Fashion', 'adityabirlafashion'],
  ])
})
