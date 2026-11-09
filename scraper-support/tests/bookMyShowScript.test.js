import assert from 'node:assert/strict'
import test from 'node:test'

const careersShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers Opportunities, Current Job Openings &amp; Vacancies at BookMyShow</title>
  </head>
  <body>
    <nav>
      <a href="https://in.bookmyshow.com/careers">Careers</a>
      <a href="https://in.bookmyshow.com/careers/job-listing">Job Listing</a>
    </nav>
    <h1>Make Your Career</h1>
    <h1>A Box-Office Hit.</h1>
    <h2>See Where You Fit In</h2>
    <p>Confused where to start? Search jobs by location or team</p>
    <p>Choose A Location</p>
    <p>Choose A Team</p>
    <footer>
      <a href="https://in.bookmyshow.com/careers/">Current Opening</a>
      <p>Copyright 2026 ©Bigtree Entertainment Pvt. Ltd.All Rights Reserved.</p>
    </footer>
  </body>
</html>
`

const emptyJobListingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers Opportunities, Current Job Openings &amp; Vacancies at BookMyShow</title>
  </head>
  <body>
    <nav>
      <a href="https://in.bookmyshow.com/careers">Careers</a>
      <a href="https://in.bookmyshow.com/careers/job-listing">Job Listing</a>
    </nav>
    <ol>
      <li><a href="https://in.bookmyshow.com/">Home</a></li>
      <li><a href="https://in.bookmyshow.com/careers/job-listing">Careers job Listing</a></li>
    </ol>
    <h2>Privacy Note</h2>
    <p>By using www.bookmyshow.com(our website), you are fully accepting the Privacy Policy.</p>
    <section>
      <h3>List your Show</h3>
      <p>Got a show, event, activity or a great experience? Partner with us &amp; get listed on BookMyShow</p>
    </section>
    <section>
      <h3>Upcoming Movies</h3>
      <a href="/explore/movies/1">FIFA World Cup 2026 Semi Final - France Vs Spain</a>
    </section>
    <section>
      <h3>Movies Now Showing</h3>
      <a href="/explore/movies/2">Dhamaal 4</a>
    </section>
    <footer>
      <a href="https://in.bookmyshow.com/careers/">Current Opening</a>
      <p>Copyright 2026 ©Bigtree Entertainment Pvt. Ltd.All Rights Reserved.</p>
    </footer>
  </body>
</html>
`

const cloudflareBlockedPage = {
  status: 403,
  html: `
  <!doctype html>
  <html lang="en-US">
    <head>
      <title>Attention Required! | Cloudflare</title>
    </head>
    <body>
      <h1>Sorry, you have been blocked</h1>
      <p>You are unable to access bookmyshow.com</p>
      <p>Cloudflare Ray ID: a1b3dc18881b492e</p>
    </body>
  </html>
  `,
}

const loadBookMyShowModule = async () => {
  try {
    return await import('../../scraper/bookmyshow/script.js')
  } catch {
    assert.fail('Expected BookMyShow scraper module at ../../scraper/bookmyshow/script.js')
  }
}

test('BookMyShow sentinel pins the verified careers shell, empty listing shell, and Cloudflare block contract', async () => {
  const bookMyShow = await loadBookMyShowModule()

  assert.equal(bookMyShow.SOURCE, 'bookmyshow')
  assert.equal(bookMyShow.COMPANY, 'BookMyShow')
  assert.equal(bookMyShow.HOMEPAGE_URL, 'https://in.bookmyshow.com/')
  assert.equal(bookMyShow.CAREERS_URL, 'https://in.bookmyshow.com/careers')
  assert.equal(bookMyShow.JOB_LISTING_URL, 'https://in.bookmyshow.com/careers/job-listing')
  assert.equal(bookMyShow.hasVerifiedCareersShell(careersShellHtml), true)
  assert.equal(bookMyShow.hasVerifiedEmptyJobListingShell(emptyJobListingHtml), true)
  assert.equal(
    bookMyShow.hasCloudflareBlockSignal({
      ...cloudflareBlockedPage,
      url: bookMyShow.CAREERS_URL,
    }),
    true,
  )
  assert.equal(bookMyShow.extractLikelyJobLinks(emptyJobListingHtml).length, 0)
  assert.equal(
    bookMyShow.extractLikelyJobLinks(
      '<a class="job-card" href="/careers/job/software-engineer">Software Engineer</a>',
    ).length,
    1,
  )
})

test('BookMyShow returns no jobs only while the verified careers shell and empty job listing shell hold', async () => {
  const bookMyShow = await loadBookMyShowModule()
  const requestedUrls = []

  const jobs = await bookMyShow.createBookMyShowScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === bookMyShow.CAREERS_URL) {
        return { status: 200, url, html: careersShellHtml }
      }

      if (url === bookMyShow.JOB_LISTING_URL) {
        return { status: 200, url, html: emptyJobListingHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [bookMyShow.CAREERS_URL, bookMyShow.JOB_LISTING_URL])
  assert.deepEqual(jobs, [])
})

test('BookMyShow reports unavailable inventory when both official careers routes are Cloudflare-blocked', async () => {
  const bookMyShow = await loadBookMyShowModule()
  const requestedUrls = []

  await assert.rejects(bookMyShow.createBookMyShowScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return { ...cloudflareBlockedPage, url }
    },
  }), error => error.code === 'BOOKMYSHOW_PUBLIC_ACCESS_BLOCKED')

  assert.deepEqual(requestedUrls, [bookMyShow.CAREERS_URL, bookMyShow.JOB_LISTING_URL])
})

test('BookMyShow fails closed when the careers shell or job listing route drifts into a public jobs surface', async () => {
  const bookMyShow = await loadBookMyShowModule()

  await assert.rejects(
    bookMyShow.createBookMyShowScraper().run({
      fetchPage: async (url) => {
        if (url === bookMyShow.CAREERS_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        return { status: 200, url, html: emptyJobListingHtml }
      },
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    bookMyShow.createBookMyShowScraper().run({
      fetchPage: async (url) => {
        if (url === bookMyShow.CAREERS_URL) {
          return { status: 200, url, html: careersShellHtml }
        }

        return {
          status: 200,
          url,
          html: `
          <html>
            <head><title>Careers Opportunities, Current Job Openings &amp; Vacancies at BookMyShow</title></head>
            <body>
              <h1>Open Positions</h1>
              <a class="job-card" href="/careers/job/software-engineer">Software Engineer</a>
            </body>
          </html>
          `,
        }
      },
    }),
    /job listing surface now appears to expose public job links/i,
  )

  await assert.rejects(
    bookMyShow.createBookMyShowScraper().run({
      fetchPage: async (url) => {
        if (url === bookMyShow.CAREERS_URL) {
          return { status: 200, url, html: careersShellHtml }
        }

        return {
          status: 200,
          url,
          html: emptyJobListingHtml.replace('Careers job Listing', 'Careers openings'),
        }
      },
    }),
    /verified job listing surface/i,
  )
})
