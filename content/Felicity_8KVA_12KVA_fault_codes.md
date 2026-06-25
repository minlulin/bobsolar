# Felicity IVEM Series (8KVA~12KVA) — Diagnostic, Warning & Fault Codes

## Models Covered

| Model | Rated Power | Rated Battery Voltage | Max. Charge Current |
|---|---|---|---|
| **IVEM8048-II** | 8000VA / 8000W | 48V | 150A |
| **IVEM12048-II** | 12000VA / 12000W | 48V | 240A |

---

## 1. Diagnostic Information (LCD Display Overview)

### LCD Display Icons

| Icon / Indicator | Description |
|---|---|
| **Li** | Indicates Lithium battery type is selected |
| **C** | Indicates communication is established between inverter and battery |
| **WiFi** | Indicates the Wi-Fi link is active |
| **Smart Load Output** | Indicates the smart load output (Generator port multiplexed) |
| **AC Output** | Indicates the AC output |
| **Generator Input** | Indicates the generator input |
| **PV1 / PV2** | Indicates which PV string is working |

### LED Indicators

| Indicator | State | Meaning |
|---|---|---|
| **Charging** | Solid Green | Battery is full |
| | Flashing Green | Battery is charging |
| | Dim | Battery is not charged |
| **Utility Bypass** | Solid Green | Inverter is running in utility mode |
| | Dim | Inverter is not running in utility mode |
| **Inverter** | Solid Green | Inverter is running in off-grid mode |
| | Dim | Inverter is not running in off-grid mode |
| **Fault / Warning** | Solid Red | Inverter works in fault event |
| | Flashing Red | Inverter works in warning event |
| | Dim | Inverter works normally |

### Generator / Smart Load Base Information

| Display | Description |
|---|---|
| Generator voltage / generator power | e.g. Generator input 230V, 2KW |
| Generator frequency / generator current | e.g. Generator input 60Hz, 8.7A |
| Smart load voltage / smart load power | e.g. Smart load output 230V, 2KW |
| Smart load frequency / smart load current | e.g. Smart load output 60Hz, 8.7A |

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

## 3. Warning Codes (Non-Fault Alarms)

| Code | Warning Description | Indication | Troubleshooting |
|---|---|---|---|
| **04** | Grid anomaly | Grid icon blinking | Check whether the input is overvoltage or overfrequency |
| **05** | Three-phase input missing phase | Fault LED flashing | Check whether the three-phase mains input is normal |
| **06** | The three-phase parallel is abnormal | Fault LED flashing | Verify that the three-phase communication is normal |
| **07** | Generator anomaly | Generator icon blinking | Check whether the input is overvoltage or overfrequency |
| **08** | Three-phase parallel generator input phase deficiency | Fault LED flashing | Check whether the three-phase mains input is normal |
| **80** | The BMS communication is abnormal | Beep once every second | Check whether the BMS communication cable is connected |

---

## 4. Fault Codes & Troubleshooting

### 4.1 AC / Internal Component Faults

| Code | Fault Description | Troubleshooting |
|---|---|---|
| **27** | AC Surge or internal components failed | Restart the unit. If error happens again, return to repair center. |
| **28** | Internal components failed | Restart the unit. If error happens again, return to repair center. |
| **29** | Over current or surge detected by Software | Restart the unit. If error happens again, return to repair center. |
| **30** | Over current or surge detected by Hardware | Restart the unit. If error happens again, return to repair center. |

### 4.2 Bus Voltage Faults

| Code | Fault Description | Troubleshooting |
|---|---|---|
| **31** | Bus voltage is too high | Restart the unit. If error happens again, return to repair center. |
| **32** | Bus voltage is too low | Restart the unit. If error happens again, return to repair center. |
| **33** | Bus soft start fail | Restart the unit. If error happens again, return to repair center. |
| **35** | Overvoltage occurs in BUS (AC surge / PV surge / internal components failed) | Restart the unit. If error happens again, return to repair center. |

### 4.3 Inverter / DC-DC / LLC Faults

| Code | Fault Description | Troubleshooting |
|---|---|---|
| **34** | Inverter soft start fail | Restart the unit. If error happens again, return to repair center. |
| **32** (LLC) | Over current happen at LLC circuit | Restart the unit. If error happens again, return to repair center. |
| **33** (DCDC) | Over current happen at DC/DC circuit | Restart the unit. If error happens again, return to repair center. |
| **34** | DC/DC hardware overflows | Restart the unit. If error happens again, return to repair center. |
| **40** | DC/DC soft start fail | Restart the unit. If error happens again, return to repair center. |

### 4.4 Output Voltage / Load Faults

| Code | Fault Description | Troubleshooting |
|---|---|---|
| **35** | Output voltage is too low | Reduce the connected load. Restart the unit. If error happens again, return to repair center. |
| **37** | Output voltage is too high | Restart the unit. If error happens again, return to repair center. |
| **—** | Output short circuited | Check if wiring is connected well and remove abnormal load. |
| **—** | Overload time out | Reduce the connected load by switching off some equipment. |

### 4.5 Battery Faults

| Code | Fault Description | Troubleshooting |
|---|---|---|
| **80** | BMS communication is abnormal | Check whether the BMS communication cable is connected |
| **—** | Battery voltage is too high | Check if spec and quantity of batteries meet requirements. |

### 4.6 PV Faults

| Code | Fault Description | Troubleshooting |
|---|---|---|
| **—** | PV voltage is too high | Reduce the number of PV modules in series. |
| **—** | Short circuited happen at PV port | Check if wiring is connected well. |
| **—** | PV power is abnormal | Reduce the number of PV modules. |
| **—** | Over current happen at PV port | Restart the unit. If error happens again, return to repair center. |

### 4.7 Temperature Faults

| Code | Fault Description | Troubleshooting |
|---|---|---|
| **31** | Over temperature happen at Convert H circuit | Check air flow of the unit is not blocked and ambient temperature is not too high. |
| **32** | Over temperature happen at LLC TX (internal DC/DC TX) | Check air flow of the unit is not blocked and ambient temperature is not too high. |
| **33** | Over temperature happen at Convert L circuit (battery converter component) | Check air flow of the unit is not blocked and ambient temperature is not too high. |
| **—** | Over temperature happen at INV circuit | Check air flow of the unit is not blocked and ambient temperature is not too high. |
| **—** | Over temperature happen at PV circuit | Check air flow of the unit is not blocked and ambient temperature is not too high. |
| **—** | The inner temperature over limit | Check air flow of the unit is not blocked and ambient temperature is not too high. |

### 4.8 Fan Faults

| Code | Fault Description | Troubleshooting |
|---|---|---|
| **—** | Fan is locked | Check if wiring is connected well. Replace the fan. |

### 4.9 Communication & Parallel System Faults

| Code | Fault Description | Troubleshooting |
|---|---|---|
| **38** | AC input and output wires are inversely connected | 1. Check AC input/output wire connections.<br>2. For parallel installation, check wiring, finish parallel installation first, then restart.<br>3. If problem remains, contact installer. |
| **39** | Single unit is installed to parallel system | 1. Check if single unit was installed to parallel system.<br>2. For parallel installation, check wiring, finish parallel installation first, then restart.<br>3. If problem remains, contact installer. |
| **41** | CAN data loss | 1. Check communication cables and restart inverter.<br>2. If problem remains, contact installer. |
| **42** | Host data loss | 1. Restart the inverter.<br>2. Check if L/N cables are not connected reversely in all inverters.<br>3. For single-phase parallel: ensure sharing cables connected in all inverters.<br>4. For three-phase: sharing cables connected in same phase, disconnected across phases.<br>5. If problem remains, contact installer. |
| **43** | Synchronization data loss / Current feedback into inverter | Check communication cables and restart inverter. If problem remains, contact installer. |
| **44** | The firmware version of each inverter is not the same | 1. Update all inverter firmware to same version.<br>2. Check CPU versions via LCD setting — must match.<br>3. If problem remains, contact installer. |
| **45** | AC output mode setting is different | 1. Check if sharing cables are connected well and restart inverter.<br>2. If problem remains, contact installer. |
| **46** | The output current of each inverter is different | 1. Switch off inverter and check LCD setting program 28.<br>2. For single-phase parallel: no 3P1/3P2/3P3 set on program 28.<br>3. For three-phase: no "PAL" set on program 28.<br>4. If problem remains, contact installer. |

### 4.10 Sensor & Hardware Faults

| Code | Fault Description | Troubleshooting |
|---|---|---|
| **—** | DCDC current sensor failed | Restart the unit. If error happens again, return to repair center. |
| **—** | No.2 DCDC current sensor failed | Restart the unit. If error happens again, return to repair center. |
| **—** | Inverter current sensor failed | Restart the unit. If error happens again, return to repair center. |
| **—** | OP current sensor failed | Restart the unit. If error happens again, return to repair center. |
| **—** | Sharing current sensor failed | Restart the unit. If error happens again, return to repair center. |
| **47** | Generator current sensor failed | Restart the unit. If error happens again, return to repair center. |

---

## 5. Power Derating

### AC Input Derating

| Condition | Behavior |
|---|---|
| AC input voltage drops to **180V** | Output power will be de-rated |
| AC input voltage at **90V** | Output power reduced to **50%** |
| AC input voltage at **180V–280V** | Output power at **Rated Power** (full) |

### DC (Battery) Input Derating

| Condition | Behavior |
|---|---|
| Battery voltage drops to **55V** | Output power will be de-rated |
| Battery voltage at **42V** | Output power reduced to **75.6%** |
| Battery voltage at **55V+** | No derating (full power) |

---

## 6. Default Settings & Parameters

| Setting | Range / Default |
|---|---|
| AC Output Voltage | 220V / **230V (Default)** / 240V |
| AC Output Frequency | **50Hz (Default)** / 60Hz |
| Max. Charge Current (8KVA) | 10A–150A (1A increments), **Default: 60A** |
| Max. Charge Current (12KVA) | 10A–240A (1A increments), **Default: 60A** |
| Max. Discharge Current (8KVA) | 10A–150A (1A increments) |
| Max. Discharge Current (12KVA) | 10A–240A (1A increments) |
| Battery Type | AGM (Default) / Flooded / User-defined / Lib |
| Battery Overcharging Protection | 60V |
| PV Voltage Range | 90V–450V (MPPT: 100V–450V) |
| PV Input Power (8KVA) | 10000W total (5000W per string) |
| PV Input Power (12KVA) | 15000W total (7500W per string) |
| PV Input Current (8KVA) | 20A×2 (MAX 40A) |
| PV Input Current (12KVA) | 27A×2 (MAX 54A) |

---

## 7. Generator Port / Smart Load Configuration (Programs 28–37)

| Program | Setting | Range / Options |
|---|---|---|
| **28-00** | Generator/Smart load port switching | Default: `GEN` (Generator); Switch to `SLd` (Smart Load) with inverter in standby |
| **28-01** | Generator and load smart switching | Enabled by default; if disabled, generator cannot be charged |
| **28-02** | Generator charging enable | Default: Enabled |
| **28-03** | Generator charging power setting | Range: 0.5KW–50KW; **Default: 8KW** |
| **30** | Smart load start time — Hour | 0–23; Default: 0 |
| **31** | Smart load start time — Minute | 0–59; Default: 0 |
| **32** | Smart load end time — Hour | 0–23; Default: 0 |
| **33** | Smart load end time — Minute | 0–59; Default: 0 |
| **34** | Smart load discharge time | 0–990 min (5 min increments); Default: Disabled (`dis`) |
| **35** | Smart load cut-off voltage (User-defined) | 42.0V–54.0V (0.1V steps); Default: 54V |
| **36** | Smart load SOC cut-off (Lithium) | 0%–95% (5% steps); Default: 60% |
| **37** | Turn on second output when back to Line/Bypass Mode | Default: Enabled |

> **Note:** If the battery discharge time reaches the setting in programs 30–33 and program 35 or 36 is not triggered, the smart load output will be turned off.

---

## 8. Communication Port Pin Assignments

### CAN Communication Port (RJ45)

| Pin | Signal |
|---|---|
| 1 | NC |
| 2 | NC |
| 3 | NC |
| 4 | CAN.H |
| 5 | CAN.L |
| 6 | COM-GND |
| 7 | RS485-A |
| 8 | RS485-B |

### RS-485 Communication Port (RJ45)

| Pin | Signal |
|---|---|
| 1 | COM-GND |
| 2 | NC |
| 3 | CAN.L |
| 4 | CAN.H |
| 5 | RS485-B |
| 6 | RS485-A |
| 7 | NC |
| 8 | NC |

### RS-232 Communication Port (RJ45)

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

> **Note:** Users need to purchase an RS-232 to USB interface cable to connect to a computer.

---

## 9. Recommended AC Input Breaker

| Model | Recommended AC Breaker |
|---|---|
| **8KVA (IVEM8048-II)** | 63A |
| **12KVA (IVEM12048-II)** | 100A |

---

## 10. Parallel Capability

| Parameter | Specification |
|---|---|
| Maximum units in parallel | Up to **6 units** |
| Single-phase max. output (8KVA model) | 48KW / 48KVA |
| Single-phase max. output (12KVA model) | 72KW / 72KVA |
| Three-phase support | Yes — up to 6 units; max 4 units per phase |
| Three-phase max. per phase (8KVA model) | 32KW / 32KVA |
| Three-phase max. per phase (12KVA model) | 48KW / 48KVA |

> **Note:** Battery must be connected under parallel operation modes.

---

## 11. Battery Low Voltage / SOC Protection

| Condition | Behavior |
|---|---|
| If battery is the only power source | Inverter will shut down |
| If PV and battery power are available | Inverter will charge battery without AC output |
| If PV, battery and utility are all available | Inverter will transfer to line mode and provide output to loads |

### Default Protection Values

| Setting | Default | Range |
|---|---|---|
| Low DC cut-off voltage (AGM/Flooded/User-defined) | 42.0V | — |
| Low SOC cut-off (Lithium / Lib) | 0% SOC | 0%–90% (5% steps) |
| Low SOC discharge restart (Lithium / Lib) | 30% SOC | 10%–100% (5% steps) |
| Battery charging voltage (User-defined) | 56.4V | — |
| Battery floating voltage (User-defined) | 54.0V | — |

---

## 12. General Troubleshooting — Restart Procedure

For most fault codes, the recommended first step is:

1. **Restart the unit** — If the error clears, monitor for recurrence.
2. **If the error happens again** — Return to repair center for professional inspection.
3. **For persistent communication errors** — Check all cable connections first before seeking service.
