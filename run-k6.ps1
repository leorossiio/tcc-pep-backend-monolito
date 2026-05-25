Write-Host ""
Write-Host "========================================"
Write-Host "   PEP - K6 Load Test Runner"
Write-Host "========================================"
Write-Host ""
Write-Host "  1) Normal         (carga base diaria)"
Write-Host "  2) Dia Corrido    (picos moderados)"
Write-Host "  3) Emergencia     (sobrecarga extrema)"
Write-Host ""

$input = Read-Host "Escolha o cenario [1-3, padrao=1]"

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
  -e K6_PROMETHEUS_RW_TREND_STATS="p(95),p(99),avg,min,max" `
  grafana/k6:latest run `
  --out experimental-prometheus-rw `
  -e SCENARIO=$scenario `
  /scripts/cenario-emergencia.js
