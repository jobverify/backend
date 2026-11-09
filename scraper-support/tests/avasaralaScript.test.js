import assert from 'node:assert/strict'
import test from 'node:test'

const loadAvasaralaModule = async () => {
  try {
    return await import('../../scraper/avasarala/script.js')
  } catch {
    return null
  }
}

const careerPageHtml = `
<!DOCTYPE html>
<html>
  <body>
    <div class="pagehead"><p>Careers</p></div>
    <div class="formdescription">
      We are passionate about attracting and supporting world-class talent.
      OR Mail to <a href="mailto:careers@avasarala.com">careers@avasarala.com</a>
    </div>
    <form method="post" action="https://avasarala.com/page/contact.html">
      <input type="hidden" name="pageid" value="careers" />
    </form>
  </body>
</html>
`

test('extractSearchResults returns no openings when the Avasarala page only exposes a resume form', async () => {
  const avasarala = await loadAvasaralaModule()
  assert.ok(avasarala)

  assert.deepEqual(avasarala.extractSearchResults(careerPageHtml), [])
})

test('run fetches the Avasarala careers page and returns an empty job list when no structured openings are published', async () => {
  const avasarala = await loadAvasaralaModule()
  assert.ok(avasarala)

  const requestedTexts = []
  const scraper = avasarala.createAvasaralaScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === avasarala.CAREER_PAGE_URL) return careerPageHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [avasarala.CAREER_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('run can recover with a browser-backed Avasarala careers page when direct requests fail', async () => {
  const avasarala = await loadAvasaralaModule()
  assert.ok(avasarala)

  const browserUrls = []
  const jobs = await avasarala.createAvasaralaScraper().run({
    fetchText: async () => {
      throw new TypeError('fetch failed')
    },
    fetchBrowserText: async (url) => {
      browserUrls.push(url)
      return careerPageHtml
    },
  })

  assert.deepEqual(browserUrls, [avasarala.CAREER_PAGE_URL])
  assert.deepEqual(jobs, [])
})
