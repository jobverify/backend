const owned=new WeakSet()
export const failure=message=>{const error=new Error('Stantec native '+message);owned.add(error);return error}
export const isFailure=value=>value!==null&&typeof value==='object'&&owned.has(value)
export const need=(ok,message)=>{if(!ok)throw failure(message)}
