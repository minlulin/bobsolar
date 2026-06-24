# Growatt SPF 4000T-12000T DVM-US MPV - Fault Codes and Troubleshooting

Models covered: SPF 4000T DVM-US, SPF 5000T DVM-US, SPF 6000T DVM-US, SPF 8000T DVM-US, SPF 10000T DVM-US, and SPF 12000T DVM-US.

Official source: [Growatt SPF 4000T-12000T DVM-US MPV user manual](https://us.growatt.com/upload/file/SPF_4000-12000T_DVM-US_MPV_User_Manual_EN_202109.pdf), manual pages 27-28.

## Fault Codes

| Code | Fault Description | Official Troubleshooting |
|---|---|---|
| 02 | Over temperature | Check airflow and ambient temperature; the internal component temperature exceeded 90°C. |
| 03 | Battery voltage too high or battery overcharged | Verify battery specification and quantity. Return to a repair center if overcharge persists. |
| 05 | Output short circuited | Check output wiring and remove the abnormal load. |
| 06 | Output voltage abnormal / too high | Reduce connected load. Return to a repair center if the fault recurs. |
| 07 | Overload timeout | Reduce connected load by switching off equipment. |
| 20 | BMS communication loss | Check BMS communication wiring and transceiver signal. |
| 51 | Over current or surge | Restart; return to a repair center if it recurs. |

## Warning Codes

| Code | Warning Description | Audible Indication / Action |
|---|---|---|
| 01 | Inverter fan or MPPT fan abnormal | Two beeps per second; inspect both cooling fans. |
| 03 | High battery voltage | Two beeps per second; verify battery specification and charging settings. |
| 04 | Battery voltage or SOC low | Two beeps per second; recharge and inspect battery condition. |
| 07 | Overload in inverter mode | Two beeps per second; reduce connected load. |
| 12 | Solar controller over temperature | One beep per second; inspect airflow and ambient temperature. |
| 19 | No battery connected | One beep per second; inspect battery breaker, fuse, cables, and terminals. |
| 51 | Solar charger over current | One beep per second; isolate PV and inspect array current/configuration. |
| 54 | PV input over voltage | One beep per second; verify array open-circuit voltage is below 150 VDC. |
| 58 | AC output low voltage | One beep per second; reduce load and inspect output wiring. |
| 61 | Battery-voltage sampling error exceeds 0.5 V | One beep per second; compare measured terminal voltage with LCD reading and contact service if persistent. |

## Manual Consistency Note

The troubleshooting table mentions code 04 as a fault and code 58 alongside output-voltage faults, while the dedicated reference tables classify low battery and output low voltage as warnings. This knowledge document follows the dedicated fault/warning reference tables.

## Safe Restart Procedure

Disconnect all power sources. Wait until the LCD is off, then boot using battery power only. Do not open the inverter enclosure.
