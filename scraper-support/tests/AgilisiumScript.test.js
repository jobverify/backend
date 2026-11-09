import { makeZohoFixture, zohoFixtureOptions } from './fixtures/zohoNativeOptions.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html><head><title>Careers at Agilisium | Life Sciences AI &amp; Data Jobs</title></head>
<body>
  <a href="https://agilisium.zohorecruit.com/jobs/Careers">view current openings</a>
  <a href="https://agilisium.zohorecruit.com/jobs/Careers">EXPLORE OPEN ROLES</a>
</body></html>
`

const boardHtml = `
<!doctype html>
<html>
<head>
  <title>Jobs at Agilisium</title>
  <meta name="description" content="Everyone at Agilisium is free to explore and work the way you want. Come join us!">
  <meta property="og:url" content="https://agilisium.zohorecruit.com/jobs/Careers">
</head>
<body>
  <div id="meta"></div>
  <script>
    window.__INITIAL_STATE__ = {
      "page_name":"Careers",
      "list_url":"https://agilisium.zohorecruit.com/jobs/Careers",
      "_no_longer":"openings"
    };
  </script>
</body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/agilisium/script.js')
  } catch {
    assert.fail('Expected Agilisium scraper module at ../../scraper/agilisium/script.js')
  }
}

test('Agilisium validators stay pinned to the verified careers handoff from Friday, July 17, 2026', async () => {
  const agilisium = await loadModule()
  assert.equal(agilisium.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(agilisium.hasVerifiedBoardSignal(boardHtml), true)
})

test('Agilisium factory recovers full native India details instead of returning an empty sentinel', async () => {
  const agilisium = await loadModule(), data = makeZohoFixture('agilisium')
  const jobs = await agilisium.createAgilisiumScraper().run(zohoFixtureOptions(data))
  assert.equal(jobs.length, 1)
  assert.match(jobs[0].jobDescription, /payment infrastructure/)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})
