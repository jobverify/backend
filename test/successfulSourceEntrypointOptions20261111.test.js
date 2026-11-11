// Authored transport-admission protocols for the actual public and factory APIs.
// These controls provide no native response, vacancy, country or recovery facts.
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
import { registerHooks, syncBuiltinESMExports } from 'node:module'

const imports = registerHooks({
  resolve(specifier, context, next) {
    if (/^(?:mongoose|mongodb|playwright|puppeteer|@playwright|@sparticuz|selenium-webdriver|chrome-launcher)(?:\/|$)/.test(specifier)
        || /^(?:node:)?(?:child_process|worker_threads)$/.test(specifier)
        || /(?:^|\/)saveToDB\.js(?:$|\?)/.test(specifier)) {
      throw Error('SOURCE_OPTIONS_PROTOCOL_FORBIDS_CAPABILITY_IMPORT: ' + specifier)
    }
    return next(specifier, context)
  },
})
let prevented = []
const defaultFailure = Error('Authored denied default transport')
Object.assign(defaultFailure, { code: 'SUCCESSFUL_SOURCE_DEFAULT_TRANSPORT', abortRetries: true, status: 451 })
const deny = kind => () => { prevented.push(kind); throw defaultFailure }
before(() => {
  mock.method(globalThis, 'fetch', deny('fetch'))
  for (const [object, names, kind] of [
    [http, ['request', 'get'], 'http'], [https, ['request', 'get'], 'https'],
    [http2, ['connect'], 'http2'], [net, ['connect', 'createConnection'], 'net'],
    [tls, ['connect'], 'tls'], [dgram, ['createSocket'], 'dgram'],
    [dns, ['lookup', 'resolve', 'resolve4', 'resolve6'], 'dns'],
    [dnsPromises, ['lookup', 'resolve', 'resolve4', 'resolve6'], 'dns.promises'],
  ]) for (const name of names) mock.method(object, name, deny(kind + '.' + name))
  mock.method(net.Socket.prototype, 'connect', deny('net.Socket.connect'))
  for (const object of [dns.Resolver.prototype, dnsPromises.Resolver.prototype]) {
    for (const key of Object.getOwnPropertyNames(object)) {
      if (/^(?:lookup|resolve|reverse)/.test(key) && typeof object[key] === 'function') mock.method(object, key, deny('resolver.' + key))
    }
  }
  syncBuiltinESMExports()
})
after(() => { mock.restoreAll(); syncBuiltinESMExports(); imports.deregister() })

const cases = [
  ["247ai", "create247AiScraper", ["fetchText"]],
  ["aanandpjangidandassociates", "createAanandPJangidAndAssociatesScraper", ["fetchText"]],
  ["acsnetworktechnologies", "createAcsNetworkTechnologiesScraper", ["fetchText"]],
  ["actualizeconsultingengineersindia", "createActualizeConsultingEngineersIndiaScraper", ["fetchText"]],
  ["aestechnologies", "createAesTechnologiesScraper", ["fetchText"]],
  ["aethroneaerospace", "createAethroneAerospaceScraper", ["fetchText"]],
  ["aizant", "createAizantScraper", ["fetchText"]],
  ["allgovision", "createAllgovisionScraper", ["fetchText"]],
  ["americanchase", "createAmericanChaseScraper", ["fetchText"]],
  ["amrita", "createAmritaScraper", ["fetchText"]],
  ["aspiresystems", "createAspireSystemsScraper", ["fetchText"]],
  ["assaabloy", "createAssaAbloyScraper", ["fetchJson"]],
  ["attentiveai", "createAttentiveAiScraper", ["fetchText"]],
  ["autorabit", "createAutoRABITScraper", ["fetchText"]],
  ["avinsystems", "createAvinSystemsScraper", ["fetchText"]],
  ["axelor", "createAxelorScraper", ["fetchText"]],
  ["axiscades", "createAxiscadesScraper", ["fetchText"]],
  ["axisenergy", "createAxisEnergyScraper", ["fetchText"]],
  ["axismyindia", "createAxisMyIndiaScraper", ["fetchText"]],
  ["axtria", "createAxtriaScraper", ["fetchText"]],
  ["bhanzu", "createBhanzuScraper", ["fetchText"]],
  ["bitsilica", "createBITSILICAScraper", ["fetchJson"]],
  ["borgwarner", "createBorgwarnerScraper", ["fetchText"]],
  ["bullmachines", "createBullMachinesScraper", ["fetchText"]],
  ["burnsmcdonnell", "createBurnsMcDonnellScraper", ["fetchJson"]],
  ["c3ihub", "createC3iHubScraper", ["fetchText"]],
  ["cbre", "createCbreScraper", ["fetchJson"]],
  ["cloudthat", "createCloudThatScraper", ["fetchText"]],
  ["coditas", "createCoditasScraper", ["fetchJson"]],
  ["cognida", "createCognidaScraper", ["fetchText"]],
  ["coinswitch", "createCoinSwitchScraper", ["fetchText"]],
  ["convinai", "createConvinAiScraper", ["fetchText"]],
  ["corizo", "createCorizoScraper", ["fetchJson"]],
  ["cranesvarsity", "createCranesVarsityScraper", ["fetchJson"]],
  ["criodo", "createCriodoScraper", ["fetchText"]],
  ["crmit", "createCrmitScraper", ["fetchText"]],
  ["crompton", "createCromptonScraper", ["fetchText"]],
  ["cynlr", "createCynlrScraper", ["fetchText"]],
  ["cyware", "createCywareScraper", ["fetchJson"]],
  ["danaincorporated", "createDanaIncorporatedScraper", ["fetchText"]],
  ["danlawtechnologies", "createDanlawTechnologiesScraper", ["fetchText"]],
  ["deshawindia", "createDeShawScraper", ["fetchText"]],
  ["dhanalaxmibank", "createDhanalaxmiBankScraper", ["fetchJson"]],
  ["doctreen", "createDoctreenScraper", ["fetchText"]],
  ["dunandbradstreet", "createDunAndBradstreetScraper", ["fetchJson"]],
  ["econsystem", "createEconSystemScraper", ["fetchText"]],
  ["edstechnologies", "createEdsTechnologiesScraper", ["fetchText"]],
  ["eistudy", "createEIStudyScraper", ["fetchText"]],
  ["embedur", "createEmbedurScraper", ["fetchText"]],
  ["emeritus", "createEmeritusScraper", ["fetchText"]],
  ["emplay", "createEmplayScraper", ["fetchText"]],
  ["exaag", "createExaAgScraper", ["fetchText"]],
  ["festo", "createFestoScraper", ["fetchText"]],
  ["flam", "createFlamScraper", ["fetchText"]],
  ["flowserve", "createFlowserveScraper", ["fetchJson"]],
  ["foodhub", "createFoodhubScraper", ["fetchPage"]],
  ["globals", "createGlobalsScraper", ["fetchPage"]],
  ["greennetspark", "createGreenNetSparkScraper", ["fetchText"]],
  ["hiveminds", "createHiveMindsScraper", ["fetchText"]],
  ["impactanalytics", "createImpactAnalyticsScraper", ["fetchText"]],
  ["increff", "createIncreffScraper", ["fetchJson"]],
  ["indiumsoftware", "createIndiumSoftwareScraper", ["fetchText"]],
  ["inel", "createINELScraper", ["fetchText"]],
  ["juspay", "createJuspayScraper", ["fetchText"]],
  ["kapture", "createKaptureScraper", ["fetchText"]],
  ["ltts", "createLttsScraper", ["fetchText"]],
  ["luxoft", "createLuxoftScraper", ["fetchText"]],
  ["mksvision", "createMksVisionScraper", ["fetchPage"]],
  ["multicoreware", "createMulticorewareScraper", ["fetchText"]],
  ["neeyamo", "createNeeyamoScraper", ["fetchText"]],
  ["nivoda", "createNivodaScraper", ["fetchJson"]],
  ["onwardtechnologies", "createOnwardTechnologiesScraper", ["fetchText"]],
  ["oppo", "createOppoScraper", ["fetchText"]],
  ["prolificscorporationltd", "createProlificsCorporationLtdScraper", ["fetchText"]],
  ["psiogdigital", "createPsiogDigitalScraper", ["fetchText"]],
  ["relanto", "createRelantoScraper", ["fetchText"]],
  ["relevancelab", "createRelevanceLabScraper", ["fetchText"]],
  ["safesecurity", "createSafeSecurityScraper", ["fetchJson"]],
  ["sasken", "createSaskenScraper", ["fetchJson"]],
  ["securdi", "createSecurDIScraper", ["fetchText"]],
  ["securinindiapvtltd", "createSecurinIndiaScraper", ["fetchText"]],
  ["siliconmicrosystems", "createSiliconMicrosystemsScraper", ["fetchText"]],
  ["sisainformationsecurity", "createSisaInformationSecurityScraper", ["fetchText"]],
  ["skillminetechnologyconsulting", "createSkillmineTechnologyConsultingScraper", ["fetchText"]],
  ["skyrootaerospace", "createSkyrootAerospaceScraper", ["fetchText"]],
  ["surveysparrow", "createSurveySparrowScraper", ["fetchText"]],
  ["testvagranttechnologies", "createTestVagrantTechnologiesScraper", ["fetchText"]],
  ["textron", "createTextronScraper", ["fetchJson"]],
  ["thinkrobotics", "createThinkRoboticsScraper", ["fetchText"]],
  ["tigeranalytics", "createTigerAnalyticsScraper", ["fetchText"]],
  ["uipath", "createUiPathScraper", ["fetchJson"]],
  ["unboxrobotics", "createUnboxRoboticsScraper", ["fetchText"]],
  ["valenta", "createValentaScraper", ["fetchJson"]],
  ["vestas", "createVestasScraper", ["fetchText"]],
  ["vimaanaaerospacetechnologies", "createVimaanaAerospaceTechnologiesScraper", ["fetchText"]],
  ["zoho", "createZohoScraper", ["fetchJson"]],
]

async function failureOf(pending) {
  let rejected = false, reason
  try { await pending } catch (error) { rejected = true; reason = error }
  assert.equal(rejected, true, 'An unavailable collaborator must reject instead of becoming an empty inventory')
  return reason
}

for (const [source, factory, expectedCalls] of cases) {
  for (const view of ['factory', 'public']) {
    test(`${source} ${view} uses the supplied collaborator without default transport`, { timeout: 10000 }, async () => {
      const module = await import(new URL(`../scraper/${source}/script.js`, import.meta.url))
      const primary = Error('Authored unavailable transport for ' + source), calls = []
      const options = Object.fromEntries(expectedCalls.map(key => [key, async () => { calls.push(key); throw primary }]))
      prevented = []
      const reason = await failureOf(view === 'factory' ? module[factory]().run(options) : module.run(options))
      assert.deepEqual(prevented, [], 'The declared injected collaborator must prevent default transport admission')
      assert.deepEqual(calls, expectedCalls)
      assert.equal(reason, primary, 'Preserve the original ordinary collaborator failure')
    })
  }
}

for (const view of ['factory', 'public']) {
  test(`already-forwarding Gcore ${view} retains its supplied fetchText`, async () => {
    const module = await import('../scraper/gcore/script.js')
    const primary = Error('Authored Gcore transport failure')
    let calls = 0
    const options = { fetchText: async () => { calls++; throw primary } }
    prevented = []
    assert.equal(await failureOf(view === 'factory' ? module.createGcoreScraper().run(options) : module.run(options)), primary)
    assert.equal(calls, 1)
    assert.deepEqual(prevented, [])
  })
}

for (const omitted of [true, false]) {
  test(`public ${omitted ? 'omitted' : 'undefined'} preserves factory default-operation behavior`, async () => {
    const module = await import('../scraper/247ai/script.js')
    for (const view of ['factory', 'public']) {
      prevented = []
      const subject = view === 'factory' ? module.create247AiScraper() : module
      assert.equal(await failureOf(omitted ? subject.run() : subject.run(undefined)), defaultFailure)
      assert.deepEqual(prevented, ['fetch'])
    }
  })
}

for (const [source, factory] of [
  ['247ai', 'create247AiScraper'],
  ['aanandpjangidandassociates', 'createAanandPJangidAndAssociatesScraper'],
]) {
  test(`${source} public null reaches the same inner validation as its factory`, async () => {
    const module = await import(new URL(`../scraper/${source}/script.js`, import.meta.url))
    for (const view of ['factory', 'public']) {
      prevented = []
      const subject = view === 'factory' ? module[factory]() : module
      assert.ok(await failureOf(subject.run(null)) instanceof TypeError)
      assert.deepEqual(prevented, [])
    }
  })
  test(`${source} public preserves the options getter receiver and one read`, async () => {
    const module = await import(new URL(`../scraper/${source}/script.js`, import.meta.url))
    for (const view of ['factory', 'public']) {
      const primary = Error('Authored getter-selected transport failure')
      let reads = 0, calls = 0
      const options = {
        get fetchText() {
          assert.equal(this, options)
          reads++
          return async () => { calls++; throw primary }
        },
      }
      prevented = []
      assert.equal(await failureOf(view === 'factory' ? module[factory]().run(options) : module.run(options)), primary)
      assert.equal(reads, 1)
      assert.equal(calls, 1)
      assert.deepEqual(prevented, [])
    }
  })
  test(`${source} public preserves an ordinary options getter failure`, async () => {
    const module = await import(new URL(`../scraper/${source}/script.js`, import.meta.url))
    for (const view of ['factory', 'public']) {
      const primary = Error('Authored ordinary options getter failure')
      let reads = 0
      const options = { get fetchText() { assert.equal(this, options); reads++; throw primary } }
      prevented = []
      assert.equal(await failureOf(view === 'factory' ? module[factory]().run(options) : module.run(options)), primary)
      assert.equal(reads, 1)
      assert.deepEqual(prevented, [])
    }
  })
}
