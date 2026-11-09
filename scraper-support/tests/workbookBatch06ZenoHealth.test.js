import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_SURFACE_HTML = `
  <html>
    <body>
      <main>
        <section>
          <h1>Vibrant. Energetic. Awesome.</h1>
          <p>
            Helping the world is perhaps the most rewarding way to grow in your
            career and life.
          </p>
          <h2>Meet Our Team</h2>
        </section>
        <section>
          <h2>Work culture at Zeno Health</h2>
          <p>Open, supportive, collaborative.</p>
        </section>
        <section>
          <h2>Join us.</h2>
          <a href="https://in.linkedin.com/company/zeno-health">
            View our LinkedIn page for current openings
          </a>
        </section>
      </main>
    </body>
  </html>
`

const CURRENT_SHELL_HTML = `
  <html>
    <head>
      <title>Zeno Health</title>
      <meta
        name="description"
        content="Zeno Health is a healthcare brand that makes medicines affordable and accessible to all, we are on a journey to educate Indians about the value of generic medicines"
      />
      <meta property="og:url" content="https://zeno.health">
    </head>
    <body>
      <script src="runtime.js"></script>
      <script src="main.js"></script>
    </body>
  </html>
`

const loadZenoHealthModule = async () => {
  try {
    return await import('../../scraper/zenohealth/script.js')
  } catch {
    assert.fail('Expected Zeno Health scraper module at ../../scraper/zenohealth/script.js')
  }
}













// Production extraction supersedes the former unconditional-empty contract.
registerCurrentRecruitmentContract('zenohealth', 'workbookBatch06ZenoHealth.test.js')

test('the captured Zeno Health shell and social handoff cannot certify empty current inventory', async () => {
  const module = await loadZenoHealthModule()
  for (const html of [VERIFIED_SURFACE_HTML, CURRENT_SHELL_HTML]) {
    await assert.rejects(module.run({ fetchPage: async url => ({ status: 200, url, html }) }), error => {
      assert.equal(error.failureKind, 'coverage_gap')
      assert.equal(error.recruitmentObservations.nativeRecords, 0)
      assert.equal(error.recruitmentObservations.sourceScopeComplete, false)
      return true
    })
  }
})
