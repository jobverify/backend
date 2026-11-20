// Tiny genuinely observed native link/slug business functions only. No whole UI hashes or roster pins.
export const templates={
  "slug": "function o(e,t){let n=function(e){let t=e.normalize(\"NFKD\").replace(/[̀-ͯ]/g,\"\").toLowerCase().replace(/[^a-z0-9]+/g,\"-\").replace(/^-+|-+$/g,\"\");if(t.length<=80)return t;let n=t.slice(0,80);if(\"-\"===t[80])return n;let r=n.lastIndexOf(\"-\");return r>0?n.slice(0,r):n}(t);return n?`${e}-${n}`:`${e}`}",
  "callback": "($id,$title)=>{let[,$account,,$preview]=$nativePathname.split(\"/\");return $preview?`/${$account}/${$id}/preview/${$preview}`:`/${$account}/${$nativeSlug($id,$title)}`}"
}
