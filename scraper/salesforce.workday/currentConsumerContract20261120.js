// Reviewed source-private semantic contracts for only the current published data consumer.
// No vacancy identifiers/titles, full UI build hash, evaluation or program execution.
export const consumerFunctions={
  "environmentResolver": {
    "binding": "Ke",
    "source": "function Ke(){var e,t;const n=null==(t=null==(e=globalThis.sfdcBase)?void 0:e.env)?void 0:t.trim().toLowerCase();return n&&Ye.includes(n)?n:\"prod\"}"
  },
  "feedConfiguration": {
    "binding": "Xe",
    "source": "(e=Ke())=>{const t=((e=Ke())=>`https://a.sfdcstatic.com/digital/xsf/careers/${e}`)(e);return{jobsPrimary:`${t}/jobs_1.json`,jobsFull:`${t}/jobs_2.json`,jobsPrimaryBackup:`${t}/jobs_1_backup.json`,jobsFullBackup:`${t}/jobs_2_backup.json`,locationsMap:`${t}/locations_map.json`,locationsMapBackup:`${t}/locations_map_backup.json`}}"
  },
  "isRecord": {
    "binding": "ft",
    "source": "e=>\"object\"==typeof e&&null!==e"
  },
  "textField": {
    "binding": "pt",
    "source": "e=>\"string\"==typeof e?e:\"\""
  },
  "locationText": {
    "binding": "mt",
    "source": "(e,t,n)=>{const r=(a=t).trim()?a.split(\";\").map(e=>e.trim()).filter(Boolean):[];var a;if(e||r.length>0){const t=new Set,n=[],a=e=>{const r=e.toLowerCase();t.has(r)||(t.add(r),n.push(e))};e&&a(e);for(const e of r)a(e);return n}return n.length>0?n:e?[e]:[]}"
  },
  "stringArray": {
    "binding": "ht",
    "source": "e=>{if(!Array.isArray(e))return;const t=e.filter(e=>\"string\"==typeof e&&\"\"!==e.trim());return t.length>0?t:void 0}"
  },
  "structuredGeography": {
    "binding": "gt",
    "source": "e=>{const t=ht(e.Countries??e.countries),n=ht(e.Regions??e.regions),r=ht(e.Locations);return{...t?{structuredCountries:t}:{},...n?{structuredRegions:n}:{},...r?{structuredLocations:r}:{}}}"
  },
  "rowProjection": {
    "binding": "vt",
    "source": "e=>{if(!ft(e))return null;const t=pt(e.Job_Requisition_Ref_ID),n=pt(e.Job_Posting_Title),r=pt(e.Job_Family_Group),a=pt(e.Job_Description),o=pt(e.External_Job_Posting_Start_Date),l=pt(e.Job_Requisition_Primary_Location),i=pt(e.Time_Type),s=pt(e.Employee_Type),c=pt(e.External_Job_Posting_Site),u=function(e){const t=Object.keys(e).filter(e=>e.toLowerCase().includes(\"pay_transparency_text\"));t.sort((e,t)=>e.localeCompare(t));const n=[];for(const r of t){const t=pt(e[r]);t.trim()&&n.push(t)}if(0!==n.length)return n}(e),d=function(e){const t=Object.keys(e).filter(e=>e.toLowerCase().includes(\"job_posting_end_date_text\"));t.sort((e,t)=>e.localeCompare(t));const n=[];for(const r of t){const t=pt(e[r]);t.trim()&&n.push(t)}if(0!==n.length)return n}(e),f=function(e){const t=Object.keys(e).filter(e=>e.toLowerCase().includes(\"_statement\"));t.sort((e,t)=>e.localeCompare(t));const n=[];for(const r of t){const t=pt(e[r]);t.trim()&&n.push(t)}if(0!==n.length)return n}(e),p=(m=e.locations,Array.isArray(m)?m.map(e=>\"string\"==typeof e?e:ft(e)?pt(e.display):\"\").filter(Boolean):[]);var m;const h=pt(e.Job_Requisition_Additional_Locations),g=mt(l,h,p);var v;const y=t&&n?`/${t}/${v=n,v.normalize(\"NFKD\").replace(/[̀-ͯ]/g,\"\").toLowerCase().trim().replace(/[^a-z0-9\\s-]/g,\"\").replace(/\\s+/g,\"-\").replace(/^-+|-+$/g,\"\").replace(/-+/g,\"-\")||\"job-details\"}/`:\"/jobs\";return t&&n&&y&&0!==g.length?{id:t,title:n,department:r,url:y,locations:g,...gt(e),description:a,postedDate:o,contractType:i,employeeType:s,externalJobPostingSite:c,...(null==u?void 0:u.length)?{payTransparencyBlocks:u}:{},...(null==d?void 0:d.length)?{jobPostingEndDateTextBlocks:d}:{},...(null==f?void 0:f.length)?{feedStatementBlocks:f}:{},isSaved:!1}:null}"
  },
  "postedSorter": {
    "binding": "yt",
    "source": "e=>{if(!ft(e))return Number.NEGATIVE_INFINITY;const t=pt(e.External_Job_Posting_Start_Date);if(!t)return Number.NEGATIVE_INFINITY;const n=Date.parse(t);return Number.isNaN(n)?Number.NEGATIVE_INFINITY:n}"
  },
  "applicationFormatter": {
    "binding": "oa",
    "source": "e=>{const t=null==e?void 0:e.trim();if(!t)return\"#\";const n=t.replace(/\\/$/,\"\");return n.toLowerCase().endsWith(\"/apply\")?n:`${n}/apply`}"
  },
  "feedReader": {
    "binding": "e",
    "source": "async e=>{const t=await fetch(e);if(!t.ok)throw new Error(`Fetch failed (${t.status}): ${e}`);return(e=>{if(!ft(e))return ut(\"jobs_payload_invalid_shape\",{reason:\"payload_not_object\"},\"error\"),[];const t=\"Report_Entry\"in e,n=Array.isArray(e.Report_Entry)?e.Report_Entry:[];return Array.isArray(e.Report_Entry)||ut(\"jobs_payload_invalid_shape\",{hasReportEntryProperty:t,reportEntryType:typeof e.Report_Entry},\"error\"),[...n].sort((e,t)=>yt(t)-yt(e)).map(e=>vt(e)).filter(e=>Boolean(e))})(await t.json())}"
  },
  "feedMerger": {
    "binding": "t",
    "source": "async(t,r)=>{const a=await e(t);n(v(a)),s(e=>({...e,jobs:!1}));const o=((e,t)=>{const n=new Map(t.map(e=>[e.id,e])),r=e.map(e=>{const t=n.get(e.id);return t?{...e,...t}:e}),a=new Set(e.map(e=>e.id));return[...r,...t.filter(e=>!a.has(e.id))]})(a,await e(r));return n(v(o)),u(!1),o}"
  },
  "feedLoader": {
    "binding": null,
    "source": "async()=>{const e=Xe();try{try{await t(e.jobsPrimary,e.jobsFull)}catch(n){console.error(\"Primary jobs fetch failed, attempting backup URLs:\",n),ut(\"jobs_fetch_primary_failed_fallback_starting\",{error:it(n),isOnline:\"undefined\"!=typeof navigator?navigator.onLine:void 0},\"error\"),await t(e.jobsPrimaryBackup,e.jobsFullBackup)}}catch(r){p(\"Failed to fetch jobs data\"),console.error(\"Failed to fetch jobs data:\",r),ut(\"jobs_fetch_failed_after_fallback\",{error:it(r),isOnline:\"undefined\"!=typeof navigator?navigator.onLine:void 0},\"error\"),s(e=>({...e,jobs:!1})),u(!1)}}"
  },
  "pageInfoWrapper": {
    "binding": "v",
    "source": "e=>({jobs:e,pageInfo:{currentPage:1,totalPages:1,jobsPerPage:e.length,totalJobs:e.length,displayingFrom:e.length>0?1:0,displayingTo:e.length}})"
  },
  "roleLookup": {
    "binding": "Jr",
    "source": "function Jr(e,t){if(null==t||!t.trim())return;const n=t.trim().toLowerCase();return e.find(e=>e.id.toLowerCase()===n)}"
  },
  "roleSavedProjection": {
    "binding": "on",
    "source": "e=>{const t=nn();return e.map(e=>({...e,isSaved:t.includes(e.id)}))}"
  },
  "roleContextHook": {
    "binding": "wt",
    "source": "()=>{const e=g.useContext(dt);if(!e)throw new Error(\"useJobs must be used within JobsProvider\");return e}"
  },
  "roleStateEffect": {
    "binding": null,
    "source": "()=>{if(!n&&t){const n=Jr(t.jobs,e);if(n){const e=on([n]);i(e[0])}else i(null)}}"
  }
}
