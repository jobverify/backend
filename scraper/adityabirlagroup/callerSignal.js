// Caller cancellation settles an observer or injected reader that ignores its
// signal, without shortening the whole public inventory collection budget.
export async function withCallerSignal(operation,signal) {
  signal?.throwIfAborted()
  if(!signal)return operation()
  let abort
  const cancelled=new Promise((_,reject)=>{
    abort=()=>reject(signal.reason)
    signal.addEventListener('abort',abort,{once:true})
  })
  try {
    const value=await Promise.race([Promise.resolve().then(()=>{signal.throwIfAborted();return operation()}),cancelled])
    signal.throwIfAborted()
    return value
  } finally {signal.removeEventListener('abort',abort)}
}
