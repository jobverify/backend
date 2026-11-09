import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head><title>Batt:RE | Electric Mobility</title></head>
  <body>
    <main>
      <h1>Batt:RE Electric Mobility</h1>
      <p>Electric scooters and electric cycles for India.</p>
    </main>
  </body>
</html>
`

test('BattRE Electric provider covers only the literal CSV company name', async () => {
  const { BATTRE_ELECTRIC_CATALOG } = await import('./catalog.js')
  const exactReport = generateCompanyCoverageReport({
    csvText: 'company_name\nBattRE Electric\n',
    catalog: [BATTRE_ELECTRIC_CATALOG],
    aliasMap: {},
  })
  const nearNameReport = generateCompanyCoverageReport({
    csvText: 'company_name\nBattRE Mobility\n',
    catalog: [BATTRE_ELECTRIC_CATALOG],
    aliasMap: {},
  })

  assert.equal(BATTRE_ELECTRIC_CATALOG.source, 'battreelectric')
  assert.equal(BATTRE_ELECTRIC_CATALOG.companyName, 'BattRE Electric')
  assert.equal(BATTRE_ELECTRIC_CATALOG.exactCompanyMatchOnly, true)
  assert.equal(exactReport.matchedCount, 1)
  assert.equal(exactReport.matched[0].source, 'battreelectric')
  assert.equal(nearNameReport.matchedCount, 0)
  assert.equal(nearNameReport.unmatchedCount, 1)
})

test('BattRE Electric returns no jobs only after validating the official first-party homepage', async () => {
  const battreElectric = await import('./script.js')

  assert.equal(battreElectric.hasVerifiedOfficialSurface(officialHomepageHtml), true)
  assert.deepEqual(
    await battreElectric.createBattreelectricScraper().run({
      fetchText: async (url) => {
        assert.equal(url, battreElectric.HOMEPAGE_URL)
        return officialHomepageHtml
      },
    }),
    [],
  )

  await assert.rejects(
    battreElectric.createBattreelectricScraper().run({
      fetchText: async () => '<title>Unrelated company</title>',
    }),
    /verified first-party surface changed materially/i,
  )
})

test('BattRE Electric dry runs return no unverified jobs without contacting an unavailable homepage', async () => {
  const battreElectric = await import('./script.js')

  assert.deepEqual(
    await battreElectric.run({
      dryRun: true,
      fetchText: async () => assert.fail('dry run must not request the official homepage'),
    }),
    [],
  )
})
