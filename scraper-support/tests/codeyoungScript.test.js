import assert from 'node:assert/strict'
import test from 'node:test'

const loadCodeyoungModule = async () => {
  try {
    return await import('../../scraper/codeyoung/script.js')
  } catch {
    assert.fail('Expected Codeyoung scraper module at ../../scraper/scraper/codeyoung/script.js')
  }
}

const mentorApplicationPageHtml = `
  <html>
    <head>
      <title>Apply as a Mentor — Teach with Codeyoung</title>
      <link rel="canonical" href="https://www.codeyoung.com/trainer-register" />
    </head>
    <body>
      <h1>Apply as a mentor at Codeyoung.</h1>
      <p>Join a diverse team of educators, earn money and bring impact to the lives of students around the world!</p>
      <div>
        <p>Apply as a mentor</p>
        <p>Name</p>
        <input placeholder="Enter full name" />
        <p>Email address</p>
        <input placeholder="Enter email" />
        <p>WhatsApp or phone</p>
        <input placeholder="Enter phone number" />
        <button type="submit">Submit</button>
      </div>
      <footer>
        <div>support@codeyoung.com</div>
      </footer>
    </body>
  </html>
`

test('run returns no jobs when Codeyoung exposes a mentor application form without public job records', async () => {
  const codeyoung = await loadCodeyoungModule()
  const requestedUrls = []

  assert.equal(codeyoung.hasMentorApplicationSignal(mentorApplicationPageHtml), true)
  assert.equal(codeyoung.hasContactSignal(mentorApplicationPageHtml), true)
  assert.deepEqual(codeyoung.extractJobs(mentorApplicationPageHtml), [])

  const jobs = await codeyoung.createCodeyoungScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return mentorApplicationPageHtml
    },
  })

  assert.deepEqual(requestedUrls, ['https://www.codeyoung.com/trainer-register'])
  assert.deepEqual(jobs, [])
})
