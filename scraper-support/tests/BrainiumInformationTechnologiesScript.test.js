import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Brainium | Join Our Team</title>
  </head>
  <body>
    <main>
      <h1>Build AI-First. Work with people who care about craft.</h1>
      <p>150+ Engineers on the team</p>
      <p>Kolkata Headquarters, India</p>
      <section>
        <h2>Open Positions</h2>
        <h3>Roles we're hiring for right now.</h3>
        <div class="careers-jobs-list">
          <a href="#" class="careers-job-card" data-category="engineering">
            <div class="careers-job-dept">Engineering</div>
            <h5 class="careers-job-title">Senior Full-Stack Engineer</h5>
            <div class="careers-job-tags">
              <span>React / Next.js</span><span>Node.js</span><span>TypeScript</span>
            </div>
            <div class="careers-job-meta">
              <span>Kolkata</span>
              <span>Full-time</span>
            </div>
          </a>
          <a href="#" class="careers-job-card" data-category="ai-data">
            <div class="careers-job-dept">AI &amp; Data</div>
            <h5 class="careers-job-title">AI / ML Engineer</h5>
            <div class="careers-job-tags">
              <span>Python</span><span>PyTorch</span><span>LangChain</span><span>LLM integration</span>
            </div>
            <div class="careers-job-meta">
              <span>Kolkata</span>
              <span>Full-time</span>
            </div>
          </a>
          <a href="#" class="careers-job-card" data-category="cloud-devops">
            <div class="careers-job-dept">Cloud &amp; DevOps</div>
            <h5 class="careers-job-title">Senior DevOps / Platform Engineer</h5>
            <div class="careers-job-tags">
              <span>Kubernetes</span><span>Terraform</span><span>AWS / Azure</span><span>GitHub Actions</span>
            </div>
            <div class="careers-job-meta">
              <span>Kolkata</span>
              <span>Full-time</span>
            </div>
          </a>
        </div>
      </section>
      <section>
        <h2>We're Hiring</h2>
        <p>We respond to every application within 5 business days.</p>
      </section>
    </main>
  </body>
</html>
`

const blockedPageHtml = `
<!DOCTYPE html>
<html class="no-js" lang="en-US">
  <head>
    <title>Attention Required! | Cloudflare</title>
  </head>
  <body>
    <div id="cf-wrapper">
      <div>Please enable cookies.</div>
      <h1>Sorry, you have been blocked</h1>
      <h2>You are unable to access brainiuminfotech.com</h2>
      <p>Cloudflare Ray ID: abc123</p>
    </div>
  </body>
</html>
`

const loadBrainiumModule = async () => {
  try {
    return await import('../../scraper/brainiuminformationtechnologies/script.js')
  } catch {
    assert.fail('Expected Brainium Information Technologies scraper module at ../../scraper/brainiuminformationtechnologies/script.js')
  }
}

test('Brainium Information Technologies extracts first-party open roles from the verified careers page', async () => {
  const brainium = await loadBrainiumModule()

  assert.equal(brainium.hasOfficialBrainiumCareersSignals(careersHtml), true)
  assert.deepEqual(brainium.extractRoleCards(careersHtml), [
    {
      title: 'Senior Full-Stack Engineer',
      department: 'Engineering',
      skills: ['React / Next.js', 'Node.js', 'TypeScript'],
      location: 'Kolkata, India',
      city: 'Kolkata',
      country: 'India',
      employmentType: 'Full-time',
      applyUrl: 'https://www.brainiuminfotech.com/careers#open-positions',
      sourceUrl: 'https://www.brainiuminfotech.com/careers#open-positions',
      jobId: 'senior-full-stack-engineer',
    },
    {
      title: 'AI / ML Engineer',
      department: 'AI & Data',
      skills: ['Python', 'PyTorch', 'LangChain', 'LLM integration'],
      location: 'Kolkata, India',
      city: 'Kolkata',
      country: 'India',
      employmentType: 'Full-time',
      applyUrl: 'https://www.brainiuminfotech.com/careers#open-positions',
      sourceUrl: 'https://www.brainiuminfotech.com/careers#open-positions',
      jobId: 'ai-ml-engineer',
    },
    {
      title: 'Senior DevOps / Platform Engineer',
      department: 'Cloud & DevOps',
      skills: ['Kubernetes', 'Terraform', 'AWS / Azure', 'GitHub Actions'],
      location: 'Kolkata, India',
      city: 'Kolkata',
      country: 'India',
      employmentType: 'Full-time',
      applyUrl: 'https://www.brainiuminfotech.com/careers#open-positions',
      sourceUrl: 'https://www.brainiuminfotech.com/careers#open-positions',
      jobId: 'senior-devops-platform-engineer',
    },
  ])
})

test('Brainium Information Technologies run returns structured jobs from the verified first-party careers page', async () => {
  const brainium = await loadBrainiumModule()
  const requestedUrls = []

  const jobs = await brainium.createBrainiumInformationTechnologiesScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, ['https://www.brainiuminfotech.com/careers'])
  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.department, job.city, job.country, job.source, job.scrapedAt]),
    [
      ['Senior Full-Stack Engineer', 'Engineering', 'Kolkata', 'India', 'brainiuminformationtechnologies', FIXED_SCRAPED_AT],
      ['AI / ML Engineer', 'AI & Data', 'Kolkata', 'India', 'brainiuminformationtechnologies', FIXED_SCRAPED_AT],
      ['Senior DevOps / Platform Engineer', 'Cloud & DevOps', 'Kolkata', 'India', 'brainiuminformationtechnologies', FIXED_SCRAPED_AT],
    ],
  )
  assert.ok(jobs.every((job) => job.publicExperienceChecked === true))
})

test('Brainium Information Technologies stops at the first blocked careers response with unknown inventory', async () => {
  const brainium = await loadBrainiumModule()
  const requestedUrls = []

  await assert.rejects(brainium.createBrainiumInformationTechnologiesScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === brainium.OFFICIAL_CAREERS_URL || url === brainium.OFFICIAL_HOMEPAGE_URL) {
        return {
          status: 403,
          url,
          headers: {
            server: 'cloudflare',
            'cf-ray': 'a2abd122184a398f-MAA',
          },
          html: blockedPageHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  }), /access denied.*HTTP 403.*inventory unknown/i)

  assert.equal(brainium.hasCloudflareBlockSignal(blockedPageHtml), true)
  assert.deepEqual(requestedUrls, [
    brainium.OFFICIAL_CAREERS_URL,
  ])
})

test('Brainium Information Technologies fails closed when the verified careers surface no longer exposes open roles', async () => {
  const brainium = await loadBrainiumModule()

  await assert.rejects(
    brainium.createBrainiumInformationTechnologiesScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    brainium.createBrainiumInformationTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === brainium.OFFICIAL_CAREERS_URL) {
          return {
            status: 403,
            url,
            headers: {
              server: 'cloudflare',
              'cf-ray': 'a2abd122184a398f-MAA',
            },
            html: blockedPageHtml,
          }
        }

        if (url === brainium.OFFICIAL_HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><body><h1>Brainium</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /access denied.*HTTP 403.*inventory unknown/i,
  )
})
