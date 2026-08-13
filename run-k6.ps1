# Para rodar em Windows: .\run-k6.ps1
#   .\run-k6.ps1            -> zera os bancos (docker compose down -v) antes de cada teste
#   .\run-k6.ps1 -KeepData  -> NAO zera; mantem os dados/metricas acumulados
param(
  [switch]$KeepData
)

# --- Autodetecao de Arquitetura ---------------------------------------------
$isMonolito = Test-Path "k6-scripts/cenario-comparativo-monolito.js"
$isMicroservicos = Test-Path "k6-scripts/cenario-comparativo-ms.js"

if ($isMonolito) {
    $arqName = "MONOLITO"
    $scriptFile = "/scripts/cenario-comparativo-monolito.js"
    $network = "tcc-pep-backend-monolito_pep_network"
    $healthUrl = "http://localhost:3000/metrics"
} elseif ($isMicroservicos) {
    $arqName = "MICROSSERVICOS"
    $scriptFile = "/scripts/cenario-comparativo-ms.js"
    $network = "tcc-pep-backend-microsservicos_pep_network_ms" 
    $healthUrl = "http://localhost:4000/api"
} else {
    Write-Host "Erro: Nenhum script K6 de benchmark encontrado na pasta k6-scripts!" -ForegroundColor Red
    exit 1
}

# --- Reset do ambiente -------------------------------------------------------
function Reset-Stack {
  Write-Host ""
  Write-Host "[reset] Zerando volumes (docker compose down -v) ..." -ForegroundColor Yellow
  docker compose down -v

  Write-Host "[reset] Subindo containers (docker compose up -d --build) ..." -ForegroundColor Yellow
  docker compose up -d --build

  Wait-AppReady
}

function Wait-AppReady {
  Write-Host "[reset] Aguardando inicializacao da aplicacao..." -ForegroundColor Yellow
  $deadline = (Get-Date).AddSeconds(120)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 3
      if ($r.StatusCode -eq 200 -or $r.StatusCode -eq 404) {
        Start-Sleep -Seconds 5
        Write-Host "[reset] App pronta." -ForegroundColor Green
        return
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  Write-Host "[reset] AVISO: app nao respondeu em 120s. Verifique os logs." -ForegroundColor Red
}

# --- Menu Interativo ---------------------------------------------------------
Clear-Host
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PEP - K6 Load Test Runner ($arqName)" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1) Normal         (carga base diaria, Pico 50)"
Write-Host "  2) Dia Corrido    (picos moderados, Pico 150)"
Write-Host "  3) Emergencia     (sobrecarga extrema, Pico 300)"
Write-Host ""

if ($KeepData) { Write-Host "  [modo -KeepData: os bancos NAO serao zerados]" -ForegroundColor Cyan } 
else { Write-Host "  [a cada teste os bancos sao zerados via docker compose down -v]" -ForegroundColor Cyan }
Write-Host ""

$scenario = Read-Host "Escolha o cenario [1, 2 ou 3]"
while ("1","2","3" -notcontains $scenario) {
    Write-Host "Opcao invalida!" -ForegroundColor Red
    $scenario = Read-Host "Escolha o cenario [1, 2 ou 3]"
}

Write-Host ""
$repeticao = Read-Host "Digite o NUMERO DA REPETICAO (ex: 1, 2, 3... 15)"
while ([string]::IsNullOrWhiteSpace($repeticao)) {
    Write-Host "A repeticao e obrigatoria para gerar o CSV corretamente." -ForegroundColor Red
    $repeticao = Read-Host "Digite o NUMERO DA REPETICAO (ex: 1, 2, 3... 15)"
}

Write-Host ""
$warmup = Read-Host "Defina o tempo de Warm-up [Aperte ENTER para o padrao de 45s]"
if ([string]::IsNullOrWhiteSpace($warmup)) { 
    $warmup = "45s" 
}

if (-not $KeepData) { Reset-Stack } 
else { Write-Host "[reset] -KeepData ativo: mantendo dados existentes." -ForegroundColor Cyan }

Write-Host ""
Write-Host "Iniciando bateria de testes no $arqName..." -ForegroundColor Green
Write-Host "Cenario: $scenario | Repeticao: $repeticao | Warm-up: $warmup" -ForegroundColor DarkGray
Write-Host "-------------------------------------------------------"

# --- Execucao via Docker -----------------------------------------------------
docker run --rm -it `
  -v "${PWD}/k6-scripts:/scripts" `
  --network $network `
  -e K6_PROMETHEUS_RW_SERVER_URL=http://prometheus_pep:9090/api/v1/write `
  -e "K6_PROMETHEUS_RW_TREND_STATS=p(95),p(99),avg,min,max" `
  grafana/k6:latest run `
  --out experimental-prometheus-rw `
  -e SCENARIO=$scenario `
  -e REPETICAO=$repeticao `
  -e WARMUP_DURATION=$warmup `
  $scriptFile