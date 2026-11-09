import {replay as currentReplay} from '../../scraper-support/native-sources/publicNativeGetSources/fixtureReplay.js'
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BOARD_URL,
  COMPANY,
  JOBS_FEED_URL,
  OFFICIAL_HOSTNAMES,
  SOURCE,
  WIDGET_API_URL,
  createDunzoScraper,
  hasOfficialJobsFeedSignal,
  hasOnlyLoopbackAddresses,
  hasWidgetApiSignal,
  hasWorkableBoardSignal,
} from './script.js'

const boardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>dunzo - Current Openings</title>
    <link rel="canonical" href="https://apply.workable.com/dunzo/"/>
    <meta name="subdomain" content="dunzo"/>
  </head>
  <body>
    <script>window.careers = {"jobs":[]};</script>
  </body>
</html>
`

const jobsFeedMarkdown = `
# dunzo — All Open Positions

> Last updated: 2026-08-02

| Title | Department | Location | Type | Salary | Posted | Details |
|-------|-----------|----------|------|--------|--------|---------|

---
Powered by [Workable](https://www.workable.com)
`

const widgetPayload = {
  name: 'dunzo',
  description: '',
  jobs: [],
}

test('Dunzo verified Workable surfaces accept the current empty-feed format', () => {
  assert.equal(SOURCE, 'dunzo')
  assert.equal(COMPANY, 'Dunzo')
  assert.equal(BOARD_URL, 'https://apply.workable.com/dunzo/')
  assert.equal(JOBS_FEED_URL, 'https://apply.workable.com/dunzo/jobs.md')
  assert.equal(WIDGET_API_URL, 'https://apply.workable.com/api/v1/widget/accounts/dunzo')
  assert.deepEqual(OFFICIAL_HOSTNAMES, ['dunzo.com', 'www.dunzo.com'])
  assert.equal(hasOnlyLoopbackAddresses(['127.0.0.1', '::1']), true)
  assert.equal(hasWorkableBoardSignal({ status: 200, url: BOARD_URL, html: boardHtml }), true)
  assert.equal(hasOfficialJobsFeedSignal(jobsFeedMarkdown), true)
  assert.equal(hasWidgetApiSignal(widgetPayload), true)
})



test('Dunzo current GET factory retains a primary hold without requiring loopback DNS as success',async()=>{const r=currentReplay(),jobs=await createDunzoScraper().run(r.options);assert.equal(jobs.length,0);assert.equal(r.audits.length,1);assert.equal(r.audits[0].employerBindingQualified,false);assert.equal(r.audits[0].sourceScopeComplete,false)})
