import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career</title>
  </head>
  <body>
    <h1>Career</h1>
    <div class="elementor-accordion">
      <div class="elementor-accordion-item">
        <span class="elementor-accordion-title">HR Recruiter</span>
        <div class="elementor-tab-content">
          <p><strong>Job Summary:</strong><br />The ideal candidate will be responsible for managing company hiring and HR initiatives.</p>
          <div class="toggle-div"><a class="toggle-btn" href="/hr-recruiter/">Learn MoreDetails</a></div>
        </div>
      </div>
      <div class="elementor-accordion-item">
        <span class="elementor-accordion-title">Full-Stack Developer</span>
        <div class="elementor-tab-content">
          <p><strong>Job Summary:</strong><br />We are looking for experienced full stack developer for our server platform-based development.</p>
          <div class="toggle-div"><a class="toggle-btn" href="/full-stack-developer/">Learn MoreDetails</a></div>
        </div>
      </div>
      <div class="elementor-accordion-item">
        <span class="elementor-accordion-title">Japanese Social Media Manager</span>
        <div class="elementor-tab-content">
          <p><strong>Job Summary:</strong><br />We are seeking an experienced Japanese social media manager / blogger to join our team for a long term project.</p>
          <div class="toggle-div"><a class="toggle-btn" href="/japanese-social-media-manager/">Learn MoreDetails</a></div>
        </div>
      </div>
    </div>
    <h2>Join Our Team!</h2>
    <form action="/career/#wpcf7-f11782-p27106-o1"></form>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/foiweinfoglobalsolution/script.js')
  } catch {
    assert.fail('Expected Foiwe Info Global Solution scraper module at ../../scraper/foiweinfoglobalsolution/script.js')
  }
}

test('Foiwe Info Global Solution helpers stay pinned to the verified careers accordion surface', async () => {
  const foiwe = await loadModule()

  assert.equal(foiwe.SOURCE, 'foiweinfoglobalsolution')
  assert.equal(foiwe.COMPANY, 'Foiwe Info Global Solution')
  assert.equal(foiwe.CAREERS_URL, 'https://www.foiwe.com/career/')
  assert.equal(foiwe.VERIFIED_ON, '2026-07-18')
  assert.equal(foiwe.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(foiwe.extractCareerListings(careersHtml), [
    {
      title: 'HR Recruiter',
      summary: 'The ideal candidate will be responsible for managing company hiring and HR initiatives.',
      detailUrl: 'https://www.foiwe.com/hr-recruiter/',
    },
    {
      title: 'Full-Stack Developer',
      summary: 'We are looking for experienced full stack developer for our server platform-based development.',
      detailUrl: 'https://www.foiwe.com/full-stack-developer/',
    },
    {
      title: 'Japanese Social Media Manager',
      summary: 'We are seeking an experienced Japanese social media manager / blogger to join our team for a long term project.',
      detailUrl: 'https://www.foiwe.com/japanese-social-media-manager/',
    },
  ])
})

test('Foiwe Info Global Solution run returns normalized jobs from the verified first-party careers page', async () => {
  const foiwe = await loadModule()
  const jobs = await foiwe.run({
    fetchText: async (url) => {
      assert.equal(url, foiwe.CAREERS_URL)
      return careersHtml
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      sourceUrl: job.sourceUrl,
      source: job.source,
      company: job.company,
    })),
    [
      {
        title: 'HR Recruiter',
        sourceUrl: 'https://www.foiwe.com/hr-recruiter/',
        source: 'foiweinfoglobalsolution',
        company: 'Foiwe Info Global Solution',
      },
      {
        title: 'Full-Stack Developer',
        sourceUrl: 'https://www.foiwe.com/full-stack-developer/',
        source: 'foiweinfoglobalsolution',
        company: 'Foiwe Info Global Solution',
      },
      {
        title: 'Japanese Social Media Manager',
        sourceUrl: 'https://www.foiwe.com/japanese-social-media-manager/',
        source: 'foiweinfoglobalsolution',
        company: 'Foiwe Info Global Solution',
      },
    ],
  )
})

test('Foiwe Info Global Solution fails closed when the verified careers accordion disappears', async () => {
  const foiwe = await loadModule()

  await assert.rejects(
    foiwe.run({
      fetchText: async () => '<html><body><h1>Career</h1></body></html>',
    }),
    /verified first-party careers page/i,
  )
})
