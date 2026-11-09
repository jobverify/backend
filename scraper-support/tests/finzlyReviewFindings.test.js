import assert from 'node:assert/strict'
import test from 'node:test'
import { createFinzlyScraper } from '../../scraper/finzly/script.js'
import { finzlyNativeOptions } from './fixtures/finzlyNativeOptions.js'

const execute = async change => {
  const options = finzlyNativeOptions(undefined, change)
  return createFinzlyScraper({ now: options.now }).run(options)
}
const nativePageMutation = (packet, change) => {
  if (packet.url.endsWith('/pages/8189')) {
    const data = JSON.parse(packet.body); change(data); packet.body = JSON.stringify(data)
  } else if (packet.url.includes('/wp-json/wp/v2/pages?')) {
    const data = JSON.parse(packet.body); change(data.find(row => row.id === 8189)); packet.body = JSON.stringify(data)
  }
}

test('Finzly excludes a role with a separate native closure notice beside its heading', async () => {
  const notice = '<p class="vacancy-status">This position is closed.</p>'
  const jobs = await execute(packet => {
    if (packet.url.endsWith('/senior-full-stack-engineer/')) packet.body = packet.body.replace('</h1>', '</h1>' + notice)
    nativePageMutation(packet, data => {
      data.content.rendered = '[vc_column_text]' + notice + '[/vc_column_text]' + data.content.rendered
    })
  })
  assert.equal(jobs.length, 11)
  assert.ok(!jobs.some(job => job.jobId === '8189'))
})

test('Finzly preserves mandatory requirements in a separate native content block', async () => {
  const requirement = '<h2>Mandatory requirements</h2><p>Applicants must possess a valid production security certification.</p>'
  const jobs = await execute(packet => {
    if (packet.url.endsWith('/senior-full-stack-engineer/')) {
      packet.body = packet.body.replace(/(<a href="mailto:careers@finzly\.com">careers@finzly\.com\.<\/a><\/p>\s*<\/div>)/,
        '$1<div class="wpb_text_column wpb_content_element">' + requirement + '</div>')
    }
    nativePageMutation(packet, data => {
      data.content.rendered = data.content.rendered.replace(/(<a href="mailto:careers@finzly\.com">careers@finzly\.com\.<\/a>(?:<\/p>)?\s*\[\/vc_column_text\])/, '$1[vc_column_text]' + requirement + '[/vc_column_text]')
      assert.match(data.content.rendered, /production security certification/)
    })
  })
  assert.equal(jobs.length, 12)
  assert.match(jobs.find(job => job.jobId === '8189').sourceDescription, /Mandatory requirements.*valid production security certification/s)
})

test('Finzly cannot call its details complete when visible extra requirements are missing from the native API', async () => {
  const jobs = await execute(packet => {
    if (packet.url.endsWith('/senior-full-stack-engineer/')) packet.body = packet.body.replace(
      /(<a href="mailto:careers@finzly\.com">careers@finzly\.com\.<\/a><\/p>\s*<\/div>)/,
      '$1<div class="wpb_text_column wpb_content_element"><h2>Mandatory requirements</h2><p>Additional role-bound qualification.</p></div>')
  })
  assert.equal(jobs.length, 11)
  assert.ok(!jobs.some(job => job.jobId === '8189'))
})

test('Finzly cannot substitute the generic careers email for conflicting role-specific application instructions', async () => {
  const jobs = await execute(packet => {
    if (packet.url.endsWith('/senior-full-stack-engineer/')) packet.body = packet.body.replace('href="mailto:careers@finzly.com"', 'href="mailto:apply@other.example"')
    nativePageMutation(packet, data => { data.content.rendered = data.content.rendered.replace('href="mailto:careers@finzly.com"', 'href="mailto:apply@other.example"') })
  })
  assert.equal(jobs.length, 11)
  assert.ok(!jobs.some(job => job.jobId === '8189'))
})
