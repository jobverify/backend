import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Atidan Technologies Pvt. Ltd.</title>
  </head>
  <body>
    <main>
      <h1>What is it like working on cutting edge technology</h1>
      <p>Creating exceptional careers with a strong purpose.</p>
      <article class="job-card">
        <time>June 19, 2026</time>
        <h4><a href="https://atidantech.com/sccm-l3-engineer/">SCCM L3 Engineer</a></h4>
      </article>
      <article class="job-card">
        <time>June 8, 2026</time>
        <h4><a href="https://atidantech.com/servicenow-hrsd-developer/">ServiceNow HRSD Developer</a></h4>
      </article>
    </main>
  </body>
</html>
`

const currentCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Atidan Technologies Pvt. Ltd.</title>
  </head>
  <body>
    <main>
      <h1>What is it like working on cutting edge technology</h1>
      <p>Creating exceptional careers with a strong purpose.</p>
      <article class="post post-item isotope-item clearfix no-img category-job">
        <div class="date_label">June 19, 2026</div>
        <div class="post-title"><h4 class="entry-title"><a href="https://atidantech.com/sccm-l3-engineer/">SCCM L3 Engineer</a></h4></div>
      </article>
      <article class="post post-item isotope-item clearfix no-img category-job">
        <div class="date_label">June 8, 2026</div>
        <div class="post-title"><h4 class="entry-title"><a href="https://atidantech.com/servicenow-hrsd-developer/">ServiceNow HRSD Developer</a></h4></div>
      </article>
    </main>
  </body>
</html>
`

const sccmDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>SCCM L3 Engineer</h1>
      <div><strong>LOCATION</strong> Remote</div>
      <div><strong>EXPERIENCE</strong> 15 - 20 years</div>
      <div><strong>FUNCTIONAL AREA</strong> Development</div>
      <h2>Key Responsibilities</h2>
      <ul>
        <li>Own end-to-end patch management for Windows servers and workstations using SCCM / MECM</li>
        <li>Design and maintain fully automated patching workflows using SCCM task sequences and PowerShell scripts</li>
      </ul>
    </main>
  </body>
</html>
`

const hrsdDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>ServiceNow HRSD Developer</h1>
      <div><strong>LOCATION</strong> Remote</div>
      <div><strong>EXPERIENCE</strong> 5 - 8 years</div>
      <div><strong>FUNCTIONAL AREA</strong> Development</div>
      <h2>Key Responsibilities</h2>
      <ul>
        <li>Develop and configure ServiceNow HRSD modules</li>
        <li>Collaborate with stakeholders to improve employee service delivery</li>
      </ul>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/atidantechnologies/script.js')
  } catch {
    assert.fail('Expected Atidan Technologies scraper module at ../../scraper/atidantechnologies/script.js')
  }
}

test('Atidan Technologies helpers stay pinned to the verified careers archive and role pages', async () => {
  const atidan = await loadModule()

  assert.equal(atidan.SOURCE, 'atidantechnologies')
  assert.equal(atidan.COMPANY, 'Atidan Technologies')
  assert.equal(atidan.CAREERS_URL, 'https://atidantech.com/careers/')
  assert.equal(atidan.VERIFIED_ON, '2026-07-18')
  assert.equal(atidan.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(atidan.hasOfficialCareersSignal('<html><body><h1>Careers</h1></body></html>'), false)
  assert.deepEqual(atidan.extractRoleSummaries(careersHtml), [
    {
      title: 'SCCM L3 Engineer',
      detailUrl: 'https://atidantech.com/sccm-l3-engineer/',
      postingDate: '2026-06-19',
    },
    {
      title: 'ServiceNow HRSD Developer',
      detailUrl: 'https://atidantech.com/servicenow-hrsd-developer/',
      postingDate: '2026-06-08',
    },
  ])

  const sccmDetail = atidan.extractRoleDetail(sccmDetailHtml, atidan.extractRoleSummaries(careersHtml)[0])
  assert.equal(sccmDetail.location, 'Remote, India')
  assert.equal(sccmDetail.department, 'Development')
  assert.equal(sccmDetail.remoteStatus, 'Remote')
  assert.equal(sccmDetail.experienceRequired, '15 - 20 years')
  assert.deepEqual(sccmDetail.requiredSkills, [
    'Own end-to-end patch management for Windows servers and workstations using SCCM / MECM',
    'Design and maintain fully automated patching workflows using SCCM task sequences and PowerShell scripts',
  ])
})

test('Atidan Technologies accepts the current careers archive cards with date_label metadata', async () => {
  const atidan = await loadModule()

  assert.equal(atidan.hasOfficialCareersSignal(currentCareersHtml), true)
  assert.deepEqual(atidan.extractRoleSummaries(currentCareersHtml), [
    {
      title: 'SCCM L3 Engineer',
      detailUrl: 'https://atidantech.com/sccm-l3-engineer/',
      postingDate: '2026-06-19',
    },
    {
      title: 'ServiceNow HRSD Developer',
      detailUrl: 'https://atidantech.com/servicenow-hrsd-developer/',
      postingDate: '2026-06-08',
    },
  ])
})

test('Atidan Technologies run validates the verified careers archive before hydrating detail pages', async () => {
  const atidan = await loadModule()
  const requestedUrls = []

  const jobs = await atidan.createAtidanTechnologiesScraper().run({
    now: () => FIXED_SCRAPED_AT,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === atidan.CAREERS_URL) return careersHtml
      if (url === 'https://atidantech.com/sccm-l3-engineer/') return sccmDetailHtml
      if (url === 'https://atidantech.com/servicenow-hrsd-developer/') return hrsdDetailHtml
      throw new Error(`Unexpected Atidan URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    atidan.CAREERS_URL,
    'https://atidantech.com/sccm-l3-engineer/',
    'https://atidantech.com/servicenow-hrsd-developer/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'atidantechnologies')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[1].title, 'ServiceNow HRSD Developer')
})

test('Atidan Technologies overlaps detail page fetches so live-slow role pages do not time out sequentially', async () => {
  const atidan = await loadModule()
  let activeDetails = 0
  let maxActiveDetails = 0

  const jobs = await atidan.createAtidanTechnologiesScraper().run({
    now: () => FIXED_SCRAPED_AT,
    fetchText: async (url) => {
      if (url === atidan.CAREERS_URL) return currentCareersHtml

      if (
        url === 'https://atidantech.com/sccm-l3-engineer/'
        || url === 'https://atidantech.com/servicenow-hrsd-developer/'
      ) {
        activeDetails += 1
        maxActiveDetails = Math.max(maxActiveDetails, activeDetails)
        await new Promise((resolve) => setTimeout(resolve, 20))
        activeDetails -= 1

        return url.includes('sccm-l3-engineer') ? sccmDetailHtml : hrsdDetailHtml
      }

      throw new Error(`Unexpected Atidan URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 2)
  assert.ok(maxActiveDetails > 1, `expected overlapping detail fetches, saw max concurrency ${maxActiveDetails}`)
})

test('Atidan Technologies run fails closed when the verified careers archive drifts', async () => {
  const atidan = await loadModule()

  await assert.rejects(
    atidan.createAtidanTechnologiesScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified atidan technologies careers archive/i,
  )
})
