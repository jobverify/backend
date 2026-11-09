import assert from 'node:assert/strict'
import test from 'node:test'

const loadRVSystemsModule = async () => {
  try {
    return await import('../../scraper/rvsystems/script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>RV Systems Private Limited — AI-Based Facial Recognition, Condition Monitoring & Preventive Maintenance</title>
    </head>
    <body>
      <section id="about">
        <span>RV Systems Private Limited</span>
        <a href="#about">About</a>
        <a href="#contact">Contact</a>
      </section>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Organization","name":"RV Systems Private Limited","contactPoint":[{"@type":"ContactPoint","email":"contact@rvsystems.co.in","contactType":"customer support"}]}
      </script>
      <p>You can contact RV Systems at contact@rvsystems.co.in or visit our website https://www.rvsystems.co.in for more information and demo requests.</p>
    </body>
  </html>
`

test('official site signal and contact signal are present while public careers routes are absent', async () => {
  const rvSystems = await loadRVSystemsModule()
  assert.ok(rvSystems)

  assert.equal(rvSystems.hasOfficialSiteSignal(homepageHtml), true)
  assert.equal(rvSystems.hasContactSignal(homepageHtml), true)
  assert.equal(rvSystems.hasCareersSignal(homepageHtml), false)
})

test('run returns no jobs when RV Systems only exposes contact/demo information publicly', async () => {
  const rvSystems = await loadRVSystemsModule()
  assert.ok(rvSystems)

  const jobs = await rvSystems.createRVSystemsScraper().run({
    fetchText: async (url) => {
      assert.equal(url, rvSystems.CAREER_PAGE_URL)
      return homepageHtml
    },
  })

  assert.deepEqual(jobs, [])
})
