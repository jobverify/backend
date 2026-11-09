import assert from 'node:assert/strict'
import test from 'node:test'
import {extractJobFilterSignals} from '../src/utils/jobFilterSignals.js'
import {normalizeScrapedJob} from '../scraper-support/utils/normalizeScrapedJob.js'
const originalJob={"title":"Claims Operations Associate III","company":"Allstate","location":"Pune, India","city":"Pune","jobDescription":"Education and Experience • 0-18 months of related experience • Bachelor’s degree or equivalent experience.","link":"https://allstate.wd5.myworkdayjobs.com/allstate_careers/job/Ind--Pune/Claims-Operations-Associate-III_R33204"}
const originalProvider={"source":"allstate","companyCareerPage":"https://www.allstate.jobs","atsPlatform":"workday"}
const relevant = signals => ({ minimum: signals.experienceProfile.minimumYears, maximum: signals.experienceProfile.maximumYears, open: signals.experienceProfile.isOpenEnded, years: signals.experienceYears })
const read = value => extractJobFilterSignals({ title: 'Controlled claims associate', experienceRequired: value })
test('contextual month prose and its canonical label preserve the same closed numeric interval', () => {
  const initial = extractJobFilterSignals(originalJob), normalized = normalizeScrapedJob(originalJob, originalProvider)
  assert.deepEqual(relevant(initial), {minimum:0,maximum:1.5,open:false,years:[0,1]})
  assert.equal(normalized.experienceRequired,'0-18 months')
  assert.equal(normalized.experienceBucket,'0-1')
  assert.deepEqual(normalized.experienceYears,[0,1])
  assert.deepEqual(relevant(normalized),relevant(initial))
  assert.equal(normalized.sourceDescription,originalJob.jobDescription)
})
for(const [value,minimum,maximum,years] of [
  ['0-18 months',0,1.5,[0,1]],
  ['0 to 18 months',0,1.5,[0,1]],
  ['0–18 months',0,1.5,[0,1]],
  ['0-6 months',0,.5,[0]],
  ['6-18 months',.5,1.5,[1]],
  ['12-24 months',1,2,[1,2]],
  ['0-0 months',0,0,[0]],
])test('explicit closed months retain both authored bounds: '+value,()=>{
  const signals=read(value)
  assert.deepEqual(relevant(signals),{minimum,maximum,open:false,years})
  assert.equal(signals.experienceProfile.hasExplicitExperience,true)
  assert.equal(signals.experienceProfile.confidence,'high')
})
test('an exact18month value retains the existing fractional singleton UI rounding',()=>{
  assert.deepEqual(relevant(read('18 months')),{minimum:1.5,maximum:1.5,open:false,years:[2]})
})
test('an open18month minimum retains the existing ceil-to-integer UI lower bound',()=>{
  assert.deepEqual(relevant(read('18+ months')),{minimum:1.5,maximum:null,open:true,years:Array.from({length:14},(_,index)=>index+2)})
})
test('bare and unit-qualified year ranges retain their established semantics',()=>{
  for(const value of ['0-2','0-2 years'])assert.deepEqual(relevant(read(value)),{minimum:0,maximum:2,open:false,years:[0,1,2]})
})
test('mixed month/year source prose remains a mixed-unit interval',()=>{
  const signals=extractJobFilterSignals({title:'Controlled associate',description:'Required qualifications:6 months to1 year of related experience.'})
  assert.deepEqual(relevant(signals),{minimum:.5,maximum:1,open:false,years:[1]})
})
test('explicit month-range authority survives a narrower specialty requirement in prose',()=>{
  const signals=extractJobFilterSignals({title:'Controlled associate',experienceRequired:'0-18 months',description:'At least5 years of experience with specialized claims software.'})
  assert.deepEqual(relevant(signals),{minimum:0,maximum:1.5,open:false,years:[0,1]})
})
test('reversed explicit months remain raw evidence without an invented numeric requirement',()=>{
  const signals=read('18-0 months')
  assert.deepEqual(relevant(signals),{minimum:null,maximum:null,open:false,years:[]})
  assert.equal(signals.experienceBucket,'unspecified')
  assert.equal(signals.experienceProfile.rawText,'18-0 months')
})
test('unsupported month-like units remain unknown rather than defaulting to years',()=>{
  assert.deepEqual(relevant(read('0-18 fortnights')),{minimum:null,maximum:null,open:false,years:[]})
})
test('a contract-duration range without experience evidence remains unknown',()=>{
  const signals=extractJobFilterSignals({title:'Controlled associate',description:'Contract duration:0-18 months. Process claims workflows.'})
  assert.deepEqual(relevant(signals),{minimum:null,maximum:null,open:false,years:[]})
})
test('missing numeric requirements remain unknown rather than becoming an experienced default',()=>{
  const signals=extractJobFilterSignals({title:'Controlled associate',description:'Relevant professional experience is requested.'})
  assert.deepEqual(relevant(signals),{minimum:null,maximum:null,open:false,years:[]})
})
test('conditional degree alternatives are retained without choosing one month range',()=>{
  const signals=extractJobFilterSignals({title:'Controlled associate',description:'Required qualifications: Bachelor degree with0-18 months of professional experience or Master degree with0-6 months of professional experience.'})
  assert.deepEqual(relevant(signals),{minimum:null,maximum:null,open:false,years:[]})
  assert.match(signals.experienceProfile.evidence,/Bachelor degree/)
})
test('numeric month repair does not manufacture country or alter source text and observation-date provenance',()=>{
  const description='Education and Experience:0-18 months of related experience.',normalized=normalizeScrapedJob({title:'Controlled associate',jobDescription:description,country:null,city:null,location:null,scrapedAt:'2026-07-17T00:00:00.000Z'},originalProvider)
  assert.equal(normalized.country,null);assert.equal(normalized.city,null);assert.equal(normalized.location,null)
  assert.equal(normalized.sourceDescription,description)
  assert.equal(normalized.postedAtProvenance,'observation')
  assert.equal(normalized.postedAt.toISOString(),'2026-07-17T00:00:00.000Z')
  assert.deepEqual(normalized.experienceYears,[0,1])
})
for(const [description,minimum,maximum,years] of [
  ['Experience:0-18 months.',0,1.5,[0,1]],
  ['Education and Experience:6-18 months of relevant experience.',.5,1.5,[1]],
])test('a plain experience label keeps its full month interval: '+description,()=>{
  const signals=extractJobFilterSignals({title:'Controlled associate',description})
  assert.deepEqual(relevant(signals),{minimum,maximum,open:false,years})
})
test('a bare untyped single-value experience label retains its established years meaning',()=>{
  const signals=extractJobFilterSignals({title:'Controlled associate',description:'Experience:2'})
  assert.deepEqual(relevant(signals),{minimum:2,maximum:2,open:false,years:[2]})
})

// Controlled parser inputs, not observations of current native vacancies.
// Reversed month bounds must not become a singleton or an inverted interval.
const monthContexts = [
  ['plain experience label', 'Experience:24-12 months.', 'Experience:12-24 months.'],
  ['zero upper bound', 'Experience:18-0 months.', 'Experience:0-18 months.'],
  ['required experience label', 'Required experience:24-12 months.', 'Required experience:12-24 months.'],
  ['month-qualified label', 'Months of experience:24 to12.', 'Months of experience:12 to24.'],
  ['separate minimum and maximum', 'Experience min24 months max12 months.', 'Experience min12 months max24 months.'],
  ['parenthesized minimum range', 'Experience (min.24 months to12 months).', 'Experience (min.12 months to24 months).'],
  ['repeated month units', '24 months to12 months of related experience.', '12 months to24 months of related experience.'],
  ['between label', 'Experience between24 and12 months.', 'Experience between12 and24 months.'],
  ['trailing unit', '24-12 experience months.', '12-24 experience months.'],
  ['mid-range minimum label', '24-12 minimum months of experience.', '12-24 minimum months of experience.'],
  ['qualification-line range', 'Bachelor degree with 24 months to 12 months.', 'Bachelor degree with 12 months to 24 months.'],
]
for (const [context, reversed, ascending] of monthContexts) {
  test('reversed contextual month bounds stay unknown: '+context, () => {
    const result=extractJobFilterSignals({title:'Controlled claims associate',description:reversed})
    assert.deepEqual(relevant(result),{minimum:null,maximum:null,open:false,years:[]})
    assert.equal(result.experienceBucket,'unspecified')
    assert.equal(result.experienceProfile.rawText,reversed)
  })
  test('ascending contextual month bounds remain numeric: '+context, () => {
    const result=extractJobFilterSignals({title:'Controlled claims associate',description:ascending})
    const zero=context==='zero upper bound'
    assert.deepEqual(relevant(result),zero
      ?{minimum:0,maximum:1.5,open:false,years:[0,1]}
      :{minimum:1,maximum:2,open:false,years:[1,2]})
  })
}
for(const description of ['Experience:18-0 months.','Experience:24-12 months.'])test('reversed month evidence is consistently unknown before and after normalization: '+description,()=>{
  const source={title:'Controlled claims associate',jobDescription:description,country:null,city:null,location:null,scrapedAt:'2026-07-17T00:00:00.000Z'}
  const first=normalizeScrapedJob(source,originalProvider),second=normalizeScrapedJob(first,originalProvider)
  for(const value of [source,first,second])assert.deepEqual(relevant(extractJobFilterSignals(value)),{minimum:null,maximum:null,open:false,years:[]})
  for(const value of [first,second]){
    assert.equal(value.sourceDescription,description)
    assert.equal(value.country,null);assert.equal(value.city,null);assert.equal(value.location,null)
    assert.equal(value.postedAtProvenance,'observation')
    assert.equal(value.postedAt.toISOString(),'2026-07-17T00:00:00.000Z')
  }
})

test('a reversed month/year contextual range remains unknown after unit conversion',()=>{
  const result=extractJobFilterSignals({title:'Controlled claims associate',description:'24 months to1 year of related experience.'})
  assert.deepEqual(relevant(result),{minimum:null,maximum:null,open:false,years:[]})
})
test('an ascending month/year contextual range retains converted bounds',()=>{
  const result=extractJobFilterSignals({title:'Controlled claims associate',description:'6 months to1 year of related experience.'})
  assert.deepEqual(relevant(result),{minimum:.5,maximum:1,open:false,years:[1]})
})
test('equal contextual month bounds retain the exact singleton requirement',()=>{
  const result=extractJobFilterSignals({title:'Controlled claims associate',description:'Experience:18-18 months.'})
  assert.deepEqual(relevant(result),{minimum:1.5,maximum:1.5,open:false,years:[2]})
})
test('an ambiguous reversed duration cannot generate a numeric experience requirement',()=>{
  const result=extractJobFilterSignals({title:'Controlled claims associate',description:'Contract duration:24-12 months. Experience:0-18 months.'})
  assert.deepEqual(relevant(result),{minimum:null,maximum:null,open:false,years:[]})
})
