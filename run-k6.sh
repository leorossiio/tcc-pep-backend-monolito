#Para rodar em Linux: bash run-k6.sh

echo ""
echo "========================================"
echo "   PEP - K6 Load Test Runner"
echo "========================================"
echo ""
echo "  1) Normal         (carga base diaria)"
echo "  2) Dia Corrido    (picos moderados)"
echo "  3) Emergencia     (sobrecarga extrema)"
echo ""

read -p "Escolha o cenario [1-3, padrao=1]: " input

case $input in
  2) scenario="2"; label="Dia Corrido" ;;
  3) scenario="3"; label="Emergencia" ;;
  *) scenario="1"; label="Normal" ;;
esac

echo ""
echo "Iniciando cenario $scenario - $label"
echo ""

docker run --rm -it \
  -v "${PWD}/k6-scripts:/scripts" \
  --network tcc-pep-backend-monolito_pep_network \
  -e K6_PROMETHEUS_RW_SERVER_URL=http://prometheus_pep:9090/api/v1/write \
  -e K6_PROMETHEUS_RW_TREND_STATS="p(95),p(99),avg,min,max" \
  grafana/k6:latest run \
  --out experimental-prometheus-rw \
  -e SCENARIO=$scenario \
  /scripts/cenario-emergencia.js
