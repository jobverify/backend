import {createCurrentReader,need} from './currentRead20261117.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
const HOME='https://absolutdata.com/'
export async function runCurrentAbsolutdata(options={}){
 const io=createCurrentReader(options,[[HOME,'html']],{maxReads:1})
 try{
  try{await io.read(HOME)}catch(error){
   options.signal?.throwIfAborted()
   if(error?.cause?.code==='ERR_TLS_CERT_ALTNAME_INVALID')throw firstPartyFailure('absolutdata','original root TLS hostname validation failed; no HTTP source/inventory acquired',{cause:error,code:error.cause.code,failureKind:'network_or_timeout'})
   throw error
  }
  need(false,'reachable root requires current publisher/recruitment authority review; inventory remains unknown')
 }finally{io.close()}
}
