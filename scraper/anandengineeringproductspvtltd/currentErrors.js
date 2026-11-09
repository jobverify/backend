const owned=new WeakSet()
export const failure=message=>{const error=Object.assign(Error('Anand native: '+message),{code:'ANAND_NATIVE_CONTRACT',abortRetries:true});owned.add(error);return error}
export const isFailure=error=>error!==null&&(typeof error==='object'||typeof error==='function')&&owned.has(error)
export const need=(value,message)=>{if(!value)throw failure(message)}
