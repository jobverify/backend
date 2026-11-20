import {createHash} from 'node:crypto'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {canonicalNativeRecord} from '../../scraper-support/native-sources/collectCurrentOriginalRecords20261106.js'
export const need=(ok,message)=>{if(!ok)throw firstPartyFailure('pena4techsolutions',message)}
export const sha=value=>createHash('sha256').update(value).digest('hex')
export const stable=value=>canonicalNativeRecord(value)
