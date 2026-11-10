param([string]$Scenario)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../../scripts/lib/windowsScraperProxy.ps1')
function Assert-ProxyTest([bool]$Condition,[string]$Message){if(-not $Condition){throw $Message}}
$taskTargets=@('https://careers.example.test/','https://api.example.test/jobs')
$taskProxy={param($target) [Uri]'http://proxy.example.test:8080/'}
switch($Scenario){
  'system'{
    $taskPlan=Get-ScraperProxyEnvironment -TargetUrls $taskTargets -ResolveProxy $taskProxy
    Assert-ProxyTest ($taskPlan.Mode -eq 'proxy-environment') 'Proxy mode missing'
    Assert-ProxyTest ($taskPlan.Values.HTTPS_PROXY -eq 'http://proxy.example.test:8080/') 'System route missing'
    Assert-ProxyTest (-not $taskPlan.Values.ContainsKey('HTTP_PROXY')) 'Unrequested protocol changed'
    Assert-ProxyTest ($taskPlan.Values.NODE_USE_ENV_PROXY -eq '1') 'Native Node support missing'
    Assert-ProxyTest ($taskPlan.Values.NO_PROXY -match '127.0.0.1') 'Loopback bypass missing'
  }
  'explicit'{
    $taskPlan=Get-ScraperProxyEnvironment -TargetUrls $taskTargets -Environment @{HTTPS_PROXY='http://explicit.example.test:81';NO_PROXY='custom.example.test'} -ResolveProxy {throw 'Must preserve explicit settings'}
    Assert-ProxyTest ($taskPlan.Values.HTTPS_PROXY -eq 'http://explicit.example.test:81') 'Explicit proxy replaced'
    Assert-ProxyTest ($taskPlan.Values.NO_PROXY -eq 'custom.example.test') 'Explicit bypass replaced'
    Assert-ProxyTest ($taskPlan.SystemRoutesQueried -eq 0) 'Unexpected system discovery'
  }
  'disabled'{
    $taskPlan=Get-ScraperProxyEnvironment -TargetUrls $taskTargets -Environment @{NODE_USE_ENV_PROXY='0'} -ResolveProxy {throw 'Must preserve opt-out'}
    Assert-ProxyTest ($taskPlan.Mode -eq 'disabled') 'Opt-out ignored'
  }
  'direct'{
    $taskPlan=Get-ScraperProxyEnvironment -TargetUrls $taskTargets -ResolveProxy {param($target) $target}
    Assert-ProxyTest ($taskPlan.Mode -eq 'direct') 'Direct route changed'
    Assert-ProxyTest (-not $taskPlan.Values.ContainsKey('HTTPS_PROXY')) 'Proxy invented'
  }
  'mixed'{
    $taskFailed=$false
    try{Get-ScraperProxyEnvironment -TargetUrls $taskTargets -ResolveProxy {param($target) if($target.Host -eq 'careers.example.test'){$target}else{[Uri]'http://proxy.example.test:8080/'}}|Out-Null}catch{$taskFailed=$_.Exception.Message -match 'routes differ'}
    Assert-ProxyTest $taskFailed 'Mixed routes accepted'
  }
  'invalid'{
    foreach($taskURL in @('file:///private','https://user:PRIVATE@careers.example.test/')){
      $taskFailed=$false
      try{Get-ScraperProxyEnvironment -TargetUrls @($taskURL) -ResolveProxy $taskProxy|Out-Null}catch{$taskFailed=$true;Assert-ProxyTest (-not $_.Exception.Message.Contains('PRIVATE')) 'Target value leaked'}
      Assert-ProxyTest $taskFailed 'Invalid target accepted'
    }
    $taskFailed=$false
    try{Get-ScraperProxyEnvironment -TargetUrls $taskTargets -ResolveProxy {param($target) [Uri]'http://user:PRIVATE@proxy.example.test/'}|Out-Null}catch{$taskFailed=$true;Assert-ProxyTest (-not $_.Exception.Message.Contains('PRIVATE')) 'Route value leaked'}
    Assert-ProxyTest $taskFailed 'Authenticated system proxy accepted'
  }
  'restore'{
    $taskBefore=@{}
    foreach($taskName in @('HTTP_PROXY','HTTPS_PROXY','NO_PROXY','NODE_USE_ENV_PROXY')){$taskBefore[$taskName]=[Environment]::GetEnvironmentVariable($taskName,'Process');[Environment]::SetEnvironmentVariable($taskName,$null,'Process')}
    try{
      $taskExit=Invoke-NodeWithScraperProxy -TargetUrls $taskTargets -NodeArguments @('fixture','argument with spaces') -ResolveProxy $taskProxy -InvokeNode {param($arguments)
        Assert-ProxyTest ($arguments.Count -eq 2 -and $arguments[1] -eq 'argument with spaces') 'Node arguments changed'
        Assert-ProxyTest ($env:HTTPS_PROXY -eq 'http://proxy.example.test:8080/') 'Proxy not passed to Node'
        Assert-ProxyTest ($env:NODE_USE_ENV_PROXY -eq '1') 'Native Node flag missing'
        return 7
      }
      Assert-ProxyTest ($taskExit -eq 7) 'Exit code changed'
      Assert-ProxyTest ($null -eq [Environment]::GetEnvironmentVariable('HTTPS_PROXY','Process')) 'Parent environment not restored'
      try{Invoke-NodeWithScraperProxy -TargetUrls $taskTargets -NodeArguments @('fixture') -ResolveProxy $taskProxy -InvokeNode {throw 'Simulated Node launch failure'}}catch{}
      Assert-ProxyTest ($null -eq [Environment]::GetEnvironmentVariable('HTTPS_PROXY','Process')) 'Failure left proxy in parent environment'
    }finally{foreach($taskName in $taskBefore.Keys){[Environment]::SetEnvironmentVariable($taskName,$taskBefore[$taskName],'Process')}}
  }
  'node-child'{
    $taskBefore=@{}
    foreach($taskName in @('HTTP_PROXY','HTTPS_PROXY','NO_PROXY','NODE_USE_ENV_PROXY')){$taskBefore[$taskName]=[Environment]::GetEnvironmentVariable($taskName,'Process');[Environment]::SetEnvironmentVariable($taskName,$null,'Process')}
    try{
      $taskChild=Join-Path $PSScriptRoot 'windowsScraperProxyChild.js'
      $taskOutput=@(Invoke-NodeWithScraperProxy -TargetUrls $taskTargets -NodeArguments @($taskChild,'argument with spaces') -ResolveProxy $taskProxy)
      Assert-ProxyTest ($taskOutput.Count -eq 2 -and $taskOutput[-1] -eq 7) 'Node output or exit code lost'
      $taskJSON=$taskOutput[0]|ConvertFrom-Json
      Assert-ProxyTest ($taskJSON.argument -eq 'argument with spaces') 'Real Node argument quoting changed'
      Assert-ProxyTest ($taskJSON.proxyPresent -and $taskJSON.proxyEnabled) 'Real Node did not inherit proxy configuration'
      Assert-ProxyTest ($null -eq [Environment]::GetEnvironmentVariable('HTTPS_PROXY','Process')) 'Real child changed parent environment'
    }finally{foreach($taskName in $taskBefore.Keys){[Environment]::SetEnvironmentVariable($taskName,$taskBefore[$taskName],'Process')}}
  }
  default{throw 'Unknown fixture scenario'}
}
[Console]::WriteLine('{"passed":true}')
