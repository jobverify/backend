import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_SURFACE_HTML = `
  <html lang="en">
    <head>
      <title>BugBase</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="stylesheet" href="/_next/static/css/app.css" />
    </head>
    <body>
      <div id="__next"></div>
      <script src="/_next/static/chunks/main-app.js"></script>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/bugbase/script.js')
  } catch {
    assert.fail('Expected BugBase scraper module at ../../scraper/bugbase/script.js')
  }
}











// Current production extraction replaces the old always-empty contract.
registerCurrentRecruitmentContract('bugbase', 'workbookBatch06Bugbase')
