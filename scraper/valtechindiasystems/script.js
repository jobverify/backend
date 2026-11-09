import { VALTECH_INDIA_SYSTEMS_CATALOG } from './catalog.js'
import { createValtechNativeInventory } from './nativeInventory.js'

export const PROVIDER_METADATA=VALTECH_INDIA_SYSTEMS_CATALOG
export * from './nativeInventory.js'
export const createValtechindiasystemsScraper=createValtechNativeInventory
export const run=async(options={})=>createValtechindiasystemsScraper(options).run(options)
