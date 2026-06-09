$ErrorActionPreference = "Stop"

$bundledPython = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if (Test-Path $bundledPython) {
    $python = $bundledPython
} else {
    $python = "python"
}

& $python app.py --port 8787
