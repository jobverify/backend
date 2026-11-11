import assert from 'node:assert/strict'
import test from 'node:test'

const cases = [
  {
    "name": "americanexpress",
    "factory": "createAmericanExpressScraper",
    "seam": "constructor",
    "primary": "fetchJson"
  },
  {
    "name": "cohesity",
    "factory": "createCohesityScraper",
    "seam": "constructor",
    "primary": "fetchJson"
  },
  {
    "name": "decimalpoint",
    "factory": "createDecimalPointScraper",
    "seam": "constructor",
    "primary": "fetchJson"
  },
  {
    "name": "egis",
    "factory": "createEgisScraper",
    "seam": "constructor",
    "primary": "fetchText"
  },
  {
    "name": "factset.workday",
    "factory": "createFactSetScraper",
    "seam": "both",
    "primary": "fetchJson"
  },
  {
    "name": "fortinet",
    "factory": "createFortinetScraper",
    "seam": "constructor",
    "primary": "fetchJson"
  },
  {
    "name": "genesys.workday",
    "factory": "createGenesysScraper",
    "seam": "both",
    "primary": "fetchJson"
  },
  {
    "name": "ibssoftware",
    "factory": "createIbsSoftwareScraper",
    "seam": "constructor",
    "primary": "fetchJson"
  },
  {
    "name": "icumedical",
    "factory": "createIcuMedicalScraper",
    "seam": "constructor",
    "primary": "fetchJson"
  },
  {
    "name": "mercedesbenz",
    "factory": "createMercedesBenzScraper",
    "seam": "constructor",
    "primary": "fetchJson"
  },
  {
    "name": "publicissapient",
    "factory": "createPublicisSapientScraper",
    "seam": "run",
    "primary": "fetchJson"
  },
  {
    "name": "radware",
    "factory": "createRadwareScraper",
    "seam": "constructor",
    "primary": "fetchText"
  },
  {
    "name": "resideo",
    "factory": "createResideoScraper",
    "seam": "constructor",
    "primary": "fetchJson"
  },
  {
    "name": "soprasteria",
    "factory": "createSopraSteriaScraper",
    "seam": "constructor",
    "primary": "fetchText"
  },
  {
    "name": "technipenergies",
    "factory": "createTechnipEnergiesScraper",
    "seam": "constructor",
    "primary": "fetchJson"
  },
  {
    "name": "tejasnetworks",
    "factory": "createTejasNetworksScraper",
    "seam": "constructor",
    "primary": "fetchJson"
  },
  {
    "name": "uber",
    "factory": "createUberScraper",
    "seam": "constructor",
    "primary": "fetchJson"
  },
  {
    "name": "yokogawaindia.workday",
    "factory": "createYokogawaIndiaScraper",
    "seam": "both",
    "primary": "fetchText"
  }
]

const callFactory = (module, item, options) => {
  if (item.seam === 'run') return module[item.factory]().run(options)
  if (item.seam === 'both') return module[item.factory](options).run(options)
  return module[item.factory](options).run()
}

for (const item of cases) {
  for (const entry of ['factory', 'public']) {
    test(`${item.name} ${entry} uses the owned first transport and preserves its ordinary failure`, async () => {
      const module = await import(`../scraper/${item.name}/script.js`)
      const failure = new Error(`${item.name} owned collaborator failure`)
      let calls = 0
      const owned = async () => { calls += 1; throw failure }
      const options = { fetchJson: owned, fetchText: owned, maxPages: 1, maxJobs: 1 }
      const invoke = () => entry === 'factory' ? callFactory(module, item, options) : module.run(options)
      await assert.rejects(invoke, error => error === failure)
      assert.equal(calls, 1)
    })
  }
}

for (const name of ['cohesity', 'factset.workday', 'publicissapient']) {
  test(`${name} public entry preserves a throwing options getter`, async () => {
    const module = await import(`../scraper/${name}/script.js`)
    const failure = new Error(`${name} owned getter failure`)
    let reads = 0
    const options = { get fetchJson() { reads += 1; throw failure } }
    await assert.rejects(() => module.run(options), error => error === failure)
    assert.equal(reads, 1)
  })
  test(`${name} public entry preserves null rejection from the existing factory/run boundary`, async () => {
    const module = await import(`../scraper/${name}/script.js`)
    await assert.rejects(() => module.run(null), TypeError)
  })
}
