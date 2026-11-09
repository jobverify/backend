import assert from 'node:assert/strict'
import test from 'node:test'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <table>
      <thead>
        <tr>
          <th>Job ID</th>
          <th>Date Posted</th>
          <th>Job Title</th>
          <th>Location</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>987</td>
          <td>11 Feb 2026</td>
          <td><a href="./job-details/business-analyst/302/987">Business Analyst</a></td>
          <td>Pune</td>
          <td><a href="./apply-job/business-analyst/302/987">Apply</a></td>
        </tr>
        <tr>
          <td>985</td>
          <td>11 Feb 2026</td>
          <td><a href="./job-details/react-developer/307/985">React Developer</a></td>
          <td>Pune- Pyramid</td>
          <td><a href="./apply-job/react-developer/307/985">Apply</a></td>
        </tr>
        <tr>
          <td>980</td>
          <td>11 Feb 2026</td>
          <td><a href="./job-details/marketing-manager/290/980">Marketing Manager</a></td>
          <td>Pune- Pyramid</td>
          <td><a href="./apply-job/marketing-manager/290/980">Apply</a></td>
        </tr>
        <tr>
          <td>968</td>
          <td>11 Feb 2026</td>
          <td><a href="./job-details/ai-mlengineer/274/968">AI/MLEngineer</a></td>
          <td>Pune</td>
          <td><a href="./apply-job/ai-mlengineer/274/968">Apply</a></td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/thedigitalgroupinfotech/script.js')
  } catch {
    assert.fail('Expected The Digital Group Infotech scraper module at ../../scraper/thedigitalgroupinfotech/script.js')
  }
}

test('The Digital Group Infotech helpers stay pinned to the verified careers table from Saturday, July 18, 2026', async () => {
  const tdg = await loadModule()

  assert.equal(tdg.SOURCE, 'thedigitalgroupinfotech')
  assert.equal(tdg.COMPANY, 'The Digital Group Infotech')
  assert.equal(tdg.CAREERS_URL, 'https://www.thedigitalgroup.com/careers?page=1')
  assert.equal(tdg.VERIFIED_ON, '2026-07-18')
  assert.equal(tdg.hasOfficialCareersSignal(careersPageHtml), true)

  const jobs = tdg.extractJobs(careersPageHtml)
  assert.equal(jobs.length, 4)
  assert.deepEqual(jobs[0], {
    jobId: '987',
    postedOn: '11 Feb 2026',
    title: 'Business Analyst',
    location: 'Pune, India',
    sourceUrl: 'https://www.thedigitalgroup.com/job-details/business-analyst/302/987',
    applyUrl: 'https://www.thedigitalgroup.com/apply-job/business-analyst/302/987',
  })
})

test('The Digital Group Infotech returns public jobs from the verified first-party careers table', async () => {
  const tdg = await loadModule()
  const requestedUrls = []

  const jobs = await tdg.createTheDigitalGroupInfotechScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === tdg.CAREERS_URL) return careersPageHtml
      throw new Error(`Unexpected The Digital Group Infotech URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [tdg.CAREERS_URL])
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].company, 'The Digital Group Infotech')
  assert.equal(jobs[0].source, 'thedigitalgroupinfotech')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
  assert.notEqual(jobs[0].jobId, jobs[1].jobId)
})

test('The Digital Group Infotech fails closed when the verified careers table disappears', async () => {
  const tdg = await loadModule()

  await assert.rejects(
    tdg.createTheDigitalGroupInfotechScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1><p>Submit Here</p></body></html>',
    }),
    /verified The Digital Group careers surface/i,
  )
})
