import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join the Intex Team - Build the Future with Us | Intex Careers - Intex Technologies</title>
  </head>
  <body>
    <h2 style="text-align: center; font-size: 28px; margin-bottom: 30px; color: #000;">Job Openings</h2>
    <section>
      <div>
        <div style="border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
            <p style="margin: 0; font-size: 20px;">Branch Sales Manager</p>
            <span>▼</span>
          </div>
          <div style="display: none; margin-top: 10px; font-size: 16px; color: #444;">
            <p><strong>Location: Pune </strong> Delhi</p>
            <p><strong>Experience:</strong> 10+ Years</p>
            <p><strong>Skills:</strong>Sales, Business Development, Chanel & Distribution Management</p>
            <p><strong>Job Description:</strong></p>
            <p><b>Key Responsibilities</b></p>
            <ul>
              <li>Develop and execute strategic sales plans to achieve branch revenue targets.</li>
              <li>Lead, train, and motivate the sales team to meet and exceed performance goals.</li>
            </ul>
            <a href="https://forms.gle/8rznvixnmnNB4cnB9">Apply Now</a>
          </div>
        </div>

        <div style="border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
            <p style="margin: 0; font-size: 20px;">E - Commerce Manager</p>
            <span>▼</span>
          </div>
          <div style="display: none; margin-top: 10px; font-size: 16px; color: #444;">
            <p><strong>Location:</strong> Head - Office - New Delhi Noida</p>
            <p><strong>Experience:</strong> 1-3 Years</p>
            <p><strong>Skills:</strong> E- Commerce, Quick Commerce, Marketplace</p>
            <p><strong>Job Description:</strong></p>
            <p><b>Key Responsibilities:</b></p>
            <ul>
              <li>Develop and implement e-commerce sales strategies to drive revenue across owned platforms.</li>
              <li>Manage and grow sales through marketplaces and proprietary websites.</li>
            </ul>
            <a href="https://forms.gle/8rznvixnmnNB4cnB9">Apply Now</a>
          </div>
        </div>

        <!-- Job Card 3
        <div style="border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
            <p style="margin: 0; font-size: 20px;">Sales Executive</p>
            <span>▼</span>
          </div>
          <div style="display: none; margin-top: 10px; font-size: 16px; color: #444;">
            <p><strong>Location:</strong> Noida</p>
            <p><strong>Experience:</strong> 1-3 Years</p>
            <p><strong>Skills:</strong> Photoshop, Illustrator, Canva</p>
            <p><strong>Job Description:</strong> Photoshop, Illustrator, Canva</p>
            <a href="https://forms.gle/8rznvixnmnNB4cnB9">Apply Now</a>
          </div>
        </div>
        -->
      </div>
    </section>
  </body>
</html>
`

const loadIntexModule = async () => {
  try {
    return await import('../../scraper/intextechnologies/script.js')
  } catch {
    assert.fail('Expected Intex Technologies scraper module at ../../scraper/intextechnologies/script.js')
  }
}

test('Intex Technologies verifies the first-party careers surface and shared Google Forms application URL', async () => {
  const intex = await loadIntexModule()

  assert.equal(intex.CAREERS_PAGE_URL, 'https://www.intex.in/pages/careers')
  assert.equal(intex.APPLICATION_URL, 'https://forms.gle/8rznvixnmnNB4cnB9')
  assert.equal(intex.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.deepEqual(intex.extractApplyUrls(CAREERS_HTML), ['https://forms.gle/8rznvixnmnNB4cnB9'])
})

test('Intex Technologies extracts only the visible public job cards and ignores commented-out openings', async () => {
  const intex = await loadIntexModule()
  const jobs = intex.extractVisibleJobs(CAREERS_HTML)

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => job.title),
    ['Branch Sales Manager', 'E - Commerce Manager'],
  )

  assert.equal(jobs[0].location, 'Pune Delhi, India')
  assert.equal(jobs[0].city, null)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].applyUrl, 'https://forms.gle/8rznvixnmnNB4cnB9')
  assert.equal(jobs[0].experienceRequired, '10+ Years')
  assert.deepEqual(jobs[0].requiredSkills, ['Sales', 'Business Development', 'Chanel & Distribution Management'])
  assert.match(jobs[0].jobDescription, /branch revenue targets/i)

  assert.equal(jobs[1].location, 'Head - Office - New Delhi Noida, India')
  assert.equal(jobs[1].city, null)
  assert.equal(jobs[1].experienceRequired, '1-3 Years')
  assert.deepEqual(jobs[1].requiredSkills, ['E- Commerce', 'Quick Commerce', 'Marketplace'])
})

test('Intex Technologies run fetches the verified careers page and decorates runner fields', async () => {
  const intex = await loadIntexModule()
  const requestedUrls = []

  const jobs = await intex.createIntexTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return CAREERS_HTML
    },
    now: () => '2026-07-16T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, ['https://www.intex.in/pages/careers'])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'intextechnologies')
  assert.equal(jobs[0].link, 'https://forms.gle/8rznvixnmnNB4cnB9')
  assert.equal(jobs[0].scrapedAt, '2026-07-16T00:00:00.000Z')
})

test('Intex Technologies fails closed when the verified careers page drifts materially', async () => {
  const intex = await loadIntexModule()

  await assert.rejects(
    intex.createIntexTechnologiesScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1><p>No trusted jobs here.</p></body></html>',
    }),
    /verified Intex Technologies careers page/i,
  )
})
