# Diagnostic Flows

## Communication Errors (BMS, CAN, RS485)

### Step 1: Verify Physical Connections
- Check cable is securely connected at both ends
- Inspect for damage, corrosion, or pinching
- Verify cable type (shielded twisted pair for CAN)

### Step 2: Check Termination Resistors
- CAN bus requires 120Ω termination at each end
- Measure resistance across CAN-H and CAN-L (should read ~60Ω with two terminators)
- Add or remove terminators as needed

### Step 3: Verify Voltage Levels
- CAN-H: 2.5V–3.5V (dominant state)
- CAN-L: 1.5V–2.5V (dominant state)
- RS485: Differential voltage between A and B should be ±1.5V to ±5V

### Step 4: Check Configuration
- Verify baud rate matches between devices
- Confirm device addresses are unique
- Check protocol settings (Modbus RTU vs ASCII)

### Step 5: Isolate the Fault
- Disconnect all devices except one pair
- Test communication with minimal configuration
- Reconnect devices one at a time

## Ground Fault Diagnosis

### Step 1: Disconnect All PV Strings
- Turn off DC isolator(s)
- Disconnect all string combiner connections

### Step 2: Test Each String Individually
- Use insulation resistance tester (megger)
- Test at 500V or 1000V DC
- Acceptable: >1MΩ per string
- Record readings for each string

### Step 3: Identify Faulty String
- String with low insulation resistance is the culprit
- Visually inspect connectors, cables, and junction boxes
- Look for moisture, damage, or contamination

### Step 4: Locate the Fault
- Test segments of the faulty string
- Check MC4 connectors for water ingress
- Inspect cable runs for physical damage

## Grid Fault Diagnosis

### Step 1: Measure Grid Parameters
- Voltage (L-N and L-L)
- Frequency
- THD (Total Harmonic Distortion)
- Record over 24 hours if intermittent

### Step 2: Check Inverter Settings
- Verify grid code settings match local requirements
- Check voltage and frequency trip limits
- Confirm anti-islanding settings

### Step 3: Inspect AC Wiring
- Check cable gauge is adequate for current and distance
- Verify all connections are tight
- Look for signs of overheating

### Step 4: Coordinate with Utility
- If grid parameters are out of spec, contact utility
- Request power quality report
- Consider installing power conditioning equipment
