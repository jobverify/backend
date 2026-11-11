// Source-specific native PDF readers share one elapsed deadline with the text
// core. Cancellation is a state, so even a falsy caller reason is preserved.
export function createNativePdfTextContext({signal,timeoutMs=20000}={}){
  signal?.throwIfAborted()
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>180000)throw RangeError('Invalid native PDF text timeout')
  const controller=new AbortController(),started=performance.now()
  const timeout=Object.assign(Error('Native PDF text deadline exceeded'),{name:'TimeoutError',code:'NATIVE_PDF_TEXT_TIMEOUT',localTimeout:true})
  const closed=Object.assign(Error('Native PDF text context closed'),{code:'NATIVE_PDF_TEXT_CONTEXT_CLOSED'})
  const combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal
  const timer=setTimeout(()=>controller.abort(timeout),timeoutMs)
  const check=()=>{
    signal?.throwIfAborted()
    if(performance.now()-started>=timeoutMs)throw timeout
    combined.throwIfAborted()
  }
  const wait=async value=>{
    const operation=Promise.resolve(value)
    operation.catch(()=>{})
    check()
    return new Promise((resolve,reject)=>{
      let settled=false
      const finish=(failed,value)=>{
        if(settled)return
        settled=true;combined.removeEventListener('abort',abort)
        try{check()}catch(error){reject(error);return}
        if(failed)reject(value);else resolve(value)
      }
      const abort=()=>finish(true,combined.reason)
      combined.addEventListener('abort',abort,{once:true})
      operation.then(value=>finish(false,value),error=>finish(true,error))
      if(combined.aborted)abort()
    })
  }
  const close=()=>{clearTimeout(timer);if(!controller.signal.aborted)controller.abort(closed)}
  return {signal:combined,check,wait,close}
}
