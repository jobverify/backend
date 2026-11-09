import assert from 'node:assert/strict'
import test from 'node:test'

const loadDoozyRoboticsModule = async () => {
  try {
    return await import('../../scraper/doozyrobotics/script.js')
  } catch {
    assert.fail('Expected Doozy Robotics scraper module at ../../scraper/scraper/doozyrobotics/script.js')
  }
}

const careerPageHtml = `
  <html>
    <body>
      <section>
        <h2>Join Our Robotics Team</h2>
        <form id="career-form" enctype="multipart/form-data">
          <select id="role" name="role">
            <option value="ROS Engineer">ROS Engineer</option>
          </select>
          <button type="submit">Submit Application</button>
        </form>
      </section>
    </body>
  </html>
`

test('run returns no jobs when Doozy Robotics exposes an application form without public opening records', async () => {
  const doozyRobotics = await loadDoozyRoboticsModule()
  const requestedUrls = []

  assert.equal(doozyRobotics.hasCareerPageSignal(careerPageHtml), true)

  const jobs = await doozyRobotics.createDoozyRoboticsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, doozyRobotics.CAREER_PAGE_URL)
      return careerPageHtml
    },
  })

  assert.deepEqual(requestedUrls, [doozyRobotics.CAREER_PAGE_URL])
  assert.deepEqual(jobs, [])
})
