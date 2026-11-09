import assert from 'node:assert/strict'
import test from 'node:test'

const loadInformationEvolutionModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Information Evolution scraper module at ./script.js')
  }
}

const jobsPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Jobs</h1>
      <p>Information Evolution Inc</p>
      <p>Join our team</p>
      <section>
        <h3>Coimbatore, India</h3>
        <p><a href="/job/team-leader/">Team Leader</a></p>
      </section>
      <section>
        <h3>Austin, United States</h3>
        <p><a href="/job/us-manager/">US Manager</a></p>
      </section>
    </main>
  </body>
</html>
`

const teamLeaderDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Team Leader – Information Evolution Inc.</title>
    <style>
      .elementor-location-footer:before { content: ""; }
    </style>
  </head>
  <body>
    <div class="job-post clearfix" role="main">
      <div class="job-content">
        <div class="job-content-wrap">
          <div class="jobs-row clearfix position_title type-text position_title ">
            <div class="jobs-row-label"><span>Position title</span></div>
            <div class="jobs-row-input">Team Leader</div>
          </div>
          <div class="jobs-row clearfix position_description type-tinymce">
            <div class="jobs-row-label"><span>Description</span></div>
            <div class="jobs-row-input">
              <p>Lead the data processing and scraping team.</p>
              <ul><li>Own project delivery.</li></ul>
            </div>
          </div>
          <div class="jobs-row clearfix position_qualifications type-tinymce">
            <div class="jobs-row-label"><span>Qualifications</span></div>
            <div class="jobs-row-input">
              <p>Strong Excel skills.</p>
            </div>
          </div>
        </div>
      </div>
      <div class="job-side">
        <div class="job-content-wrap">
          <div class="jobs-row clearfix position_employment_type type-checkboxes">
            <div class="jobs-row-label"><span>Employment Type</span></div>
            <div class="jobs-row-input">Full-time</div>
          </div>
          <div class="jobs-row clearfix position_job_location type-location">
            <div class="jobs-row-label"><span>Job Location</span></div>
            <div class="jobs-row-input">
              <svg><path d="M40.94,5.617"></path></svg>
              Information Evolution India Private Limited Module No. 002/1 Ground Floor,
              TIDEL Park Coimbatore Ltd, ELCOSEZ, Coimbatore, 641 014., India
            </div>
          </div>
        </div>
      </div>
      <div class="jobs-row-apply">
        <button class="button jp-apply-button">Apply now</button>
      </div>
    </div>
  </body>
</html>
`

test('Information Evolution extracts the verified India card from the first-party jobs page', async () => {
  const informationEvolution = await loadInformationEvolutionModule()
  const cards = informationEvolution.extractJobCards(jobsPageHtml)

  assert.deepEqual(cards, [
    {
      title: 'Team Leader',
      detailUrl: new URL('/job/team-leader/', informationEvolution.JOBS_URL).href,
      location: 'Coimbatore, India',
    },
  ])
})

test('Information Evolution extracts clean detail fields without CSS or SVG noise', async () => {
  const informationEvolution = await loadInformationEvolutionModule()

  const job = informationEvolution.extractJobDetail(teamLeaderDetailHtml, {
    title: 'Team Leader',
    detailUrl: 'https://dev.informationevolution.com/job/team-leader/',
    location: 'Coimbatore, India',
  })

  assert.equal(job.title, 'Team Leader')
  assert.equal(job.employmentType, 'Full-time')
  assert.equal(
    job.location,
    'Information Evolution India Private Limited Module No. 002/1 Ground Floor, TIDEL Park Coimbatore Ltd, ELCOSEZ, Coimbatore, 641 014., India',
  )
  assert.equal(job.city, 'Coimbatore')
  assert.equal(job.state, null)
  assert.equal(job.country, 'India')
  assert.equal(job.jobId, 'team-leader')
  assert.match(job.jobDescription, /Lead the data processing and scraping team\./)
  assert.doesNotMatch(job.location, /elementor-location-footer|M40\.94,5\.617/)
})

test('Information Evolution returns the current first-party India job set', async () => {
  const informationEvolution = await loadInformationEvolutionModule()
  const requestedUrls = []

  const jobs = await informationEvolution.createInformationEvolutionScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === informationEvolution.JOBS_URL) {
        return jobsPageHtml
      }

      if (url === new URL('/job/team-leader/', informationEvolution.JOBS_URL).href) {
        return teamLeaderDetailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => new Date('2026-08-02T12:00:00.000Z'),
  })

  assert.deepEqual(requestedUrls, [
    informationEvolution.JOBS_URL,
    new URL('/job/team-leader/', informationEvolution.JOBS_URL).href,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'informationevolution')
  assert.equal(jobs[0].link, jobs[0].sourceUrl)
  assert.equal(jobs[0].scrapedAt, '2026-08-02T12:00:00.000Z')
})
