import assert from 'node:assert/strict'
import test from 'node:test'

const aboutPage = {
  status: 200,
  url: 'https://www.guru99.com/about-us',
  html: `
    <!doctype html>
    <html lang="en">
      <body>
        <main>
          <h1>About Us</h1>
          <p>Guru99 was founded in the year 2008 by technology enthusiast and expert Krishna Rungta as an educational content platform for software-focused learners.</p>
          <p>Guru99 empowers individuals by keeping them conversant and highly informed about software.</p>
          <h2>Contribute a Tutorial</h2>
          <p>We are looking for great instructors like you to create awesome courses for our community.</p>
        </main>
      </body>
    </html>
  `,
}

const contactPage = {
  status: 200,
  url: 'https://www.guru99.com/contact-us',
  html: `
    <!doctype html>
    <html lang="en">
      <body>
        <main>
          <h1>Contact Us</h1>
          <h2>Advertising</h2>
          <h2>Editorial</h2>
          <h2>Guru99's Headquarters</h2>
          <p>Physical Address Titanium City Center, Ahmedabad, Gujarat, India</p>
        </main>
      </body>
    </html>
  `,
}

const termsPage = {
  status: 200,
  url: 'https://www.guru99.com/terms-of-service',
  html: `
    <!doctype html>
    <html lang="en">
      <body>
        <main>
          <h1>Terms of Use</h1>
          <p>The domain name www.guru99.com and its Mobile Apps are owned by Guru99 Tech Pvt Ltd bearing CIN No. U72900GJ2013PTC074450.</p>
          <p>Guru99 is a leading Edu-tech Company that provides online courses in the form of text and videos through our Website and Mobile Application.</p>
        </main>
      </body>
    </html>
  `,
}

const careerContentPage = {
  status: 200,
  url: 'https://career.guru99.com/',
  html: `
    <!doctype html>
    <html lang="en">
      <body>
        <main>
          <h1>Career Guru99 helps you get your Dream Job</h1>
          <p>We make tons of efforts to take boredom out of learning and make it fun.</p>
          <h2>Interview Question Library</h2>
          <p>Search you Favorite Interview Question</p>
          <a href="/top-25-retail-interview-questions-with-answers/">Retail Interview Questions</a>
        </main>
      </body>
    </html>
  `,
}

const publicJobsBoardPage = {
  status: 200,
  url: 'https://career.guru99.com/',
  html: `
    <!doctype html>
    <html lang="en">
      <body>
        <main>
          <h1>Careers</h1>
          <h2>Current Openings</h2>
          <a href="/careers/software-tester">Apply Now</a>
        </main>
      </body>
    </html>
  `,
}

const loadModule = async () => {
  try {
    return await import('../../scraper/guru99/script.js')
  } catch {
    assert.fail('Expected Guru99 scraper module at ../../scraper/guru99/script.js')
  }
}

test('Guru99 helpers stay pinned to the verified first-party company pages and career-content microsite from Friday, July 17, 2026', async () => {
  const guru99 = await loadModule()

  assert.equal(guru99.SOURCE, 'guru99')
  assert.equal(guru99.COMPANY, 'Guru99')
  assert.equal(guru99.ABOUT_URL, 'https://www.guru99.com/about-us')
  assert.equal(guru99.CONTACT_URL, 'https://www.guru99.com/contact-us')
  assert.equal(guru99.TERMS_URL, 'https://www.guru99.com/terms-of-service')
  assert.equal(guru99.CAREER_CONTENT_URL, 'https://career.guru99.com/')
  assert.equal(guru99.VERIFIED_ON, '2026-07-17')
  assert.match(guru99.VERIFIED_SURFACE_SUMMARY, /Guru99/i)
  assert.equal(guru99.hasOfficialAboutSignal(aboutPage), true)
  assert.equal(guru99.hasOfficialContactSignal(contactPage), true)
  assert.equal(guru99.hasOfficialTermsSignal(termsPage), true)
  assert.equal(guru99.hasCareerContentSignal(careerContentPage), true)
  assert.equal(guru99.hasPublicJobsBoardSignal(publicJobsBoardPage.html), true)
})

test('Guru99 returns no jobs only while the verified first-party surfaces remain company-content pages rather than a recruiting board', async () => {
  const guru99 = await loadModule()
  const requestedUrls = []

  const jobs = await guru99.createGuru99Scraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === guru99.ABOUT_URL) return aboutPage
      if (url === guru99.CONTACT_URL) return contactPage
      if (url === guru99.TERMS_URL) return termsPage
      if (url === guru99.CAREER_CONTENT_URL) return careerContentPage

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    guru99.ABOUT_URL,
    guru99.CONTACT_URL,
    guru99.TERMS_URL,
    guru99.CAREER_CONTENT_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Guru99 fails closed when the verified company pages drift or the career microsite turns into a recruiting board', async () => {
  const guru99 = await loadModule()

  await assert.rejects(
    guru99.createGuru99Scraper().run({
      fetchPage: async (url) => {
        if (url === guru99.ABOUT_URL) {
          return { status: 200, url, html: '<html><body><h1>About</h1></body></html>' }
        }

        if (url === guru99.CONTACT_URL) return contactPage
        if (url === guru99.TERMS_URL) return termsPage
        if (url === guru99.CAREER_CONTENT_URL) return careerContentPage

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified Guru99 about page/i,
  )

  await assert.rejects(
    guru99.createGuru99Scraper().run({
      fetchPage: async (url) => {
        if (url === guru99.ABOUT_URL) return aboutPage
        if (url === guru99.CONTACT_URL) {
          return { status: 200, url, html: '<html><body><h1>Contact</h1></body></html>' }
        }
        if (url === guru99.TERMS_URL) return termsPage
        if (url === guru99.CAREER_CONTENT_URL) return careerContentPage

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified Guru99 contact page/i,
  )

  await assert.rejects(
    guru99.createGuru99Scraper().run({
      fetchPage: async (url) => {
        if (url === guru99.ABOUT_URL) return aboutPage
        if (url === guru99.CONTACT_URL) return contactPage
        if (url === guru99.TERMS_URL) {
          return { status: 200, url, html: '<html><body><h1>Terms</h1></body></html>' }
        }
        if (url === guru99.CAREER_CONTENT_URL) return careerContentPage

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified Guru99 terms page/i,
  )

  await assert.rejects(
    guru99.createGuru99Scraper().run({
      fetchPage: async (url) => {
        if (url === guru99.ABOUT_URL) return aboutPage
        if (url === guru99.CONTACT_URL) return contactPage
        if (url === guru99.TERMS_URL) return termsPage
        if (url === guru99.CAREER_CONTENT_URL) return publicJobsBoardPage

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified Guru99 content-only state/i,
  )
})
