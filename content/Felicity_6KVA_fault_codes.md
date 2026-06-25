# Felicity IVEM Series (6KVA) — Diagnostic, Warning & Fault Codes

## 1. Diagnostic Information (LCD Display Overview)

| Icon / Indicator | Description |
|---|---|
| **Li** | Indicates Lithium battery type is selected |
| **C** | Indicates communication is established between inverter and battery |
| **WiFi** | Indicates the Wi-Fi link is active |
| **AC Output 1** | Indicates the first AC output |
| **AC Output 2** | Indicates the second AC output |

### BMS Information Page Parameters

| Parameter | Description |
|---|---|
| **Mean SOC / Battery Pack Number / BMS Status** | e.g. Mean SOC 97%, Connected Battery Pack 4, BMS Status 51 |
| **BMS Version / SOC** | e.g. BMS Version 100, SOC 99% on battery pack address 1 |
| **BMS Voltage / Current** | e.g. 54.0V, 1A on battery pack address 1 |
| **BMS Highest / Lowest Temperature** | e.g. Highest 25°C, Lowest -10°C on battery pack address 1 |
| **BMS Fault Code / Flag** | e.g. Fault code 0, Flag 000 on battery pack address 1 |

### Energy Stored Data Page

| Parameter | Example |
|---|---|
| PV generated energy this month | 99 kWh |
| PV generated energy today | 99 kWh |
| PV generated energy this year | 99 kWh |
| PV generated energy total | 340 kWh |
| Load consumed energy today | 79 kWh |
| Load consumed energy this month | 79 kWh |
| Load consumed energy this year | 80 kWh |
| Load consumed energy total | 272 kWh |

---

## 2. BMS Warning Codes (BMS Status Codes)

| Code | Description | Action |
|---|---|---|
| **50** | BMS doesn't allow inverter to charge battery | Inverter will stop charging battery automatically |
| **51** | BMS doesn't allow inverter to discharge battery | Inverter will stop discharging battery automatically |
| **52** | BMS requires inverter to charge battery | Inverter will charge battery automatically |
| **53** | BMS detects something wrong happened | If the code persists for a long time, contact your installer |
| **54–65** | Upgrade the firmware of BMS | — |

---

## 3. Fault Codes & Troubleshooting

### 3.1 AC / Internal Component Faults

| Code | Fault Description | Troubleshooting |
|---|---|---|
| **27** | AC Surge or internal components failed | Restart the unit. If error happens again, return to repair center. |
| **28** | Internal components failed | Restart the unit. If error happens again, return to repair center. |
| **29** | Over current or surge detected by Software | Restart the unit. If error happens again, return to repair center. |
| **30** | Over current or surge detected by Hardware | Restart the unit. If error happens again, return to repair center. |

### 3.2 Bus Voltage Faults

| Code | Fault Description | Troubleshooting |
|---|---|---|
| **31** | Bus voltage is too high | Restart the unit. If error happens again, return to repair center. |
| **32** | Bus voltage is too low | Restart the unit. If error happens again, return to repair center. |
| **33** | Bus soft start fail | Restart the unit. If error happens again, return to repair center. |
| **44** | Overvoltage occurs in BUS (AC surge / PV surge / internal components failed) | Restart the unit. If error happens again, return to repair center. |

### 3.3 Inverter / DC-DC / LLC Faults

| Code | Fault Description | Troubleshooting |
|---|---|---|
| **34** | Inverter soft start fail | Restart the unit. If error happens again, return to repair center. |
| **32** (LLC) | Over current happen at LLC circuit | Restart the unit. If error happens again, return to repair center. |
| **33** (DCDC) | Over current happen at DCDC circuit | Restart the unit. If error happens again, return to repair center. |
| **40** | DC/DC soft start fail | Restart the unit. If error happens again, return to repair center. |

### 3.4 Output Voltage / Load Faults

| Code | Fault Description | Troubleshooting |
|---|---|---|
| **35** | Output voltage is too low | Reduce the connected load. Restart the unit. If error happens again, return to repair center. |
| **37** | Output voltage is too high | Restart the unit. If error happens again, return to repair center. |
| **—** | Output short circuited | Check if wiring is connected well and remove abnormal load. |
| **—** | Overload time out | Reduce the connected load by switching off some equipment. |

### 3.5 Battery Faults

| Code | Fault Description | Troubleshooting |
|---|---|---|
| **35** | BMS communication fault | Check if the communication line is connected well. |
| **—** | Battery voltage is too high | Check if spec and quantity of batteries meet requirements. |

### 3.6 PV Faults

| Code | Fault Description | Troubleshooting |
|---|---|---|
| **—** | PV voltage is too high | Reduce the number of PV modules in series. |
| **—** | Short circuited happen at PV port | Check if wiring is connected well. |
| **—** | PV power is abnormal | Reduce the number of PV modules. |
| **—** | Over current happen at PV port | Restart the unit. If error happens again, return to repair center. |

### 3.7 Temperature Faults

| Code | Fault Description | Troubleshooting |
|---|---|---|
| **27** | Over temperature happen at convert H circuit | Check air flow of the unit is not blocked and ambient temperature is not too high. |
| **31** | Over temperature happen at LLC TX (internal DC/DC TX) | Check air flow of the unit is not blocked and ambient temperature is not too high. |
| **—** | Over temperature happen at PV circuit | Check air flow of the unit is not blocked and ambient temperature is not too high. |
| **—** | Over temperature happen at battery circuit | Check air flow of the unit is not blocked and ambient temperature is not too high. |
| **—** | Over temperature happen at inverter circuit | Check air flow of the unit is not blocked and ambient temperature is not too high. |
| **—** | The inner temperature over limit | Check air flow of the unit is not blocked and ambient temperature is not too high. |

### 3.8 Communication & Parallel System Faults

| Code | Fault Description | Troubleshooting |
|---|---|---|
| **38** | AC input and output wires are inversely connected | 1. Check AC input/output wire connections.<br>2. For parallel installation, check wiring, finish parallel installation first, then restart.<br>3. If problem remains, contact installer. |
| **39** | Single unit is installed to parallel system | 1. Check if single unit was installed to parallel system.<br>2. For parallel installation, check wiring, finish parallel installation first, then restart.<br>3. If problem remains, contact installer. |
| **41** | CAN data loss | 1. Check communication cables and restart inverter.<br>2. If problem remains, contact installer. |
| **42** | Host data loss | 1. Restart the inverter.<br>2. Check if L/N cables are not connected reversely in all inverters.<br>3. For single-phase parallel: ensure sharing cables connected in all inverters.<br>4. For three-phase: sharing cables connected in same phase, disconnected across phases.<br>5. If problem remains, contact installer. |
| **43** | Synchronization data loss / Current feedback into inverter | Check communication cables and restart inverter. If problem remains, contact installer. |
| **45** | AC output mode setting is different | 1. Check if sharing cables are connected well and restart inverter.<br>2. If problem remains, contact installer. |
| **46** | The output current of each inverter is different | 1. Switch off inverter and check LCD setting program 28.<br>2. For single-phase parallel: no 3P1/3P2/3P3 set on program 28.<br>3. For three-phase: no "PAL" set on program 28.<br>4. If problem remains, contact installer. |
| **—** | Firmware version of each inverter is not the same | 1. Update all inverter firmware to same version.<br>2. Check CPU versions via LCD setting — must match.<br>3. If problem remains, contact installer. |

### 3.9 Sensor & Hardware Faults

| Code | Fault Description | Troubleshooting |
|---|---|---|
| **—** | Fan is locked | Check if wiring is connected well. Replace the fan. |
| **—** | DCDC current sensor failed | Restart the unit. If error happens again, return to repair center. |
| **—** | No.2 DCDC current sensor failed | Restart the unit. If error happens again, return to repair center. |
| **—** | Inverter current sensor failed | Restart the unit. If error happens again, return to repair center. |
| **—** | OP current sensor failed | Restart the unit. If error happens again, return to repair center. |
| **—** | Sharing current sensor failed | Restart the unit. If error happens again, return to repair center. |

---

## 4. Battery Low Voltage / SOC Protection

| Parameter | Condition | Behavior |
|---|---|---|
| **Low DC cut-off voltage / Low SOC** | If battery is the only power source | Inverter will shut down |
| | If PV and battery power are available | Inverter will charge battery without AC output |
| | If PV, battery and utility are all available | Inverter will transfer to line mode and provide output to loads |

### Default Values

| Setting | Default | Range |
|---|---|---|
| Low DC cut-off voltage (Flooded/Self-defined) | 42.0V | 42.0V–54.0V (0.1V steps) |
| Low DC cut-off voltage (Lithium / Lib) | 10% SOC | 10%–100% (5% steps) |
| Battery charging voltage (Self-defined) | 54.0V | 44.0V–54.0V (0.1V steps) |
| Battery floating voltage (Self-defined) | 54.0V | 42.0V–54.0V (0.1V steps) |
| Low SOC discharge stop (Lib) | 0% | 0%–90% (5% steps) |
| Low SOC discharge start (Lib) | 10% | 5%–95% (5% steps) |

---

## 5. BMS Communication Port Pin Assignment (RJ45)

| Pin | Signal |
|---|---|
| 1 | NC |
| 2 | NC |
| 3 | CAN.L |
| 4 | CAN.H |
| 5 | RS485-B |
| 6 | RS485-A |
| 7 | NC |
| 8 | NC |

> **Note:** The BMS communication port only supports Felicitysolar batteries.

---

## 6. RS-232 Communication Port Pin Assignment (RJ45)

| Pin | Signal |
|---|---|
| 1 | RS232 TX |
| 2 | RS232 RX |
| 3 | +12V |
| 4 | GND |
| 5 | NC |
| 6 | NC |
| 7 | NC |
| 8 | GND |

> **Note:** WiFi and RS-232 cannot be connected at the same time. Users need to purchase an RS-232 to USB interface cable to connect to a computer.

---

## 7. Wi-Fi Port Pin Assignment

| Pin | Signal |
|---|---|
| 1 | +VCC |
| 2 | RS232_TXD |
| 3 | RS232_RXD |
| 4 | GND |

---

## 8. General Troubleshooting — Restart Procedure

For most fault codes, the recommended first step is:

1. **Restart the unit** — If the error clears, monitor for recurrence.
2. **If the error happens again** — Return to repair center for professional inspection.
3. **For persistent communication errors** — Check all cable connections first before seeking service.
