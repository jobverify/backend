import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const SYSTEM_CA_NODE_OPTION = '--use-system-ca'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const backendEnvPath = path.resolve(currentDir, '../.env')

const loadBackendDotenv = () => {
  try {
    return dotenv.parse(fs.readFileSync(backendEnvPath, 'utf8'))
  } catch {
    return {}
  }
}

const BACKEND_DOTENV = Object.freeze(loadBackendDotenv())

const hasNodeOption = (value = '', option = SYSTEM_CA_NODE_OPTION) => (
  new RegExp(`(^|\\s)${option}(?=\\s|$)`).test(String(value || ''))
)

const mergeNodeOptions = (value = '') => {
  const normalized = String(value || '').trim()
  if (!normalized) return SYSTEM_CA_NODE_OPTION
  if (hasNodeOption(normalized)) return normalized
  return `${normalized} ${SYSTEM_CA_NODE_OPTION}`
}

export const DEFAULT_LOCAL_SCRAPE_ENV = Object.freeze({
  SCRAPER_FAILURE_ABORT_THRESHOLD: '1000',
  WORKDAY_SCRAPER_TIMEOUT_MS: '210000',
  WORKDAY_REQUEST_TIMEOUT_MS: '20000',
  WORKDAY_DETAIL_FETCH_CONCURRENCY: '1',
  NODE_OPTIONS: SYSTEM_CA_NODE_OPTION,
})

export const buildLocalScrapeRunEnv = (
  sourceEnv = process.env,
  dotenvEnv = BACKEND_DOTENV,
) => {
  const env = { ...dotenvEnv, ...sourceEnv }

  for (const [key, defaultValue] of Object.entries(DEFAULT_LOCAL_SCRAPE_ENV)) {
    if (key === 'NODE_OPTIONS') continue
    env[key] = sourceEnv[key] || dotenvEnv[key] || defaultValue
  }

  if (sourceEnv.SCRAPER_CONCURRENCY || dotenvEnv.SCRAPER_CONCURRENCY) {
    env.SCRAPER_CONCURRENCY = sourceEnv.SCRAPER_CONCURRENCY || dotenvEnv.SCRAPER_CONCURRENCY
  } else {
    delete env.SCRAPER_CONCURRENCY
  }

  env.NODE_OPTIONS = mergeNodeOptions(sourceEnv.NODE_OPTIONS || dotenvEnv.NODE_OPTIONS)

  return env
}
