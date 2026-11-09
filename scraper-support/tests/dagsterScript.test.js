import { checkCurrentReplay, assertCurrentProvider } from '../native-sources/declaredJobFeeds/legacyReplayControls.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const OFFICIAL_HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
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
      <footer>
        <p>Copyright Â© 2026 Elementl, Inc. d.b.a. Dagster Labs. All rights reserved.</p>
      </footer>
    </main>
  </body>
</html>
`

const PREFECT_CAREERS_REDIRECT_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Prefect - Open Roles</title>
  </head>
  <body>
    <main>
      <h1>Careers at Prefect - Open Roles</h1>
      <p>Join the team building modern workflow orchestration.</p>
    </main>
  </body>
</html>
`

const GREENHOUSE_BOARD_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at Dagster Labs</title>
  </head>
  <body>
    <main>
      <h1>Current openings at Dagster Labs</h1>
      <p>There are no current openings.</p>
      <p>Powered by Greenhouse</p>
    </main>
  </body>
</html>
`

const GREENHOUSE_BOARD_WITH_ROLE_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Current openings at Dagster Labs</h1>
      <a href="/dagsterlabs/jobs/9999999">Software Engineer</a>
    </main>
  </body>
</html>
`

const loadDagsterModule = async () => {
  try {
    return await import('../../scraper/dagster/script.js')
  } catch {
    assert.fail('Expected Dagster scraper module at ../../scraper/dagster/script.js')
  }
}

test('Dagster pins the verified Dagster homepage, Prefect redirect, and empty Greenhouse board constants', async () => {
  const dagster = await loadDagsterModule()

  assert.equal(dagster.SOURCE, 'dagster')
  assert.equal(dagster.COMPANY_NAME, 'Dagster')
  assert.equal(dagster.OFFICIAL_BRAND_NAME, 'Dagster Labs')
  assert.equal(dagster.HOMEPAGE_URL, 'https://dagster.io/')
  assert.equal(dagster.CAREERS_URL, 'https://dagster.io/company/careers')
  assert.equal(dagster.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/dagsterlabs')
  assert.equal(dagster.hasOfficialHomepageSignal(OFFICIAL_HOMEPAGE_HTML), true)
  assert.equal(
    dagster.isVerifiedPrefectCareersRedirect({
      status: 200,
      url: 'https://www.prefect.io/careers',
      html: PREFECT_CAREERS_REDIRECT_HTML,
    }, dagster.CAREERS_URL),
    true,
  )
  assert.equal(dagster.hasEmptyGreenhouseBoardSignal(GREENHOUSE_BOARD_HTML), true)
})

test('dagster: current original-entity complete replay (legacy case 98)', async () => checkCurrentReplay('dagster', 'complete'))

test('dagster: current original-entity primary replay (legacy case 133)', async () => checkCurrentReplay('dagster', 'primary'))
