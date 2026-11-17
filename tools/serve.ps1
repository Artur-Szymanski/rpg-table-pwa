# Minimal static file server for local testing (no Node / Python needed).
# Usage: powershell -ExecutionPolicy Bypass -File tools\serve.ps1 [-Port 8080]
#
# Live reload: index.html is served with a small injected script that polls /__livereload
# and reloads the page whenever any file in the repo changes. Only this dev server does that;
# the deployed site is unaffected.
param([int]$Port = 8080)

$root = Split-Path -Parent $PSScriptRoot
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'
  '.jpeg' = 'image/jpeg'; '.webp' = 'image/webp'; '.frag' = 'text/plain; charset=utf-8'; '.glsl' = 'text/plain; charset=utf-8'; '.ttf' = 'font/ttf'; '.woff2' = 'font/woff2'
}

$liveReload = @'
<script>
// Injected by tools/serve.ps1 (dev only): reload when files change.
(function () {
  let last = null;
  setInterval(async () => {
    try {
      const v = await (await fetch('/__livereload', { cache: 'no-store' })).text();
      if (last !== null && v !== last) location.reload();
      last = v;
    } catch (e) { /* server restarting */ }
  }, 700);
})();
</script>
'@

# Latest write time of any file outside .git, as a string token.
function Get-RepoVersion {
  $max = 0L
  foreach ($f in [IO.Directory]::EnumerateFiles($root, '*', 'AllDirectories')) {
    if ($f.Contains('\.git\') -or $f.Contains('\.claude\')) { continue }
    $t = [IO.File]::GetLastWriteTimeUtc($f).Ticks
    if ($t -gt $max) { $max = $t }
  }
  return [string]$max
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$Port/ (live reload on)"

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $res = $ctx.Response
    try {
      $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
      $res.Headers.Add('Cache-Control', 'no-store')
      if ($path -eq '__livereload') {
        $bytes = [Text.Encoding]::UTF8.GetBytes((Get-RepoVersion))
        $res.ContentType = 'text/plain'
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
        continue
      }
      if ($path -eq '') { $path = 'index.html' }
      $file = [IO.Path]::GetFullPath((Join-Path $root $path))
      if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf)) {
        $ext = [IO.Path]::GetExtension($file).ToLower()
        if ($ext -eq '.html') {
          $html = [IO.File]::ReadAllText($file).Replace('</body>', $liveReload + '</body>')
          $bytes = [Text.Encoding]::UTF8.GetBytes($html)
        } else {
          $bytes = [IO.File]::ReadAllBytes($file)
        }
        $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $res.StatusCode = 404
      }
    } catch {
      Write-Host "Error: $_"
    } finally {
      $res.Close()
    }
  }
} finally {
  $listener.Stop()
}
