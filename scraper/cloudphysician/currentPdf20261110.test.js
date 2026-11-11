import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import PDFDocument from 'pdfkit'
import * as source from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const directory = new URL('./test-data-20261110/', import.meta.url)
const packets = readdirSync(directory).filter(file => file.endsWith('.json.gz')).map(file => {
  const packet = JSON.parse(gunzipSync(readFileSync(new URL(file, directory))))
  const bytes = Buffer.from(packet.bodyBase64, 'base64')
  assert.equal(bytes.length, packet.bytes)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), packet.sha256)
  return { ...packet, bytes }
})
const original = new Map(packets.map(packet => [packet.requestUrl, packet]))
const careers = 'https://www.cloudphysician.net/careers/'
const indiaPdf = 'https://www.cloudphysician.net/assets/jds/20220331_BusinessDevelopment%20Manager.pdf'
const transport = (change = (_, packet) => packet, calls = []) => async (url) => {
  calls.push(url)
  const packet = original.get(url)
  assert.ok(packet, 'Only currently advertised URLs are allowed: ' + url)
  const next = change(url, packet, calls)
  const response = new Response(next.bytes, {status: next.status, headers: next.headers})
  Object.defineProperty(response, 'url', { value: next.finalUrl })
  return response
}

test('current native base resolves all19 real PDFs and retains the full explicit India vacancy', async () => {
  const calls = []
  const jobs = await source.run({fetchImpl: transport(undefined, calls)})
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Business Development Manager')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceUrl, indiaPdf)
  assert.equal(jobs[0].sourceNativeApplicationUrl, 'mailto:careers@cloudphysician.net')
  assert.equal(jobs[0].postingDate, null)
  assert.equal(jobs[0].closingDate, null)
  assert.ok(jobs[0].jobDescription.length > 4000)
  assert.match(jobs[0].jobDescription, /PREFERRED QUALIFICATIONS/)
  assert.match(jobs[0].jobDescription, /Minimum 2 years experience in B2B Sales/)
  assert.match(jobs[0].jobDescription, /two\s+references/)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(jobs.nativeCollectionEvidence.nativeRecords.length, 19)
  assert.ok(jobs.nativeCollectionEvidence.nativeRecords.some(record => record.disposition === 'workplace-country-unverified'))
  assert.equal(calls.filter(url => url === careers).length, 2)
  assert.equal(calls.filter(url => url === indiaPdf).length, 2)
  assert.ok(calls.every(url => !url.includes('/careers/assets/')))
})

test('a foreign or ambiguous base cannot authorize corrected PDF URLs', async () => {
  for (const replacement of ['https://another-employer.example/', '/careers/']) {
    await assert.rejects(source.run({fetchImpl: transport((url, packet) => url === careers
      ? {...packet, bytes: Buffer.from(packet.bytes.toString('utf8').replace('<base href="/">', '<base href="' + replacement + '">'))} : packet)}),
    /Cloudphysician.*base/i)
  }
})

test('changed closing role declarations cannot authorize publication', async () => {
  await assert.rejects(source.run({fetchImpl: transport((url, packet, calls) => {
    if (url !== careers || calls.filter(value => value === careers).length < 2) return packet
    const html = packet.bytes.toString('utf8'), changed = html.replace('Business Development Manager', 'Different Manager')
    assert.notEqual(changed, html)
    return {...packet, bytes: Buffer.from(changed)}
  })}),
  /Cloudphysician.*(?:closing|snapshot|changed)/i)
})

const negativePdf = async (text, {applicationLink = 'mailto:careers@cloudphysician.net'} = {}) => {
  const chunks = [], document = new PDFDocument({size: 'A4', margin: 40})
  const complete = new Promise(resolve => document.on('end', () => resolve(Buffer.concat(chunks))))
  document.on('data', chunk => chunks.push(chunk))
  document.fontSize(10).text(text).text('careers@cloudphysician.net', applicationLink === null ? {} : {link: applicationLink})
  document.end()
  return complete
}

test('corporate India mentions and city-only workplaces cannot replace a native role-country heading', async () => {
  // Explicitly synthetic negative PDF: positive evidence always uses original bytes.
  const text = 'Business Development Manager (Bengaluru)\nCLOUDPHYSICIAN\n'
    + 'Cloudphysician serves patients across India.\nJOB DESCRIPTION\n'
    + 'Work with clients and develop relationships. '.repeat(40)
    + '\nPREFERRED QUALIFICATIONS\nMBA and sales experience.\nHow to apply\ncareers@cloudphysician.net\nCloudphysician Healthcare Pvt. Ltd.'
  const bytes = await negativePdf(text)
  await assert.rejects(source.run({fetchImpl: transport((url, packet) => url === indiaPdf ? {...packet, bytes} : packet)}),
    /Cloudphysician.*no qualified native India/)
})

test('a negated or unbounded India heading cannot qualify a workplace country', async () => {
  const text = 'Business Development Manager (Not India)\nCLOUDPHYSICIAN\n'
    + 'Cloudphysician serves patients across India.\nJOB DESCRIPTION\n'
    + 'Work with clients and develop relationships. '.repeat(40)
    + '\nPREFERRED QUALIFICATIONS\nMBA and sales experience.\nHow to apply\ncareers@cloudphysician.net\nCloudphysician Healthcare Pvt. Ltd.'
  const bytes = await negativePdf(text)
  await assert.rejects(source.run({fetchImpl: transport((url, packet) => url === indiaPdf ? {...packet, bytes} : packet)}),
    /Cloudphysician.*no qualified native India/)
})

test('a different PDF employer or missing full native criteria prevents India publication', async () => {
  for (const text of [
    'Business Development Manager (India)\nAnother Employer\n' + 'Requirements and qualifications. '.repeat(50),
    'Business Development Manager (India)\nCLOUDPHYSICIAN\nCloudphysician Healthcare Pvt. Ltd.\nApply now',
  ]) {
    const bytes = await negativePdf(text)
    await assert.rejects(source.run({fetchImpl: transport((url, packet) => url === indiaPdf ? {...packet, bytes} : packet)}),
      /Cloudphysician.*(?:employer|criteria)/i)
  }
})

test('a selected PDF redirect or HTML replacement cannot supply native full criteria', async () => {
  await assert.rejects(source.run({fetchImpl: transport((url, packet) => url === indiaPdf
    ? {...packet, finalUrl: 'https://another-employer.example/role.pdf'} : packet)}), /Cloudphysician.*(?:authority|URL|redirect)/i)
  await assert.rejects(source.run({fetchImpl: transport((url, packet) => url === indiaPdf
    ? {...packet, bytes: Buffer.from('<html>Preview only</html>'), headers: {'content-type': 'text/html'}} : packet)}),
  /Cloudphysician.*(?:PDF|criteria|qualified)/i)
})

test('a MIME parameter mentioning PDF cannot authorize the original native PDF bytes', async () => {
  await assert.rejects(source.run({fetchImpl: transport((url, packet) => url === indiaPdf
    ? {...packet, headers: {'content-type': 'text/html; note=application/pdf'}} : packet)}),
  /Cloudphysician.*PDF.*MIME/i)
})

test('a changed closing native PDF with identical text still withholds publication', async () => {
  await assert.rejects(source.run({fetchImpl: transport((url, packet, calls) => url === indiaPdf
    && calls.filter(value => value === indiaPdf).length > 1
    ? {...packet, bytes: Buffer.concat([packet.bytes, Buffer.from('\n% changed native document\n')])} : packet)}),
  /Cloudphysician.*closing native full PDF criteria changed/i)
})

test('pre-aborted caller retains its reason and makes no native request', async () => {
  const controller = new AbortController(), reason = new Error('Caller stopped the source')
  controller.abort(reason)
  const calls = []
  await assert.rejects(source.run({signal: controller.signal, fetchImpl: transport(undefined, calls)}), error => error === reason)
  assert.equal(calls.length, 0)
})

for (const applicationLink of [null, 'mailto:another-employer@example.test']) {
  test('synthetic native PDF email text cannot replace its exact application annotation: ' + applicationLink, async () => {
    const text = 'Business Development Manager (India)\nCLOUDPHYSICIAN\n'
      + 'JOB DESCRIPTION\nWork with clients and develop sales relationships. '.repeat(30)
      + '\nPREFERRED QUALIFICATIONS\nMBA and sales experience.\nHow to apply\ncareers@cloudphysician.net\nCloudphysician Healthcare Pvt. Ltd.'
    const bytes = await negativePdf(text, {applicationLink})
    await assert.rejects(source.run({fetchImpl: transport((url, packet) => url === indiaPdf ? {...packet, bytes} : packet)}),
      /Cloudphysician.*application binding unavailable/i)
  })
}
