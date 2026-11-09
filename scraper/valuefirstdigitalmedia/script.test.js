import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join Our Team | Careers at ValueFirst</title>
  </head>
  <body>
    <div>#JoinTheJoy</div>
    <h2>Open Roles</h2>
    <div class="s-card bg-gray-4 rounded">
      <div class="space-between-hor s-margin">
        <div class="s-paragraph">Gurugram, India</div>
        <div class="s-paragraph">Full-Time</div>
      </div>
      <h5 class="h5-title xs-margin">Sales Manager - Acquisition</h5>
      <a href="/job-opening/sales-manager-acquisition" class="link-block w-inline-block">
        <div>Learn More</div>
      </a>
    </div>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>We Are Looking for a Sales Manager - Acquisition In Gurugram, India | ValueFirst Careers</title>
  </head>
  <body>
    <div>Gurugram, India — Full-Time</div>
    <h1>Sales Manager - Acquisition</h1>
    <div>Apply for this position!</div>
    <p>
      This is a highly motivated and aggressive team responsible for developing new business
      opportunities.
    </p>
  </body>
</html>
`

test('ValueFirst recognizes the current careers shell and extracts the current inline role summary', async () => {
  const valuefirst = await loadModule()

  assert.equal(valuefirst.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(valuefirst.extractRoleSummaries(careersHtml), [
    {
      location: 'Gurugram, India',
      employmentType: 'Full-Time',
      title: 'Sales Manager - Acquisition',
      sourceUrl: 'https://www.vfirst.com/job-opening/sales-manager-acquisition',
    },
  ])
  assert.equal(
    valuefirst.hasRoleDetailSignal(detailHtml, 'Sales Manager - Acquisition'),
    true,
  )
})

test('ValueFirst returns the current first-party India role', async () => {
  const valuefirst = await loadModule()

  const jobs = await valuefirst.run({
    fetchText: async (url) => {
      if (url === valuefirst.CAREERS_URL) return careersHtml
      if (url === 'https://www.vfirst.com/job-opening/sales-manager-acquisition') return detailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-08-06T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Sales Manager - Acquisition')
  assert.equal(jobs[0].company, 'ValueFirst Digital Media')
  assert.equal(jobs[0].location, 'Gurugram, India')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].source, 'valuefirstdigitalmedia')
})
