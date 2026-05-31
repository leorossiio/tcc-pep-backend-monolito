# Para rodar em Windows: .\run-k6.ps1
#   .\run-k6.ps1            -> zera os bancos (docker compose down -v) antes de cada teste
#   .\run-k6.ps1 -KeepData  -> NAO zera; mantem os dados/metricas acumulados
param(
  [switch]$KeepData
)

# --- Reset do ambiente -------------------------------------------------------
# Zera os volumes (PG, Mongo, Prometheus, Grafana), recria os containers e
# espera a API responder. Garante dataset limpo a cada teste — sem acumulo de
# dados que inflaria a latencia dos reads e invalidaria a comparacao.
function Reset-Stack {
  Write-Host ""
  Write-Host "[reset] Zerando volumes (docker compose down -v) ..." -ForegroundColor Yellow
  docker compose down -v

  Write-Host "[reset] Subindo containers (docker compose up -d --build) ..." -ForegroundColor Yellow
  docker compose up -d --build

  Wait-AppReady
}

function Wait-AppReady {
  Write-Host "[reset] Aguardando app-monolito em http://localhost:3000/metrics ..." -ForegroundColor Yellow
  $deadline = (Get-Date).AddSeconds(120)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri "http://localhost:3000/metrics" -UseBasicParsing -TimeoutSec 3
      if ($r.StatusCode -eq 200) {
        Start-Sleep -Seconds 2   # folga para o TypeORM synchronize finalizar o schema
        Write-Host "[reset] App pronto." -ForegroundColor Green
        return
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  Write-Host "[reset] AVISO: app nao respondeu em 120s. Verifique 'docker compose logs app-monolito'." -ForegroundColor Red
}

# --- Menu --------------------------------------------------------------------
Write-Host ""
Write-Host "========================================"
Write-Host "   PEP - K6 Load Test Runner"
Write-Host "========================================"
Write-Host ""
Write-Host "  1) Normal         (carga base diaria)"
Write-Host "  2) Dia Corrido    (picos moderados)"
Write-Host "  3) Emergencia     (sobrecarga extrema)"
Write-Host "  4) Mono vs MS     (comparacao das duas arquiteturas)"
Write-Host ""
if ($KeepData) {
  Write-Host "  [modo -KeepData: os bancos NAO serao zerados]" -ForegroundColor Cyan
} else {
  Write-Host "  [a cada teste os bancos sao zerados via docker compose down -v]" -ForegroundColor Cyan
}
Write-Host ""

$choice = Read-Host "Escolha o cenario [1-4, padrao=1]"

# Zera o ambiente antes de rodar (a menos que -KeepData)
if (-not $KeepData) {
  Reset-Stack
} else {
  Write-Host "[reset] -KeepData ativo: mantendo dados existentes." -ForegroundColor Cyan
}

if ($choice -eq "4") {
  $scenario = Read-Host "Perfil de carga [1=Normal / 2=Stress / 3=Pico, padrao=1]"
  if ($scenario -notin @("1","2","3")) { $scenario = "1" }

  Write-Host ""
  Write-Host "Iniciando comparacao Monolito vs MS - perfil $scenario"
  Write-Host "(obs: este reset zera apenas o stack do monolito; o stack de microsservicos e separado)" -ForegroundColor Yellow
  Write-Host ""

  # Cria o container sem iniciar (permite conectar as duas redes antes do start)
  docker create `
    -v "${PWD}/k6-scripts:/scripts" `
    --network tcc-pep-backend-monolito_pep_network `
    -e K6_PROMETHEUS_RW_SERVER_URL=http://prometheus_pep:9090/api/v1/write `
    -e 'K6_PROMETHEUS_RW_TREND_STATS=p(95),p(99),avg,min,max' `
    -e SCENARIO=$scenario `
    --name k6_runner_ms `
    grafana/k6:latest run --out experimental-prometheus-rw /scripts/cenario-mono-ms.js

  # Conecta na rede do MS (container ainda nao iniciado)
  docker network connect tcc-pep-backend-microsservicos_pep_network_ms k6_runner_ms

  # Inicia e exibe output em tempo real
  docker start -a k6_runner_ms

  # Limpeza
  docker rm k6_runner_ms 2>$null

} else {
  switch ($choice) {
    "2" { $scenario = "2"; $label = "Dia Corrido" }
    "3" { $scenario = "3"; $label = "Emergencia" }
    default { $scenario = "1"; $label = "Normal" }
  }

  Write-Host ""
  Write-Host "Iniciando cenario $scenario - $label"
  Write-Host ""

  docker run --rm -it `
    -v "${PWD}/k6-scripts:/scripts" `
    --network tcc-pep-backend-monolito_pep_network `
    -e K6_PROMETHEUS_RW_SERVER_URL=http://prometheus_pep:9090/api/v1/write `
    -e 'K6_PROMETHEUS_RW_TREND_STATS=p(95),p(99),avg,min,max' `
    grafana/k6:latest run `
    --out experimental-prometheus-rw `
    -e SCENARIO=$scenario `
    /scripts/cenario-emergencia.js
}
