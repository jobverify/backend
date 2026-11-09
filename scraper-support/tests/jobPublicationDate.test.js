import assert from 'node:assert/strict'
import test from 'node:test'
const helperUrl=new URL('../../src/utils/jobPublicationDate.js',import.meta.url).href
const first='2026-10-24T08:00:00.000Z',later='2026-10-25T09:00:00.000Z',native='2026-10-20T03:00:00.000Z'
const iso=value=>value?.toISOString?.()??value??null
const load=()=>import(helperUrl)
const observed=()=>({postingDate:first,postedAt:first,scrapedAt:later,postedAtProvenance:'observation',postedAtProvenanceValue:first})
test('unknown publication resolves an observation without mutating input',async()=>{
 const {resolveJobPublicationDate}=await load(),job={postingDate:null,scrapedAt:first},snapshot=structuredClone(job)
 const result=resolveJobPublicationDate(job)
 assert.equal(iso(result.date),first);assert.equal(result.provenance,'observation');assert.equal(result.provenanceValue,first);assert.deepEqual(job,snapshot)
})
test('new undated input can use an explicit observation clock',async()=>{
 const {resolveJobPublicationDate}=await load(),result=resolveJobPublicationDate({},{observationDate:first})
 assert.equal(iso(result.date),first);assert.equal(result.provenance,'observation')
})
test('an undated input without any observation clock does not invent one in the shared resolver',async()=>{
 const {resolveJobPublicationDate}=await load(),result=resolveJobPublicationDate({})
 assert.equal(result.date,null);assert.equal(result.provenance,'observation');assert.equal(result.provenanceValue,null)
})
for(const alias of ['postingDate','postedAt'])test(`an unmarked real ${alias} is source evidence even at the observation instant`,async()=>{
 const {resolveJobPublicationDate}=await load(),result=resolveJobPublicationDate({[alias]:first,scrapedAt:first})
 assert.equal(iso(result.date),first);assert.equal(result.provenance,'source');assert.equal(result.provenanceValue,first)
})
test('an observation anchor survives Date and JSON representations and a later scrape clock',async()=>{
 const {resolveJobPublicationDate}=await load(),input={...observed(),postingDate:new Date(first)}
 const result=resolveJobPublicationDate(JSON.parse(JSON.stringify(input)))
 assert.equal(iso(result.date),first);assert.equal(result.provenance,'observation');assert.equal(result.provenanceValue,first)
})
for(const alias of ['postingDate','postedAt'])test(`a changed ${alias} replaces a stale observation marker`,async()=>{
 const {resolveJobPublicationDate}=await load(),result=resolveJobPublicationDate({...observed(),[alias]:native})
 assert.equal(iso(result.date),native);assert.equal(result.provenance,'source');assert.equal(result.provenanceValue,native)
})
test('an invalid changed alias does not promote a synthesized fallback to source evidence',async()=>{
 const {resolveJobPublicationDate}=await load(),result=resolveJobPublicationDate({...observed(),postedAt:'not-a-date'})
 assert.equal(iso(result.date),first);assert.equal(result.provenance,'observation')
})
test('explicit verified source marking can replace an observation origin at the same instant',async()=>{
 const {resolveJobPublicationDate,sourcePublicationDateFields}=await load()
 const fields=sourcePublicationDateFields(first),result=resolveJobPublicationDate({...observed(),...fields})
 assert.equal(iso(result.date),first);assert.equal(result.provenance,'source');assert.equal(result.provenanceValue,first)
})
test('the explicit source marker does not accept a malformed lifecycle date',async()=>{
 const {sourcePublicationDateFields}=await load()
 assert.throws(()=>sourcePublicationDateFields('not-a-date'),TypeError)
})
test('legacy unmarked source dates are not reclassified just because they equal scrapedAt',async()=>{
 const {resolveJobPublicationDate}=await load(),result=resolveJobPublicationDate({postedAt:first,scrapedAt:first,createdAt:first})
 assert.equal(result.provenance,'source');assert.equal(iso(result.date),first)
})
test('a recognized source origin survives JSON and re-normalization-shaped aliases',async()=>{
 const {resolveJobPublicationDate}=await load()
 const result=resolveJobPublicationDate({postingDate:native,postedAt:native,postedAtProvenance:'source',postedAtProvenanceValue:native,scrapedAt:later})
 assert.equal(result.provenance,'source');assert.equal(iso(result.date),native)
})
test('an invalid anchor cannot suppress a supplied real source date',async()=>{
 const {resolveJobPublicationDate}=await load(),result=resolveJobPublicationDate({...observed(),postingDate:native,postedAtProvenanceValue:'invalid'})
 assert.equal(result.provenance,'source');assert.equal(iso(result.date),native)
})
test('when both changed valid aliases conflict the existing postingDate precedence remains',async()=>{
 const {resolveJobPublicationDate}=await load(),result=resolveJobPublicationDate({...observed(),postingDate:native,postedAt:'2026-10-19T00:00:00.000Z'})
 assert.equal(result.provenance,'source');assert.equal(iso(result.date),native)
})
test('explicit source enrichment fields keep serialized ISO date aliases compatible with provider output',async()=>{
 const {sourcePublicationDateFields}=await load(),fields=sourcePublicationDateFields(native)
 assert.equal(fields.postingDate,native);assert.equal(fields.postedAt,native)
})

