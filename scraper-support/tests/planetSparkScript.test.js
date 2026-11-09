import assert from 'node:assert/strict'
import test from 'node:test'

const loadPlanetSparkModule = async () => {
  try {
    return await import('../../scraper/planetspark/script.js')
  } catch {
    return null
  }
}

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <section>
        <h2>Explore a career @ PlanetSpark</h2>
        <h3>Live 1:1 Online Classes for Public Speaking & Creative Writing</h3>
        <h1>We're hiring for these roles</h1>

        <div class="career-card">
          <h4>Online English Teacher</h4>
          <div>location_on Work From Home</div>
          <div>calendar_today 1 to 20 Years</div>
          <a href="/careers/online-english-teacher">View &amp; Apply</a>
        </div>

        <div class="career-card">
          <h4>Front End Developer</h4>
          <div>access_time Full time</div>
          <div>location_on Work From Home</div>
          <div>calendar_today 1 to 20 Years</div>
          <a href="/careers/front-end-developer">View &amp; Apply</a>
        </div>

        <div class="career-card">
          <h4>Ruby On Rails Developer</h4>
          <div>access_time Full time</div>
          <div>location_on Gurugram, Haryana (Work from office)</div>
          <div>calendar_today 1 to 4 yrs</div>
          <a href="/careers/ruby-on-rails-developer">View &amp; Apply</a>
        </div>
      </section>

      <p>For job application related queries, kindly reach out to teach@planetspark.in</p>
    </main>
  </body>
</html>
`

const currentCareersPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <section>
        <h2>Explore a career @ PlanetSpark</h2>
        <h3>Live 1:1 Online Classes for Public Speaking & Creative Writing</h3>
        <h1>
          We're
          <br />
          hiring
          <br />
          for these
          <br />
          roles
        </h1>

        <div class="card">
          <div class="card-body">
            <h4 class="new_career_card_title">Online English Teacher</h4>
            <p class="text-uppercase mb-2">
              <i class="material-icons career-icon-color">location_on</i>
              <span>Work From Home</span>
            </p>
            <p class="text-uppercase mb-2">
              <i class="material-icons career-icon-color">calendar_today</i>
              <span>1 to 20 Years</span>
            </p>
            <a href="/careers/32-full-time-jobs-online-english-teacher-work-from-home">View &amp; Apply</a>
          </div>
        </div>

        <div class="card">
          <div class="card-body">
            <h4 class="new_career_card_title">Ruby On Rails Developer</h4>
            <p class="text-uppercase mb-2">
              <i class="material-icons career-icon-color">access_time</i>
              <span>Full time</span>
            </p>
            <p class="text-uppercase mb-2">
              <i class="material-icons career-icon-color">location_on</i>
              <span>Gurugram, Haryana (Work from office)</span>
            </p>
            <p class="text-uppercase mb-2">
              <i class="material-icons career-icon-color">calendar_today</i>
              <span>1 to 4 yrs</span>
            </p>
            <a href="/careers/54-full-time-jobs-ruby-on-rails-developer-gurugram-haryana-work-from-office-">View &amp; Apply</a>
          </div>
        </div>
      </section>

      <p>For job application related queries, kindly reach out to teach@planetspark.in</p>
    </main>
  </body>
</html>
`

test('PlanetSpark scraper recognizes the verified official careers page and extracts public role cards', async () => {
  const planetSpark = await loadPlanetSparkModule()
  assert.ok(planetSpark, 'Expected PlanetSpark scraper module at ../../scraper/planetspark/script.js')

  assert.equal(planetSpark.SOURCE, 'planetspark')
  assert.equal(planetSpark.COMPANY, 'PlanetSpark')
  assert.equal(planetSpark.CAREERS_URL, 'https://www.planetspark.in/careers')
  assert.equal(planetSpark.hasOfficialCareersSignal(careersPageHtml), true)

  assert.deepEqual(planetSpark.extractRoleCards(careersPageHtml), [
    {
      title: 'Online English Teacher',
      location: 'Work From Home, India',
      city: null,
      employmentType: null,
      experienceRequired: '1 to 20 Years',
      sourceUrl: 'https://www.planetspark.in/careers',
      applyUrl: 'https://www.planetspark.in/careers',
    },
    {
      title: 'Front End Developer',
      location: 'Work From Home, India',
      city: null,
      employmentType: 'Full time',
      experienceRequired: '1 to 20 Years',
      sourceUrl: 'https://www.planetspark.in/careers',
      applyUrl: 'https://www.planetspark.in/careers',
    },
    {
      title: 'Ruby On Rails Developer',
      location: 'Gurugram, Haryana (Work from office), India',
      city: 'Gurgaon',
      employmentType: 'Full time',
      experienceRequired: '1 to 4 yrs',
      sourceUrl: 'https://www.planetspark.in/careers',
      applyUrl: 'https://www.planetspark.in/careers',
    },
  ])
  assert.deepEqual(planetSpark.extractRoleCards(currentCareersPageHtml), [
    {
      title: 'Online English Teacher',
      location: 'Work From Home, India',
      city: null,
      employmentType: null,
      experienceRequired: '1 to 20 Years',
      sourceUrl: 'https://www.planetspark.in/careers',
      applyUrl: 'https://www.planetspark.in/careers',
    },
    {
      title: 'Ruby On Rails Developer',
      location: 'Gurugram, Haryana (Work from office), India',
      city: 'Gurgaon',
      employmentType: 'Full time',
      experienceRequired: '1 to 4 yrs',
      sourceUrl: 'https://www.planetspark.in/careers',
      applyUrl: 'https://www.planetspark.in/careers',
    },
  ])
})

test('run validates the official PlanetSpark careers surface and decorates public jobs', async () => {
  const planetSpark = await loadPlanetSparkModule()
  assert.ok(planetSpark, 'Expected PlanetSpark scraper module at ../../scraper/planetspark/script.js')

  const requestedUrls = []
  const jobs = await planetSpark.createPlanetSparkScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === planetSpark.CAREERS_URL) return careersPageHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, ['https://www.planetspark.in/careers'])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].company, 'PlanetSpark')
  assert.equal(jobs[0].source, 'planetspark')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].link, 'https://www.planetspark.in/careers')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
  assert.notEqual(jobs[1].jobId, jobs[2].jobId)
})

test('run fails closed when the PlanetSpark careers page no longer matches the verified public surface', async () => {
  const planetSpark = await loadPlanetSparkModule()
  assert.ok(planetSpark, 'Expected PlanetSpark scraper module at ../../scraper/planetspark/script.js')

  await assert.rejects(
    planetSpark.createPlanetSparkScraper().run({
      fetchText: async () => '<main>No public careers board here anymore</main>',
    }),
    /verified official public careers surface/i,
  )
})

test('PlanetSpark accepts the verified careers heading when the apostrophe is curly', async () => {
  const planetSpark = await loadPlanetSparkModule()
  const curlyApostropheHtml = careersPageHtml.replace("We're", 'We\u2019re')

  assert.equal(planetSpark.hasOfficialCareersSignal(curlyApostropheHtml), true)
  assert.equal(planetSpark.extractRoleCards(curlyApostropheHtml).length, 3)
})
