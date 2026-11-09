import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-27T00:00:00.000Z'

const INDIA_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>All Jobs | SIXT Jobs</title>
  </head>
  <body>
    <main>
      <h1>Join Team Orange in India!</h1>
      <h2>4 jobs located in India.</h2>
      <article class="job-card">
        <div class="job-card__business-area">TECH & Engineering</div>
        <a href="/in/jobs/f2e35a18-5799-4833-b1a3-c71e4c28619a">Senior Product Manager II (Salesforce)</a>
      </article>
      <article class="job-card">
        <div class="job-card__business-area">TECH & Engineering</div>
        <a href="/in/jobs/1cc60485-7bf0-40f6-be30-ff6bbcfc439f">Engineering Manager (Salesforce)</a>
      </article>
      <article class="job-card">
        <div class="job-card__business-area">TECH & Engineering</div>
        <a href="/in/jobs/5167a351-244f-4229-80f7-b094e9ce618b">AI Data Engineer III</a>
      </article>
      <article class="job-card">
        <div class="job-card__business-area">TECH & Engineering</div>
        <a href="/in/jobs/993f99e6-4492-4d83-b758-69a94d4faeea">Staff Data Engineer</a>
      </article>
      <button>Load more results</button>
    </main>
  </body>
</html>
`

const SENIOR_PRODUCT_MANAGER_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Senior Product Manager II (Salesforce) | SIXT Jobs</title>
  </head>
  <body>
    <main>
      <a href="/in/jobs?q=&country=IN">Back to results</a>
      <h1>Senior Product Manager II (Salesforce)</h1>
      <p>TECH & Engineering</p>
      <p>Full-time Bengaluru, India</p>
      <a href="#apply">Apply now</a>
      <p>SIXT's corporate business is growing and the Salesforce ecosystem sitting at its core needs an owner who can keep the pace.</p>
      <h2>YOUR ROLE AT SIXT</h2>
      <ul>
        <li>You own the roadmap.</li>
      </ul>
      <h2>YOUR SKILLS MATTER</h2>
      <ul>
        <li>Salesforce Expertise</li>
      </ul>
      <h2>WHAT WE OFFER</h2>
      <p>Competitive Compensation</p>
      <p>Postet on 14.07.2026</p>
    </main>
  </body>
</html>
`

const ENGINEERING_MANAGER_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Engineering Manager (Salesforce) | SIXT Jobs</title>
  </head>
  <body>
    <main>
      <a href="/in/jobs?q=&country=IN">Back to results</a>
      <h1>Engineering Manager (Salesforce)</h1>
      <p>TECH & Engineering</p>
      <p>Full-time Bengaluru, India</p>
      <a href="#apply">Apply now</a>
      <p>At SIXT, our B2B sales Engineering team builds the systems that power how we sell, retain, and grow our customer base across regions.</p>
      <h2>YOUR ROLE AT SIXT</h2>
      <ul>
        <li>You own the end-to-end success of our Salesforce platform domain.</li>
      </ul>
      <h2>YOUR SKILLS MATTER</h2>
      <ul>
        <li>Salesforce Expertise</li>
      </ul>
      <h2>WHAT WE OFFER</h2>
      <p>Comprehensive Benefits</p>
      <p>Postet on 07.07.2026</p>
    </main>
  </body>
</html>
`

const AI_DATA_ENGINEER_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>AI Data Engineer III | SIXT Jobs</title>
  </head>
  <body>
    <main>
      <a href="/in/jobs?q=&country=IN">Back to results</a>
      <h1>AI Data Engineer III</h1>
      <p>TECH & Engineering</p>
      <p>Full-time Bengaluru, India</p>
      <a href="#apply">Apply now</a>
      <p>Millions of events. Thousands of users. One platform built to turn data into decisions and you could be the one shaping it.</p>
      <h2>YOUR ROLE AT SIXT</h2>
      <ul>
        <li>You lead, explore, and implement the latest AWS and big data technologies.</li>
      </ul>
      <h2>YOUR SKILLS MATTER</h2>
      <ul>
        <li>Advanced proficiency in Python and SQL</li>
      </ul>
      <h2>WHAT WE OFFER</h2>
      <p>Hybrid Work policies</p>
      <p>Postet on 07.07.2026</p>
    </main>
  </body>
</html>
`

const SECURITY_ENGINEER_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Security Engineer II (AI) | SIXT Jobs</title>
  </head>
  <body>
    <main>
      <a href="/in/jobs?q=&country=IN">Back to results</a>
      <h1>Security Engineer II (AI)</h1>
      <p>TECH & Engineering</p>
      <p>Full-time Bengaluru, India</p>
      <a href="#apply">Apply now</a>
      <p>At SIXT, AI is changing how work gets done and we are looking for the person who will help us do it safely.</p>
      <h2>YOUR ROLE AT SIXT</h2>
      <ul>
        <li>You assess AI tooling and AI-built applications across SIXT.</li>
      </ul>
      <h2>YOUR SKILLS MATTER</h2>
      <ul>
        <li>AI Security</li>
      </ul>
      <h2>About us:</h2>
      <p>We are shaping the future of mobility.</p>
      <p>Postet on 25.07.2026</p>
    </main>
  </body>
</html>
`

const STAFF_DATA_ENGINEER_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Staff Data Engineer | SIXT Jobs</title>
  </head>
  <body>
    <main>
      <a href="/in/jobs?q=&country=IN">Back to results</a>
      <h1>Staff Data Engineer</h1>
      <p>TECH & Engineering</p>
      <p>Full-time Bengaluru, India</p>
      <a href="#apply">Apply now</a>
      <p>The central Business Intelligence team at SIXT builds and maintains the SIXT Data Platform and its Data Catalogue, serving thousands of users globally.</p>
      <h2>YOUR ROLE AT SIXT</h2>
      <ul>
        <li>You shape scalable data products.</li>
      </ul>
      <h2>YOUR SKILLS MATTER</h2>
      <ul>
        <li>Strong experience in distributed data systems</li>
      </ul>
      <h2>WHAT WE OFFER</h2>
      <p>Great employee benefits</p>
      <p>Postet on 02.07.2026</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/sixt/script.js')
  } catch {
    assert.fail('Expected Sixt scraper module at ../../scraper/sixt/script.js')
  }
}

test('Sixt helpers stay pinned to the verified first-party India jobs flow', async () => {
  const sixt = await loadModule()

  assert.equal(sixt.SOURCE, 'sixt')
  assert.equal(sixt.COMPANY_NAME, 'Sixt')
  assert.equal(sixt.OFFICIAL_BRAND_NAME, 'SIXT')
  assert.equal(sixt.VERIFIED_ON, '2026-07-27')
  assert.equal(sixt.INDIA_JOBS_URL, 'https://www.sixt.jobs/in/jobs?q=&country=IN')
  assert.equal(sixt.DETAIL_PAGE_PREFIX, 'https://www.sixt.jobs/in/jobs/')
  assert.equal(sixt.hasOfficialJobsPageSignal(INDIA_JOBS_HTML), true)
  assert.equal(sixt.hasOfficialJobDetailSignal(SECURITY_ENGINEER_DETAIL_HTML), true)
  assert.deepEqual(sixt.extractVisibleJobLinks(INDIA_JOBS_HTML), [
    {
      jobId: 'f2e35a18-5799-4833-b1a3-c71e4c28619a',
      title: 'Senior Product Manager II (Salesforce)',
      sourceUrl: 'https://www.sixt.jobs/in/jobs/f2e35a18-5799-4833-b1a3-c71e4c28619a',
      applyUrl: 'https://www.sixt.jobs/in/jobs/f2e35a18-5799-4833-b1a3-c71e4c28619a',
    },
    {
      jobId: '1cc60485-7bf0-40f6-be30-ff6bbcfc439f',
      title: 'Engineering Manager (Salesforce)',
      sourceUrl: 'https://www.sixt.jobs/in/jobs/1cc60485-7bf0-40f6-be30-ff6bbcfc439f',
      applyUrl: 'https://www.sixt.jobs/in/jobs/1cc60485-7bf0-40f6-be30-ff6bbcfc439f',
    },
    {
      jobId: '5167a351-244f-4229-80f7-b094e9ce618b',
      title: 'AI Data Engineer III',
      sourceUrl: 'https://www.sixt.jobs/in/jobs/5167a351-244f-4229-80f7-b094e9ce618b',
      applyUrl: 'https://www.sixt.jobs/in/jobs/5167a351-244f-4229-80f7-b094e9ce618b',
    },
    {
      jobId: '993f99e6-4492-4d83-b758-69a94d4faeea',
      title: 'Staff Data Engineer',
      sourceUrl: 'https://www.sixt.jobs/in/jobs/993f99e6-4492-4d83-b758-69a94d4faeea',
      applyUrl: 'https://www.sixt.jobs/in/jobs/993f99e6-4492-4d83-b758-69a94d4faeea',
    },
  ])
  assert.deepEqual(
    sixt.extractJobDetail(ENGINEERING_MANAGER_DETAIL_HTML, {
      jobId: '1cc60485-7bf0-40f6-be30-ff6bbcfc439f',
      title: 'Engineering Manager (Salesforce)',
      sourceUrl: 'https://www.sixt.jobs/in/jobs/1cc60485-7bf0-40f6-be30-ff6bbcfc439f',
      applyUrl: 'https://www.sixt.jobs/in/jobs/1cc60485-7bf0-40f6-be30-ff6bbcfc439f',
    }),
    {
      jobId: '1cc60485-7bf0-40f6-be30-ff6bbcfc439f',
      title: 'Engineering Manager (Salesforce)',
      department: 'TECH & Engineering',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      employmentType: 'Full-time',
      postingDate: '2026-07-07',
      jobDescription:
        'At SIXT, our B2B sales Engineering team builds the systems that power how we sell, retain, and grow our customer base across regions.',
      sourceUrl: 'https://www.sixt.jobs/in/jobs/1cc60485-7bf0-40f6-be30-ff6bbcfc439f',
      applyUrl: 'https://www.sixt.jobs/in/jobs/1cc60485-7bf0-40f6-be30-ff6bbcfc439f',
    },
  )
})

test('Sixt run validates the official India jobs page and enriches public roles from first-party detail pages', async () => {
  const sixt = await loadModule()
  const requestedUrls = []

  const jobs = await sixt.createSixtScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === sixt.INDIA_JOBS_URL) return INDIA_JOBS_HTML
      if (url === 'https://www.sixt.jobs/in/jobs/f2e35a18-5799-4833-b1a3-c71e4c28619a') return SENIOR_PRODUCT_MANAGER_DETAIL_HTML
      if (url === 'https://www.sixt.jobs/in/jobs/1cc60485-7bf0-40f6-be30-ff6bbcfc439f') return ENGINEERING_MANAGER_DETAIL_HTML
      if (url === 'https://www.sixt.jobs/in/jobs/5167a351-244f-4229-80f7-b094e9ce618b') return AI_DATA_ENGINEER_DETAIL_HTML
      if (url === 'https://www.sixt.jobs/in/jobs/993f99e6-4492-4d83-b758-69a94d4faeea') return STAFF_DATA_ENGINEER_DETAIL_HTML

      throw new Error(`Unexpected Sixt URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    sixt.INDIA_JOBS_URL,
    'https://www.sixt.jobs/in/jobs/f2e35a18-5799-4833-b1a3-c71e4c28619a',
    'https://www.sixt.jobs/in/jobs/1cc60485-7bf0-40f6-be30-ff6bbcfc439f',
    'https://www.sixt.jobs/in/jobs/5167a351-244f-4229-80f7-b094e9ce618b',
    'https://www.sixt.jobs/in/jobs/993f99e6-4492-4d83-b758-69a94d4faeea',
  ])
  assert.equal(jobs.length, 4)
  assert.deepEqual(jobs[0], {
    title: 'Senior Product Manager II (Salesforce)',
    company: 'Sixt',
    department: 'TECH & Engineering',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'f2e35a18-5799-4833-b1a3-c71e4c28619a',
    requisitionId: null,
    sourceUrl: 'https://www.sixt.jobs/in/jobs/f2e35a18-5799-4833-b1a3-c71e4c28619a',
    applyUrl: 'https://www.sixt.jobs/in/jobs/f2e35a18-5799-4833-b1a3-c71e4c28619a',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-14',
    closingDate: null,
    jobDescription:
      "SIXT's corporate business is growing and the Salesforce ecosystem sitting at its core needs an owner who can keep the pace.",
    source: 'sixt',
    link: 'https://www.sixt.jobs/in/jobs/f2e35a18-5799-4833-b1a3-c71e4c28619a',
    scrapedAt: FIXED_SCRAPED_AT,
  })
  assert.equal(jobs[1].title, 'Engineering Manager (Salesforce)')
  assert.equal(jobs[2].title, 'AI Data Engineer III')
  assert.equal(jobs[3].title, 'Staff Data Engineer')
})

test('Sixt fails closed when the verified India jobs page or detail pages drift materially', async () => {
  const sixt = await loadModule()

  await assert.rejects(
    sixt.createSixtScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified sixt india jobs page/i,
  )

  await assert.rejects(
    sixt.createSixtScraper().run({
      fetchText: async (url) => {
        if (url === sixt.INDIA_JOBS_URL) return INDIA_JOBS_HTML
        return ENGINEERING_MANAGER_DETAIL_HTML.replace('Apply now', 'Share this job')
      },
    }),
    /verified sixt job detail page/i,
  )
})
