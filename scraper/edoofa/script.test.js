import assert from 'node:assert/strict'
import test from 'node:test'

const loadEdoofaModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>Edoofa - Education for all</title>
    </head>
    <body>
      <nav>
        <a href="https://edoofa.com/work-with-edoofa/">Work With Edoofa</a>
      </nav>
      <footer>
        <p>Edoofa is a platform for students to pursue Affordable Higher Education in India through Scholarships and Internships.</p>
        <p>901, Emaar Colonnade, 9th Floor, Sector 66, Gurugram, Haryana, India 122018</p>
        <a href="mailto:studentcare@edoofa.com">studentcare@edoofa.com</a>
      </footer>
    </body>
  </html>
`

const workWithEdoofaHtml = `
  <html>
    <head>
      <title>Work With Edoofa - Edoofa</title>
    </head>
    <body>
      <main>
        <h1>Work With Edoofa</h1>
        <form name="Work With Edoofa">
          <label>Full name</label>
          <label>Country</label>
          <label>WhatsApp Number</label>
          <label>Email</label>
          <label>Upload CV/Resume [Optional]</label>
          <button type="submit">Submit your Application</button>
        </form>
      </main>
    </body>
  </html>
`

const publicJobsHtml = `
  <html>
    <head>
      <title>Work With Edoofa - Edoofa</title>
    </head>
    <body>
      <main>
        <h1>Work With Edoofa</h1>
        <section>
          <h2>Current Openings</h2>
          <article class="job-card">
            <h3>Admissions Counselor</h3>
            <p>Location: Gurugram, India</p>
            <a href="/apply/admissions-counselor">Apply now</a>
          </article>
        </section>
      </main>
    </body>
  </html>
`

test('official page helpers recognize Edoofa site and generic work-with application form', async () => {
  const edoofa = await loadEdoofaModule()
  assert.ok(edoofa)

  assert.equal(edoofa.hasOfficialSiteSignal(homepageHtml), true)
  assert.equal(edoofa.hasContactSignal(homepageHtml), true)
  assert.equal(edoofa.hasWorkWithFormSignal(workWithEdoofaHtml), true)
  assert.equal(edoofa.hasPublicJobsSignal(workWithEdoofaHtml), false)
})

test('run returns no jobs when Edoofa only exposes a generic application form', async () => {
  const edoofa = await loadEdoofaModule()
  assert.ok(edoofa)

  const requestedUrls = []
  const jobs = await edoofa.createEdoofaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === edoofa.HOMEPAGE_URL) {
        return homepageHtml
      }

      if (url === edoofa.WORK_WITH_URL) {
        return workWithEdoofaHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    edoofa.HOMEPAGE_URL,
    edoofa.WORK_WITH_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('run fails closed when Edoofa starts exposing public job listings', async () => {
  const edoofa = await loadEdoofaModule()
  assert.ok(edoofa)

  await assert.rejects(
    edoofa.createEdoofaScraper().run({
      fetchText: async (url) => {
        if (url === edoofa.HOMEPAGE_URL) {
          return homepageHtml
        }

        if (url === edoofa.WORK_WITH_URL) {
          return publicJobsHtml
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Edoofa site now exposes public job listings; scraper needs an update/,
  )
})
