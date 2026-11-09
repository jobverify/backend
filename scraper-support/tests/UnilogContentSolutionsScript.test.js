import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-06T00:00:00.000Z'

const verifiedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Unilog</title>
  </head>
  <body>
    <section>
      <h1>Build What's Next in B2B Commerce. Together.</h1>
      <h2>Open Roles</h2>
      <article class="job-role-card">
        <a href="https://www.unilogcorp.com/careers/java-software-developer-cx1-platform/">
          <h3>Java Software Developer (CX1 Platform)</h3>
        </a>
        <p>Full Time</p>
        <p>Bangalore</p>
        <p>Mysore</p>
        <p>Remote</p>
      </article>
      <article class="job-role-card">
        <a href="https://www.unilogcorp.com/careers/software-test-engineer-accelq-selenium-python/">
          <h3>Software Test Engineer - AccelQ & Selenium/Python (Ecomm Domain)</h3>
        </a>
        <p>Full Time</p>
        <p>Mysore/Bangalore/Remote</p>
      </article>
    </section>
  </body>
</html>
`

const CLOUDFLARE_BLOCKED_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Just a moment...</title>
    <meta name="robots" content="noindex,nofollow">
  </head>
  <body>
    <div class="cf-browser-verification cf-im-under-attack">
      <h1>Just a moment...</h1>
      <p>Please enable JavaScript and cookies to continue</p>
      <p>Performance &amp; security by Cloudflare</p>
    </div>
    <script src="https://challenges.cloudflare.com/turnstile/v0/beta/cf-challenge.js"></script>
  </body>
</html>
`

const loadUnilogModule = async () => {
  try {
    return await import('../../scraper/unilogcontentsolutions/script.js')
  } catch {
    assert.fail('Expected Unilog Content Solutions scraper module at ../../scraper/unilogcontentsolutions/script.js')
  }
}

test('Unilog Content Solutions helpers stay pinned to the verified Cloudflare challenge contract', async () => {
  const unilog = await loadUnilogModule()

  assert.equal(unilog.SOURCE, 'unilogcontentsolutions')
  assert.equal(unilog.COMPANY_NAME, 'Unilog Content Solutions ( P)')
  assert.equal(unilog.OFFICIAL_BRAND_NAME, 'Unilog')
  assert.equal(unilog.VERIFIED_ON, '2026-08-06')
  assert.equal(unilog.OFFICIAL_CAREERS_URL, 'https://www.unilogcorp.com/careers/')
  assert.equal(typeof unilog.hasVerifiedCloudflareChallengeSignal, 'function')
  assert.equal(unilog.hasVerifiedCloudflareChallengeSignal(CLOUDFLARE_BLOCKED_HTML), true)
  assert.equal(unilog.hasVerifiedCloudflareChallengeSignal(verifiedCareersHtml), false)
  assert.equal(unilog.hasOfficialUnilogCareersSignals(verifiedCareersHtml), true)
  assert.deepEqual(unilog.extractVisibleRoleCards(verifiedCareersHtml), [
    {
      title: 'Java Software Developer (CX1 Platform)',
      location: 'Bangalore / Mysore / Remote',
      cities: ['Bangalore', 'Mysore'],
      country: 'India',
      sourceUrl: 'https://www.unilogcorp.com/careers/java-software-developer-cx1-platform/',
      applyUrl: 'https://www.unilogcorp.com/careers/java-software-developer-cx1-platform/',
      employmentType: 'Full Time',
      jobId: 'java-software-developer-cx1-platform',
    },
    {
      title: 'Software Test Engineer - AccelQ & Selenium/Python (Ecomm Domain)',
      location: 'Mysore/Bangalore/Remote',
      cities: ['Mysore', 'Bangalore'],
      country: 'India',
      sourceUrl: 'https://www.unilogcorp.com/careers/software-test-engineer-accelq-selenium-python/',
      applyUrl: 'https://www.unilogcorp.com/careers/software-test-engineer-accelq-selenium-python/',
      employmentType: 'Full Time',
      jobId: 'software-test-engineer-accelq-selenium-python',
    },
  ])
})

test('Unilog Content Solutions returns [] while the verified first-party routes remain Cloudflare-challenged', async () => {
  const { createUnilogContentSolutionsScraper } = await loadUnilogModule()
  const requestedUrls = []
  const scraper = createUnilogContentSolutionsScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 403,
        url,
        headers: {
          server: 'cloudflare',
          'cf-ray': `${requestedUrls.length}-MAA`,
        },
        html: CLOUDFLARE_BLOCKED_HTML,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.unilogcorp.com/',
    'https://www.unilogcorp.com/careers/',
  ])
  assert.deepEqual(jobs, [])
})

test('Unilog Content Solutions fails closed when the verified blocked routes drift or public jobs become reachable again', async () => {
  const { createUnilogContentSolutionsScraper } = await loadUnilogModule()
  const scraper = createUnilogContentSolutionsScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  await assert.rejects(
    scraper.run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        headers: {},
        html: verifiedCareersHtml,
      }),
    }),
    /verified Cloudflare-challenged first-party state/i,
  )

  await assert.rejects(
    scraper.run({
      fetchPage: async (url) => {
        if (url === 'https://www.unilogcorp.com/') {
          return {
            status: 403,
            url,
            headers: {
              server: 'cloudflare',
              'cf-ray': 'home-123-MAA',
            },
            html: CLOUDFLARE_BLOCKED_HTML,
          }
        }

        return {
          status: 200,
          url,
          headers: {},
          html: verifiedCareersHtml,
        }
      },
    }),
    /public jobs/i,
  )
})
