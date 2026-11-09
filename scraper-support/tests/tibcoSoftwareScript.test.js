import assert from 'node:assert/strict'
import test from 'node:test'

const CONTACT_PAGE_HTML = `
<!doctype html>
<html>
  <head><title>Contact Us | TIBCO</title></head>
  <body>
    <h2>Find your next JOB OPPORTUNITY</h2>
    <a href="https://careers.cloud.com/" aria-label="Careers at Cloud Software Group - Opens link in a new window"><span>CAREERS</span></a>
  </body>
</html>
`

const CHALLENGE_HTML = `
<!doctype html>
<html>
  <body>
    <noscript>
      <h1>JavaScript is disabled</h1>
      In order to continue, we need to verify that you're not a robot.
    </noscript>
  </body>
</html>
`

const CAREERS_HUB_HTML = `
<html>
  <head><title>Careers Home - Cloud Software Group</title></head>
  <body>
    <h1>Innovate and grow within Cloud Software Group</h1>
    <p>Search by job title, location, department, category, etc.</p>
    <h2>Inside Cloud Software Group</h2>
    <h3>About Us</h3>
    <p>Cloud Software Group is one of the world's largest cloud solution providers, serving more than 100 million users around the globe.</p>
    <h2>Ready to apply? Search for open roles.</h2>
    <a href="https://careers.cloud.com/jobs/search">See all opportunities</a>
  </body>
</html>
`

const CAREERS_SEARCH_HTML = `
<html>
  <head><title>Career Search - Cloud Software Group</title></head>
  <body>
    Find your next career opportunity
    Country
    India
    Brand
    Citrix
    Cloud Software Group Corporate
    Spotfire
    Non-TIBCO Office
    <a href="https://careers.cloud.com/jobs/lead-account-technical-strategist-remote-illinois-united-states">Lead Account Technical Strategist</a>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/tibcosoftware/script.js')
  } catch {
    assert.fail('Expected TIBCO Software scraper module at ../../scraper/tibcosoftware/script.js')
  }
}

test('TIBCO Software pins the official contact-page careers link and generic cloud careers shell', async () => {
  const tibco = await loadScriptModule()

  assert.equal(tibco.hasOfficialContactPageSignal(CONTACT_PAGE_HTML), true)
  assert.equal(tibco.extractOfficialCareersHubUrl(CONTACT_PAGE_HTML), 'https://careers.cloud.com/')
  assert.equal(tibco.hasGenericCloudCareersHubSignal(CAREERS_HUB_HTML), true)
  assert.equal(tibco.hasGenericCloudCareersSearchSignal(CAREERS_SEARCH_HTML), true)
})

test('TIBCO Software recognizes the documented empty 202 Cloud careers challenge response', async () => {
  const tibco = await loadScriptModule()

  assert.equal(
    tibco.isCloudCareersAccessChallengePage({
      status: 202,
      html: '',
    }),
    true,
  )
  assert.equal(
    tibco.isCloudCareersAccessChallengePage({
      status: 202,
      html: CHALLENGE_HTML,
    }),
    true,
  )
  assert.equal(
    tibco.isCloudCareersAccessChallengePage({
      status: 200,
      html: CAREERS_HUB_HTML,
    }),
    false,
  )
})

test('TIBCO Software returns [] while the current official handoff stays a generic multi-brand careers surface', async () => {
  const tibco = await loadScriptModule()
  const requestedUrls = []

  const jobs = await tibco.createTibcoSoftwareScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === tibco.CAREERS_URL) return CONTACT_PAGE_HTML
      if (url === tibco.CAREERS_HUB_URL) return CHALLENGE_HTML
      if (url === tibco.CAREERS_SEARCH_URL) return CHALLENGE_HTML
      throw new Error(`Unexpected TIBCO text URL: ${url}`)
    },
    fetchBrowserText: async (url) => {
      requestedUrls.push(url)
      if (url === tibco.CAREERS_HUB_URL) return CAREERS_HUB_HTML
      if (url === tibco.CAREERS_SEARCH_URL) return CAREERS_SEARCH_HTML
      throw new Error(`Unexpected TIBCO browser URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
  assert.deepEqual(requestedUrls, [
    tibco.CAREERS_URL,
    tibco.CAREERS_HUB_URL,
    tibco.CAREERS_HUB_URL,
    tibco.CAREERS_SEARCH_URL,
    tibco.CAREERS_SEARCH_URL,
  ])
})

test('TIBCO Software returns [] when the linked Cloud careers host only exposes empty 202 challenge responses', async () => {
  const tibco = await loadScriptModule()
  const requestedUrls = []

  const jobs = await tibco.createTibcoSoftwareScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(`direct:${url}`)
      if (url === tibco.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: CONTACT_PAGE_HTML,
        }
      }
      if (url === tibco.CAREERS_HUB_URL || url === tibco.CAREERS_SEARCH_URL) {
        return {
          status: 202,
          url,
          html: '',
        }
      }
      throw new Error(`Unexpected TIBCO direct URL: ${url}`)
    },
    fetchBrowserPage: async (url) => {
      requestedUrls.push(`browser:${url}`)
      if (url === tibco.CAREERS_HUB_URL || url === tibco.CAREERS_SEARCH_URL) {
        return {
          status: 202,
          url,
          html: '',
        }
      }
      throw new Error(`Unexpected TIBCO browser URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
  assert.deepEqual(requestedUrls, [
    `direct:${tibco.CAREERS_URL}`,
    `direct:${tibco.CAREERS_HUB_URL}`,
    `browser:${tibco.CAREERS_HUB_URL}`,
    `direct:${tibco.CAREERS_SEARCH_URL}`,
    `browser:${tibco.CAREERS_SEARCH_URL}`,
  ])
})

test('TIBCO Software fails closed when the official careers handoff drifts materially', async () => {
  const tibco = await loadScriptModule()

  await assert.rejects(
    tibco.createTibcoSoftwareScraper().run({
      fetchText: async () => '<html><body>Unexpected</body></html>',
      fetchBrowserText: async () => '<html><body>Unexpected</body></html>',
    }),
    /verified official contact page/i,
  )
})
