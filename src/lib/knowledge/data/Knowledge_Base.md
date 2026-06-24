# **Comprehensive Knowledge Base and Diagnostic Framework for Solar Inverters in App-Based O\&M Management**

## **Grid-Inverter Coupling and Phase Synchronization Dynamics**

Grid-tied and hybrid solar inverters operate under dynamic electrical constraints imposed by the public utility network. Power grid parameters, specifically voltage and frequency, are subject to real-time fluctuations influenced by localized generation spikes and load variations. When solar installations export power during peak daylight hours, the system encounters localized voltage rise. The line-to-neutral voltage at the inverter output terminals is dictated by the grid's baseline impedance and the injected active current. This relationship is quantified by the electrical impedance equation:

In this interaction, Z represents the complex impedance of the local utility connection. If the grid impedance is excessively high—due to thin conductor cross-sections, corroded utility connections, or long cable lengths—the terminal voltage climbs rapidly. This behavior frequently triggers transient overvoltage protections. For example, in the Australian regulatory framework governed by AS 60038 and AS 4777.2, the nominal grid voltage of 230V carries an upper continuous tolerance of 3%. Sustained ten-minute averages exceeding 253V trigger protective grid overvoltage limits. Field technicians must differentiate between an inherently high grid baseline voltage and localized voltage rise by executing systematic voltage-drop tests. These require logging grid values at the main switchboard with the solar inverter completely isolated.

In multi-phase systems, grid voltage imbalances create additional thermal stress on the inverter's power stages. Phase-voltage differences exceeding standard protective thresholds lead to uneven current distribution across the inverter's internal IGBT bridges, causing localized overheating and subsequent hardware protective shutdowns. Furthermore, transient frequency changes can trigger under-frequency or over-frequency faults. Frequency variations are direct indicators of grid supply-demand imbalances, and standard utility-tied platforms must respond by modulating their power outputs or executing immediate isolation maneuvers to prevent hazardous islanding scenarios.

## **Isolation Diagnostics and Thermal Mitigation Pathways**

The integrity of a solar photovoltaic installation depends heavily on maintaining high DC insulation resistance (Riso) to prevent ground fault currents and hazardous personnel exposure. DC insulation failures occur when the physical barrier between the active DC conductors (positive/negative PV strings) and the grounded structural framework degrades. This degradation is mathematically represented as a parallel resistance network, where the total isolation resistance must remain above a critical threshold:

Riso > 1000MΩ

Under normal operational conditions, dry weather maintains high insulation resistance across the array. However, humidity, rain, and condensation dramatically accelerate insulation failure modes. Water ingress into non-IP rooftop isolators, degraded MC connector seals, or micro-cracked PV module backing sheets provides a low-resistance path to the grounded mounting rails. When the inverter performs its pre-startup insulation test and measures an impedance below the limit (typically 100MΩ to 500MΩ), it triggers an insulation fault and locks out power generation to prevent electrical arcing and personnel shocks.

+--------------------------------------------------------------------------+  
| DIAGNOSTIC ISOLATION FLOW |  
+--------------------------------------------------------------------------+  
 |  
 [Active Isolation Alarm]  
 |  
 v  
 Isolate AC/DC Power Sources  
 |  
 v  
 Measure PV(+) & PV(-) to Earth  
 using a calibrated Megohmmeter  
 |  
 +------------------+------------------+  
 | |  
 [Readings < 100 kOhm] [Readings > 100 kOhm]  
 | |  
 v v  
 Unplug string modules Measure Neutral-to-PE  
 one-by-one to locate impedance at the AC  
 faulty module/run. terminal block (< 10 Ohm).

Thermal management is another critical factor in inverter lifetime and operational reliability. Power electronics convert solar DC into grid-compliant AC, producing heat as a byproduct of switching losses in the IGBTs. If the installation site does not allow sufficient clearance for convective cooling, or if cooling fans are physically obstructed, internal heatsink temperatures will rise rapidly. Modern inverters respond by executing automatic thermal derating—reducing active output power to balance thermal equilibrium—before reaching critical thermal limits and shutting down entirely to protect sensitive silicon dies from catastrophic failure.

## **Growatt SPF Off-Grid and Storage Diagnostic Framework**

The off-grid and storage inverter systems from Growatt, particularly the SPF 5000 ES series, operate using dual low-voltage DC links and high-speed digital communication layers. These platforms require precise hardware configurations to establish closed-loop communication with lithium battery management systems.

| Brand & Series             | Code & Description                 | Meaning (English & Burmese Translation)                                               | Causes & Trigger Mechanisms                                                                                                            | Safety-First Action Plan for Technicians                                                                                                                                                                                                                                                                                                                                                                           | Danger Level & Source |
| :------------------------- | :--------------------------------- | :------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------- |
| **Growatt** SPF Series     | **Fault 20** BMS COM Fault         | BMS Communication Loss (BMS ဆက်သွယ်မှုစနစ် ပြတ်တောက်ခြင်း)                            | Mismatched physical RJ cabling; incorrect serial communication protocol mapping in Menu 05/36; wrong battery DIP switch configuration. | 1. Isolate AC output breakers and DC battery isolators before testing. 2. Fabricate or inspect the communication link to ensure Pin 1 (RS485B) and Pin 2 (RS485A) map correctly, or check CAN High (Pin 4) and CAN Low (Pin 5)17. 3. Access Menu 05, select Lithium ("Li"), and configure Menu 36 to L (for CAN) or L (for RS485)17. 4. Configure the master battery's DIP switches to 1000 (ON, OFF, OFF, OFF)19. | **Minor** 17          |
| **Growatt** SPF Series     | **Fault 04** Low Battery           | Low Battery Voltage (ဘက္ထရီဗို့အား အလွန်ကျဆင်းခြင်း)                                  | Battery pack terminal voltage drops below 42V under continuous load; loose or corroded battery DC cabling.                             | 1. Disconnect high-power DC load fuses. 2. Measure terminal voltage directly at the battery terminal using a calibrated multimeter. 3. Verify that the measured physical voltage matches the LCD screen display; calibrate if the variance exceeds 24V. 4. Apply external charging via utility grid or PV input to restore cells.                                                                                  | **Medium** 20         |
| **Growatt** SPF Series     | **Warning 15** Grid Unsynchronized | Parallel Connection Input Mismatch (အပြိုင်စနစ်အတွင်း မဟာဓာတ်အားလိုင်း မကိုက်ညီခြင်း) | Grid utility input is not fed into parallel units simultaneously at startup; phase alignment mismatch.                                 | 1. Open all AC input breakers to the paralleled array. 2. Power down all units and verify current-sharing cables and parallel communication links are seated correctly. 3. Power up one master unit, navigate to configuration settings, assign parallel modes, then power down. 4. Re-energize all parallel DC and AC switches at the same time to force automatic system synchronization.                        | **Minor** 26          |
| **Growatt** SPF Series     | **Fault 09** Bus Soft Start Fail   | Bus Soft Start Failure (ဘတ်စ်ဗို့အား စတင်မောင်းနှင်မှု ပျက်ကွက်ခြင်း)                 | Short-circuited PV string inputs, faulty high-voltage DC-DC converter stages, or damaged internal capacitors.                          | 1. Turn off all DC switch disconnectors and isolate the utility AC grid. 2. Confirm the absence of hazardous DC voltage at the PV terminals using a voltmeter. 3. Measure internal electrical resistance across the PV input terminals using a multimeter; a low resistance indicates a shorted MPPT stage. 4. Replace internal power boards if diagnostic measurements show a zero-ohm short circuit.             | **Critical** 27       |
| **Growatt** SPF Series     | **Warning 43** Battery Over-Temp   | Battery Over-Temperature (ဘက္ထရီ အပူချိန်လွန်ကဲခြင်း)                                 | Continuous battery operation at extreme charge or discharge rates; insufficient spacing around cell packs.                             | 1. Reduce the inverter’s maximum charging and discharging currents in settings. 2. Read real-time BMS cell temperature telemetry via diagnostic software. 3. Ensure there is at least 20cm clearance to the sides and 30cm above the battery enclosures.                                                                                                                                                           | **Major** 19          |
| **Growatt** Storage Series | **Error 418** Firmware Mismatch    | Firmware Incompatibility (ဖမ်းဝဲလ်ဗားရှင်း ကိုက်ညီမှုမရှိခြင်း)                       | Programming incompatible or mismatched firmware files into parallel-connected storage units.                                           | 1. Turn off the inverter and isolate all communication links. 2. Interlock the PC communication tool using matching RJ interfacing links. 3. Reflash all microcontrollers to matching, validated firmware versions. 4. Run the validation utility to ensure uniform software versions across the system.                                                                                                           | **Medium** 21         |

## **Deye Hybrid Inverter Protective Mechanisms and Alarm Protocols**

Deye hybrid systems are designed for high efficiency and outdoor resilience, featuring advanced multi-phase balancing and low-voltage storage controls. These inverters utilize split-phase output stages that are sensitive to severe neutral imbalances and grounding inconsistencies.

| Brand & Series      | Code & Description           | Meaning (English & Burmese Translation)                                    | Causes & Trigger Mechanisms                                                                                                      | Safety-First Action Plan for Technicians                                                                                                                                                                                                                                                                                                                   | Danger Level & Source |
| :------------------ | :--------------------------- | :------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------- |
| **Deye** SUN Series | **F18** HW AC Over-Current   | AC Overcurrent Hardware Fault (အေစီ လျှပ်စီးကြောင်းလွန်ကဲမှု ဟာ့ဒ်ဝဲအမှား) | Heavy continuous loads connected to the backup output terminal; high inrush currents from large inductive inductive loads.       | 1. Disconnect all emergency and backup loads from the output ports. 2. Confirm insulation resistance across backup lines to isolate downstream AC short circuits. 3. Wait at least 5 minutes to allow internal bus capacitors to discharge. 4. Restart the inverter to determine if the hardware error clears under no-load conditions.                    | **Major** 6           |
| **Deye** SUN Series | **F20** Tz_Dc_OverCurr_Fault | DC Overcurrent Hardware Fault (ဒီစီ လျှပ်စီးကြောင်းလွန်ကဲမှု ဟာ့ဒ်ဝဲအမှား) | Transient PV input surges; battery short circuit; large load startup surges during off-grid operation.                           | 1. Isolate both the DC battery switch and the main PV array disconnectors. 2. Verify physical connections at the battery terminals to ensure proper torque (90Nm)33. 3. Access the battery configuration menu and lower the charge current limit to a safe range (e.g., 30A to 40A)25. 4. Re-energize power inputs after checking wiring paths.            | **Major** 6           |
| **Deye** SUN Series | **F24** DC Insulation Fault  | DC Insulation Impedance Failure (ဒီစီ လျှပ်ကာခုခံမှု အားနည်းခြင်း အမှား)   | Active ground leakage within the PV array; structural damage to insulation jackets; missing or corroded earth connections.       | 1. Disconnect the DC switch to isolate high-voltage solar fields. 2. Confirm the inverter’s Protective Earth (PE) chassis is connected to a low-resistance grounding bus. 3. Measure insulation resistance of the DC conductors to earth using a calibrated insulation tester. 4. Replace damaged solar conductors or moisture-compromised junction boxes. | **Major** 6           |
| **Deye** SUN Series | **F26** Bus Unbalance Fault  | DC Busbar Unbalance Fault (ဒီစီ ဘတ်စ်ဗား ဗို့အား မမျှတခြင်း အမှား)         | Severe load imbalances between split-phase outputs (L vs L2); DC leakage to ground on the power stages.                          | 1. Measure the active load currents of phase L and phase L at the main distribution board. 2. Re-allocate single-phase loads across both legs to balance load distributions. 3. Isolate the AC and DC feeds, wait 5 minutes, then execute a triple-cycle reset to recalibrate internal bus levels.                                                         | **Medium** 6          |
| **Deye** SUN Series | **F56** DC Busbar Low        | DC Busbar Low Voltage (ဒီစီ ဘတ်စ်ဗား ဗို့အား အလွန်နညးနေခြင်း)              | Low battery terminal voltage; excessive continuous power draws; high battery cable resistance; battery reaches shutdown cut-off. | 1. Check battery terminal tightness and measure DC voltage. 2. Ensure parallel battery cables are of equal length and cross-section to balance current distribution. 3. Access the configuration menu and raise the charging limits or adjust the discharge cut-off parameters. 4. Charge the battery using PV inputs or grid power to recover voltage.    | **Medium** 7          |
| **Deye** SUN Series | **F58** BMS Comm Fault       | BMS Communication Fault (BMS ဆက်သွယ်မှု စနစ် ချို့ယွင်းချက်)               | Loose or broken communication wiring; incorrect address mapping when "BMS_Err-Stop" is active.                                   | 1. Isolate communication ports and verify the physical continuity of the CAN/RS485 link. 2. Check that the battery address and matching DIP configurations are set correctly. 3. Temporarily disable the "BMS_Err-Stop" feature on the LCD to maintain basic operation using voltage-based settings if needed.                                             | **Minor** 7           |
| **Deye** SUN Series | **F64** Heatsink High Temp   | Heatsink Over Temperature (အပူစုပ်ရေတိုင်ကီ အပူချိန် အလွန်မြင့်မားခြင်း)   | High ambient workspace temperature (40°C); direct sunlight exposure; cooling fin obstruction.                                    | 1. Visually check clearances around the inverter heatsink. 2. Clear dust, debris, or insect nests blocking passive or active airflow paths. 3. Ensure the inverter is shaded from direct solar radiation. 4. Power down the system for 10 minutes to allow the heatsink to cool before restarting.                                                         | **Medium** 6          |

## **Sungrow SG and SH Series Diagnostics**

Sungrow grid-connected platforms generate continuous operation logs and diagnostic telemetry, accessible via physical LCD screens or the iSolarCloud remote service platform.

| Brand & Series           | Code & Description         | Meaning (English & Burmese Translation)                                    | Causes & Trigger Mechanisms                                                                              | Safety-First Action Plan for Technicians                                                                                                                                                                                            | Danger Level & Source |
| :----------------------- | :------------------------- | :------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------- |
| **Sungrow** SG/SH Series | **010** Islanding          | Grid Failure / Islanding (မဟာဓာတ်အားလိုင်း ချို့ယွင်းချက်)                 | Utility grid blackout; tripped main AC breaker; local utility grid voltage drops to zero.                | 1. Check the local main AC circuit breaker status at the switchboard. 2. Measure baseline AC voltage at the inverter output terminals. 3. The inverter will automatically reconnect when grid parameters return to standard ranges. | **Major** 4           |
| **Sungrow** SG/SH Series | **012** High Leakage       | High Earth Leakage Current (မြေဓာတ်ယိုစိမ့်မှု လျှပ်စီးကြောင်းလွန်ကဲခြင်း) | Water ingress in junction boxes; damaged solar panel cable insulation; wet ground conditions.            | 1. Switch off both DC isolators. 2. Visually inspect rooftop isolators and junction boxes for water ingress. 3. Measure insulation of all strings to locate the leakage path. 4. Do not touch bare metal frames during testing.     | **Major** 4           |
| **Sungrow** SG/SH Series | **039** PV Insulation Low  | Low PV Insulation Resistance (ဆိုလာပြား လျှပ်ကာခုခံမှု အားနည်းခြင်း)       | The system measured insulation resistance below 1 MΩ, typically caused by moisture or cable degradation. | 1. Isolate the inverter DC switch. 2. Use an insulation tester on each string to identify the faulty PV module or conduit. 3. Inspect the cable runs for physical damage or degradation.                                            | **Major** 4           |
| **Sungrow** SG/SH Series | **517** BMS Lost           | Battery Communication Loss (BMS ဆက်သွယ်မှု ပြတ်တောက်ခြင်း)                 | Disrupted communication link between the hybrid inverter and the battery's master BMS.                   | 1. Turn off the inverter, then the battery. 2. Reseat the communication cable at both terminals. 3. Turn on the battery, then power up the inverter to re-establish the communication link.                                         | **Minor** 4           |
| **Sungrow** SG/SH Series | **036** Radiator Temp High | Radiator Over-Temperature (အပူစုပ်ရေတိုင်ကီ အပူချိန် အလွန်မြင့်မားခြင်း)   | Blocked fan ducts; intense continuous direct sunlight; heavy dust coating on cooling fins.               | 1. Clean the dust and debris from cooling radiator fins. 2. Ensure the inverter is shaded. 3. Verify that there is adequate clear space around the unit for air circulation.                                                        | **Medium** 4          |

## **Huawei SUN2000 Screenless Diagnostic Telemetry**

Huawei SUN2000 smart PV controllers feature a screenless design, communicating faults using tri-state LED indicators and real-time alerts on the FusionSolar mobile platform. These systems incorporate an active Arc Fault Circuit Interrupter (AFCI) that scans strings for high-frequency noise signature spikes.

| Brand & Series            | Code & Description                 | Meaning (English & Burmese Translation)                                               | Causes & Trigger Mechanisms                                                                  | Safety-First Action Plan for Technicians                                                                                                                                                                                                                                  | Danger Level & Source |
| :------------------------ | :--------------------------------- | :------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------- |
| **Huawei** SUN2000 Series | **Alarm 2063** Low Isolation       | Low Earth Insulation Impedance (မြေပြင်လျှပ်ကာခုခံမှု အလွန်နည်းခြင်း)                 | Breakdown of string DC cabling insulation; water ingress inside rooftop DC isolator boxes.   | 1. Ensure dry ground conditions and use insulated tools. 2. Switch off AC breaker and DC switch. Measure DC string insulation to ground using a megohmmeter. 3. Plug in strings one at a time to identify the faulty PV string. 4. Check and seal the water entry points. | **Major** 5           |
| **Huawei** SUN2000 Series | **Alarm 2031** DC Arc Fault        | Potential Arc in DC Wiring (ဒီစီ ဆားကစ်အတွင်း လျှပ်စစ်အာ့ခ် ဖြစ်ပေါ်ခြင်း)            | Damaged solar panel cables; loose MC connectors; corroded internal junction box terminals.   | 1. Shutdown the inverter (turn off DC and AC switches)12. 2. Inspect DC wiring runs and connectors for physical damage or burn marks. 3. Re-crimp loose connections, restart, and clear the fault inside the FusionSolar app.                                             | **Major** 5           |
| **Huawei** SUN2000 Series | **Alarm 2064** High Residual Curr  | Earth Leakage Current Over Limit (မြေဓာတ်ယိုစိမ့်မှု လျှပ်စီးကြောင်း အလွန်များခြင်း)  | PV string leakage to ground under high moisture or wet environments; insulation degradation. | 1. Do not touch uninsulated components. 2. Check for water ingress inside MC plugs, DC isolators, or junction boxes. 3. Verify that all components have dry connections and are sealed.                                                                                   | **Major** 12          |
| **Huawei** SUN2000 Series | **Alarm 3001** Abnormal Power Mod  | Battery Power Module Hardware Error (ဘက္ထရီပါဝါထိန်းချုပ်မှုစနစ် ပုံမှန်မဟုတ်ခြင်း)   | Faulty power module; hardware failure within the battery control loop.                       | 1. Send shutdown command via FusionSolar app. 2. Switch off AC, DC, and battery switches sequentially. 3. Wait 5 minutes, then power up in reverse sequence and restart the app interface.                                                                                | **Major** 12          |
| **Huawei** SUN2000 Series | **Alarm 3013** Expansion Mod Error | Expansion Module Communication Loss (ဘက္ထရီ ထပ်တိုးမော်ဂျူး ဆက်သွယ်မှု ပျက်ကွက်ခြင်း) | Cascading cable disconnection; internal electronics failure on the expansion battery packs.  | 1. Power down the system safely and isolate DC feeds. 2. Verify physical connectivity of cascading cables; power up one expansion pack at a time. 3. Replace modules if errors persist.                                                                                   | **Major** 12          |

## **GoodWe Solar Inverter Error Matrices**

GoodWe systems, including the DNS single-phase and ET three-phase hybrid models, utilize specific error flags to signal physical insulation degradation and grid parameter anomalies.

| Brand & Series           | Code & Description            | Meaning (English & Burmese Translation)                                             | Causes & Trigger Mechanisms                                                        | Safety-First Action Plan for Technicians                                                                                                                                                                               | Danger Level & Source |
| :----------------------- | :---------------------------- | :---------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------- |
| **GoodWe** DNS/ET Series | **Isolation Fail** Error 1446 | Low Isolation Resistance (လျှပ်ကာခုခံမှု အားနည်းခြင်း အမှား)                        | Moisture inside rooftop isolators; insulation damage to DC cabling.                | 1. Turn off the DC switch. 2. Measure impedance between PV(+) and PV(-) to earth; if < 100MΩ, check roof wiring runs. 3. Measure Neutral-to-PE impedance at AC terminal; if < 0.5 Ohm, verify the AC wiring integrity. | **Major** 10          |
| **GoodWe** DNS/ET Series | **Ground I Fail** Error 2246  | Ground Fault (Leakage Current) (မြေဓာတ်သို့ လျှပ်စစ်ယိုစိမ့်မှုဖြစ်ခြင်း)           | Active leakage current running from the DC solar panels directly into the earth.   | 1. Disconnect the DC switch immediately. 2. Visually inspect the insulation of all PV string wiring to earth. 3. Repair damaged insulation, reconnect the DC switch, and power-cycle.                                  | **Major** 10          |
| **GoodWe** DNS/ET Series | **Vac Fail** Error 1546       | Grid Voltage Out of Range (လိုင်းဗို့အား အတိုင်းအတာပြင်ပသို့ ရောက်ရှိနေခြင်း အမှား) | Local network over/under voltage limits; loose AC connector contacts.              | 1. Disconnect DC switch and AC isolator. 2. Measure voltage between Line and Neutral on the AC terminal block. 3. If out of specification, check grid configuration or contact the utility provider.                   | **Medium** 10         |
| **GoodWe** DNS/ET Series | **Utility Loss** Error 2346   | Grid Connection Loss (မဟာဓာတ်အားလိုင်း ဆက်သွယ်မှု ပြတ်တောက်ခြင်း)                   | Solar main breaker or AC isolator is off; grid blackout; loose AC terminal wiring. | 1. Turn off the DC switch. 2. Check if the Solar Supply Main Switch and local AC isolators are turned on. 3. Measure AC voltage across L and N terminals to verify grid presence.                                      | **Medium** 10         |

## **Felicity Solar Hybrid and Battery Storage Diagnostics**

Felicity Solar systems use high-current, low-voltage power topologies with programmable dry contacts and parallel multi-unit architectures. These configurations require matching neutral bonds and shared active power parameters.

| Brand & Series           | Code & Description         | Meaning (English & Burmese Translation)                                | Causes & Trigger Mechanisms                                           | Safety-First Action Plan for Technicians                                                                                                                                                                               | Danger Level & Source |
| :----------------------- | :------------------------- | :--------------------------------------------------------------------- | :-------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------- |
| **Felicity** IVEM Series | **Warning 80** BMS Lost    | BMS CAN/RS485 Connection Failure (BMS ဆက်သွယ်မှု လိုင်းချို့ယွင်းချက်) | Loose RJ connections; mismatched baud rate; protocol selection error. | 1. De-energize the AC and DC breakers. 2. Check the RJ pinout mapping. 3. Check the battery address and parallel configuration settings. 4. Ensure communications cables are separated from high-current power cables. | **Minor** 30          |
| **Felicity** IVEM Series | **Error 08** Bus Over-Volt | DC Busbar High Voltage (ဘတ်စ်ဗား ဗို့အား အလွန်မြင့်မားခြင်း)           | Sudden load drops; internal surge; component failure.                 | 1. Isolate the system completely and let it sit for 5 minutes. 2. Restart the unit and check the bus voltage on the screen. 3. If the error persists, check internal capacitors and components.                        | **Major** 30          |
| **Felicity** IVEM Series | **Error 09** Bus Soft Fail | Bus Soft Start Fail (ဘတ်စ်ဗား ဖြည်းညှင်းစွာ စတင်မှုမအောင်မြင်ခြင်း)    | Internal hardware short circuit; output bridge failure.               | 1. Turn off the DC and AC breakers. 2. Check the PV input terminals for short circuits. 3. If the error remains after restarting, the main power board may need to be replaced.                                        | **Critical** 30       |
| **Felicity** IVEM Series | **Error 07** Overload      | Overload Timeout (ဝန်အားလွန်ကဲမှု အချိန်ကျော်လွန်သွားခြင်း)            | Load connected exceeds the inverter's rated capacity.                 | 1. Disconnect high-power appliances and reduce active load. 2. Check for short circuits in the load lines. 3. Clear the alarm and restart the inverter.                                                                | **Medium** 30         |
| **Felicity** LPBF Series | **F09** Cell High Temp     | Battery Cell High Temperature (ဘက္ထရီဆဲလ် အပူချိန် အလွန်မြင့်မားခြင်း) | Long-term high-power operation in a hot environment.                  | 1. Disconnect the battery loads. 2. Let the system cool down. 3. Verify the battery room's temperature and cooling ventilation.                                                                                        | **Major** 29          |

## **Must Power and Voltronic Axpert Diagnostics and Hardware Repair Protocols**

Off-grid inverters from Must Power and Voltronic Axpert series share a common high-voltage bus design. This architecture is sensitive to imbalances in the battery link and DC input surges.

| Brand & Series              | Code & Description     | Meaning (English & Burmese Translation)                                    | Causes & Trigger Mechanisms                                                             | Safety-First Action Plan for Technicians                                                                                                                                                                                                 | Danger Level & Source |
| :-------------------------- | :--------------------- | :------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------- |
| **Voltronic** Axpert Series | **Error 08** Bus High  | DC Busbar High Voltage (ဒီစီဘတ်စ်ဗား ဗို့အား မြင့်မားလွန်းခြင်း)           | Large load disconnects; uneven battery cable lengths causing voltage spikes under load. | 1. Disconnect the PV inputs and run the unit on battery power alone. 2. Check the battery cables and verify positive and negative lengths are identical. 3. Measure the bus voltage and verify accuracy within 2% of the screen display. | **Major** 16          |
| **Voltronic** Axpert Series | **Error 09** Soft Fail | Bus Soft Start Failed (ဘတ်စ်ဗား ဖြည်းညှင်းစွာ စတင်မှုမအောင်မြင်ခြင်း)      | Shorted internal high-voltage IGBTs (QB, QA1); damaged gate drivers.                    | 1. Isolate the AC grid and disconnect all DC power sources. 2. Desolder and test the IGBTs for short circuits. 3. Check the gate resistors and ACPL gate driver pins for continuity.                                                     | **Critical** 16       |
| **Voltronic** Axpert Series | **Error 51** Surge     | Overcurrent / System Surge (လျှပ်စီးကြောင်းလွန်ကဲမှု လှိုင်းသက်ရောက်ခြင်း) | Large appliance startup surges; internal power board component failure.                 | 1. Isolate and turn off the inverter. 2. Check the output lines for short circuits. 3. Inspect the main board for physical damage or burnt components before restarting.                                                                 | **Critical** 54       |

## **ChatBot Integration Architecture and Logic Trees**

Implementing this diagnostic database into an app-based O\&M chatbot requires structured search pathways and logical flows to ensure safety and accuracy.

                +---------------------------------------+
                |         TECHNICIAN SEARCH INPUT       |
                +---------------------------------------+
                                    |
                                    v
                +---------------------------------------+
                |        SELECT INVERTER BRAND          |
                |  (Felicity, Growatt, Sungrow, etc.)   |
                +---------------------------------------+
                                    |
                                    v
                +---------------------------------------+
                |         SELECT MODEL SERIES           |
                +---------------------------------------+
                                    |
                                    v
                +---------------------------------------+
                |          ENTER ERROR CODE             |
                +---------------------------------------+
                                    |
                                    v
                +---------------------------------------+
                |      ISOLATE PROTOCOL & MEANINGS      |
                |          (English & Burmese)          |
                +---------------------------------------+
                                    |
                  +-----------------+-----------------+
                  |                                 |
         [DANGER LEVEL: HIGH]                [DANGER LEVEL: LOW]
                  |                                 |
                  v                                 v
     +---------------------------+       +---------------------------+
     |  \*MANDATORY SAFETY POPUP\* |       |    Provide Standard O\&M   |
     |  Display Lockout/Tagout   |       |   Step-by-Step Guidance   |
     |  instructions and PPE req |       |      from the database    |
     \+---------------------------+       +---------------------------+
                                    |
                                    v
     +---------------------------+
     |  Proceed to standard step-|
     |   by-step actions once    |
     |   safety is acknowledged  |
     \---------------------------+

### **Cascade Search Indexing**

To prevent the chatbot from returning mismatched information across different brands (for example, explaining Voltronic's Error 08 bus fault when a technician queries a Felicity Solar battery cell temperature fault29), the bot's database must follow a strict search hierarchy:

This ensures that queries for "09" are mapped accurately to either a bus soft start error on a Voltronic platform or a high cell temperature warning on a Felicity battery system.

### **Automated Safety Protocols**

For any diagnostic code classified with a **Major** or **Critical** danger level (such as arc faults, ground leakage, insulation failures, or soft-start errors)4, the chatbot must display a mandatory safety pop-up before showing standard troubleshooting steps:  
**⚠️ CRITICAL LIFE SAFETY WARNING (အန္တရာယ်ရှိသည်):** High-voltage DC circuits can cause severe shock or death. Do not touch or work on exposed conductors under load. Ensure proper PPE (such as Class 0 insulated gloves and safety glasses) is worn, and verify the system is locked out and tagged out (LOTO) before proceeding.

### **Standardized Verification Steps**

For communication errors (such as Growatt's Fault 2017 or Deye's F587), the chatbot should guide the technician through a structured logical flow:

- Verify the physical continuity and shields of the network cabling.
- Confirm correct pin configurations (Pin 1 and 2 for RS485 systems; Pin 4 and 5 for CAN-bus setups22).
- Verify the master-slave DIP switch settings match the corresponding manuals.
- Validate that selected protocols match the battery chemistry and BMS firmware versions.

## **General Troubleshooting** Without Error Codes

When a solar inverter faces daily issues without displaying an error code, it often stems from external factors or subtle faults.

| Brand & Series | Code & Description | Meaning | Causes | Action Plan | Danger Level |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **All Brands** Universal | **Glitch** System Unresponsive | Blank screen or hung software without error code | Minor software glitch, ghost issue, or temporary communication hang | 1. Turn off AC disconnect. 2. Turn off DC disconnect. 3. Wait 5-10 minutes for capacitors to discharge. 4. Turn DC back on, then AC. | Minor |
| **All Brands** Universal | **Drop** Intermittent Daily Drop | Intermittent issues, fluctuating power during day | Loose, corroded, or damaged wiring expanding/contracting with heat | 1. Inspect DC MC4 connectors. 2. Check AC terminals. 3. Ensure solar supply breaker isn't loose. | Moderate |
| **All Brands** Universal | **Derating** Midday Power Drop | Inverter derating (reducing power) or shutting down | Overheating due to direct sunlight, poor ventilation, dust, or bird nests | 1. Check inverter placement. 2. Clear dust/debris from cooling fans and heat sinks. | Minor |
| **All Brands** Universal | **Standby** Stuck in Standby | Inverter stuck in standby mode | Grid voltage too high or unstable, preventing connection | 1. Check grid voltage via online monitoring. 2. Contact utility if voltage is out of spec. | Moderate |
| **All Brands** Universal | **Wake** Morning Startup Fail | Inverter struggles to wake up in the morning | Fails to reach start-up voltage due to partial shading, dust on panels, or faulty string | 1. Clean solar panels. 2. Check for new shading (trees). 3. Test string voltage. | Minor |
| **All Brands** Universal | **Noise** Unusual Noises | Buzzing, clicking, or humming without code | Failing internal components like relays or inductors | 1. Do not open casing. 2. Contact a professional technician for replacement. | Major |
