import assert from 'node:assert/strict'
import test from 'node:test'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Opportunities - CircleCI</title>
    <link rel="canonical" href="https://circleci.com/careers/jobs/" />
  </head>
  <body>
    <main>
      <p>Posting expired</p>
      <h1>Current open roles</h1>
      <section>
        <h2>Engineering - Foundational Technology</h2>
        <a href="/careers/jobs/software-engineer-remote-uk">Software Engineer Remote, UK</a>
      </section>
      <section>
        <h2>Engineering - Product Experience</h2>
        <a href="/careers/jobs/senior-software-engineer-remote-ontario-canada">Senior Software Engineer Remote, Ontario, Canada</a>
        <a href="/careers/jobs/software-engineer-toronto-ontario">Software Engineer Toronto, Ontario</a>
      </section>
      <section>
        <h2>Product</h2>
        <a href="/careers/jobs/product-manager-san-francisco-toronto">Product Manager San Francisco, Toronto</a>
      </section>
      <section>
        <h2>Sales</h2>
        <a href="/careers/jobs/commercial-client-account-executive-san-francisco">Commercial Client Account Executive San Francisco</a>
        <a href="/careers/jobs/sales-manager-san-francisco">Sales Manager San Francisco</a>
      </section>
    </main>
  </body>
</html>
`

const INDIA_ROLE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Opportunities - CircleCI</title>
  </head>
  <body>
    <main>
      <p>Posting expired</p>
      <h1>Current open roles</h1>
      <section>
        <h2>Engineering - Product Experience</h2>
        <a href="/careers/jobs/software-engineer-bengaluru-india">Software Engineer Bengaluru, India</a>
      </section>
    </main>
  </body>
</html>
`

const loadCircleCiModule = async () => {
  try {
    return await import('../../scraper/circleci/script.js')
  } catch {
    assert.fail('Expected CircleCI scraper module at ../../scraper/circleci/script.js')
  }
}

test('CircleCI pins the verified first-party careers page and extracts same-domain role links', async () => {
  const circleci = await loadCircleCiModule()

  assert.equal(circleci.SOURCE, 'circleci')
  assert.equal(circleci.COMPANY, 'CircleCI')
  assert.equal(circleci.OFFICIAL_BRAND_NAME, 'CircleCI')
  assert.equal(circleci.VERIFIED_ON, null)
  assert.equal(circleci.CAREERS_PAGE_URL, 'https://circleci.com/careers/jobs/')
  assert.equal(circleci.hasVerifiedCareersPageSignal(OFFICIAL_CAREERS_HTML), true)
  assert.deepEqual(circleci.extractRoleSummaries(OFFICIAL_CAREERS_HTML), [
    {
      title: 'Software Engineer',
      location: 'Remote, UK',
      department: 'Engineering - Foundational Technology',
      url: 'https://circleci.com/careers/jobs/software-engineer-remote-uk',
    },
    {
      title: 'Senior Software Engineer',
      location: 'Remote, Ontario, Canada',
      department: 'Engineering - Product Experience',
      url: 'https://circleci.com/careers/jobs/senior-software-engineer-remote-ontario-canada',
    },
    {
      title: 'Software Engineer',
      location: 'Toronto, Ontario',
      department: 'Engineering - Product Experience',
      url: 'https://circleci.com/careers/jobs/software-engineer-toronto-ontario',
    },
    {
      title: 'Product Manager',
      location: 'San Francisco, Toronto',
      department: 'Product',
      url: 'https://circleci.com/careers/jobs/product-manager-san-francisco-toronto',
    },
    {
      title: 'Commercial Client Account Executive',
      location: 'San Francisco',
      department: 'Sales',
      url: 'https://circleci.com/careers/jobs/commercial-client-account-executive-san-francisco',
    },
    {
      title: 'Sales Manager',
      location: 'San Francisco',
      department: 'Sales',
      url: 'https://circleci.com/careers/jobs/sales-manager-san-francisco',
    },
  ])
})

test('CircleCI does not promote a legacy summary-only page into verified India absence', async () => {
  const circleci = await loadCircleCiModule()
  const requestedUrls = []

  await assert.rejects(circleci.createCircleCiScraper({
    fetchImpl: async (url) => {
      requestedUrls.push(url)
      const response = new Response(OFFICIAL_CAREERS_HTML, { headers: { 'content-type': 'text/html' } })
      Object.defineProperty(response, 'url', { value: url })
      return response
    },
  }).run(), /current open roles scope missing/)

  assert.deepEqual(requestedUrls, [circleci.CAREERS_PAGE_URL])
})

test('CircleCI requires current native inventory proof for changed pages and legacy India cards', async () => {
  const circleci = await loadCircleCiModule()

  for (const html of ['<html><body><h1>Unexpected</h1></body></html>', INDIA_ROLE_HTML]) {
    await assert.rejects(circleci.createCircleCiScraper({ fetchImpl: async url => {
      const response = new Response(html, { headers: { 'content-type': 'text/html' } })
      Object.defineProperty(response, 'url', { value: url })
      return response
    } }).run(), /publisher title differs|current open roles scope missing/)
  }
})
