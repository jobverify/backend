import { checkCurrentReplay, assertCurrentProvider } from '../../scraper-support/native-sources/declaredJobFeeds/legacyReplayControls.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const homepageHtml = `
<!doctype html>
<html>
  <head>
    <title>Modern Data Orchestrator Platform | Dagster</title>
  </head>
  <body>
    <p>AI-native DataOps platform</p>
    <h1>Data your team trusts. AI that runs on it.</h1>
    <p>
      Dagster is the operational layer that structures how data is built, observed, and delivered,
      so both teams and AI agents can rely on it.
    </p>
    <a href="https://dagster.plus/">Get started for free</a>
  </body>
</html>
`

const prefectCareersHtml = `
<!doctype html>
<html>
  <head>
    <title>Careers at Prefect - Open Roles</title>
  </head>
  <body>
    <h1>Join the team defining the future of workflow automation</h1>
    <h2>Open roles</h2>
    <p>Loading open roles...</p>
  </body>
</html>
`

const emptyGreenhouseHtml = `
<!doctype html>
<html>
  <head>
    <title>Jobs at Dagster Labs</title>
  </head>
  <body>
    <h1>Current openings at Dagster Labs</h1>
    <p>There are no current openings.</p>
    <p>Powered by Greenhouse</p>
  </body>
</html>
`

test('Dagster recognizes the current homepage, Prefect careers redirect, and empty exact-name Greenhouse board', async () => {
  const dagster = await loadModule()

  assert.equal(dagster.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(
    dagster.isVerifiedPrefectCareersRedirect({
      url: 'https://www.prefect.io/careers',
      html: prefectCareersHtml,
    }),
    true,
  )
  assert.equal(dagster.hasEmptyGreenhouseBoardSignal(emptyGreenhouseHtml), true)
})

test('dagster: current original-entity complete replay (legacy case 66)', async () => checkCurrentReplay('dagster', 'complete'))
