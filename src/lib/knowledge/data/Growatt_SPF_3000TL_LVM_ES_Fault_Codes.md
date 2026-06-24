# Growatt SPF 3000TL LVM-ES - Fault Codes and Troubleshooting

Official source: [Growatt SPF 3000TL LVM-ES user manual](https://latam.growatt.com/upload/file/SPF_3000TL_LVM-ES_Manual_de_usuario_EN_202209.pdf), pages 36-43.

## Fault Codes

| Code | Fault Description | Official Troubleshooting |
|---|---|---|
| 01 | Fan locked | Check that all fans operate correctly; replace the fan if required. |
| 02 | Over temperature | Check for blocked airflow, excessive ambient temperature, or a loose thermistor connector. |
| 03 | Battery voltage too high or battery overcharged | Verify battery specification and quantity. Restart; if overcharge recurs, contact a repair center. |
| 04 | Battery voltage too low | Measure and recharge the battery; inspect battery condition and connections. |
| 05 | Output short circuited | Check output wiring and remove the abnormal load. |
| 06 | Output voltage too high | Reduce connected load. Restart; if the fault recurs, contact a repair center. |
| 07 | Overload timeout | Reduce connected load by switching off equipment. |
| 08 | Bus voltage too high | For lithium without communication, verify Programs 19 and 21 are not set too high. Restart; service if it recurs. |
| 09 | Bus soft start failed | Internal component fault. Restart; contact a repair center if it recurs. |
| 51 | Over current or surge | Restart; contact a repair center if it recurs. |
| 52 | Bus voltage too low | Restart; contact a repair center if it recurs. |
| 53 | Inverter soft start failed | Internal component fault. Restart; contact a repair center if it recurs. |
| 55 | Excess DC voltage at AC output / output voltage unbalanced | Restart; contact a repair center if it recurs. |
| 56 | Battery connection open | Check battery connection and fuse. If connected correctly, restart; service if it recurs. |
| 57 | Current sensor failed | Internal component fault. Restart; contact a repair center if it recurs. |
| 58 | Output voltage too low | Reduce connected load. Restart; if the fault recurs, contact a repair center. |
| 60 | Negative power fault | Check AC output is not connected to grid input; verify Program 8, current-sharing cables, and neutral wiring across parallel units. |
| 61 | PV voltage too high | Isolate PV and verify array open-circuit voltage is below 250 VDC before reconnecting. |
| 62 | Internal communication error | Restart; contact a repair center if it recurs. |
| 80 | CAN fault | Check parallel communication cables and Program 23 parallel settings. |
| 81 | Host loss | Check parallel communication cables and Program 23 parallel settings. |

## Warning Codes

| Code | Warning Description | Audible Indication / Action |
|---|---|---|
| 01 | Fan locked while inverter is on | Three beeps per second; check fan operation. |
| 02 | Over temperature | One beep per second; check airflow and ambient temperature. |
| 03 | Battery overcharged | One beep per second; verify battery configuration. |
| 04 | Low battery | One beep per second; measure battery voltage/SOC and recharge. |
| 07 | Overload | One beep every 0.5 seconds; reduce load. |
| 10 | Output power derating | Two beeps every three seconds; reduce load and check temperature/input conditions. |
| 12 | Solar charger stopped due to low battery | One beep per second; restore battery voltage. |
| 13 | Solar charger stopped due to high PV voltage | One beep per second; verify PV string voltage. |
| 14 | Solar charger stopped due to overload | One beep per second; reduce PV charging load/input. |
| 15 | Parallel input utility grid differs | One beep per second; check AC inputs to all parallel inverters. |
| 16 | Parallel input phase error | One beep per second; correct the input phase wiring. |
| 17 | Parallel output phase loss | One beep per second; verify parallel settings and that every phase inverter is powered. |
| 18 | Buck over current | One beep per second; isolate inputs and contact service if persistent. |
| 19 | Battery disconnected | No beep; inspect battery breaker, fuse, cables, and terminals. |
| 20 | BMS communication error | One beep per second; check communication cable and selected BMS protocol. |
| 21 | PV power insufficient | One beep per second; check irradiance, PV wiring, and string voltage. |
| 22 | Parallel operation forbidden without battery | One beep per second; connect the required common battery bank. |
| 25 | Parallel inverter capacities differ | One beep per second; use compatible inverter ratings in the parallel system. |
| 33 | BMS communication loss | One beep per second; check BMS cable, protocol, and battery status. |
| 34 | Cell overvoltage | One beep per second; stop charging and inspect BMS/cell data. |
| 35 | Cell undervoltage | One beep per second; reduce discharge and recharge the battery. |
| 36 | Total battery overvoltage | One beep per second; stop charging and verify configured voltage limits. |
| 37 | Total battery undervoltage | One beep per second; reduce discharge and recharge the battery. |
| 38 | Discharge overcurrent | One beep per second; reduce load and inspect battery current limits. |
| 39 | Charge overcurrent | One beep per second; reduce charge current and inspect BMS limits. |
| 40 | Discharge overtemperature | One beep per second; stop/reduce discharge and allow the battery to cool. |
| 41 | Charge overtemperature | One beep per second; stop/reduce charging and allow the battery to cool. |
| 42 | MOSFET overtemperature | One beep per second; stop high-current operation and inspect battery cooling. |
| 43 | Battery overtemperature | One beep per second; stop operation and allow the battery to cool. |
| 44 | Battery undertemperature | One beep per second; stop charging until battery temperature is within limits. |
| 45 | System shutdown | One beep per second; inspect BMS status and battery protection events. |

## Safe Restart Procedure

Disconnect all power sources. Wait until the LCD backlight is off, then boot using battery power only. Do not open the inverter enclosure.
