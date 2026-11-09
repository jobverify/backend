import assert from 'node:assert/strict'
import test from 'node:test'
import { createLiciousScraper } from '../../scraper/licious/script.js'
import { liciousCapture, liciousNativeOptions } from './fixtures/liciousNativeOptions.js'

const execute = async (mutate, { empty = false } = {}) => {
  const fixture = liciousCapture()
  if (empty) for (const packet of fixture.packets) {
    if (packet.url.endsWith('/reqlist/get')) {
      const body = JSON.parse(packet.body); body.reqDetailsBOList = []; packet.body = JSON.stringify(body)
    }
    if (packet.url.includes('job-posting-dates/list')) {
      packet.requestBody = JSON.stringify({ srcShortName: 'careers', requisitionIdList: [] })
      const body = JSON.parse(packet.body); body.data.careersJobPostingDatesList = []; packet.body = JSON.stringify(body)
    }
    if (packet.url === 'https://www.licious.in/careers' || packet.url === 'https://www.licious.in/careers/jobs') {
      packet.body = packet.body.replace(/href="\/careers\/(?:why-join|culture|technology|teams|life)"/g, 'href="/careers"')
    }
  }
  const options = liciousNativeOptions(fixture, mutate)
  return createLiciousScraper({ now: options.now }).run(options)
}

for (const metadata of [{ error: 'Service unavailable' }, { hasMore: true, total: 35 }]) {
  test(`Licious cannot certify native zero with ${JSON.stringify(metadata)}`, async () => {
    await assert.rejects(execute(packet => {
      if (packet.url.endsWith('/reqlist/get')) packet.body = JSON.stringify({ ...JSON.parse(packet.body), ...metadata })
    }, { empty: true }), /Licious native.*listing/i)
  })
}

for (const attributes of ['type="application/json"', 'nomodule']) {
  test(`Licious cannot bind its component through an inactive ${attributes} script`, async () => {
    await assert.rejects(execute(packet => {
      if (packet.url === 'https://www.licious.in/careers/jobs') packet.body = packet.body.replace(
        /<script(?=[^>]*src="[^\"]*\/chunks\/pages\/content\/careers\/jobs-[^\"]+\.js")/, `<script ${attributes}`)
    }, { empty: true }), /Licious native.*client/i)
  })
}

test('Licious cannot return a stylesheet-hidden full native description as complete', async () => {
  const jobs = await execute(packet => {
    if (packet.url.endsWith('/requisition/object') && JSON.parse(packet.requestBody).reqId === 1573) {
      const body = JSON.parse(packet.body)
      body.data.reqDetailsBO.jdDisplay = `<style>#review-hidden-jd{display:none}</style><div id="review-hidden-jd">${body.data.reqDetailsBO.jdDisplay}</div>`
      packet.body = JSON.stringify(body)
    }
  })
  assert.equal(jobs.length, 32)
  assert.ok(!jobs.some(job => job.jobId === '1573'))
})

test('Licious excludes a role whose closing employer identity changed', async () => {
  const jobs = await execute((packet, index) => {
    if (packet.url.endsWith('/reqlist/get') && index === 1) {
      const body = JSON.parse(packet.body)
      body.reqDetailsBOList.find(row => row.reqId === 1573).companyName = 'Syra Foods'
      packet.body = JSON.stringify(body)
    }
  })
  assert.equal(jobs.length, 32)
  assert.ok(!jobs.some(job => job.jobId === '1573'))
})
