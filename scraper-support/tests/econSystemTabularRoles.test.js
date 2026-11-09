import assert from 'node:assert/strict'
import test from 'node:test'
import { extractOpenings, CAREER_PAGE_URL } from '../../scraper/econsystem/script.js'
const tabular = `<a name="e-con005"></a><h2>JOB ID: e-con005</h2><h3>Job Synopsis:</h3><table><tr><td><b>Position:</b> Lead Engineer</td></tr><tr><td><b>Location:</b> Chennai</td></tr><tr><td><b>Experience:</b> 3+ Years</td></tr><tr><td><b>Educational Qualification :</b> Bachelor's degree - EEE/ ECE</td></tr></table><h3>Role Overview: </h3><table><tr><td><p>Develop Linux kernel components for camera products.</p></td></tr></table><h3>Key responsibilities:</h3><ul><li>Maintain low-level device drivers.</li></ul><a href="mailto:jobs@e-consystems.com?subject=e-con004: Lead Engineer&amp;body=Attach resume">Apply Here</a><footer>Unrelated footer copy</footer>`

test('e-con Systems reads tabular role fields and retains only that role description', () => {
  const [job] = extractOpenings(tabular)
  assert.equal(job.title, 'Lead Engineer')
  assert.equal(job.city, 'Chennai')
  assert.equal(job.experienceRequired, '3+ Years')
  assert.equal(job.minimumQualification, "Bachelor's degree - EEE/ ECE")
  assert.match(job.jobDescription, /Linux kernel/)
  assert.match(job.jobDescription, /low-level device drivers/)
  assert.doesNotMatch(job.jobDescription, /Unrelated footer/)
  assert.equal(job.publicExperienceChecked, true)
  assert.equal(job.sourceUrl, CAREER_PAGE_URL + '#e-con005')
})

test('e-con Systems fallback title parses the mailto subject without adding the email body', () => {
  const [job] = extractOpenings('<h2>JOB ID: e-con010</h2><a href="mailto:jobs@e-consystems.com?subject=e-con010:%20Firmware%20Engineer&amp;body=Attach resume">Apply Here</a>')
  assert.equal(job.title, 'Firmware Engineer')
})

test('e-con Systems refuses an unidentifiable role instead of emitting a missing title', () => {
  assert.throws(() => extractOpenings('<h2>JOB ID: e-con011</h2><p>No role title</p>'), /title/i)
})
