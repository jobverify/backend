import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import * as slice from '../../scraper/slice/script.js'
const fixture=name=>fs.readFile(new URL('../../scraper/slice/fixtures/'+name,import.meta.url),'utf8')

test('Slice pins the Indian-bank identity and its verified Kula handoff',async()=>{
  assert.equal(slice.SOURCE,'slice')
  assert.equal(slice.COMPANY,'Slice')
  assert.equal(slice.OFFICIAL_BRAND_NAME,'Slice')
  assert.equal(slice.VERIFIED_ON,'2026-10-03')
  assert.equal(slice.SLICE_BANK_CAREERS_URL,'https://slice.bank.in/careers/')
  assert.equal(slice.SLICE_BANK_OPEN_POSITIONS_URL,'https://slice.bank.in/careers/open-positions')
  assert.equal(slice.SLICE_KULA_BOARD_URL,'https://careers.kula.ai/slice?jobs=true')
  assert.equal(slice.SLICE_JOBS_API_URL,'https://careers.kula.ai/api/internal/ats_job_posts')
  assert.equal(slice.hasVerifiedSliceBankCareersSignal(await fixture('bank-careers.html')),true)
  assert.equal(slice.hasVerifiedSliceBankOpenPositionsSignal(await fixture('bank-open-positions.html')),true)
})
test('Slice rejects changed legal identity and the unrelated pizza careers surface',async()=>{
  const careers=await fixture('bank-careers.html')
  const positions=await fixture('bank-open-positions.html')
  assert.equal(slice.hasVerifiedSliceBankCareersSignal(careers.replaceAll('slice small finance bank ltd','Slice pizza')),false)
  assert.equal(slice.hasVerifiedSliceBankOpenPositionsSignal(positions.replaceAll('https://careers.kula.ai/slice?jobs=true','https://slice.careers/')),false)
  assert.equal(slice.hasVerifiedSliceBankCareersSignal('<title>Slice Careers — Open for Talent</title>Ilir Sela and local pizzerias about.slicelife.com'),false)
})
