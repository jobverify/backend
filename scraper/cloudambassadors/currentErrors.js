const owned=new WeakSet()
export const failure=message=>{const e=Object.assign(Error('Cloud Ambassadors native: '+message),{code:'CLOUD_AMBASSADORS_NATIVE_CONTRACT',abortRetries:true});owned.add(e);return e}
export const need=(ok,message)=>{if(!ok)throw failure(message)}
export const isFailure=e=>e!==null&&typeof e==='object'&&owned.has(e)
