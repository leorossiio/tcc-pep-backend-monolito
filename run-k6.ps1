# Para rodar em Windows: .\run-k6.ps1
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

$input = Read-Host "Escolha o cenario [1-4, padrao=1]"

if ($input -eq "4") {
  $scenario = Read-Host "Perfil de carga [1=Normal / 2=Stress / 3=Pico, padrao=1]"
  if ($scenario -notin @("1","2","3")) { $scenario = "1" }

  Write-Host ""
  Write-Host "Iniciando comparacao Monolito vs MS - perfil $scenario"
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
  switch ($input) {
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
