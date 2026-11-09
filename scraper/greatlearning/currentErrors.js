const owned=new WeakSet()
export const failure=message=>{const error=new Error('Great Learning native '+message);owned.add(error);return error}
export const isFailure=value=>value!==null&&typeof value==='object'&&owned.has(value)
export const need=(value,message)=>{if(!value)throw failure(message)}
