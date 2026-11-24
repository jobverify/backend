// WHATWG HTML prepare-script steps10-15,21,24 and MIME Sniffing section4.6.
// This classifies browser carriers; it never executes a publisher programme.
const javascriptEssences=new Set(['application/ecmascript','application/javascript','application/x-ecmascript','application/x-javascript','text/ecmascript','text/javascript','text/javascript1.0','text/javascript1.1','text/javascript1.2','text/javascript1.3','text/javascript1.4','text/javascript1.5','text/jscript','text/livescript','text/x-ecmascript','text/x-javascript'])
const asciiLower=value=>value.replace(/[A-Z]/g,char=>char.toLowerCase()),asciiTrim=value=>value.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g,'')
export function scriptKind(node){
 const a=node.attrs,hasType=Object.hasOwn(a,'type'),type=hasType?(a.type===''?'text/javascript':a.type):!Object.hasOwn(a,'language')||a.language===''?'text/javascript':'text/'+a.language,lower=asciiLower(type)
 const kind=javascriptEssences.has(lower)||hasType&&javascriptEssences.has(asciiLower(asciiTrim(a.type)))?'classic':lower==='module'?'module':null
 if(kind==='classic'&&Object.hasOwn(a,'nomodule'))return null
 if(kind==='classic'&&Object.hasOwn(a,'for')&&Object.hasOwn(a,'event')&&!(asciiLower(asciiTrim(a.for))==='window'&&['onload','onload()'].includes(asciiLower(asciiTrim(a.event)))))return null
 return kind
}
