import path from 'node:path'
import {fileURLToPath} from 'node:url'
import CURRENT_METADATA from '../../scraper-support/providers/providerExtensions/zz-041-avendata.json' with {type:'json'}
const directory=path.dirname(fileURLToPath(import.meta.url))
export const AVENDATA_CATALOG={...CURRENT_METADATA,modulePath:path.join(directory,'script.js'),dryRunFile:path.join(directory,'jobs.json')}
export default AVENDATA_CATALOG
