import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>We're Hiring! Join Dialpad's UCaaS, CCaaS, and AI-focused Team | Dialpad</title>
  </head>
  <body>
    <p>CAREERS AT DIALPAD</p>
    <h1>Come join our team</h1>
    <p>Dream jobs across the planet</p>
    <p>Bengaluru, India</p>
    <a href="/careers/open-opportunities/">See all jobs</a>
  </body>
</html>
`

const OPEN_OPPORTUNITIES_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Opportunities at Dialpad | Dialpad</title>
  </head>
  <body>
    <h1>Open Opportunities</h1>
    <p>All locations</p>
    <select><option value="bengaluru-india">Bengaluru, India</option></select>
    <div class="w-full lg:grid lg:grid-cols-10">
      <div class="col-span-6"><strong>QA Automation Engineer</strong></div>
      <div class="col-span-3 text-ultra-dark-tan">Bengaluru, India</div>
      <div class="col-span-1">
        <a href="/careers/open-opportunities/apply/?id=8407056002&title=QA-Automation-Engineer&officeId=4017032002&location=Bengaluru-India">Apply</a>
      </div>
    </div>
    <div class="w-full lg:grid lg:grid-cols-10">
      <div class="col-span-6"><strong>Analytics Engineer</strong></div>
      <div class="col-span-3 text-ultra-dark-tan">Buenos Aires, Argentina</div>
      <div class="col-span-1">
        <a href="/careers/open-opportunities/apply/?id=1234567890&title=Analytics-Engineer&officeId=4017289002&location=Buenos-Aires-Argentina">Apply</a>
      </div>
    </div>
    <div class="w-full lg:grid lg:grid-cols-10">
      <div class="col-span-6"><strong>Sr. Software Engineer (Search)</strong></div>
      <div class="col-span-3 text-ultra-dark-tan">Bengaluru, India</div>
      <div class="col-span-1">
        <a href="/careers/open-opportunities/apply/?id=8541115002&title=Sr.-Software-Engineer-%28Search%29&officeId=4017032002&location=Bengaluru-India">Apply</a>
      </div>
    </div>
  </body>
</html>
`

const QA_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <a href="/careers/open-opportunities/">Back to all jobs</a>
    <h2 class="my-[42px]">QA Automation Engineer</h2>
    <div class="flex">
      <span class="text-xl font-semibold">Quality Assurance</span>
      <span class="mb-8 ml-10 mt-0 flex items-center text-xl font-semibold">
        <svg fill="none" viewBox="0 0 14 18" class="mr-2 h-[20px] w-[20px] text-dp-purple">
          <path fill="currentColor" d="M14 7c0-3.9-3.1-7-7-7S0 3.1 0 7"></path>
        </svg>
        Bengaluru, India
      </span>
    </div>
    <div class="job-details-wrapper">
      <div class="content-intro">
        <p><strong>About Dialpad</strong></p>
        <p>Dialpad is the AI-native business communications platform.</p>
        <p>Build, execute, and maintain UI and API automated tests.</p>
      </div>
    </div>
    <a class="btn-primary btn-primary-secondary-styles" rel="noreferrer" target="_blank" href="https://boards.greenhouse.io/dialpad/jobs/8407056002">Apply for this position</a>
  </body>
</html>
`

const SEARCH_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <a href="/careers/open-opportunities/">Back to all jobs</a>
    <h2 class="my-[42px]">Sr. Software Engineer (Search)</h2>
    <div class="flex">
      <span class="text-xl font-semibold">Platform Engineering</span>
      <span class="mb-8 ml-10 mt-0 flex items-center text-xl font-semibold">Bengaluru, India</span>
    </div>
    <div class="job-details-wrapper">
      <div class="content-intro">
        <p>Dialpad's Analytics team owns data pipelines and rich FE components.</p>
        <p>This position reports to the Engineering Manager, based in Bengaluru.</p>
      </div>
    </div>
    <a class="btn-primary btn-primary-secondary-styles" rel="noreferrer" target="_blank" href="https://boards.greenhouse.io/dialpad/jobs/8541115002">Apply for this position</a>
  </body>
</html>
`

const loadDialpadModule = async () => {
  try {
    return await import('../../scraper/dialpad/script.js')
  } catch {
    assert.fail('Expected Dialpad scraper module at ../../scraper/dialpad/script.js')
  }
}

test('Dialpad scraper helpers stay pinned to the verified careers page, India listing cards, and first-party detail pages', async () => {
  const dialpad = await loadDialpadModule()

  assert.equal(dialpad.SOURCE, 'dialpad')
  assert.equal(dialpad.COMPANY, 'Dialpad')
  assert.equal(dialpad.CAREERS_URL, 'https://www.dialpad.com/careers/')
  assert.equal(dialpad.OPEN_OPPORTUNITIES_URL, 'https://www.dialpad.com/careers/open-opportunities/')
  assert.equal(dialpad.hasVerifiedCareersPageSignal(CAREERS_HTML), true)
  assert.equal(dialpad.extractOpenOpportunitiesUrl(CAREERS_HTML), dialpad.OPEN_OPPORTUNITIES_URL)
  assert.equal(dialpad.hasVerifiedOpenOpportunitiesSignal(OPEN_OPPORTUNITIES_HTML), true)

  const cards = dialpad.extractIndiaJobCards(OPEN_OPPORTUNITIES_HTML)
  assert.deepEqual(
    cards.map((card) => [card.title, card.location, card.detailUrl]),
    [
      [
        'QA Automation Engineer',
        'Bengaluru, India',
        'https://www.dialpad.com/careers/open-opportunities/apply/?id=8407056002&title=QA-Automation-Engineer&officeId=4017032002&location=Bengaluru-India',
      ],
      [
        'Sr. Software Engineer (Search)',
        'Bengaluru, India',
        'https://www.dialpad.com/careers/open-opportunities/apply/?id=8541115002&title=Sr.-Software-Engineer-%28Search%29&officeId=4017032002&location=Bengaluru-India',
      ],
    ],
  )

  const qaJob = dialpad.extractJobDetail(
    QA_DETAIL_HTML,
    'https://www.dialpad.com/careers/open-opportunities/apply/?id=8407056002&location=Bengaluru-India&officeId=4017032002&title=QA-Automation-Engineer',
  )

  assert.equal(qaJob.title, 'QA Automation Engineer')
  assert.equal(qaJob.department, 'Quality Assurance')
  assert.equal(qaJob.location, 'Bengaluru, India')
  assert.equal(qaJob.city, 'Bengaluru')
  assert.equal(qaJob.country, 'India')
  assert.equal(qaJob.jobId, '8407056002')
  assert.equal(qaJob.applyUrl, 'https://boards.greenhouse.io/dialpad/jobs/8407056002')
  assert.match(qaJob.jobDescription, /AI-native business communications platform/i)
})

test('Dialpad run returns normalized India jobs from the verified first-party listing and detail pages', async () => {
  const dialpad = await loadDialpadModule()
  const requestedUrls = []

  const jobs = await dialpad.createDialpadScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === dialpad.CAREERS_URL) {
        return { status: 200, url, html: CAREERS_HTML }
      }

      if (url === dialpad.OPEN_OPPORTUNITIES_URL) {
        return { status: 200, url, html: OPEN_OPPORTUNITIES_HTML }
      }

      if (url.includes('8407056002')) {
        return { status: 200, url, html: QA_DETAIL_HTML }
      }

      if (url.includes('8541115002')) {
        return { status: 200, url, html: SEARCH_DETAIL_HTML }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-15T10:30:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    dialpad.CAREERS_URL,
    dialpad.OPEN_OPPORTUNITIES_URL,
    'https://www.dialpad.com/careers/open-opportunities/apply/?id=8407056002&title=QA-Automation-Engineer&officeId=4017032002&location=Bengaluru-India',
    'https://www.dialpad.com/careers/open-opportunities/apply/?id=8541115002&title=Sr.-Software-Engineer-%28Search%29&officeId=4017032002&location=Bengaluru-India',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.department, job.location, job.link]),
    [
      [
        'QA Automation Engineer',
        'Quality Assurance',
        'Bengaluru, India',
        'https://boards.greenhouse.io/dialpad/jobs/8407056002',
      ],
      [
        'Sr. Software Engineer (Search)',
        'Platform Engineering',
        'Bengaluru, India',
        'https://boards.greenhouse.io/dialpad/jobs/8541115002',
      ],
    ],
  )
})

test('Dialpad fails closed when the careers handoff, listing structure, or detail-page apply contract drifts', async () => {
  const dialpad = await loadDialpadModule()

  await assert.rejects(
    dialpad.createDialpadScraper().run({
      fetchPage: async () => ({ status: 200, url: dialpad.CAREERS_URL, html: '<html><body>Unexpected</body></html>' }),
    }),
    /careers page no longer matches/i,
  )

  await assert.rejects(
    dialpad.createDialpadScraper().run({
      fetchPage: async (url) => {
        if (url === dialpad.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: CAREERS_HTML.replace('/careers/open-opportunities/', '/careers/jobs/'),
          }
        }

        return { status: 200, url, html: OPEN_OPPORTUNITIES_HTML }
      },
    }),
    /careers handoff changed/i,
  )

  await assert.rejects(
    dialpad.createDialpadScraper().run({
      fetchPage: async (url) => {
        if (url === dialpad.CAREERS_URL) {
          return { status: 200, url, html: CAREERS_HTML }
        }

        return { status: 200, url, html: '<html><body><h1>Open Opportunities</h1></body></html>' }
      },
    }),
    /open opportunities page no longer matches/i,
  )

  await assert.rejects(
    dialpad.createDialpadScraper().run({
      fetchPage: async (url) => {
        if (url === dialpad.CAREERS_URL) {
          return { status: 200, url, html: CAREERS_HTML }
        }

        if (url === dialpad.OPEN_OPPORTUNITIES_URL) {
          return { status: 200, url, html: OPEN_OPPORTUNITIES_HTML }
        }

        return {
          status: 200,
          url,
          html: QA_DETAIL_HTML.replace('https://boards.greenhouse.io/dialpad/jobs/8407056002', ''),
        }
      },
    }),
    /job detail page no longer matches/i,
  )
})
