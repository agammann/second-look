$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$archivePath = Join-Path $taskRoot 'second-look-prototype.zip'
$nextArchivePath = Join-Path $taskRoot 'second-look-prototype.next.zip'
if ([IO.Path]::GetDirectoryName($archivePath) -ne $taskRoot -or [IO.Path]::GetDirectoryName($nextArchivePath) -ne $taskRoot) { throw 'Archive path outside project'; }
if (Test-Path -LiteralPath $nextArchivePath) { throw 'Previous staging archive exists; inspect it first'; }

# Explicit public deliverables; no credentials, local state, weights, binaries or old ZIPs.
$names = @('server.mjs','lib','public','tests','scripts','artifacts','README.md','PLAN.md','CONTRACT.md','STATUS.md','DEMO.md','SUBMISSION.md','LICENSE','NOTICES.md','.env.example','.gitignore')
$forbiddenEntryPattern = '(^|/)(\.data|node_modules|deliveries|temporary-data)(/|$)|(^|/)\.env(?!\.example$)(?:\.[^/]*)?(/|$)|\.(sqlite|sqlite-wal|sqlite-shm|db|log|exe|dll|gguf|zip)$|(^|/)session-key$'
$sources = $names | ForEach-Object { Join-Path $taskRoot $_ }
foreach ($relativeTemp in @('artifacts\browser\temporary-data','artifacts\browser\v3\temporary-data','artifacts\browser\v4\temporary-data')) {
  $temporaryData = Join-Path $taskRoot $relativeTemp
  if (Test-Path -LiteralPath $temporaryData) { throw 'Owned browser temporary-data directory must be removed before packaging'; }
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
# V3's preserved mirror remains on disk. Package each byte-identical raw artifact
# once under its original v3 path, while retaining unique archived QA scripts.
$deduplicatedMirrorEntries = 0
$archiveStream = [IO.File]::Open($nextArchivePath, [IO.FileMode]::CreateNew)
$creatingZip = [IO.Compression.ZipArchive]::new($archiveStream, [IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($source in $sources) {
    $sourceItem = Get-Item -LiteralPath $source
    $sourceFiles = if ($sourceItem.PSIsContainer) { Get-ChildItem -LiteralPath $source -Recurse -File -Force } else { @($sourceItem) }
    foreach ($sourceFile in $sourceFiles) {
      $relativePath = [IO.Path]::GetRelativePath($taskRoot, $sourceFile.FullName).Replace('\','/')
      if ($relativePath -match $forbiddenEntryPattern) { throw ('Forbidden archive entry: ' + $relativePath); }
      if ($relativePath.StartsWith('artifacts/browser/frozen-v3/')) {
        $originalRelative = 'artifacts/browser/v3/' + $relativePath.Substring('artifacts/browser/frozen-v3/'.Length)
        $originalPath = Join-Path $taskRoot $originalRelative
        if (Test-Path -LiteralPath $originalPath -PathType Leaf) {
          if ((Get-FileHash -LiteralPath $sourceFile.FullName -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $originalPath -Algorithm SHA256).Hash) { throw 'Preserved v3 mirror differs from original'; }
          $deduplicatedMirrorEntries++
          continue
        }
      }
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($creatingZip, $sourceFile.FullName, $relativePath, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
  }
} finally { $creatingZip.Dispose(); $archiveStream.Dispose(); }

$zip = [IO.Compression.ZipFile]::OpenRead($nextArchivePath)
try {
  $entryNames = @($zip.Entries | ForEach-Object { $_.FullName.Replace('\','/') })
  $forbidden = @($entryNames | Where-Object { $_ -match $forbiddenEntryPattern })
  if ($forbidden.Count) { throw ('Forbidden archive entries: ' + ($forbidden -join ', ')); }
  foreach ($required in @('server.mjs','lib/evidence.mjs','public/quote-review.js','README.md','STATUS.md','DEMO.md','SUBMISSION.md','LICENSE','NOTICES.md','.env.example','artifacts/model-check/freeze-v3.json','artifacts/model-check/v3/evidence.mjs','artifacts/model-check/freeze-v4.json','artifacts/model-check/v4/evidence.mjs')) {
    if ($entryNames -notcontains $required) { throw ('Missing archive entry: ' + $required); }
  }
  foreach ($version in @('v1','v2','v3','v4')) {
    $freeze = Get-Content -LiteralPath (Join-Path $taskRoot ('artifacts/model-check/freeze-' + $version + '.json')) -Raw | ConvertFrom-Json
    $entry = $zip.GetEntry('artifacts/model-check/' + $version + '/evidence.mjs')
    $stream = $entry.Open()
    try { $hash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($stream)).ToLowerInvariant(); } finally { $stream.Dispose(); }
    if ($hash -ne $freeze.moduleSha256) { throw ('Frozen ' + $version + ' source differs in archive'); }
    if ($version -eq 'v4') {
      $currentStream = $zip.GetEntry('lib/evidence.mjs').Open()
      try { $currentHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($currentStream)).ToLowerInvariant(); } finally { $currentStream.Dispose(); }
      if ($currentHash -ne $freeze.moduleSha256) { throw 'Current model source differs from frozen v4'; }
    }
  }
  $count = $entryNames.Count
} finally { $zip.Dispose(); }
Move-Item -LiteralPath $nextArchivePath -Destination $archivePath -Force
$archive = Get-Item -LiteralPath $archivePath
[PSCustomObject]@{path=$archivePath;bytes=$archive.Length;sha256=(Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant();entries=$count;frozenSourcesVerified=$true;excludedPrivateState=$true;identicalV3MirrorEntriesPackagedOnce=$deduplicatedMirrorEntries} | ConvertTo-Json
