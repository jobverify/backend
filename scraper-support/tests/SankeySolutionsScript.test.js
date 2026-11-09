import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/sankeysolutions/script.js')
  } catch {
    assert.fail('Expected Sankey Solutions scraper module at ../../scraper/sankeysolutions/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Sankey solutions: IT Consulting & Services | Digital Transformation</title>
  </head>
  <body>
    <h1>DEFINE YOUR FUTURE WITH LIMITLESS POSSIBILITIES</h1>
    <section class="opportunities">
      <a class="job-card" href="https://sankeysolutions.com/solution-analyst/">
        <h3>Solution Analyst</h3>
        <p>An all-rounder who can meticulously understand client’s requirement and develop top-notch</p>
        <span>Apply Now</span>
      </a>
      <a class="job-card" href="https://sankeysolutions.com/technical-architect/">
        <h3>Technical Architect</h3>
        <p>A specialist holding potential to be decisive in creating, assessing and analyzing technical solutions.</p>
        <span>Apply Now</span>
      </a>
      <a class="job-card" href="https://sankeysolutions.com/senior-project-manager/">
        <h3>Senior Project Manager (Technical)</h3>
        <p>A project manager is responsible for planning and overseeing projects within an organisation.</p>
        <span>Apply Now</span>
      </a>
    </section>
  </body>
</html>
`

test('Sankey Solutions constants stay pinned to the verified first-party careers page', async () => {
  const sankey = await loadModule()

  assert.equal(sankey.SOURCE, 'sankeysolutions')
  assert.equal(sankey.COMPANY, 'Sankey Solutions')
  assert.equal(sankey.CAREERS_URL, 'https://sankeysolutions.com/careers/')
  assert.equal(sankey.hasOfficialCareersSignal(careersHtml), true)
})

test('Sankey Solutions extracts public careers cards and detail links from the first-party page', async () => {
  const sankey = await loadModule()

  assert.deepEqual(sankey.extractIndiaJobs(careersHtml), [
    {
      title: 'Solution Analyst',
      company: 'Sankey Solutions',
      department: null,
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      jobId: 'solution-analyst',
      requisitionId: 'solution-analyst',
      sourceUrl: 'https://sankeysolutions.com/solution-analyst/',
      applyUrl: 'https://sankeysolutions.com/solution-analyst/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'An all-rounder who can meticulously understand client’s requirement and develop top-notch',
      remoteStatus: null,
    },
    {
      title: 'Technical Architect',
      company: 'Sankey Solutions',
      department: null,
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      jobId: 'technical-architect',
      requisitionId: 'technical-architect',
      sourceUrl: 'https://sankeysolutions.com/technical-architect/',
      applyUrl: 'https://sankeysolutions.com/technical-architect/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'A specialist holding potential to be decisive in creating, assessing and analyzing technical solutions.',
      remoteStatus: null,
    },
    {
      title: 'Senior Project Manager (Technical)',
      company: 'Sankey Solutions',
      department: null,
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      jobId: 'senior-project-manager',
      requisitionId: 'senior-project-manager',
      sourceUrl: 'https://sankeysolutions.com/senior-project-manager/',
      applyUrl: 'https://sankeysolutions.com/senior-project-manager/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'A project manager is responsible for planning and overseeing projects within an organisation.',
      remoteStatus: null,
    },
  ])
})

test('Sankey Solutions run validates the first-party careers page and decorates extracted roles', async () => {
  const sankey = await loadModule()

  const jobs = await sankey.createSankeySolutionsScraper({ maxJobs: 2 }).run({
    fetchText: async () => careersHtml,
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'sankeysolutions')
  assert.equal(jobs[0].link, 'https://sankeysolutions.com/solution-analyst/')
  assert.equal(jobs[0].scrapedAt, '2026-07-18T00:00:00.000Z')
})

test('Sankey Solutions fails closed when the verified careers page signal disappears', async () => {
  const sankey = await loadModule()

  await assert.rejects(
    sankey.createSankeySolutionsScraper().run({
      fetchText: async () => '<html><body>Unexpected page</body></html>',
    }),
    /verified Sankey Solutions careers page/i,
  )
})
