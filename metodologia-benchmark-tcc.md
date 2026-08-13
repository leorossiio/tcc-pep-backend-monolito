Para os testes do TCC, as arquiteturas não podem disputar hardware. O protocolo correto é:

Sobe o Monólito -> Roda o K6 -> Derruba o Monólito (docker-compose down -v).

Sobe os Microsserviços -> Roda o K6 -> Derruba os Microsserviços (docker-compose down -v).