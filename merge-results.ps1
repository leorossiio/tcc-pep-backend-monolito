# Agrupa os CSVs de um cenario num unico arquivo para a tabela do TCC.
#
# Cada run do k6 gera 1 CSV em k6-scripts\results\<cenario>\. Este script
# pergunta qual cenario voce quer agrupar e empilha todos os CSVs daquela
# pasta (mantendo um unico cabecalho) em k6-scripts\consolidado-<cenario>.csv.
#
# Uso:
#   .\merge-results.ps1                 -> menu interativo
#   .\merge-results.ps1 -Cenario normal -> agrupa direto, sem perguntar
param(
  [ValidateSet('normal', 'dia-corrido', 'emergencia', 'todos')]
  [string]$Cenario
)

$ResultsRoot = "$PSScriptRoot\k6-scripts\results"

# --- Menu (se nao veio por parametro) ----------------------------------------
if (-not $Cenario) {
  Write-Host ""
  Write-Host "========================================"
  Write-Host "   Agrupar resultados k6 (CSV)"
  Write-Host "========================================"
  Write-Host ""
  Write-Host "  1) Normal       (30 VUs)"
  Write-Host "  2) Dia Corrido  (100 VUs)"
  Write-Host "  3) Emergencia   (250 VUs)"
  Write-Host "  4) Todos        (junta os tres num arquivo so)"
  Write-Host ""
  $escolha = Read-Host "Qual cenario agrupar? [1-4]"
  switch ($escolha) {
    "1" { $Cenario = "normal" }
    "2" { $Cenario = "dia-corrido" }
    "3" { $Cenario = "emergencia" }
    "4" { $Cenario = "todos" }
    default { Write-Host "Opcao invalida." -ForegroundColor Red; exit 1 }
  }
}

# --- Define quais pastas entram ----------------------------------------------
if ($Cenario -eq "todos") {
  $pastas = @("normal", "dia-corrido", "emergencia")
  $Out = "$PSScriptRoot\k6-scripts\consolidado-geral.csv"
} else {
  $pastas = @($Cenario)
  $Out = "$PSScriptRoot\k6-scripts\consolidado-$Cenario.csv"
}

# --- Coleta os CSVs ----------------------------------------------------------
$files = @()
foreach ($p in $pastas) {
  $dir = Join-Path $ResultsRoot $p
  if (Test-Path $dir) {
    $files += Get-ChildItem -Path $dir -Filter *.csv -File
  }
}
$files = $files | Sort-Object Name

if ($files.Count -eq 0) {
  Write-Host "Nenhum CSV encontrado para '$Cenario' em $ResultsRoot" -ForegroundColor Yellow
  exit 0
}

# --- Empilha (1 cabecalho + dados de todos) ----------------------------------
$saida  = New-Object System.Collections.Generic.List[string]
$header = $null

foreach ($f in $files) {
  $linhas = @(Get-Content -Path $f.FullName)
  if ($linhas.Count -eq 0) { continue }
  if ($null -eq $header) {
    $header = $linhas[0]
    $saida.Add($header)
  }
  if ($linhas.Count -gt 1) {
    foreach ($l in $linhas[1..($linhas.Count - 1)]) {
      if ($l.Trim().Length -gt 0) { $saida.Add($l) }
    }
  }
}

$saida | Set-Content -Path $Out -Encoding utf8
Write-Host ""
Write-Host "Consolidado gerado: $Out" -ForegroundColor Green
Write-Host "  Cenario: $Cenario | $($files.Count) arquivo(s) | $($saida.Count - 1) linha(s) de dados." -ForegroundColor Green
