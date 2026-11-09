import assert from 'node:assert/strict'
import test from 'node:test'
import { geography, officeIndex, nativeHTMLText, literalFields } from './nativeData.js'
import { normalizeScrapedJob } from '../../utils/normalizeScrapedJob.js'
import { isIndiaJob } from '../../utils/indiaLocationFilter.js'

const project = (label, offices = [], graph = offices) => geography({ location: { name: label }, offices }, officeIndex({ offices: graph }))
const publicJob = fields => normalizeScrapedJob({ source: 'control', title: 'Software Engineer', company: 'Example India', ...fields }, { source: 'control', companyName: 'Example India', countryFilter: 'India' })

test('native inline formatting cannot split an original word, ordinal or punctuation', () => {
  assert.equal(nativeHTMLText('&lt;p&gt;T&lt;span&gt;he&lt;/span&gt; role is 3&lt;sup&gt;rd&lt;/sup&gt;.&lt;/p&gt;'), 'The role is 3rd.')
})
test('inner literal example brackets survive exactly one documented outer HTML encoding layer', () => {
  assert.equal(nativeHTMLText('&lt;p&gt;Use &amp;lt;T&amp;gt; &amp;amp; retain this.&lt;/p&gt;'), 'Use <T> & retain this.')
})
test('an office business-unit name containing India is not a country label', () => {
  const result = project('Remote', [{ id: 1, name: 'India Strategy Team', location: null, parent_id: null }])
  assert.equal(result.country, null);assert.equal(result.sourceCountryScopeUnresolved, true)
  assert.equal(isIndiaJob(publicJob(result)), false)
})
test('explicit separate comma-delimited country names remain coherent country scope', () => {
  const result = project('United Kingdom, Ireland or Poland')
  assert.equal(result.sourceNativeCountryConflict, false)
  assert.equal(result.sourceCountryScopeUnresolved, false)
  assert.deepEqual(new Set(result.sourceNativeCountries), new Set(['United Kingdom', 'Ireland', 'Poland']))
  assert.equal(isIndiaJob(publicJob(result)), false)
})
for (const label of ['Pune', 'Pune, IN', 'Georgia', 'Global', 'APAC', 'Remote', 'RemoteIndia', 'IndiaRemote']) test('untyped ambiguous location stays unresolved: ' + label, () => {
  const result = project(label)
  assert.equal(result.country, null);assert.equal(result.city, null);assert.equal(result.location, null)
  assert.deepEqual(result.locations, []);assert.equal(isIndiaJob(publicJob(result)), false)
})
test('explicit same-worksite country contradictions hold the public geography', () => {
  const result = project('Bengaluru, Karnataka, India', [{ id: 1, name: 'Bengaluru', location: 'Bengaluru, Karnataka, United States', parent_id: null }])
  assert.equal(result.sourceNativeCountryConflict, true);assert.equal(result.country, null)
  assert.equal(isIndiaJob(publicJob(result)), false)
})
test('separately identified India and foreign offices preserve only supported India public places', () => {
  const result = project('New York, New York, United States', [{ id: 1, name: 'Bengaluru', location: 'Bengaluru, Karnataka, India', parent_id: null }])
  assert.equal(result.country, 'India');assert.equal(result.sourceNativeCountryConflict, false)
  assert.deepEqual(result.locations, ['Bengaluru, Karnataka, India']);assert.equal(isIndiaJob(publicJob(result)), true)
})
test('native office ID hierarchy can supply an explicit country without city inference', () => {
  const office = { id: 1, name: 'Undeclared city', location: null, parent_id: 2 }, parent = { id: 2, name: 'India', location: null, parent_id: null }
  const result = project('Undeclared city', [office], [office, parent])
  assert.equal(result.country, 'India');assert.equal(result.sourceNativeCountryEvidence.assignedOffices[0].nativeCountryPath[1].id, 2)
  assert.equal(result.sourceCountryScopeUnresolved, false)
})
test('genuine native No Office zero entry is retained without inventing a real worksite', () => {
  const index = officeIndex({ offices: [{ id: 0, name: 'No Office', location: null, parent_id: null, child_ids: [], departments: [] }] })
  assert.equal(index.nodes.get(0).name, 'No Office')
  const result = geography({ location: { name: 'Remote' }, offices: [] }, index)
  assert.equal(result.country, null);assert.equal(result.sourceCountryScopeUnresolved, true)
})
test('a mixed flat city/country list cannot assign its first city to a later country', () => {
  const result = project('London, Oxford, Poland, Krakow', [{ id: 1, name: 'London, United Kingdom', location: 'London, England, United Kingdom', parent_id: null }])
  assert.equal(result.sourceNativeCountryConflict, false);assert.equal(result.sourceCountryScopeUnresolved, true)
  assert.ok(result.sourceNativeCountries.includes('Poland'));assert.ok(result.sourceNativeCountries.includes('United Kingdom'))
})
test('literal Part-time and absent hours never acquire the generic Full-time default', () => {
  for (const metadata of [null, [{ name: 'Employment Type', value: 'Part-time' }]]) {
    const fields = literalFields({ metadata })
    assert.equal(publicJob(fields).employmentType, null)
    assert.equal(publicJob(fields).sourceEmploymentType, metadata ? 'Part-time' : null)
  }
})
test('an explicit native Hybrid location prefix is retained separately from employment hours', () => {
  const fields = literalFields({ location: { name: 'Hybrid - Houston, TX' }, metadata: null })
  assert.equal(fields.remoteStatus, 'Hybrid');assert.equal(fields.sourceEmploymentType, null)
  assert.equal(literalFields({ location: { name: 'Houston, TX' } }).remoteStatus, null)
})
test('edit dates and invalid calendars cannot become source posting dates', () => {
  const fields = literalFields({ first_published: '2026-02-30T10:00:00+00:00', updated_at: '2026-10-31T10:00:00+00:00' })
  assert.equal(fields.sourcePostingDate, '2026-02-30T10:00:00+00:00');assert.equal(fields.postingDate, null)
  assert.equal(fields.sourceNativeUpdatedAt, '2026-10-31T10:00:00+00:00')
})

test('typed native Country metadata supports ISO values without interpreting untyped city/state aliases', () => {
 const index=officeIndex({offices:[]})
 const result=geography({location:{name:'Pune'},offices:[],metadata:[{name:'Country',value:'IN'}]},index)
 assert.equal(result.country,'India');assert.ok(result.sourceNativeCountryEvidence.typedMetadata.some(item=>item.originalValue==='IN'))
 const irrelevant=geography({location:{name:'Pune, IN'},offices:[],metadata:[{name:'Business Unit',value:'India'}]},index)
 assert.equal(irrelevant.country,null)
 const conflict=geography({location:{name:'India'},offices:[],metadata:[{name:'Country',value:'US'}]},index)
 assert.equal(conflict.sourceNativeCountryConflict,true);assert.equal(conflict.country,null)
})

test('typed Location country assertions and assigned-office country contradictions hold India consumer geography',()=>{
 const india={id:1,name:'India',location:null,parent_id:null},index=officeIndex({offices:[india]})
 for(const name of ['Country','Location']){
  const result=geography({location:{name:name==='Country'?'Remote':'India'},offices:[india],metadata:[{name,value_type:'single_select',value:'United States'}]},index)
  assert.equal(result.sourceNativeCountryConflict,true);assert.equal(result.country,null);assert.equal(isIndiaJob(publicJob(result)),false)
  assert.ok(result.sourceNativeCountryEvidence.typedMetadata.some(field=>field.originalField===name&&field.originalValue==='United States'))
 }
})

test('explicit native Location metadata supplies missing country and retains clearly separate worksites',()=>{
 const index=officeIndex({offices:[]}),metadata=[{name:'Location',value:['Bengaluru, Karnataka, India','New York, New York, United States']}]
 const result=geography({location:{name:'Remote'},offices:[],metadata},index)
 assert.equal(result.country,'India');assert.equal(result.sourceNativeCountryConflict,false)
 assert.ok(result.locations.includes('Bengaluru, Karnataka, India'));assert.ok(!result.locations.some(label=>label.includes('New York')))
 assert.equal(isIndiaJob(publicJob(result)),true)
 const unknown=geography({location:{name:'United States'},offices:[],metadata:[{name:'Location',value:{label:'undeclared structured value'}}]},index)
 assert.equal(unknown.sourceCountryScopeUnresolved,true)
})
