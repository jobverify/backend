import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html>
  <head><title>Join Our Team | Careers at ValueFirst</title></head>
  <body>
    <h1>#JoinTheJoy</h1>
    <h2>Open Roles</h2>
    <div class="s-paragraph">Gurugram, India</div>
    <div class="s-paragraph">Full-Time</div>
    <h5>Sales Manager - Acquisition</h5>
    <a href="/job-opening/sales-manager-acquisition">Learn More</a>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html>
  <head><title>We Are Looking for a Sales Manager - Acquisition In Gurugram, India | ValueFirst Careers</title></head>
  <body>
    <p>Gurugram, India</p>
    <p>Full-Time</p>
    <h1>Sales Manager - Acquisition</h1>
    <p>This is a highly motivated and aggressive team responsible for developing new business opportunities.</p>
    <h2>Apply for this position!</h2>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/valuefirstdigitalmedia/script.js')
  } catch {
    assert.fail('Expected ValueFirst Digital Media scraper module at ../../scraper/valuefirstdigitalmedia/script.js')
  }
}

test('ValueFirst Digital Media extracts the verified same-page role summary and first-party detail page', async () => {
  const valuefirst = await loadScriptModule()

  assert.equal(valuefirst.hasOfficialCareersSignal(careersHtml), true)

  const jobs = await valuefirst.run({
    fetchText: async (url) => (url === valuefirst.CAREERS_URL ? careersHtml : detailHtml),
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Sales Manager - Acquisition',
      company: 'ValueFirst Digital Media',
      location: 'Gurugram, India',
      country: 'India',
      employmentType: 'Full-Time',
      sourceUrl: 'https://www.vfirst.com/job-opening/sales-manager-acquisition',
      applyUrl: 'https://www.vfirst.com/job-opening/sales-manager-acquisition',
      description:
        'This is a highly motivated and aggressive team responsible for developing new business opportunities.',
      link: 'https://www.vfirst.com/job-opening/sales-manager-acquisition',
      source: 'valuefirstdigitalmedia',
      scrapedAt: '2026-07-18T00:00:00.000Z',
    },
  ])
})
