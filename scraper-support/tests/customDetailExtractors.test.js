import assert from 'node:assert/strict'
import test from 'node:test'

import {
  extractGoogleJobDetail,
  extractRubrikJobDetail,
} from '../detailExtractors/custom.js'

test('extractGoogleJobDetail marks public detail as checked when qualifications are present but experience years are absent', () => {
  const detail = extractGoogleJobDetail(`
    <section>
      <h2>About the job</h2>
      <div>Build resilient distributed systems for Google Cloud customers.</div>
      <h3>Minimum qualifications</h3>
      <ul>
        <li>Bachelor's degree in Computer Science or equivalent practical experience.</li>
        <li>Experience with data structures and algorithms.</li>
      </ul>
    </section>
  `)

  assert.equal(detail.experienceRequired, null)
  assert.equal(detail.publicExperienceChecked, true)
})

test('extractRubrikJobDetail marks public detail as checked when the public job page exposes requirements but no experience years', () => {
  const detail = extractRubrikJobDetail(`
    <section>
      <h2>What you'll do</h2>
      <ul>
        <li>Partner with engineering teams to improve platform reliability.</li>
      </ul>
      <h2>Requirements</h2>
      <ul>
        <li>Strong distributed systems fundamentals.</li>
        <li>Comfort mentoring cross-functional teams.</li>
      </ul>
    </section>
  `)

  assert.equal(detail.experienceRequired, null)
  assert.equal(detail.publicExperienceChecked, true)
})

test('custom detail extractors keep publicExperienceChecked true when the public page exposes explicit experience requirements', () => {
  const googleDetail = extractGoogleJobDetail(`
    <section>
      <h2>About the job</h2>
      <div>Build resilient distributed systems for Google Cloud customers.</div>
      <h3>Minimum qualifications</h3>
      <ul>
        <li>6 years of experience building distributed systems.</li>
      </ul>
    </section>
  `)
  const rubrikDetail = extractRubrikJobDetail(`
    <section>
      <h2>What you'll do</h2>
      <ul>
        <li>Build AI platform services.</li>
      </ul>
      <h2>Requirements</h2>
      <ul>
        <li>9+ years of software engineering with deep backend and infrastructure focus.</li>
      </ul>
    </section>
  `)

  assert.equal(googleDetail.experienceRequired, '6 years of experience building distributed systems.')
  assert.equal(googleDetail.publicExperienceChecked, true)
  assert.equal(
    rubrikDetail.experienceRequired,
    '9+ years of software engineering with deep backend and infrastructure focus.',
  )
  assert.equal(rubrikDetail.publicExperienceChecked, true)
})

test('extractRubrikJobDetail handles the current text-section page shape used on live Rubrik job pages', () => {
  const detail = extractRubrikJobDetail(`
    <section>
      <p>This role works on platform architecture.</p>
      <h2>What You’ll Do</h2>
      <p>As a Software Engineer, you will be responsible for:</p>
      <ul>
        <li>Full stack ownership across design and implementation.</li>
        <li>Troubleshooting issues experienced by customers.</li>
      </ul>
      <h2><strong>Experience You’ll Need</strong>:</h2>
      <p>You are passionate about distributed systems.</p>
      <ul>
        <li>2-5 years of software development experience.</li>
        <li>BS/MS/PhD in Computer Science or in any related field.</li>
      </ul>
      <h2>Join Us in Securing and Accelerating the World's AI Transformation</h2>
      <p>Rubrik (RBRK) is the Security and AI Operations Company.</p>
      <h2>Apply For This Job</h2>
    </section>
  `)

  assert.match(detail.jobDescription || '', /Full stack ownership/)
  assert.match(detail.minimumQualification || '', /2-5 years of software development experience/)
  assert.equal(detail.experienceRequired, '2-5 years of software development experience')
  assert.equal(detail.publicExperienceChecked, true)
})
