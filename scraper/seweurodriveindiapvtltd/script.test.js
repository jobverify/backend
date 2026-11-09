import assert from 'node:assert/strict'
import test from 'node:test'

const loadSeweurodriveModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected SEW-EURODRIVE India scraper module at ./script.js')
  }
}

const careersHtml = `
<!DOCTYPE html>
<html lang="en">
  <head></head>
  <body>
    <main>
      <h1>Your career at SEW-EURODRIVE</h1>
      <p>Take a look at our current job opportunities.</p>
      <p>Job opportunities</p>
      <p>You can find a list of current job offers as below:</p>
      <a href="https://www.seweurodriveindia.com/meta_seiten/web_online_contact_form_career.html">application form</a>
      <table class="table striped responsive-table">
        <thead>
          <tr>
            <th><b>Sr. No.</b></th>
            <th><b>Job Position</b></th>
            <th><b>Location</b></th>
            <th><b>Vertical</b></th>
            <th><b>Job Description</b></th>
          </tr>
        </thead>
        <tbody>
          <tr class="odd">
            <td>1</td>
            <td>Executive/Assistant Manager - Technical Sales</td>
            <td>Mumbai</td>
            <td>Sales</td>
            <td><a href="https://media.sew-eurodrive.com/path/jd-6142.pdf">Click here <span class="fileinfo">(PDF, 462 KB)</span></a></td>
          </tr>
          <tr class="even">
            <td>2</td>
            <td>Executive/Assistant Manager - Project (MMHS)</td>
            <td>Sriperumbudur</td>
            <td>Technical Support - D&amp;A</td>
            <td><a href="https://media.sew-eurodrive.com/path/jd-7144.pdf">click here <span class="fileinfo">(PDF, 457 KB)</span></a></td>
          </tr>
        </tbody>
      </table>
    </main>
  </body>
</html>
`

test('SEW-EURODRIVE accepts the current title-less first-party careers surface', async () => {
  const sew = await loadSeweurodriveModule()

  assert.equal(sew.SOURCE, 'seweurodriveindiapvtltd')
  assert.equal(sew.CAREERS_URL, 'https://www.seweurodriveindia.com/career/your_career/your_career.html')
  assert.equal(sew.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    sew.extractApplicationFormUrl(careersHtml),
    'https://www.seweurodriveindia.com/meta_seiten/web_online_contact_form_career.html',
  )
  assert.equal(sew.extractOpenings(careersHtml).length, 2)
})

test('SEW-EURODRIVE run returns normalized India openings from the verified table surface', async () => {
  const sew = await loadSeweurodriveModule()
  const requestedUrls = []

  const jobs = await sew.createSeweurodriveIndiaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [sew.CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Executive/Assistant Manager - Technical Sales')
  assert.equal(jobs[0].location, 'Mumbai, India')
  assert.equal(jobs[0].applyUrl, 'https://www.seweurodriveindia.com/meta_seiten/web_online_contact_form_career.html')
})
