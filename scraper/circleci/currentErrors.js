const owned=new WeakSet()
export function failure(message){const error=Object.assign(Error('CircleCI native: '+message),{code:'CIRCLECI_NATIVE_CONTRACT',abortRetries:true,inventoryEvidence:{status:'coverage-gap',surface:'https://circleci.com/careers/jobs/',firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null}});owned.add(error);return error}
export const need=(ok,message)=>{if(!ok)throw failure(message)}
export const isFailure=error=>error!==null&&typeof error==='object'&&owned.has(error)
