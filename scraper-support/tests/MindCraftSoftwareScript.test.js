import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Build your career and experience rewarding opportunities at MindCraft | MindCraft</title>
  </head>
  <body>
    <main>
      <h1>Build your career and experience rewarding opportunities at MindCraft</h1>
      <p>Send an email with your resume and we will contact you for a suitable job opening.</p>
      <button>Apply Now</button>
      <div class="popup">
        <p>Send your resume to recruitment@mindcraft.com or fill your information here</p>
      </div>
      <form>
        <label>Resume</label>
      </form>
    </main>
  </body>
</html>
`

const structuredJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Build your career and experience rewarding opportunities at MindCraft | MindCraft</title>
  </head>
  <body>
    <main>
      <p>Send your resume to recruitment@mindcraft.com or fill your information here</p>
      <button>Apply Now</button>
      <article class="job-card">
        <h2>Java Developer</h2>
        <a href="https://www.mindcraftamerica.com/careers/java-developer/">Apply</a>
      </article>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/mindcraftsoftware/script.js')
  } catch {
    assert.fail('Expected MindCraft Software scraper module at ../../scraper/mindcraftsoftware/script.js')
  }
}

test('MindCraft Software returns [] only while the verified careers shell exposes no public role listings', async () => {
  const mindCraft = await loadModule()
  const requestedUrls = []

  assert.equal(mindCraft.hasOfficialMindCraftCareersSignals(careersHtml), true)
  assert.equal(mindCraft.pageExposesStructuredJobListings(careersHtml), false)

  const jobs = await mindCraft.createMindCraftSoftwareScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, ['https://www.mindcraftamerica.com/careers/'])
  assert.deepEqual(jobs, [])
})

test('MindCraft Software fails closed when structured public jobs appear on the careers shell', async () => {
  const mindCraft = await loadModule()

  await assert.rejects(
    mindCraft.createMindCraftSoftwareScraper().run({
      fetchText: async () => structuredJobsHtml,
    }),
    /structured public job listings/i,
  )
})

test('MindCraft Software fails closed when the verified careers shell identity drifts', async () => {
  const mindCraft = await loadModule()

  await assert.rejects(
    mindCraft.createMindCraftSoftwareScraper().run({
      fetchText: async () => '<html><body>Unknown</body></html>',
    }),
    /official careers shell changed/i,
  )
})
