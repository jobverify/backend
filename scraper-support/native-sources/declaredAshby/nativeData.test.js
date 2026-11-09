import test from 'node:test'
import assert from 'node:assert/strict'
import { appData, nativePlaces } from './nativeData.js'
import { readNativeDocument } from '../../utils/activeNativeHtml.js'
import { normalizeScrapedJob } from '../../utils/normalizeScrapedJob.js'
import { isIndiaJob } from '../../utils/indiaLocationFilter.js'

// Entirely artificial pure geography controls. They are never native HTTP,
// native openings, current criteria, or current source-qualification evidence.
const india = { location: 'Bengaluru', address: { postalAddress: { addressCountry: 'India', addressLocality: 'Bengaluru', addressRegion: 'Karnataka' } } }
const foreign = { location: 'Boston', address: { postalAddress: { addressCountry: 'United States', addressLocality: 'Boston', addressRegion: 'Massachusetts' } } }
const fixture = () => ({ record: { ...structuredClone(foreign), secondaryLocations: [structuredClone(india)] },
  schema: { jobLocation: { address: structuredClone(foreign.address.postalAddress) },
    applicantLocationRequirements: [{ name: 'United States' }, { name: 'India' }] } })
const publicAccepts = geo => isIndiaJob(normalizeScrapedJob({ title: 'Artificial geography control',
  company: 'Offline geography control', country: geo.country, city: geo.city, state: geo.state,
  location: geo.location, locations: geo.locations, sourceCountryScopeUnresolved: geo.unresolved,
  sourceNativeCountryCodes: geo.countries }, { countryFilter: 'India' }))

test('a proven secondary India worksite reaches the actual predicate while its foreign primary remains original', () => {
  const input = fixture(), original = structuredClone(input), geo = nativePlaces(input.record, input.schema)
  assert.deepEqual(input, original)
  assert.equal(geo.originalPlaces[0].country, 'United States')
  assert.equal(geo.originalPlaces[0].originalAddress.postalAddress.addressLocality, 'Boston')
  assert.equal(publicAccepts(geo), true)
  assert.equal(geo.country, 'India');assert.equal(geo.city, 'Bengaluru')
  assert.equal(geo.indiaWorksiteQualified, true)
  assert.deepEqual(geo.countries, ['United States', 'India'])
})

test('another unknown location cannot erase an explicitly proven India worksite', () => {
  const record = { ...structuredClone(india), secondaryLocations: [{ location: 'Global', address: null }] }
  const geo = nativePlaces(record, { jobLocation: { address: structuredClone(india.address.postalAddress) } })
  assert.equal(publicAccepts(geo), true)
  assert.equal(geo.country, 'India');assert.equal(geo.indiaWorksiteQualified, true)
  assert.equal(geo.unresolved, true)
  assert.equal(geo.originalPlaces[1].country, null)
})

test('an explicit India applicant allowance survives an unrelated unknown applicant region', () => {
  const input = fixture();input.schema.applicantLocationRequirements.push({ name: 'Unresolved region control' })
  const geo = nativePlaces(input.record, input.schema)
  assert.equal(publicAccepts(geo), true)
  assert.equal(geo.country, 'India');assert.equal(geo.indiaWorksiteQualified, true)
  assert.equal(geo.unresolved, true)
})

test('India applicant restrictions and India worksite form a valid intersection beside a foreign primary', () => {
  const input = fixture();input.schema.applicantLocationRequirements = [{ name: 'India' }]
  const geo = nativePlaces(input.record, input.schema)
  assert.equal(publicAccepts(geo), true)
  assert.equal(geo.originalPlaces[0].country, 'United States')
  assert.equal(geo.country, 'India');assert.equal(geo.indiaWorksiteQualified, true)
})

test('a bare Indian-looking city or applicant-only country cannot manufacture worksite country', () => {
  const geo = nativePlaces({ location: 'Bengaluru', address: null, secondaryLocations: [] },
    { applicantLocationRequirements: [{ name: 'India' }] })
  assert.equal(geo.country, null)
  assert.equal(publicAccepts(geo), false)
})

test('conflicting applicant restrictions cannot qualify a secondary India location', () => {
  const input = fixture();input.schema.applicantLocationRequirements = [{ name: 'United States' }]
  const geo = nativePlaces(input.record, input.schema)
  assert.equal(geo.applicantConflict, true);assert.equal(geo.country, null)
  assert.equal(publicAccepts(geo), false)
})

test('contradictory own-role worksite metadata cannot qualify the India projection', () => {
  const input = fixture();input.schema.jobLocation.address.addressCountry = 'France'
  const geo = nativePlaces(input.record, input.schema)
  assert.equal(geo.schemaConflict, true);assert.equal(geo.country, null)
  assert.equal(publicAccepts(geo), false)
})

const literalControl = tail => appData(readNativeDocument('<script>window.__appData='
  + JSON.stringify({ organization: { name: 'Original employer' }, posting: { title: 'Original role' } })
  + ';' + tail + '</script>'))
for (const [label, code] of [
  ['app-data mutating call', 'Object.assign(window.__appData,{organization:{name:"Foreign employer"}});'],
  ['organization mutating call', 'Object.assign(window.__appData.organization,{name:"Foreign employer"});'],
  ['posting mutating call', 'Object.assign(window.__appData.posting,{title:"Other role"});'],
  ['app-data alias', 'const data=window.__appData;data.organization.name="Foreign employer";'],
  ['organization alias', 'const organization=window.__appData.organization;organization.name="Foreign employer";'],
  ['posting alias', 'const posting=window.__appData.posting;posting.title="Other role";'],
  ['property definition', 'Object.defineProperty(window.__appData.organization,"name",{value:"Foreign employer"});'],
  ['reflective write', 'Reflect.set(window.__appData.posting,"title","Other role");'],
  ['global object alias', 'const root=window;root.__appData.organization.name="Foreign employer";'],
  ['direct property write', 'window.__appData.organization.name="Foreign employer";'],
]) test('final-review R2 artificial ' + label + ' cannot qualify an ambiguous initializer', () => {
  assert.throws(() => literalControl(code), /app-data|Ambiguous/i)
})

test('final-review R2 terminal example strings and unrelated Vite-like setup remain inert data', () => {
  const model = { organization: { name: 'Original employer' },
    example: 'Object.assign(window.__appData.organization,{name:"Example"});' }
  const parsed = appData(readNativeDocument('<script>window.__appData=' + JSON.stringify(model)
    + ';window.addEventListener("load",function(){const examples=["window.__appData.posting"];});</script>'))
  assert.equal(parsed.organization.name, model.organization.name)
  assert.equal(parsed.example, model.example)
})

test('final-review R3 a schema country cannot borrow a foreign country from another native worksite', () => {
  const input = fixture(), original = structuredClone(input)
  input.schema.jobLocation = [{ address: structuredClone(foreign.address.postalAddress) },
    { address: { ...structuredClone(india.address.postalAddress), addressCountry: 'United States' } }]
  const nativeBefore = structuredClone(input.record), geo = nativePlaces(input.record, input.schema)
  assert.deepEqual(input.record, nativeBefore)
  assert.equal(geo.schemaConflict, true)
  assert.equal(geo.publicProjection.knownSchemaConflict, true)
  assert.equal(geo.indiaWorksiteQualified, false)
  assert.equal(publicAccepts(geo), false)
  assert.deepEqual(geo.countries, ['United States', 'India'])
  assert.equal(original.record.secondaryLocations[0].address.postalAddress.addressCountry, 'India')
})

test('final-review R3 contradictory state metadata for the same named city remains unqualified in arrays', () => {
  const input = fixture()
  input.schema.jobLocation = [{ address: structuredClone(foreign.address.postalAddress) },
    { address: { ...structuredClone(india.address.postalAddress), addressRegion: 'Contradictory state control' } }]
  const geo = nativePlaces(input.record, input.schema)
  assert.equal(geo.schemaConflict, true)
  assert.equal(publicAccepts(geo), false)
})

test('final-review R3 reordered coherent schema worksites preserve the explicit India projection', () => {
  const input = fixture()
  input.schema.jobLocation = [{ address: structuredClone(india.address.postalAddress) },
    { address: structuredClone(foreign.address.postalAddress) }]
  const original = structuredClone(input), geo = nativePlaces(input.record, input.schema)
  assert.deepEqual(input, original)
  assert.equal(geo.schemaConflict, false)
  assert.equal(publicAccepts(geo), true)
  assert.equal(geo.originalPlaces[0].country, 'United States')
})

test('final-review R3 same-city places in two countries do not create a false correspondence conflict', () => {
  const record = { location: 'Springfield', address: { addressLocality: 'Springfield', addressCountry: 'United States' },
    secondaryLocations: [
      { location: 'Springfield', address: { addressLocality: 'Springfield', addressCountry: 'Canada' } },
      structuredClone(india),
    ] }
  const schema = { jobLocation: [
    { address: { addressLocality: 'Springfield', addressCountry: 'United States' } },
    { address: structuredClone(india.address.postalAddress) },
  ] }
  const geo = nativePlaces(record, schema)
  assert.equal(geo.schemaConflict, false)
  assert.equal(publicAccepts(geo), true)
})
