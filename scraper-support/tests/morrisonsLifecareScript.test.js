import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/morrisonslifecare/script.js')
  } catch {
    assert.fail('Expected Morrisons Lifecare scraper module at ../../scraper/morrisonslifecare/script.js')
  }
}

const detailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2 class="section__header">Production Engineer (On-site, Ahmedabad)</h2>
    <p class="job__description-text">Support daily production planning and process quality checks.</p>
    <ul class="job__responsibilities-list">
      <li>Own production line coordination.</li>
    </ul>
    <ul class="job__qualifications-list">
      <li>Experience in a manufacturing environment, preferably in medical devices.</li>
      <li>Bachelor's degree in mechanical engineering.</li>
    </ul>
    <a class="apply-now" href="/careers/morrisonsjobform">Apply</a>
  </body>
</html>
`

test('Morrisons Lifecare marks merged public detail pages as experience-checked', async () => {
  const morrisons = await loadModule()
  const detail = morrisons.extractJobDetail(detailHtml, {
    title: 'Production Engineer',
    location: 'Ahmedabad, India',
    city: 'Ahmedabad',
    sourceUrl: 'https://www.morrisonslifecare.com/careers/production_engineer',
    applyUrl: 'https://www.morrisonslifecare.com/careers/morrisonsjobform',
  })

  assert.equal(detail.experienceRequired, 'Experience in a manufacturing environment, preferably in medical devices.')
  assert.equal(detail.publicExperienceChecked, true)
  assert.match(detail.jobDescription, /Support daily production planning/i)
})
