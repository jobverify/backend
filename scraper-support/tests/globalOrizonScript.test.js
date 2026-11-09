import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-14T10:00:00.000Z'

const loadGlobalOrizonModule = async () => {
  try {
    return await import('../../scraper/globalorizon/script.js')
  } catch {
    assert.fail('Expected Global Orizon scraper module at ../../scraper/globalorizon/script.js')
  }
}

const ourDataTeamHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Your Data Experts at your service, Call it ours | Global Orizon</title>
  </head>
  <body>
    <main>
      <h1>Do you know your data because Data is New Oil!</h1>
      <p>Data Engineering Perfected.</p>
      <p>OurDataTeam provides curated, labeled, and optimized training data services.</p>
      <a href="/the-hiring-partner-com">Our Hiring Partner</a>
    </main>
  </body>
</html>
`

const hiringPartnerHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Our Hiring Partner | Global Orizon</title>
  </head>
  <body>
    <main>
      <h1>Staffing & Recruitment Inclusive of BGV</h1>
      <h2>Join Our Team - We always hire</h2>
      <section>
        <h3><span>DevOps Engineers</span></h3>
        <p><span>India</span></p>
        <a href="https://www.thehiringpartner.com/" aria-label="Apply">Apply</a>
      </section>
      <section>
        <h3><span>Data Engineers</span></h3>
        <p><span>India</span></p>
        <a href="https://www.thehiringpartner.com/" aria-label="Apply">Apply</a>
      </section>
      <section>
        <h3><span>Security Engineer's</span></h3>
        <p><span>India</span></p>
        <a href="https://www.thehiringpartner.com/" aria-label="Apply">Apply</a>
      </section>
    </main>
  </body>
</html>
`

test('Global Orizon validates the Our Data Team and Our Hiring Partner surfaces before extracting public India roles', async () => {
  const globalOrizon = await loadGlobalOrizonModule()

  assert.equal(globalOrizon.OUR_DATA_TEAM_URL, 'https://www.globalorizon.com/our-data-team-com')
  assert.equal(
    globalOrizon.OUR_HIRING_PARTNER_URL,
    'https://www.globalorizon.com/the-hiring-partner-com',
  )
  assert.equal(globalOrizon.hasOfficialOurDataTeamSignal(ourDataTeamHtml), true)
  assert.equal(globalOrizon.hasOfficialHiringPartnerSignal(hiringPartnerHtml), true)
  assert.deepEqual(
    globalOrizon.extractHiringPartnerJobs(hiringPartnerHtml, {
      scrapedAt: FIXED_SCRAPED_AT,
    }),
    [
      {
        title: 'DevOps Engineers',
        company: 'Global Orizon',
        department: null,
        location: 'India',
        city: null,
        country: 'India',
        link: 'https://www.globalorizon.com/the-hiring-partner-com',
        applyUrl: 'https://www.thehiringpartner.com/',
        sourceUrl: 'https://www.globalorizon.com/the-hiring-partner-com',
        source: 'globalorizon',
        jobId: 'globalorizon-devops-engineers',
        requisitionId: 'globalorizon-devops-engineers',
        employmentType: null,
        experienceRequired: null,
        jobDescription: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        remoteStatus: null,
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Data Engineers',
        company: 'Global Orizon',
        department: null,
        location: 'India',
        city: null,
        country: 'India',
        link: 'https://www.globalorizon.com/the-hiring-partner-com',
        applyUrl: 'https://www.thehiringpartner.com/',
        sourceUrl: 'https://www.globalorizon.com/the-hiring-partner-com',
        source: 'globalorizon',
        jobId: 'globalorizon-data-engineers',
        requisitionId: 'globalorizon-data-engineers',
        employmentType: null,
        experienceRequired: null,
        jobDescription: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        remoteStatus: null,
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: "Security Engineer's",
        company: 'Global Orizon',
        department: null,
        location: 'India',
        city: null,
        country: 'India',
        link: 'https://www.globalorizon.com/the-hiring-partner-com',
        applyUrl: 'https://www.thehiringpartner.com/',
        sourceUrl: 'https://www.globalorizon.com/the-hiring-partner-com',
        source: 'globalorizon',
        jobId: 'globalorizon-security-engineers',
        requisitionId: 'globalorizon-security-engineers',
        employmentType: null,
        experienceRequired: null,
        jobDescription: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        remoteStatus: null,
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

test('Global Orizon returns normalized India roles from the first-party hiring partner page', async () => {
  const globalOrizon = await loadGlobalOrizonModule()
  const requestedUrls = []

  const jobs = await globalOrizon.createGlobalOrizonScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === globalOrizon.OUR_DATA_TEAM_URL) return ourDataTeamHtml
      if (url === globalOrizon.OUR_HIRING_PARTNER_URL) return hiringPartnerHtml
      throw new Error(`Unexpected Global Orizon HTML fixture URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedUrls, [
    globalOrizon.OUR_DATA_TEAM_URL,
    globalOrizon.OUR_HIRING_PARTNER_URL,
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].title, 'DevOps Engineers')
  assert.equal(jobs[1].title, 'Data Engineers')
  assert.equal(jobs[2].title, "Security Engineer's")
  assert.equal(jobs[2].applyUrl, 'https://www.thehiringpartner.com/')
  assert.equal(jobs[2].sourceUrl, 'https://www.globalorizon.com/the-hiring-partner-com')
  assert.equal(jobs[2].country, 'India')
  assert.equal(jobs[2].scrapedAt, FIXED_SCRAPED_AT)
})

test('Global Orizon fails closed when the brand pages change or the hiring partner page no longer exposes public roles', async () => {
  const globalOrizon = await loadGlobalOrizonModule()

  await assert.rejects(
    globalOrizon.createGlobalOrizonScraper().run({
      fetchText: async (url) => {
        if (url === globalOrizon.OUR_DATA_TEAM_URL) {
          return '<html><body><h1>Data Services</h1></body></html>'
        }

        return hiringPartnerHtml
      },
    }),
    /Global Orizon Our Data Team surface changed/i,
  )

  await assert.rejects(
    globalOrizon.createGlobalOrizonScraper().run({
      fetchText: async (url) => {
        if (url === globalOrizon.OUR_DATA_TEAM_URL) return ourDataTeamHtml
        if (url === globalOrizon.OUR_HIRING_PARTNER_URL) {
          return '<html><body><h1>Our Hiring Partner</h1><p>Open roles live now</p></body></html>'
        }

        throw new Error(`Unexpected Global Orizon HTML fixture URL: ${url}`)
      },
    }),
    /Global Orizon Hiring Partner surface changed/i,
  )

  await assert.rejects(
    globalOrizon.createGlobalOrizonScraper().run({
      fetchText: async (url) => {
        if (url === globalOrizon.OUR_DATA_TEAM_URL) return ourDataTeamHtml
        if (url === globalOrizon.OUR_HIRING_PARTNER_URL) {
          return `
            <!doctype html>
            <html lang="en">
              <body>
                <main>
                  <h1>Global Orizon</h1>
                  <h2>Join Our Team - We always hire</h2>
                  <p>Data Engineers</p>
                  <p>Learn more at thehiringpartner.com.</p>
                  <a href="https://www.thehiringpartner.com/">Apply</a>
                </main>
              </body>
            </html>
          `
        }
        throw new Error(`Unexpected Global Orizon HTML fixture URL: ${url}`)
      },
    }),
    /Global Orizon hiring partner page no longer exposes parseable public roles/i,
  )
})
