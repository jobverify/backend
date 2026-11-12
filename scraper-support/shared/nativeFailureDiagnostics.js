// Describe failures without invoking arbitrary rejection getters or coercion.
const descriptor=Object.getOwnPropertyDescriptor,prototype=Object.getPrototypeOf,hasOwn=Object.hasOwn,apply=Reflect.apply
const nativeDOMExceptionPrototype=typeof DOMException==='undefined'?null:DOMException.prototype
const nativeDOMExceptionName=nativeDOMExceptionPrototype&&descriptor(nativeDOMExceptionPrototype,'name')?.get
const nativeDOMExceptionMessage=nativeDOMExceptionPrototype&&descriptor(nativeDOMExceptionPrototype,'message')?.get
const trim=String.prototype.trim

function failureData(original,key){
 try{
  for(let value=original,depth=0;value!==null&&(typeof value==='object'||typeof value==='function')&&depth<4;depth++,value=prototype(value)){
   if(value===nativeDOMExceptionPrototype){
    const getter=key==='name'?nativeDOMExceptionName:key==='message'?nativeDOMExceptionMessage:null
    if(getter)return apply(getter,original,[])
   }
   const field=descriptor(value,key)
   if(field)return hasOwn(field,'value')?field.value:undefined
  }
 }catch{}
}

export function nativeFailureDiagnostics(reason){
 const name=failureData(reason,'name'),message=typeof reason==='string'?reason:failureData(reason,'message')
 const kind=reason===null?'null':typeof reason
 return {name:typeof name==='string'&&name?name:'Error',
  message:typeof message==='string'&&apply(trim,message,[])?message:'Native transport rejected with '+kind}
}
