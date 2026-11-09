param(
  [Parameter(Mandatory=$true)][string[]]$TargetUrls,
  [Parameter(Mandatory=$true)][string[]]$NodeArguments
)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'lib/windowsScraperProxy.ps1')
$taskExitCode=$null
Invoke-NodeWithScraperProxy -TargetUrls $TargetUrls -NodeArguments $NodeArguments | ForEach-Object {
  if($_ -is [int]){$taskExitCode=$_}else{Write-Output $_}
}
if($null -eq $taskExitCode){throw 'Node launcher did not return an exit code'}
exit $taskExitCode
