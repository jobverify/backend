function Get-ScraperProxyEnvironment {
  param(
    [Parameter(Mandatory=$true)][string[]]$TargetUrls,
    [hashtable]$Environment=@{},
    [scriptblock]$ResolveProxy={param($taskURL) [Net.WebRequest]::GetSystemWebProxy().GetProxy($taskURL)}
  )
  if($TargetUrls.Count -eq 0){throw 'At least one public scraper target is required'}
  $taskURIs=@()
  foreach($taskTarget in $TargetUrls){
    $taskURI=$null
    if(-not [Uri]::TryCreate($taskTarget,[UriKind]::Absolute,[ref]$taskURI) -or $taskURI.Scheme -notin @('http','https') -or $taskURI.UserInfo -or $taskURI.Fragment){throw 'Invalid scraper network target;URL values are not logged'}
    $taskURIs+=$taskURI
  }
  $taskValues=@{}
  foreach($taskName in @('HTTP_PROXY','HTTPS_PROXY','NO_PROXY','NODE_USE_ENV_PROXY')){
    if($Environment.ContainsKey($taskName) -and $null -ne $Environment[$taskName]){$taskValues[$taskName]=[string]$Environment[$taskName]}
  }
  if($taskValues.ContainsKey('NODE_USE_ENV_PROXY') -and $taskValues.NODE_USE_ENV_PROXY -ne '1'){
    return @{Mode='disabled';Values=$taskValues;TargetsChecked=$taskURIs.Count;SystemRoutesQueried=0}
  }
  $taskQueries=0
  foreach($taskProtocol in @('http','https')){
    $taskProtocolTargets=@($taskURIs|Where-Object {$_.Scheme -eq $taskProtocol})
    if($taskProtocolTargets.Count -eq 0){continue}
    $taskKey=if($taskProtocol -eq 'https'){'HTTPS_PROXY'}else{'HTTP_PROXY'}
    if($taskValues.ContainsKey($taskKey) -and $taskValues[$taskKey]){continue}
    $taskRoutes=@()
    foreach($taskURI in $taskProtocolTargets){
      $taskRoute=& $ResolveProxy $taskURI;$taskQueries++
      if($null -eq $taskRoute){throw 'Windows proxy discovery returned no route'}
      if($taskRoute -eq $taskURI){$taskRoutes+='DIRECT';continue}
      if($taskRoute.Scheme -notin @('http','https') -or $taskRoute.UserInfo -or $taskRoute.AbsolutePath -ne '/' -or $taskRoute.Query -or $taskRoute.Fragment){throw 'Windows proxy route is unsupported;route values are not logged'}
      $taskRoutes+=$taskRoute.AbsoluteUri
    }
    $taskUniqueRoutes=@($taskRoutes|Select-Object -Unique)
    if($taskUniqueRoutes.Count -ne 1){throw 'Windows proxy routes differ across the selected scraper targets;refusing to guess a global route'}
    if($taskUniqueRoutes[0] -ne 'DIRECT'){$taskValues[$taskKey]=$taskUniqueRoutes[0]}
  }
  $taskHasProxy=[bool]($taskValues.HTTP_PROXY -or $taskValues.HTTPS_PROXY)
  if($taskHasProxy){
    if(-not $taskValues.ContainsKey('NO_PROXY')){$taskValues.NO_PROXY='localhost,127.0.0.1,::1'}
    $taskValues.NODE_USE_ENV_PROXY='1'
  }
  return @{Mode=$(if($taskHasProxy){'proxy-environment'}else{'direct'});Values=$taskValues;TargetsChecked=$taskURIs.Count;SystemRoutesQueried=$taskQueries}
}

function Invoke-NodeWithScraperProxy {
  param(
    [Parameter(Mandatory=$true)][string[]]$TargetUrls,
    [Parameter(Mandatory=$true)][string[]]$NodeArguments,
    [scriptblock]$ResolveProxy={param($taskURL) [Net.WebRequest]::GetSystemWebProxy().GetProxy($taskURL)},
    [scriptblock]$InvokeNode={param($taskArguments) & node.exe --use-system-ca @taskArguments; return $LASTEXITCODE}
  )
  $taskNames=@('HTTP_PROXY','HTTPS_PROXY','NO_PROXY','NODE_USE_ENV_PROXY')
  $taskBefore=@{}
  foreach($taskName in $taskNames){$taskBefore[$taskName]=[Environment]::GetEnvironmentVariable($taskName,'Process')}
  $taskPlan=Get-ScraperProxyEnvironment -TargetUrls $TargetUrls -Environment $taskBefore -ResolveProxy $ResolveProxy
  try{
    foreach($taskName in $taskNames){
      $taskValue=if($taskPlan.Values.ContainsKey($taskName)){$taskPlan.Values[$taskName]}else{$null}
      [Environment]::SetEnvironmentVariable($taskName,$taskValue,'Process')
    }
    # Node output passes through. Only the final integer is its exit code.
    & $InvokeNode $NodeArguments
  }finally{
    foreach($taskName in $taskNames){[Environment]::SetEnvironmentVariable($taskName,$taskBefore[$taskName],'Process')}
  }
}
