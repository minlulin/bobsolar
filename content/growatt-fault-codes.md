# Growatt Inverter Fault Codes

## Grid Faults

| Brand | Error Code | Meaning | Possible Causes | Danger Level | Troubleshooting |
|-------|-----------|---------|-----------------|--------------|-----------------|
| Growatt | Fault 01 | Grid voltage out of range | Grid instability, wiring issues | **Major** | 1. Check grid voltage at inverter terminals. 2. Verify AC wiring is secure. 3. Contact utility if grid is unstable. |
| Growatt | Fault 02 | Grid frequency out of range | Generator or grid frequency drift | **Major** | 1. Measure grid frequency. 2. If using generator, check governor settings. |
| Growatt | Fault 03 | Grid lost (islanding) | Grid disconnection | **Critical** | **⚠️ DANGER: Disconnect AC breaker before troubleshooting.** 1. Check AC breaker. 2. Verify grid is present. 3. Do not reconnect until grid is stable. |

## Inverter Faults

| Brand | Error Code | Meaning | Possible Causes | Danger Level | Troubleshooting |
|-------|-----------|---------|-----------------|--------------|-----------------|
| Growatt | Fault 09 | Bus start failure | Shorted PV input, hardware fault | **Critical** | **⚠️ DANGER: Isolate AC and DC before testing.** 1. Disconnect all PV strings. 2. Check for short circuits in PV wiring. 3. Reconnect strings one at a time to find faulty string. 4. If fault persists, contact support. |
| Growatt | Fault 10 | Inverter over-temperature | Blocked ventilation, high ambient temp | **Major** | 1. Clear ventilation around inverter. 2. Check ambient temperature is within spec. 3. Clean dust from heatsinks. |
| Growatt | Fault 11 | Ground fault | Insulation failure in PV array | **Critical** | **⚠️ DANGER: Risk of electric shock.** 1. Disconnect PV. 2. Test each string insulation resistance. 3. Replace damaged cables/modules. |

## Battery / BMS Faults

| Brand | Error Code | Meaning | Possible Causes | Danger Level | Troubleshooting |
|-------|-----------|---------|-----------------|--------------|-----------------|
| Growatt | Fault 20 | BMS communication error | CAN/RS485 wiring, BMS offline | **Medium** | 1. Check communication cable between battery and inverter. 2. Verify BMS is powered on. 3. Check CAN termination resistors. |
| Growatt | Fault 21 | Battery over-voltage | BMS failure, charger fault | **Major** | 1. Check battery voltage. 2. Verify BMS settings match inverter. 3. Disconnect battery if voltage exceeds safe limit. |
| Growatt | Fault 22 | Battery under-voltage | Deep discharge, cell imbalance | **Medium** | 1. Check battery SOC. 2. Charge battery to minimum voltage. 3. Check cell balance. |
