import assert from 'node:assert/strict'
import fs from 'node:fs'
import zlib from 'node:zlib'
import test from 'node:test'
import { createSouthIndianBankScraper, fetchNotificationPdfText } from '../../scraper/southindianbank/script.js'

const fixture = name => fs.readFileSync(new URL(`./fixtures/southindianbank/${name}`, import.meta.url))
const board = fixture('board.html').toString()
const script = zlib.gunzipSync(fixture('index.js.gz')).toString()
const text = fixture('notification.txt').toString()
const notificationUrl = 'https://recruit.southindianbank.bank.in/RDC/Notification/Notification_115102026.PDF'
const scriptResponse = {status:200, url:'https://recruit.southindianbank.bank.in/RDC/js/index.js?v=1.1', html:script}
const response = {status:200, url:notificationUrl, text}
const run = (overrides = {}) => createSouthIndianBankScraper().run({
  fetchText:async () => board,
  fetchNotificationScript: async () => scriptResponse,
  fetchPdfText:async () => response,
  ...overrides,
})

// Captures the live 2026-10-29 board and its exact linked campaign notification.
// A change dropping PDF recovery or hiding its contradictory dates must fail.
test('South Indian Bank recovers the exact official operations notification and preserves its date conflict', async () => {
  const [job] = await run()
  assert.equal(job.jobId, '115102026')
  assert.equal(job.title, 'RECRUITMENT OF JUNIOR OFFICER (OPERATIONS)')
  assert.equal(job.sourceNotificationDescription, text)
  assert.equal(job.sourceDescription, null)
  assert.equal(job.jobDescription, null)
  assert.equal(job.sourceNotificationUrl, notificationUrl)
  assert.equal(job.sourceUrl, 'https://recruit.southindianbank.bank.in/RDC/')
  assert.equal(job.closingDate, '2026-10-31')
  assert.deepEqual(job.sourceNotificationDates, {postingDate:'2026-10-16',closingDate:'2026-10-27'})
  assert.equal(job.sourceDateConflict, true)
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'notification-date-conflict')
})

test('South Indian Bank promotes matching-date notification content without claiming PDF completeness', async () => {
  const correctedText = text.replaceAll('27.10.2026','31.10.2026')
  const [job] = await run({fetchPdfText:async()=>({...response,text:correctedText})})
  assert.equal(job.sourceNotificationDescription,correctedText)
  assert.equal(job.sourceDescription,correctedText)
  assert.equal(job.jobDescription,correctedText)
  assert.equal(job.sourceDateConflict,false)
  assert.equal(job.sourceDetailComplete,false)
  assert.equal(job.sourceDetailFailureKind,'pdf-completeness-unverified')
})

test('South Indian Bank conflicting notification cannot become public through persistence', {timeout:60000}, async t => {
  const [{default:mongoose},{MongoMemoryServer},{fileURLToPath},{saveToDB},{applyPublicJobVisibility}] = await Promise.all([
    import('mongoose'),import('mongodb-memory-server'),import('node:url'),import('../utils/saveToDB.js'),
    import('../../src/utils/publicJobVisibility.js'),
  ])
  assert.equal(mongoose.connection.readyState,0,'Never reuse an application database')
  const mongo=await MongoMemoryServer.create({instance:{ip:'127.0.0.1'},binary:{version:'8.2.6',
    downloadDir:fileURLToPath(new URL('../../.cache/mongodb-binaries/',import.meta.url)),runtimeDownload:false}})
  t.after(async()=>{await mongoose.disconnect();await mongo.stop()})
  assert.match(mongo.getUri(),/^mongodb:\/\/127\.0\.0\.1:\d+\//)
  await mongoose.connect(mongo.getUri(),{autoIndex:false,autoCreate:false})
  const now=new Date('2026-10-29T18:00:00.000Z')
  const options={now,enrichPublicExperience:false,enqueueAlerts:false,
    descriptionRewriteMode:'off',replaceExisting:false,refreshDatasetSummary:false}
  const jobs=await run({now:()=>now.toISOString()})
  await saveToDB(jobs,'southindianbank',options)
  const collection=mongoose.connection.db.collection('jobs')
  const filter=applyPublicJobVisibility({source:'southindianbank',status:'active'},{},now)
  assert.equal(await collection.countDocuments(filter),0,'Unresolved source applicability must stay private')
  const stored=await collection.findOne({source:'southindianbank',jobId:'115102026'})
  assert.equal(stored.sourceDescription,null)
  assert.equal(stored.description,null)
  // A controlled matching-date notification proves the withheld canonical body
  // is the blocker, rather than an unrelated bank/date/location filter.
  const correctedText=text.replaceAll('27.10.2026','31.10.2026')
  const matched=await run({now:()=>now.toISOString(),fetchPdfText:async()=>({...response,text:correctedText})})
  await saveToDB(matched,'southindianbank',options)
  assert.equal(await collection.countDocuments(filter),1)
})

test('South Indian Bank rejects another employer, role, campaign date or redirected document', async () => {
  for (const change of [
    {text:text.replaceAll('South Indian Bank', 'Unrelated Bank')},
    {text:text.replaceAll('JUNIOR OFFICER (OPERATIONS)', 'PROBATIONARY OFFICER (CA)')},
    {text:text.replace('RECRUITMENT OF JUNIOR OFFICER (OPERATIONS)', 'RECRUITMENT OF JUNIOR OFFICER (OPERATIONS) TRAINEE')},
    {text:text.replaceAll('16.10.2026', '16.10.2025')},
    {url:'https://recruit.southindianbank.bank.in/RDC/Notification/Notification_108052026.PDF'},
    {url:'https://unrelated.example/Notification_115102026.PDF'},
    {status:404},
  ]) {
    const [job] = await run({fetchPdfText:async () => ({...response,...change})})
    assert.equal(job.sourceDescription, undefined, JSON.stringify(change).slice(0,200))
    assert.equal(job.jobDescription, null)
    assert.equal(job.sourceDetailComplete, false)
  }
})

test('South Indian Bank default PDF reader cancels an unresponsive native request', {timeout:2000}, async () => {
  let fallback
  try {
    await assert.rejects(fetchNotificationPdfText(notificationUrl, {timeoutMs:20,
      fetchImpl:async (_url,{signal})=>new Promise((resolve,reject)=>{
        fallback=setTimeout(()=>resolve(null),1000)
        signal.addEventListener('abort',()=>reject(signal.reason),{once:true})
      }),
    }), error => error.name === 'TimeoutError')
  } finally { clearTimeout(fallback) }
})

test('South Indian Bank default PDF reader rejects redirects and HTML before extraction', async () => {
  for (const value of [
    {status:200,url:'https://unrelated.example/notice.pdf',headers:new Headers({'content-type':'application/pdf'})},
    {status:200,url:notificationUrl,headers:new Headers({'content-type':'text/html'})},
    {status:404,url:notificationUrl,headers:new Headers({'content-type':'application/pdf'})},
  ]) assert.equal(await fetchNotificationPdfText(notificationUrl, {fetchImpl:async ()=>({
    ...value, arrayBuffer:async ()=>{assert.fail('Invalid native responses must not be parsed')},
  })}),null)
})

test('South Indian Bank uses only the exact linked script notification handler', async () => {
  for (const changed of [
    {...scriptResponse, html:script.replace("callpdf('115102026')", "callJDpdf('115102026')")},
    {...scriptResponse, html:script.replace('Notification/Notification_', 'Notification/jd_')},
    {...scriptResponse, url:'https://unrelated.example/index.js?v=1.1'},
  ]) {
    const [job] = await run({fetchNotificationScript:async () => changed,
      fetchPdfText:async () => {assert.fail('An unverified notification must not be requested')}})
    assert.equal(job.sourceDescription, undefined)
  }
})

test('South Indian Bank supports cancellation during PDF enrichment and a zero detail budget', async () => {
  const controller = new AbortController()
  const reason = new Error('cancel bank read')
  await assert.rejects(run({signal:controller.signal, fetchPdfText:async (_url,{signal})=>{
    controller.abort(reason)
    signal.throwIfAborted()
  }}), error => error === reason)
  const [job] = await run({detailEnrichmentBudgetMs:0,
    fetchPdfText:async () => {assert.fail('No PDF read with exhausted budget')}})
  assert.equal(job.sourceDetailComplete,false)
  assert.equal(job.sourceDescription,undefined)
})
