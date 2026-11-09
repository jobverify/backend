import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T12:00:00.000Z'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>KiwiTech Careers | Find IT Job Openings & Opportunities</title>
  </head>
  <body>
    <div class="career-heading">
      <p class="career-tag">JOBS</p>
      <h1>Current Openings</h1>
    </div>
    <div class="current-opening-list service-list">
      <ul>
        <li class="service-item" data-service="1">
          <a href="https://www.kiwitech.com/careers/details/full-stack-lead-react-angular-node-js-python">
            <span class="num">1</span>
            <p>
              <span class="profile"><strong>Full Stack Lead (React / Angular + Node.js / Python)</strong></span>
              <span class="location-year"><span>Gurgaon / Remote / Hybrid</span> 8-12 Years </span>
            </p>
          </a>
        </li>
        <li class="service-item" data-service="1">
          <a href="https://www.kiwitech.com/careers/details/associate-lead-ai-ml-6-plus-years">
            <span class="num">2</span>
            <p>
              <span class="profile"><strong>Associate Lead AI & ML</strong></span>
              <span class="location-year"><span>Noida</span> 6+ Years </span>
            </p>
          </a>
        </li>
      </ul>
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/kiwitech/script.js')
  } catch {
    assert.fail('Expected KiwiTech scraper module at ../../scraper/kiwitech/script.js')
  }
}

test('KiwiTech helpers stay pinned to the verified first-party careers page contract', async () => {
  const kiwitech = await loadModule()

  assert.equal(kiwitech.hasOfficialCareersSignal(careersPageHtml), true)
  assert.deepEqual(kiwitech.extractJobCards(careersPageHtml), [
    {
      title: 'Full Stack Lead (React / Angular + Node.js / Python)',
      location: 'Gurgaon / Remote / Hybrid',
      experience: '8-12 Years',
      applyUrl: 'https://www.kiwitech.com/careers/details/full-stack-lead-react-angular-node-js-python',
    },
    {
      title: 'Associate Lead AI & ML',
      location: 'Noida',
      experience: '6+ Years',
      applyUrl: 'https://www.kiwitech.com/careers/details/associate-lead-ai-ml-6-plus-years',
    },
  ])
})

test('KiwiTech run validates the careers page and returns normalized jobs', async () => {
  const kiwitech = await loadModule()
  const jobs = await kiwitech.createKiwiTechScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, kiwitech.CAREERS_URL)
      return careersPageHtml
    },
  })

  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.city, job.remoteStatus, job.experienceRequired, job.applyUrl]),
    [
      [
        'Full Stack Lead (React / Angular + Node.js / Python)',
        'Gurgaon, India',
        'Gurgaon',
        'Hybrid',
        '8-12 Years',
        'https://www.kiwitech.com/careers/details/full-stack-lead-react-angular-node-js-python',
      ],
      [
        'Associate Lead AI & ML',
        'Noida, India',
        'Noida',
        'On-site',
        '6+ Years',
        'https://www.kiwitech.com/careers/details/associate-lead-ai-ml-6-plus-years',
      ],
    ],
  )
})

test('KiwiTech fails closed when the verified careers page drifts', async () => {
  const kiwitech = await loadModule()

  await assert.rejects(
    kiwitech.createKiwiTechScraper().run({
      fetchText: async () => '<html><body><h1>Jobs</h1></body></html>',
    }),
    /verified KiwiTech careers page/i,
  )
})
