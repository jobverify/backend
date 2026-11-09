import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career at Sapphire Software Solutions</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <section class="opening">
        <h2>Business Development Executive</h2>
        <p>Ahmedabad</p>
        <a href="#apply">Apply Here</a>
      </section>
      <section class="opening">
        <h2>Senior HR Executive</h2>
        <p>Ahmedabad</p>
        <a href="#apply">Apply Here</a>
      </section>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/sapphiresoftwaresolutionsindia/script.js')
  } catch {
    assert.fail('Expected Sapphire Software Solutions India scraper module at ../../scraper/sapphiresoftwaresolutionsindia/script.js')
  }
}

test('Sapphire Software Solutions (India) helpers stay pinned to the verified current openings page', async () => {
  const sapphire = await loadModule()

  assert.equal(sapphire.SOURCE, 'sapphiresoftwaresolutionsindia')
  assert.equal(sapphire.COMPANY, 'Sapphire Software Solutions (India)')
  assert.equal(sapphire.CAREERS_URL, 'https://www.sapphiresolutions.net/careers?tab=CurrentOpenings')
  assert.equal(sapphire.VERIFIED_ON, '2026-07-17')
  assert.equal(sapphire.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.deepEqual(sapphire.extractJobs(CAREERS_HTML), [
    {
      title: 'Business Development Executive',
      company: 'Sapphire Software Solutions (India)',
      location: 'Ahmedabad, India',
      city: 'Ahmedabad',
      country: 'India',
      jobId: 'business-development-executive',
      requisitionId: 'business-development-executive',
      sourceUrl: 'https://www.sapphiresolutions.net/careers?tab=CurrentOpenings',
      applyUrl: 'https://www.sapphiresolutions.net/careers?tab=CurrentOpenings',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'Senior HR Executive',
      company: 'Sapphire Software Solutions (India)',
      location: 'Ahmedabad, India',
      city: 'Ahmedabad',
      country: 'India',
      jobId: 'senior-hr-executive',
      requisitionId: 'senior-hr-executive',
      sourceUrl: 'https://www.sapphiresolutions.net/careers?tab=CurrentOpenings',
      applyUrl: 'https://www.sapphiresolutions.net/careers?tab=CurrentOpenings',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
  ])
})

test('Sapphire Software Solutions (India) run validates the verified current openings page and decorates jobs', async () => {
  const sapphire = await loadModule()
  const jobs = await sapphire.createSapphireSoftwareSolutionsIndiaScraper({
    now: () => '2026-07-17T12:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      assert.equal(url, sapphire.CAREERS_URL)
      return CAREERS_HTML
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'sapphiresoftwaresolutionsindia')
  assert.equal(jobs[0].scrapedAt, '2026-07-17T12:00:00.000Z')
})

test('Sapphire Software Solutions (India) fails closed when the verified current openings page drifts', async () => {
  const sapphire = await loadModule()

  await assert.rejects(
    sapphire.createSapphireSoftwareSolutionsIndiaScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified Sapphire Software Solutions/i,
  )
})
