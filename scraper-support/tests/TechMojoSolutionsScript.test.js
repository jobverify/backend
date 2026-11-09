import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T08:45:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at TechMojo | Build Systems at Scale</title>
    <link rel="canonical" href="https://techmojo.com/company/careers/" />
    <meta name="description" content="Explore careers at TechMojo in Hyderabad and build massively scalable platforms." />
  </head>
  <body>
    <span>Careers at TechMojo</span>
    <h1>Build where engineering is tested by reality.</h1>
    <a href="https://9am.careers/jobs/techmojo-solutions">View open roles</a>
    <a href="https://9am.careers/jobs/techmojo-solutions">Explore TechMojo jobs</a>
  </body>
</html>
`

const publicBoardHtml = `
<!doctype html>
<html lang="en">
  <head><title>9am Careers | Tech Jobs in India</title></head>
  <body>
    <script>
      (function(){
        const jobsData = ${JSON.stringify(JSON.stringify([
          {
            id: '0ca8adb1-854b-40c0-b086-bc9e1c550a33',
            title: 'Product Owner',
            description: '"<p>Own the product lifecycle.</p><ul><li>Define the product vision</li><li>The position is based in Hyderabad.</li></ul>"',
            company: 'TECHMOJO SOLUTIONS',
            displaySlug: 'techmojo-solutions',
            jobNameSlug: 'product-owner',
            sequenceNo: 101,
            jobUrlSegment: 'product-owner-101',
            location: 'HYDERABAD',
            location_extracted: {
              city: 'HYDERABAD',
              stateName: 'TELANGANA',
              raw_location: 'HYDERABAD',
              country: 'India',
              remote: false,
            },
            employment_type: 'FULL_TIME',
            workMode: 'WORK_FROM_OFFICE',
            created_at: '2026-08-17T11:13:32.994898',
            status: 'open',
            openings: 2,
          },
          {
            id: 'closed-role',
            title: 'Closed Role',
            company: 'TECHMOJO SOLUTIONS',
            displaySlug: 'techmojo-solutions',
            jobUrlSegment: 'closed-role-102',
            location: 'HYDERABAD',
            employment_type: 'FULL_TIME',
            status: 'closed',
          },
          {
            id: 'other-company',
            title: 'Other Company Role',
            company: 'OTHER',
            displaySlug: 'other-company',
            jobUrlSegment: 'other-role-1',
            location: 'BENGALURU',
            employment_type: 'FULL_TIME',
            status: 'open',
          },
        ]))};
        window.__jobs = JSON.parse(jobsData);
      })();
    </script>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/techmojosolutions/script.js')
  } catch {
    assert.fail('Expected TechMojo Solutions scraper module at ../../scraper/techmojosolutions/script.js')
  }
}

test('TechMojo Solutions helpers stay pinned to the current first-party careers handoff and 9am payload', async () => {
  const techmojo = await loadModule()

  assert.equal(techmojo.SOURCE, 'techmojosolutions')
  assert.equal(techmojo.COMPANY, 'TechMojo Solutions')
  assert.equal(techmojo.CAREERS_URL, 'https://techmojo.com/company/careers/')
  assert.equal(techmojo.PUBLIC_JOBS_URL, 'https://9am.careers/')
  assert.equal(techmojo.PUBLIC_COMPANY_BOARD_URL, 'https://9am.careers/jobs/techmojo-solutions/')
  assert.equal(techmojo.VERIFIED_ON, '2026-10-19')
  assert.equal(techmojo.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(techmojo.hasPublicJobsPayloadSignal(publicBoardHtml), true)
})

test('TechMojo Solutions run parses open TechMojo roles from the linked 9am public payload', async () => {
  const techmojo = await loadModule()
  const requestedUrls = []
  const jobs = await techmojo.createTechMojoSolutionsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === techmojo.CAREERS_URL) return careersHtml
      if (url === techmojo.PUBLIC_COMPANY_BOARD_URL) return publicBoardHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [techmojo.CAREERS_URL, techmojo.PUBLIC_COMPANY_BOARD_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Product Owner')
  assert.equal(jobs[0].location, 'Hyderabad, Telangana, India')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].sourceUrl, 'https://9am.careers/jobs/techmojo-solutions/product-owner-101/')
  assert.match(jobs[0].jobDescription, /Own the product lifecycle/i)
  assert.deepEqual(jobs[0].requiredSkills, [
    'Define the product vision',
    'The position is based in Hyderabad.',
  ])
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

const currentBoard = readFileSync(new URL('./fixtures/techmojosolutions/current-board.html', import.meta.url), 'utf8')
const angularDetail = readFileSync(new URL('./fixtures/techmojosolutions/angular-developer.html', import.meta.url), 'utf8')
const boardWithRecords = (records) => `<p class="company-header-count">${records.length} jobs available</p><script>const jobsData = ${JSON.stringify(JSON.stringify(records))};</script>`

test('TechMojo reads all twenty company-board rows rather than the root featured roles', async () => {
  const techmojo = await loadModule()
  const jobs = techmojo.extractJobs(currentBoard, FIXED_SCRAPED_AT)
  assert.equal(jobs.length, 20)
  const angular = jobs.find(job => job.title === 'Angular Developer')
  assert.equal(angular.city, 'Hyderabad')
  assert.equal(angular.sourceUrl, 'https://9am.careers/jobs/techmojo-solutions/angular-developer-17/')
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceUrl.includes('/jobs/techmojo-solutions/')))
})

test('TechMojo hydrates slim company-board records from matching official detail payloads', async () => {
  const techmojo = await loadModule()
  const [angular] = techmojo.extractPublicJobsPayload(currentBoard)
  const jobs = await techmojo.createTechMojoSolutionsScraper({ now: () => FIXED_SCRAPED_AT }).run({
    fetchText: async (url) => {
      if (url === techmojo.CAREERS_URL) return careersHtml
      if (url === 'https://9am.careers/jobs/techmojo-solutions/') return boardWithRecords([angular])
      if (url === 'https://9am.careers/jobs/techmojo-solutions/angular-developer-17/') return angularDetail
      throw new Error(`Unexpected URL: ${url}`)
    },
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '01c8eb8c-7e8b-4308-bd83-932bd8e0d097')
  assert.equal(jobs[0].location, 'Hyderabad, Telangana, India')
  assert.match(jobs[0].jobDescription, /Frontend Angular Developer/)
  assert.ok(jobs[0].requiredSkills.some(skill => /Angular/.test(skill)))
  assert.equal(jobs[0].remoteStatus, 'On-site')
})

test('TechMojo rejects truncated company-board payloads before fetching details', async () => {
  const techmojo = await loadModule()
  const rows = techmojo.extractPublicJobsPayload(currentBoard)
  await assert.rejects(techmojo.createTechMojoSolutionsScraper().run({
    fetchText: async (url) => {
      if (url === techmojo.CAREERS_URL) return careersHtml
      if (url === techmojo.PUBLIC_COMPANY_BOARD_URL) return boardWithRecords(rows.slice(1)).replace('19 jobs available', '20 jobs available')
      throw new Error('Details must not be fetched from an incomplete board')
    },
  }), /incomplete public company-board count/i)
})

test('TechMojo rejects incomplete detail hydration and employer or identity mismatches', async () => {
  const techmojo = await loadModule()
  const [angular] = techmojo.extractPublicJobsPayload(currentBoard)
  for (const detail of [
    '<html>No detail payload</html>',
    angularDetail.replace('"company":"TECHMOJO SOLUTIONS"', '"company":"TECHMOJO SOLUTIONS PARTNERS"'),
    angularDetail.replaceAll('01c8eb8c-7e8b-4308-bd83-932bd8e0d097', 'unrelated-role'),
  ]) {
    await assert.rejects(techmojo.createTechMojoSolutionsScraper().run({
      fetchText: async (url) => url === techmojo.CAREERS_URL ? careersHtml
        : url === techmojo.PUBLIC_COMPANY_BOARD_URL ? boardWithRecords([angular]) : detail,
    }), /detail|identity|employer|payload/i)
  }
})

test('TechMojo never labels foreign or ambiguous company-board locations as India', async () => {
  const techmojo = await loadModule()
  const [angular] = techmojo.extractPublicJobsPayload(currentBoard)
  assert.deepEqual(techmojo.extractJobs(boardWithRecords([{ ...angular, loc_country: 'United States', loc_city: 'Austin' }])), [])
  assert.throws(() => techmojo.extractJobs(boardWithRecords([{ ...angular, loc_country: null, loc_city: 'Remote', location: 'Remote' }])), /country|location|scope/i)
  assert.deepEqual(techmojo.extractJobs(boardWithRecords([{ ...angular, company: 'TECHMOJO SOLUTIONS PARTNERS' }])), [])
  assert.throws(() => techmojo.extractJobs(boardWithRecords([{ ...angular, jobUrlSegment: 'https://unrelated.example/apply' }])), /URL|segment|link/i)
  assert.throws(() => techmojo.extractJobs(boardWithRecords([angular, angular])), /duplicate|incomplete/i)
})

test('TechMojo Solutions fails closed when the trusted careers handoff or public payload changes materially', async () => {
  const techmojo = await loadModule()

  await assert.rejects(
    techmojo.createTechMojoSolutionsScraper().run({
      fetchText: async () => '<html><body><h1>Jobs</h1></body></html>',
    }),
    /verified TechMojo Solutions careers page/i,
  )

  await assert.rejects(
    techmojo.createTechMojoSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === techmojo.CAREERS_URL) return careersHtml
        return '<html><body>No public data</body></html>'
      },
    }),
    /9am public jobs payload/i,
  )
})
