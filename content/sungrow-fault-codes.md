# Sungrow Inverter Fault Codes

## Grid Faults

| Brand | Error Code | Meaning | Possible Causes | Danger Level | Troubleshooting |
|-------|-----------|---------|-----------------|--------------|-----------------|
| Sungrow | Grid Voltage High | Grid voltage exceeds limit | Grid overvoltage, tap changer issue | **Major** | 1. Measure grid voltage. 2. If persistent, contact utility company. |
| Sungrow | Grid Voltage Low | Grid voltage below limit | Grid overload, wiring too thin | **Major** | 1. Check grid voltage. 2. Verify AC cable gauge is adequate for distance. |
| Sungrow | Grid Frequency High | Grid frequency above limit | Generator issue | **Major** | 1. Check generator frequency. 2. Adjust governor if applicable. |
| Sungrow | Grid Relay Fault | AC relay failure | Relay wear, hardware fault | **Critical** | **⚠️ DANGER: Do not operate inverter.** Disconnect AC and DC. Contact Sungrow support. |

## PV / DC Faults

| Brand | Error Code | Meaning | Possible Causes | Danger Level | Troubleshooting |
|-------|-----------|---------|-----------------|--------------|-----------------|
| Sungrow | PV Voltage High | DC voltage exceeds inverter max | Too many panels in series, cold weather | **Critical** | **⚠️ DANGER: High voltage present.** 1. Verify panel string voltage at terminals. 2. Reduce panels in series if over limit. 3. Consider temperature coefficient in cold climates. |
| Sungrow | PV1/PV2 Reverse | PV polarity reversed | Wiring error | **Medium** | 1. Disconnect PV. 2. Check polarity with multimeter. 3. Correct wiring. |
| Sungrow | Insulation Fault | Low insulation resistance | Damaged cables, moisture ingress | **Critical** | **⚠️ DANGER: Risk of shock and fire.** 1. Disconnect all PV strings. 2. Test each string with insulation tester. 3. Replace damaged components. |

## Inverter Faults

| Brand | Error Code | Meaning | Possible Causes | Danger Level | Troubleshooting |
|-------|-----------|---------|-----------------|--------------|-----------------|
| Sungrow | Inverter Fault (001) | Internal hardware fault | Component failure | **Critical** | 1. Power cycle inverter (DC then AC). 2. If fault persists, contact Sungrow. |
| Sungrow | Over-temperature | Internal temp too high | Blocked vents, fan failure, high ambient | **Major** | 1. Clean air filters. 2. Check fan operation. 3. Ensure clearance around inverter. |
| Sungrow | Fan Fault | Cooling fan failure | Fan bearing failure, wiring | **Major** | 1. Check fan wiring. 2. Replace fan if not spinning. 3. Monitor temperature closely. |

## Battery Faults

| Brand | Error Code | Meaning | Possible Causes | Danger Level | Troubleshooting |
|-------|-----------|---------|-----------------|--------------|-----------------|
| Sungrow | BMS Timeout | No communication from BMS | Cable disconnected, BMS off | **Medium** | 1. Check BMS power. 2. Verify communication cable. 3. Restart BMS. |
| Sungrow | Battery Overcurrent | Charge/discharge current too high | Load spike, inverter fault | **Major** | 1. Reduce loads. 2. Check battery specs match inverter. 3. Contact support if persistent. |
