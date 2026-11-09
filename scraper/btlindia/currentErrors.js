const owned=new WeakSet()
export function failure(message){const error=Object.assign(Error('BTL India native: '+message),{code:'BTL_INDIA_NATIVE_CONTRACT',abortRetries:true,inventoryEvidence:{status:'coverage-gap',surface:'https://www.btlnet.co.in/careers.php',firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null}});owned.add(error);return error}
export const need=(ok,message)=>{if(!ok)throw failure(message)}
export const isFailure=error=>error!==null&&typeof error==='object'&&owned.has(error)
