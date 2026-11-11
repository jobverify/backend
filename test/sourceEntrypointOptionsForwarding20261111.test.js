// Synthetic transport/DNS admission controls for actual source exports.
// No native response, vacancy, country, inventory or recovery fact is supplied.
import assert from 'node:assert/strict'
import { after, before, mock, test } from 'node:test'
import http from 'node:http'
import https from 'node:https'
import http2 from 'node:http2'
import net from 'node:net'
import tls from 'node:tls'
import dgram from 'node:dgram'
import dns from 'node:dns'
import dnsPromises from 'node:dns/promises'
import { syncBuiltinESMExports } from 'node:module'

let prevented = []
const defaultFailure = Error('Authored denied default transport')
Object.assign(defaultFailure, { code: 'ENTRYPOINT_DEFAULT_TRANSPORT', abortRetries: true, status: 451 })
const denyDefault = kind => () => { prevented.push(kind); throw defaultFailure }
before(() => {
  mock.method(globalThis, 'fetch', denyDefault('fetch'))
  for (const [object, names, kind] of [
    [http, ['request', 'get'], 'http'], [https, ['request', 'get'], 'https'],
    [http2, ['connect'], 'http2'], [net, ['connect', 'createConnection'], 'net'],
    [tls, ['connect'], 'tls'], [dgram, ['createSocket'], 'dgram'],
    [dns, ['lookup', 'resolve', 'resolve4', 'resolve6'], 'dns'],
    [dnsPromises, ['lookup', 'resolve', 'resolve4', 'resolve6'], 'dns.promises'],
  ]) for (const name of names) mock.method(object, name, denyDefault(kind + '.' + name))
  mock.method(net.Socket.prototype, 'connect', denyDefault('net.Socket.connect'))
  syncBuiltinESMExports()
})
after(() => { mock.restoreAll(); syncBuiltinESMExports() })

const cases = [
  ["acceleroisa", "createAcceleroIsaScraper", ["fetchText"]],
  ["acsia", "createAcsiaScraper", ["fetchText"]],
  ["aliensgroup", "createAliensGroupScraper", ["fetchPage"]],
  ["altenindia", "createAltenIndiaScraper", ["fetchText"]],
  ["annalect", "createAnnalectScraper", ["fetchText"]],
  ["aquera", "createAqueraScraper", ["fetchText"]],
  ["arjunaresearchandfinancialservicespvtltd", "createArjunaResearchAndFinancialServicesScraper", ["resolveHosts"]],
  ["asaco", "createAsacoScraper", ["fetchPage"]],
  ["bses", "createBsesScraper", ["fetchText"]],
  ["bytexl", "createBytexlScraper", ["fetchPage"]],
  ["cafecoffeeday", "createCafeCoffeeDayScraper", ["fetchText"]],
  ["cgpower", "createCgPowerScraper", ["fetchText"]],
  ["chargebee", "createChargebeeScraper", ["fetchText"]],
  ["cmscomputers", "createCmsComputersScraper", ["fetchText"]],
  ["codetantra", "createCodetantraScraper", ["fetchText"]],
  ["codeyoung", "createCodeyoungScraper", ["fetchText"]],
  ["cognizant", "createCognizantScraper", ["fetchText", "fetchPage"]],
  ["comviva", "createComvivaScraper", ["fetchText"]],
  ["confluent", "createConfluentScraper", ["fetchJson"]],
  ["contlo", "createContloScraper", ["fetchPage"]],
  ["controloneai", "createControlOneAiScraper", ["fetchText"]],
  ["course5i", "createCourse5iScraper", ["fetchText"]],
  ["cubiquitous", "createCubiquitousScraper", ["fetchText"]],
  ["cuemath", "createCuemathScraper", ["fetchText"]],
  ["cyepro", "createCyeproScraper", ["fetchText"]],
  ["dassaultsystems", "createDassaultSystemsScraper", ["fetchText"]],
  ["datumadvancedcomposites", "createDatumAdvancedCompositesScraper", ["resolveHosts"]],
  ["deltaelectronicsindia", "createDeltaElectronicsIndiaScraper", ["fetchText"]],
  ["deltax", "createDeltaXScraper", ["fetchText"]],
  ["devathon", "createDevathonScraper", ["fetchText"]],
  ["diatoz", "createDiatozScraper", ["fetchText"]],
  ["directshifts", "createDirectShiftsScraper", ["fetchJson"]],
  ["diyaedulabspvtltd", "createDiyaEdulabsScraper", ["resolveHosts"]],
  ["dlf", "createDlfScraper", ["fetchText"]],
  ["doozyrobotics", "createDoozyRoboticsScraper", ["fetchText"]],
  ["drutnetworks", "createDrutNetworksScraper", ["fetchText"]],
  ["e2open", "createE2OpenScraper", ["fetchText"]],
  ["eclipse360", "createEclipse360Scraper", ["fetchPage"]],
  ["edoofa", "createEdoofaScraper", ["fetchText"]],
  ["eduversity", "createEduversityScraper", ["fetchText"]],
  ["eklavyasolution", "createEklavyaSolutionScraper", ["fetchPage"]],
  ["emptycup", "createEmptyCupScraper", ["fetchText"]],
  ["engineerminds", "createEngineermindsScraper", ["resolveAddresses"]],
  ["eram", "createEramScraper", ["fetchText"]],
  ["fevindia", "createFevIndiaScraper", ["fetchText"]],
  ["gayathrihealthcaresolutions", "createGayathriHealthCareSolutionsScraper", ["resolveHosts"]],
  ["gep", "createGepScraper", ["fetchText"]],
  ["globallogic", "createGlobalLogicScraper", ["fetchPage"]],
  ["godharinfratechpvtltd", "createGodharInfratechScraper", ["resolveHosts"]],
  ["goldisolar", "createGoldiSolarScraper", ["fetchText"]],
  ["goldmansachs", "createGoldmanSachsScraper", ["fetchText"]],
  ["gulfasia", "createGulfAsiaScraper", ["fetchText"]],
  ["indomim", "createIndoMimScraper", ["fetchPage"]],
  ["inframarket", "createInfraMarketScraper", ["fetchJson"]],
  ["inmovidutechnologiespvtltd", "createInMoviduTechnologiesPvtLtdScraper", ["resolveHosts"]],
  ["innovasolutions", "createInnovaSolutionsScraper", ["fetchText"]],
  ["iprtechnologies", "createIPRTechnologiesScraper", ["fetchText"]],
  ["ivhomes", "createIvHomesScraper", ["fetchText"]],
  ["jacobai", "createJacobAiScraper", ["fetchText"]],
  ["karomitechnology", "createKaromiTechnologyScraper", ["fetchText"]],
  ["kottackalbusinesssolutionspvtltd", "createKottackalBusinessSolutionsScraper", ["resolveHosts"]],
  ["lixil", "createLixilScraper", ["fetchText"]],
  ["meritdataandtechnology", "createMeritDataAndTechnologyScraper", ["fetchPage"]],
  ["networkintelligence", "createNetworkIntelligenceScraper", ["fetchText"]],
  ["odnestcompany", "createOdNestCompanyScraper", ["resolveHosts"]],
  ["proptimes", "createPropTimesScraper", ["resolveAddresses"]],
  ["pyzqlltd", "createPyzqLLtdScraper", ["resolveHosts"]],
  ["radspanwirelesssystems", "createRadspanWirelessSystemsScraper", ["fetchText"]],
  ["rovoautomation", "createRovoAutomationScraper", ["fetchText"]],
  ["rvsystems", "createRVSystemsScraper", ["fetchText"]],
  ["seveneleven", "createSevenElevenScraper", ["fetchText"]],
  ["sfotechnologies", "createSfoTechnologiesScraper", ["fetchText"]],
  ["sganalytics", "createSgAnalyticsScraper", ["fetchText"]],
  ["sipl", "createSIPLScraper", ["fetchText"]],
  ["softcooperative", "createSoftCooperativeScraper", ["resolveHosts"]],
  ["ssjedustationedtechpvtltd", "createSsjEduStationEdtechScraper", ["resolveHosts"]],
  ["sundaramclayton", "createSundaramClaytonScraper", ["fetchPage"]],
  ["sunmobility", "createSunMobilityScraper", ["fetchText"]],
  ["systemtwo", "createSystemTwoScraper", ["fetchText"]],
  ["tataadvancedsystems", "createTataAdvancedSystemsScraper", ["fetchPage"]],
  ["tectonicslabs", "createTectonicsLabsScraper", ["fetchText"]],
  ["timeflexdata", "createTimeFlexDataScraper", ["resolveHosts"]],
  ["trianz", "createTrianzScraper", ["fetchPage"]],
  ["vedantu", "createVedantuScraper", ["fetchText"]],
  ["werize", "createWeRizeScraper", ["fetchText"]],
  ["zomato", "createZomatoScraper", ["fetchText"]],
  ["zonescorporatesolutionspvtltd", "createZonesCorporateSolutionsScraper", ["fetchText"]],

]

async function failureOf(pending) {
  let rejected = false, reason
  try { await pending } catch (error) { rejected = true; reason = error }
  assert.equal(rejected, true, 'The unavailable injected collaborator must reject instead of becoming an empty inventory')
  return reason
}

for (const [source, factory, expectedCalls] of cases) {
  for (const view of ['factory', 'public']) {
    test(`${source} ${view} uses the supplied collaborator without default transport`, { timeout: 10000 }, async () => {
      const module = await import(new URL(`../scraper/${source}/script.js`, import.meta.url))
      const primary = Error('Authored collaborator failure for ' + source), calls = []
      const options = Object.fromEntries(expectedCalls.map(key => [key, async () => { calls.push(key); throw primary }]))
      prevented = []
      const reason = await failureOf(view === 'factory' ? module[factory]().run(options) : module.run(options))
      assert.deepEqual(prevented, [], 'Caller-supplied collaborators must prevent default network/DNS admission')
      assert.deepEqual(calls, expectedCalls, 'The actual source must admit its declared collaborator')
      if (source === 'radspanwirelesssystems') {
        assert.ok(reason instanceof Error)
        assert.ok(reason.message.includes(primary.message), 'Keep the existing wrapped ordinary failure')
      } else assert.equal(reason, primary, 'Keep the caller-visible injected primary')
    })
  }
}

for (const view of ['factory', 'public']) {
  test(`already-forwarding Calendly ${view} retains its supported fetchImpl`, async () => {
    const module = await import('../scraper/calendly/script.js')
    const primary = Error('Authored Calendly collaborator failure')
    let calls = 0
    const options = { fetchImpl: async () => { calls++; throw primary } }
    prevented = []
    const reason = await failureOf(view === 'factory' ? module.createCalendlyScraper().run(options) : module.run(options))
    assert.equal(reason, primary)
    assert.equal(calls, 1)
    assert.deepEqual(prevented, [])
  })
}

test('public undefined preserves the existing default-operation failure', async () => {
  const module = await import('../scraper/acceleroisa/script.js')
  prevented = []
  assert.equal(await failureOf(module.run(undefined)), defaultFailure)
  assert.deepEqual(prevented, ['fetch'])
})

test('public null reaches the same inner option validation without default transport', async () => {
  const module = await import('../scraper/acceleroisa/script.js')
  prevented = []
  assert.ok(await failureOf(module.run(null)) instanceof TypeError)
  assert.deepEqual(prevented, [])
})

test('public options retain the original getter receiver and one read', async () => {
  const module = await import('../scraper/acceleroisa/script.js')
  const primary = Error('Authored getter-selected collaborator failure')
  let reads = 0, calls = 0
  const options = {
    get fetchText() {
      assert.equal(this, options)
      reads++
      return async () => { calls++; throw primary }
    },
  }
  prevented = []
  assert.equal(await failureOf(module.run(options)), primary)
  assert.equal(reads, 1)
  assert.equal(calls, 1)
  assert.deepEqual(prevented, [])
})
