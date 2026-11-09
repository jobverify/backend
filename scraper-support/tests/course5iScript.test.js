import assert from 'node:assert/strict'
import test from 'node:test'

const loadCourse5iModule = async () => {
  try {
    return await import('../../scraper/course5i/script.js')
  } catch {
    assert.fail('Expected Course5i scraper module at ../../scraper/scraper/course5i/script.js')
  }
}

const careerPageHtml = `
  <html>
    <head><title>C5i Careers</title></head>
    <body>
      <h1>Find Your Flourish. Ignite Your Impact.</h1>
      <h2>Careers with C5i</h2>
      <p>If you meet our position requirements, email your resume and cover letter to careers@c5i.ai.</p>
    </body>
  </html>
`

const sucuriChallengeHtml = `
  <html>
    <head><title>You are being redirected...</title></head>
    <body>
      <p>Javascript is required. Please enable javascript before you are allowed to see this page.</p>
      <script>var sucuri_cloudproxy_js='challenge';</script>
    </body>
  </html>
`

test('Course5i follows the verified same-domain careers redirect before validating the email-apply page', async () => {
  const course5i = await loadCourse5iModule()
  const requestedUrls = []

  const html = await course5i.fetchCareerPageHtml(course5i.CAREER_PAGE_URL, {
    fetchImpl: async (url) => {
      requestedUrls.push(url)

      if (url === course5i.CAREER_PAGE_URL) {
        return {
          ok: false,
          status: 307,
          headers: {
            get: (name) => (String(name).toLowerCase() === 'location' ? 'https://c5i.ai/careers/' : null),
          },
          text: async () => '',
        }
      }

      if (url === 'https://c5i.ai/careers/') {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: async () => careerPageHtml,
        }
      }

      throw new Error(`Unexpected Course5i fetch URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    course5i.CAREER_PAGE_URL,
    'https://c5i.ai/careers/',
  ])
  assert.equal(html, careerPageHtml)
})

test('Course5i fails closed when the careers redirect leaves the verified first-party careers surface', async () => {
  const course5i = await loadCourse5iModule()

  assert.equal(course5i.isVerifiedCareersRedirectUrl(null), false)

  await assert.rejects(
    course5i.fetchCareerPageHtml(course5i.CAREER_PAGE_URL, {
      fetchImpl: async () => ({
        ok: false,
        status: 307,
        headers: {
          get: (name) => (String(name).toLowerCase() === 'location' ? 'https://jobs.example.com/c5i' : null),
        },
        text: async () => '',
      }),
    }),
    /verified first-party careers surface/i,
  )
})

test('run returns no jobs when Course5i publishes email applications without public opening records', async () => {
  const course5i = await loadCourse5iModule()
  const requestedUrls = []

  assert.equal(course5i.hasCareerPageSignal(careerPageHtml), true)

  const jobs = await course5i.createCourse5iScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, course5i.CAREER_PAGE_URL)
      return careerPageHtml
    },
  })

  assert.deepEqual(requestedUrls, [course5i.CAREER_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('Course5i returns an empty result when the verified careers surface is gated behind the live Sucuri javascript challenge', async () => {
  const course5i = await loadCourse5iModule()

  assert.equal(course5i.hasVerifiedCourse5iJsChallengePage(sucuriChallengeHtml), true)

  const jobs = await course5i.createCourse5iScraper().run({
    fetchText: async () => sucuriChallengeHtml,
  })

  assert.deepEqual(jobs, [])
})

test('Course5i returns an empty result when the verified no-public-jobs careers route is temporarily timeout-blocked', async () => {
  const course5i = await loadCourse5iModule()

  const jobs = await course5i.createCourse5iScraper().run({
    fetchText: async () => {
      throw new Error(
        'fetch failed | Connect Timeout Error (attempted address: www.c5i.ai:443, timeout: 10000ms)',
      )
    },
  })

  assert.deepEqual(jobs, [])
})
