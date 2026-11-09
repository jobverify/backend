import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

// Imports and calls only the selected source modules. Never opens MongoDB or runs global cleanup.
export const trialPublishingGapRepairs = async ({ outputDirectory, sources, concurrency = 4, providerManifest } = {}) => {
  const extension = JSON.parse(fs.readFileSync(providerManifest || new URL('../scraper-support/providers/providerExtensions/zzz-publishing-gap-repairs.json', import.meta.url)))
  const selected = sources?.length ? extension.filter((p) => sources.includes(p.source)) : extension
  if (sources?.some((source) => !selected.some((p) => p.source === source))) throw new Error('Requested source is not in the verified repair manifest')
  const catalog = getScraperCatalog()
  fs.mkdirSync(outputDirectory, { recursive: true })
  const results = []
  let index = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, selected.length) }, async () => {
    while (index < selected.length) {
      const metadata = selected[index++]
      const provider = catalog.find((p) => p.source === metadata.source)
      const attemptedAt = new Date().toISOString()
      const file = `${metadata.source}.json`
      try {
        if (provider?.extractionStrategy !== metadata.extractionStrategy) throw new Error('Catalog repair override was not applied')
        const jobs = provider.adapter === 'publicAts'
          ? await createCatalogScraper(provider).run()
          : await (await import(pathToFileURL(provider.modulePath).href)).run()
        const inventoryEvidence = readInventoryEvidence(jobs)
        const result = { success: true, rawRecords: jobs.length, jobsFound: jobs.length, eligibleJobs: null, upstreamReportedTotal: inventoryEvidence?.reportedTotal ?? null }
        fs.writeFileSync(path.join(outputDirectory, file), JSON.stringify({ source: metadata.source, attemptedAt, completedAt: new Date().toISOString(), inventoryEvidence, jobs, result }, null, 2))
        results.push({ source: metadata.source, companyName: metadata.companyName, file, ...result, inventoryEvidence, bindingEvidence: metadata.bindingEvidence })
      } catch (error) {
        const result = { success: false, rawRecords: null, jobsFound: null, eligibleJobs: null, error: error.message }
        fs.writeFileSync(path.join(outputDirectory, file), JSON.stringify({ source: metadata.source, attemptedAt, completedAt: new Date().toISOString(), inventoryEvidence: null, jobs: null, result }, null, 2))
        results.push({ source: metadata.source, companyName: metadata.companyName, file, ...result })
      }
    }
  }))
  results.sort((a, b) => a.source.localeCompare(b.source))
  const manifest = { generatedAt: new Date().toISOString(), mode: 'isolated-live-extraction-no-database', sources: results }
  fs.writeFileSync(path.join(outputDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2))
  return manifest
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const outputIndex = args.indexOf('--output-dir')
  if (outputIndex < 0 || !args[outputIndex + 1]) throw new Error('Pass --output-dir <isolated-artifact-directory>')
  const sourcesIndex = args.indexOf('--sources')
  const sources = sourcesIndex < 0 ? null : args[sourcesIndex + 1]?.split(',').filter(Boolean)
  const providerIndex = args.indexOf('--provider-manifest')
  const manifest = await trialPublishingGapRepairs({ outputDirectory: path.resolve(args[outputIndex + 1]), sources,
    providerManifest: providerIndex < 0 ? undefined : path.resolve(args[providerIndex + 1]),
  })
  console.log(JSON.stringify({ sources: manifest.sources.length, successes: manifest.sources.filter((s) => s.success).length, jobs: manifest.sources.reduce((sum, s) => sum + (s.jobsFound || 0), 0) }))
  if (manifest.sources.some((s) => !s.success)) process.exitCode = 1
}
