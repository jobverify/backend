import assert from 'node:assert/strict'
import test from 'node:test'

const loadHuTLabsModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const jobsBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Openings at Amrita Vishwa Vidyapeetham</title>
  </head>
  <body>
    <main>
      <ul class="career-list">
        <li>
          <div class="position">
            <a href="https://www.amrita.edu/job/robotics-engineer-amritapuri/">Robotics Engineer @ Amritapuri</a>
          </div>
          <div class="place"><span>Amrita Vishwa Vidyapeetham</span>Amritapuri</div>
          <div class="aply-bnt">
            <a href="https://www.amrita.edu/job/robotics-engineer-amritapuri/" class="btn btn-bordered">View Details</a>
            <a href="https://careers.amrita.edu/client/job-search?jid=robotics" class="btn btn-bordered">Apply now</a>
            <div class="app-date">Closing date : <span>Jul 15, 2026</span></div>
          </div>
        </li>
        <li>
          <div class="position">
            <a href="https://www.amrita.edu/job/technical-staff-trainee-amritapuri/">Technical Staff Trainee @ Hut Labs Amritapuri</a>
          </div>
          <div class="place"><span></span>Amritapuri</div>
          <div class="aply-bnt">
            <a href="https://www.amrita.edu/job/technical-staff-trainee-amritapuri/" class="btn btn-bordered">View Details</a>
            <a href="https://careers.amrita.edu/client/job-search?jid=hutlabs" class="btn btn-bordered">Apply now</a>
            <div class="app-date">Closing date : <span>Jul 15, 2026</span></div>
          </div>
        </li>
      </ul>
    </main>
  </body>
</html>
`

const hutLabsDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Technical Staff Trainee @ Hut Labs Amritapuri - Amrita Vishwa Vidyapeetham</title>
    <meta property="og:updated_time" content="2026-06-12T13:58:08+05:30" />
  </head>
  <body>
    <div class="job-deatil">
      <div class="detail-text">
        <h2 class="block-title bt-left-aligned">Technical Staff Trainee @ Hut Labs Amritapuri</h2>
        <p>Amrita Vishwa Vidyapeetham, Amritapuri Campus is inviting applications from qualified candidates for the post of <b>Technical Staff Trainee.</b></p>
        <p>For details contact : <strong><a href="mailto:rajeshm@am.amrita.edu">rajeshm@am.amrita.edu</a></strong></p>
        <p><strong><a class="btn btn-bordered" href="https://careers.amrita.edu/client/job-search?jid=hutlabs" target="_blank" rel="noopener">Apply Now</a></strong></p>
      </div>
      <div class="deatil-list">
        <table style="width:100%">
          <tr>
            <th>Job Title</th>
            <td>Technical Staff Trainee</td>
          </tr>
          <tr>
            <th>Location</th>
            <td>Amritapuri</td>
          </tr>
          <tr>
            <th>Qualification</th>
            <td>B.Tech in Electronics, Robotics, or related discipline</td>
          </tr>
          <tr>
            <th>Last Date to Apply</th>
            <td>Jul 15, 2026</td>
          </tr>
          <tr>
            <th>Apply Online</th>
            <td><a href="https://careers.amrita.edu/client/job-search?jid=hutlabs">Apply now</a></td>
          </tr>
        </table>
      </div>
    </div>
  </body>
</html>
`

const changedBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs | Amrita</title>
  </head>
  <body>
    <main><p>No recognizable board content</p></main>
  </body>
</html>
`

test('HuT Labs scraper recognizes the verified Amrita jobs board and HuT Labs detail surface', async () => {
  const hutLabs = await loadHuTLabsModule()
  assert.ok(hutLabs, 'Expected scraper module at ./script.js')

  assert.equal(hutLabs.SOURCE, 'hutlabs')
  assert.equal(hutLabs.COMPANY, 'HuT Labs')
  assert.equal(hutLabs.JOBS_URL, 'https://www.amrita.edu/jobs/')
  assert.equal(hutLabs.hasOfficialJobsBoardSignal(jobsBoardHtml), true)
  assert.equal(hutLabs.isHuTLabsRoleTitle('Technical Staff Trainee @ Hut Labs Amritapuri'), true)
  assert.equal(hutLabs.isHuTLabsRoleTitle('Robotics Engineer @ Amritapuri'), false)

  const cards = hutLabs.extractJobCards(jobsBoardHtml)
  assert.equal(cards.length, 2)
  assert.equal(cards[1].title, 'Technical Staff Trainee @ Hut Labs Amritapuri')
  assert.equal(cards[1].closingDateText, 'Jul 15, 2026')
  assert.equal(hutLabs.hasOfficialHuTLabsDetailSignal(hutLabsDetailHtml, cards[1].title), true)
})

test('HuT Labs scraper returns only explicit HuT Labs roles from the verified Amrita jobs board', async () => {
  const hutLabs = await loadHuTLabsModule()
  assert.ok(hutLabs, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await hutLabs.createHuTLabsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === hutLabs.JOBS_URL) return jobsBoardHtml
      if (url === 'https://www.amrita.edu/job/technical-staff-trainee-amritapuri/') return hutLabsDetailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    hutLabs.JOBS_URL,
    'https://www.amrita.edu/job/technical-staff-trainee-amritapuri/',
  ])
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Technical Staff Trainee',
    company: 'HuT Labs',
    location: 'Amritapuri, Kollam, Kerala, India',
    city: 'Kollam',
    state: 'Kerala',
    country: 'India',
    sourceUrl: 'https://www.amrita.edu/job/technical-staff-trainee-amritapuri/',
    applyUrl: 'https://careers.amrita.edu/client/job-search?jid=hutlabs',
    postedAt: '2026-06-12T08:28:08.000Z',
    closingDate: '2026-07-15T00:00:00.000Z',
    jobDescription: 'Amrita Vishwa Vidyapeetham, Amritapuri Campus is inviting applications from qualified candidates for the post of Technical Staff Trainee. For details contact : rajeshm@am.amrita.edu',
    minimumQualification: 'B.Tech in Electronics, Robotics, or related discipline',
    companyCareerPage: 'https://www.amrita.edu/jobs/',
  })
})

test('HuT Labs scraper fails closed when the Amrita jobs board or HuT Labs detail surface changes materially', async () => {
  const hutLabs = await loadHuTLabsModule()
  assert.ok(hutLabs, 'Expected scraper module at ./script.js')

  await assert.rejects(
    hutLabs.createHuTLabsScraper().run({
      fetchText: async (url) => {
        if (url === hutLabs.JOBS_URL) return changedBoardHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified amrita jobs board/i,
  )

  await assert.rejects(
    hutLabs.createHuTLabsScraper().run({
      fetchText: async (url) => {
        if (url === hutLabs.JOBS_URL) return jobsBoardHtml
        if (url === 'https://www.amrita.edu/job/technical-staff-trainee-amritapuri/') {
          return hutLabsDetailHtml.replace('Technical Staff Trainee</td>', '')
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified hut labs detail surface/i,
  )
})
