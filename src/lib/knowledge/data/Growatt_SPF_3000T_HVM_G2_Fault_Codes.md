# Growatt SPF 3000T HVM-G2 - Fault Codes and Troubleshooting

Official source: [Growatt SPF 3000T HVM-G2 user manual](https://us.growatt.com/upload/file/SPF_3000T_HVM-G2_User_Manual_EN_202305.pdf), manual pages 23-24.

## Fault Codes

| Code | Fault Description | Official Troubleshooting |
|---|---|---|
| 01 | Inverter fan not working | Replace the fan. |
| 02 | Inverter over temperature | Check airflow and ambient temperature; the internal component temperature exceeded 90°C. |
| 03 | Battery voltage too high or battery overcharged | Verify battery specification and quantity. Return to a repair center if overcharge persists. |
| 04 | Battery voltage too low | Recharge the battery and inspect its condition and connections. |
| 05 | Output short circuited | Check output wiring and remove the abnormal load. |
| 06 | Output voltage abnormal / too high | Reduce connected load. Return to a repair center if the fault recurs. |
| 07 | Overload timeout | Reduce connected load by switching off equipment. |
| 20 | BMS communication error | Check BMS communication wiring and transceiver signal. |
| 51 | Over current or surge | Restart; return to a repair center if it recurs. |

## Warning Codes

| Code | Warning Description | Audible Indication / Action |
|---|---|---|
| 01 | PV fan not working | One beep per second; inspect the PV fan. |
| 02 | PV over temperature | One beep per second; inspect PV-section airflow and ambient temperature. |
| 04 | Low battery | One beep per second; recharge and inspect battery condition. |
| 07 | Overload | One beep per second; reduce connected load. |
| 13 | Solar charger stopped due to high PV voltage | One beep per second; verify PV string voltage. |
| 19 | Battery disconnected | One beep per second; inspect battery breaker, fuse, cables, and terminals. |
| 51 | PV over current or surge | One beep per second; isolate PV and inspect array current/configuration. |
| 58 | AC output low voltage | One beep per second; reduce load and inspect output wiring. |
| 63 | Battery-voltage sampling error exceeds 0.5 V | One beep per second; compare measured terminal voltage with the LCD reading and contact service if persistent. |

## Safe Restart Procedure

Disconnect all power sources. Wait until the LCD is off, then boot using battery power only. Do not open the inverter enclosure.
