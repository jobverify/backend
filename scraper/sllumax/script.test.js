import assert from 'node:assert/strict'
import test from 'node:test'

const officialCompanyHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Global network | SL corporation</title>
    </head>
    <body>
      <main>
        <h1>Global network</h1>
        <section>
          <h2>India</h2>
          <article>
            <h3>SL Lumax (Tami nadu)</h3>
            <p>G-15 Sipcot Industrial Park Irrugattukottai Sriperumbudur TK, Kancheepuram Dist. 602-105, Tamil nadu, India</p>
            <p>Haed lamp, Rear lamp, Fog lamp, Lever Etc</p>
          </article>
          <article>
            <h3>SL Lumax (Pune)</h3>
            <p>Plot No B-1 ,Talegon Industrial Area Phase-II, Badhalawadi, Pune, Maharashtra, India</p>
            <p>Head lamp, Rear lamp, Fog lamp, Mirror, Lever etc</p>
          </article>
        </section>
      </main>
    </body>
  </html>
`

const officialCurrentOpeningsHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Lumax World | lumax career &amp; Job Openings</title>
    </head>
    <body>
      <main>
        <h1>Current openings</h1>
        <section>
          <h2>There is currently 1 vacancy</h2>
          <h3>Manager / Div. Manager-Company Secretary</h3>
          <a href="#apply-1">Apply Now</a>
        </section>
        <section>
          <h2>There are currently 2 vacancies</h2>
          <h3>Executive/Sr Executive - IT</h3>
          <a href="#apply-2">Apply Now</a>
        </section>
      </main>
      <footer>
        <a href="/work-with-us.html">Work with us</a>
      </footer>
    </body>
  </html>
`

const officialWorkWithUsHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Lumax World | Work-with-us</title>
    </head>
    <body>
      <main>
        <h1>Work With Us</h1>
        <h2>Springboard Policy</h2>
        <p>Explore our current openings and find the perfect role for you.</p>
        <p>Re-start your career - Write to us at <a href="mailto:springboard@lumaxmail.com">springboard@lumaxmail.com</a></p>
        <form action="formvalidate_workwithus_lumax.php" method="post">
          <input name="Position" placeholder="Position Applied For*" />
          <textarea name="Message" placeholder="Copy and paste your CV here"></textarea>
          <input type="submit" value="APPLY" />
        </form>
      </main>
    </body>
  </html>
`

test('SL LUMAX verifies the official SL and Lumax first-party surfaces before returning no attributed openings', async () => {
  const sllumax = await import('./script.js')
  const requestedUrls = []

  assert.equal(sllumax.hasOfficialCompanySignal(officialCompanyHtml), true)
  assert.equal(sllumax.hasOfficialCurrentOpeningsSignal(officialCurrentOpeningsHtml), true)
  assert.equal(sllumax.hasOfficialWorkWithUsSignal(officialWorkWithUsHtml), true)
  assert.equal(sllumax.pageMentionsAttributedSllumaxOpenings(officialCurrentOpeningsHtml), false)
  assert.equal(sllumax.pageMentionsAttributedSllumaxOpenings(officialWorkWithUsHtml), false)

  const jobs = await sllumax.createSllumaxScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === sllumax.OFFICIAL_COMPANY_PAGE_URL) {
        return officialCompanyHtml
      }

      if (url === sllumax.CURRENT_OPENINGS_URL) {
        return officialCurrentOpeningsHtml
      }

      if (url === sllumax.WORK_WITH_US_URL) {
        return officialWorkWithUsHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    sllumax.OFFICIAL_COMPANY_PAGE_URL,
    sllumax.CURRENT_OPENINGS_URL,
    sllumax.WORK_WITH_US_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('SL LUMAX requires review when the Lumax current-openings page starts attributing roles to SL Lumax', async () => {
  const sllumax = await import('./script.js')
  const attributedOpeningsHtml = `
    ${officialCurrentOpeningsHtml}
    <section>
      <h2>SL Lumax (Tami nadu)</h2>
      <h3>Senior Engineer - Quality</h3>
      <p>G-15 Sipcot Industrial Park Irrugattukottai Sriperumbudur TK, Kancheepuram Dist. 602-105, Tamil nadu, India</p>
      <a href="#apply-sllumax">Apply Now</a>
    </section>
  `

  assert.equal(sllumax.pageMentionsAttributedSllumaxOpenings(attributedOpeningsHtml), true)

  await assert.rejects(
    sllumax.createSllumaxScraper().run({
      fetchText: async (url) => {
        if (url === sllumax.OFFICIAL_COMPANY_PAGE_URL) return officialCompanyHtml
        if (url === sllumax.CURRENT_OPENINGS_URL) return attributedOpeningsHtml
        if (url === sllumax.WORK_WITH_US_URL) return officialWorkWithUsHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /current openings page now attributes roles to SL LUMAX/i,
  )
})

test('SL LUMAX fails closed when the official SL company surface changes', async () => {
  const sllumax = await import('./script.js')

  await assert.rejects(
    sllumax.createSllumaxScraper().run({
      fetchText: async (url) => {
        if (url === sllumax.OFFICIAL_COMPANY_PAGE_URL) {
          return '<html><title>Unexpected</title></html>'
        }

        if (url === sllumax.CURRENT_OPENINGS_URL) return officialCurrentOpeningsHtml
        if (url === sllumax.WORK_WITH_US_URL) return officialWorkWithUsHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official SL company surface changed/i,
  )
})
