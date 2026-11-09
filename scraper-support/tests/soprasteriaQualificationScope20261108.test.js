import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { extractJobDetail } from '../../scraper/soprasteria/script.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/soprasteriaQualificationScope20261108.json', import.meta.url)))
const footer = '<footer><ul><li>MANAGE YOUR COOKIES</li><li>TERMS OF USE</li><li>WARNING ALERT - SCAM/ IDENTITY THEFT</li></ul></footer>'
const page = content => '<html><body><a href="/Workflow?workflowId=test&amp;vacancyId=10352">Apply</a>'
  + '<div class="description-widget"><div aria-label="Job description">' + content + '</div></div>' + footer + '</body></html>'

test('archived original and source contamination remain inspectable', () => {
  assert.equal(createHash('sha256').update(fixture.case.originalText).digest('hex'), fixture.case.originalTextSha256)
  assert.equal(fixture.case.sourceFields.minimumQualification, 'MANAGE YOUR COOKIES')
  assert.ok(fixture.case.originalText.includes('Qualifications Any Graduate Additional Information'))
})

test('qualification paragraph cannot acquire a footer list', () => {
  const job = extractJobDetail(page('<div class="jobad-jobdescription">Job Description</div><p>Oracle EPM implementation.</p>'
    + '<div class="jobad-qualifications">Qualifications</div><p>' + fixture.qualificationParagraph + '</p>'
    + '<div class="jobad-additionalinformation">Additional Information</div><p>Equal opportunity.</p>'))
  assert.equal(job.minimumQualification, 'Any Graduate')
  assert.deepEqual(job.requiredSkills, ['Any Graduate'])
  assert.ok(job.jobDescription.includes('Oracle EPM implementation.'))
  assert.ok(job.jobDescription.includes('Equal opportunity.'))
  assert.doesNotMatch(job.jobDescription, /MANAGE YOUR COOKIES|TERMS OF USE/)
})

test('empty qualifications stop before the next employer section', () => {
  const job = extractJobDetail(page('<h2 class="jobad-qualifications">Qualifications</h2>'
    + '<h2 class="jobad-additionalinformation">Additional Information</h2><ul><li>Employee benefits</li></ul>'))
  assert.equal(job.minimumQualification, null)
  assert.deepEqual(job.requiredSkills, [])
})

test('own list qualifications remain complete and ordered', () => {
  const job = extractJobDetail(page('<div class="jobad-qualifications">Qualifications</div>'
    + '<ul><li>4+ years of Oracle EPM experience.</li><li>Strong analytical skills.</li></ul>'
    + '<h3>Additional Information</h3><ul><li>Employee benefits</li></ul>'))
  assert.equal(job.minimumQualification, '4+ years of Oracle EPM experience.')
  assert.deepEqual(job.requiredSkills, ['4+ years of Oracle EPM experience.', 'Strong analytical skills.'])
})

test('qualification containers and nested widget divs stay inside the role', () => {
  const job = extractJobDetail(page('<div><p>Complete employer duties.</p></div>'
    + '<section class="jobad-qualifications"><h3>Qualifications</h3><p>Engineering graduate.</p></section>'))
  assert.equal(job.minimumQualification, 'Engineering graduate.')
  assert.deepEqual(job.requiredSkills, ['Engineering graduate.'])
  assert.ok(job.jobDescription.includes('Complete employer duties.'))
  assert.doesNotMatch(job.jobDescription, /MANAGE YOUR COOKIES/)
})

test('missing own qualifications preserve verified listing facts', () => {
  const listing = { minimumQualification: 'Verified engineering degree.', requiredSkills: ['Verified Oracle EPM skill.'] }
  const job = extractJobDetail(page('<p>Complete employer duties.</p>'), listing)
  assert.equal(job.minimumQualification, listing.minimumQualification)
  assert.deepEqual(job.requiredSkills, listing.requiredSkills)
})

test('a qualification marker outside the description widget is not this role content', () => {
  const html = '<div class="description-widget"><p>Own duties.</p></div>'
    + '<aside><div class="jobad-qualifications">Qualifications</div><ul><li>Other vacancy requirements.</li></ul></aside>'
  const job = extractJobDetail(html)
  assert.equal(job.minimumQualification, null)
  assert.deepEqual(job.requiredSkills, [])
})



for (const example of fixture.independentStructuralCases) {
  test('independent structural boundary: ' + example.id, () => {
    const job = extractJobDetail(example.html)
    assert.deepEqual(job.requiredSkills, example.expectedSkills)
    assert.equal(job.minimumQualification, example.expectedSkills[0] ?? null)
    if (example.expectedDescription !== undefined) {
      assert.equal(job.jobDescription, example.expectedDescription, 'Only visible employer text belongs in the role description')
    }
    if (example.id === 'data-class-is-not-widget-class') {
      assert.ok(job.jobDescription.includes('Own duties.'))
      assert.doesNotMatch(job.jobDescription, /Wrong promo\./)
    }
  })
}

test('complete archived visible role survives clearly reconstructed section markup', () => {
  // The archive retained complete text and native fields, not the raw HTML.
  const original = fixture.case.originalText
  const structuredDataStart = original.indexOf(' {"@context"')
  assert.ok(structuredDataStart > 0)
  const visibleRole = original.slice(0, structuredDataStart)
  const sectionMarker = 'Qualifications Any Graduate Additional Information'
  const markerIndex = visibleRole.indexOf(sectionMarker)
  assert.ok(markerIndex > 0)
  const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  const prefix = visibleRole.slice(0, markerIndex)
  const suffix = visibleRole.slice(markerIndex + sectionMarker.length)
  const html = page('<section class="jobad-jobdescription"><p>' + escape(prefix) + '</p></section>'
    + '<h2 class="jobad-qualifications">Qualifications</h2><p>Any Graduate</p>'
    + '<section class="jobad-additionalinformation"><h2>Additional Information</h2><p>'
    + escape(suffix) + '</p></section>')
  const job = extractJobDetail(html)
  assert.equal(job.jobDescription, visibleRole.replace(/\s+/g, ' ').trim())
  assert.equal(job.minimumQualification, 'Any Graduate')
  assert.deepEqual(job.requiredSkills, ['Any Graduate'])
  assert.ok(job.jobDescription.includes('5+ years of experience in Oracle EPM/ERP implementations, with a focus on data management.'))
  assert.doesNotMatch(job.jobDescription, /MANAGE YOUR COOKIES|TERMS OF USE/)
})
