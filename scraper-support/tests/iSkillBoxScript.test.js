import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>iSkillbox Corporate Training</title>
  </head>
  <body>
    <nav>
      <a href="https://iskillbox.com/about-us/">About Us</a>
      <a href="https://iskillbox.com/career/">Career</a>
      <a href="https://iskillbox.com/contact/">Contact</a>
    </nav>
    <h1>Welcome to iSkillBox</h1>
    <p>Your Trusted Partner In Corporate Training.</p>
    <p>Upskill. Reskill. Transform.</p>
    <p>ISKILLBOX LEARNING TECHNOLOGIES PRIVATE LIMITED</p>
  </body>
</html>
`

const careerShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career &#8211; iSkillbox Corporate Training</title>
    <link rel="canonical" href="https://iskillbox.com/career/" />
  </head>
  <body>
    <h1>Career</h1>
    <p>ISKILLBOX LEARNING TECHNOLOGIES PRIVATE LIMITED</p>
    <p>If you have any questions or need help, feel free to contact with our team.</p>
    <p>(+91) 902 800 5801</p>
    <p>2nd Floor, Vasukamal Express, Rohan Sehar Ln, Pan Card Club Rd, behind Beverly Hills Society, Samarth Colony, Baner, Pune, Maharashtra 411045</p>
    <a href="https://iskillbox.com/contact/">Contact</a>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Openings</h1>
    <a href="https://www.linkedin.com/jobs/view/1234567890">Apply now</a>
  </body>
</html>
`

const loadISkillBoxModule = async () => {
  try {
    return await import('../../scraper/iskillbox/script.js')
  } catch {
    assert.fail('Expected iSkillBox scraper module at ../../scraper/iskillbox/script.js')
  }
}

test('iSkillBox scraper constants stay pinned to the verified homepage and contact-style career shell', async () => {
  const iskillbox = await loadISkillBoxModule()

  assert.equal(iskillbox.SOURCE, 'iskillbox')
  assert.equal(iskillbox.COMPANY, 'iSkillBox')
  assert.equal(iskillbox.VERIFIED_ON, '2026-08-02')
  assert.equal(iskillbox.HOMEPAGE_URL, 'https://iskillbox.com/')
  assert.equal(iskillbox.CAREER_PAGE_URL, 'https://iskillbox.com/career/')
  assert.equal(iskillbox.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(iskillbox.hasOfficialCareerShellSignal(careerShellHtml), true)
  assert.equal(iskillbox.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(iskillbox.hasPublicJobsSignal(careerShellHtml), false)
  assert.equal(iskillbox.hasPublicJobsSignal(publicJobsHtml), true)
})

test('iSkillBox returns [] only while the verified first-party career page stays a contact-style non-listing shell', async () => {
  const iskillbox = await loadISkillBoxModule()
  const requestedUrls = []

  const jobs = await iskillbox.createISkillBoxScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === iskillbox.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === iskillbox.CAREER_PAGE_URL) {
        return { status: 200, url, html: careerShellHtml }
      }

      throw new Error(`Unexpected iSkillBox URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    iskillbox.HOMEPAGE_URL,
    iskillbox.CAREER_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('iSkillBox fails closed when the verified homepage or career shell drifts into a public jobs surface', async () => {
  const iskillbox = await loadISkillBoxModule()

  await assert.rejects(
    iskillbox.createISkillBoxScraper().run({
      fetchPage: async (url) => {
        if (url === iskillbox.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        if (url === iskillbox.CAREER_PAGE_URL) {
          return { status: 200, url, html: careerShellHtml }
        }

        throw new Error(`Unexpected iSkillBox URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    iskillbox.createISkillBoxScraper().run({
      fetchPage: async (url) => {
        if (url === iskillbox.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === iskillbox.CAREER_PAGE_URL) {
          return { status: 200, url, html: '<html><body>Unexpected content</body></html>' }
        }

        throw new Error(`Unexpected iSkillBox URL: ${url}`)
      },
    }),
    /verified first-party career shell/i,
  )

  await assert.rejects(
    iskillbox.createISkillBoxScraper().run({
      fetchPage: async (url) => {
        if (url === iskillbox.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === iskillbox.CAREER_PAGE_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected iSkillBox URL: ${url}`)
      },
    }),
    /career shell now appears to expose public jobs/i,
  )
})
