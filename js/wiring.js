/**
 * Smart Cooling Vest - Interactive Circuit & Wiring Architecture Visualizer
 * Renders SVG circuit schematic, handles wire hover/inspection,
 * displays pinout maps and safety interlock statuses.
 */

class VestWiringInspector {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.selectedNode = null;
    this.init();
  }

  init() {
    if (!this.container) return;
    this.renderSchematicSVG();
    this.bindInteractions();
  }

  renderSchematicSVG() {
    const svgHTML = `
      <svg id="schematic-svg" viewBox="0 0 950 580" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <linearGradient id="grad-esp32" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f291e" />
            <stop offset="100%" stop-color="#051710" />
          </linearGradient>
          <linearGradient id="grad-batt" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0284c7" />
            <stop offset="100%" stop-color="#03496d" />
          </linearGradient>
        </defs>

        <!-- Background grid lines -->
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
        </pattern>
        <rect width="950" height="580" fill="url(#grid)" />

        <!-- ================= WIRES & BUSES ================= -->
        <!-- 12V Main Power Rail (Thick Red) -->
        <path id="wire-12v-rail" d="M 120 110 L 260 110 L 260 80 L 760 80 L 760 180" 
              fill="none" stroke="#ff3344" stroke-width="4" stroke-linecap="round" />
        <path d="M 260 80 L 480 80 L 480 180" fill="none" stroke="#ff3344" stroke-width="3" />
        <path d="M 260 110 L 260 250 L 320 250" fill="none" stroke="#ff3344" stroke-width="3" />

        <!-- GND Rail (Black/Dark Grey) -->
        <path id="wire-gnd-rail" d="M 120 150 L 230 150 L 230 520 L 860 520 L 860 260" 
              fill="none" stroke="#64748b" stroke-width="4" stroke-dasharray="4,2" />
        <path d="M 230 290 L 320 290" fill="none" stroke="#64748b" stroke-width="2" />
        <path d="M 230 480 L 410 480 L 410 440" fill="none" stroke="#64748b" stroke-width="2" />
        <path d="M 480 260 L 480 520" fill="none" stroke="#64748b" stroke-width="2" />

        <!-- 5V Buck Output (Orange) -->
        <path id="wire-5v" d="M 400 270 L 440 270 L 440 330 L 490 330" 
              fill="none" stroke="#f97316" stroke-width="3" />

        <!-- 3.3V Sensor Rail (Yellow) -->
        <path id="wire-3v3" d="M 610 330 L 680 330 L 680 430 L 720 430" 
              fill="none" stroke="#eab308" stroke-width="2.5" />
        <path d="M 680 430 L 680 500 L 720 500" fill="none" stroke="#eab308" stroke-width="2" />

        <!-- I2C Bus: SDA / SCL (Cyan / Purple) -->
        <path id="wire-sda" d="M 610 370 L 690 370 L 690 450 L 720 450" 
              fill="none" stroke="#00f0ff" stroke-width="2" />
        <path d="M 690 450 L 690 520 L 720 520" fill="none" stroke="#00f0ff" stroke-width="1.5" />

        <path id="wire-scl" d="M 610 390 L 700 390 L 700 470 L 720 470" 
              fill="none" stroke="#a855f7" stroke-width="2" />
        <path d="M 700 470 L 700 540 L 720 540" fill="none" stroke="#a855f7" stroke-width="1.5" />

        <!-- PWM Fan Signal (Green) -->
        <path id="wire-fan-pwm" d="M 610 350 L 730 350 L 730 230 L 760 230" 
              fill="none" stroke="#10b981" stroke-width="2.5" />
        <path d="M 730 230 L 730 200 L 760 200" fill="none" stroke="#10b981" stroke-width="2" />

        <!-- PWM Peltier Signal (Magenta) -->
        <path id="wire-tec-pwm" d="M 550 310 L 550 240 L 520 240" 
              fill="none" stroke="#ec4899" stroke-width="2.5" />

        <!-- ================= COMPONENTS ================= -->

        <!-- 1. BATTERY PACK & BMS -->
        <g id="comp-battery" class="schematic-node" cursor="pointer">
          <rect x="30" y="80" width="90" height="90" rx="8" fill="url(#grad-batt)" stroke="#38bdf8" stroke-width="2" />
          <text x="75" y="112" fill="#fff" font-size="12" font-weight="700" text-anchor="middle">3S Li-ion</text>
          <text x="75" y="128" fill="#bae6fd" font-size="10" text-anchor="middle">11.1V 7000mAh</text>
          <text x="75" y="146" fill="#00ff88" font-size="9" font-family="monospace" text-anchor="middle">BMS Protected</text>
          <circle cx="120" cy="110" r="4" fill="#ff3344" />
          <text x="110" y="105" fill="#ff3344" font-size="10" font-weight="bold">+</text>
          <circle cx="120" cy="150" r="4" fill="#64748b" />
          <text x="110" y="160" fill="#cbd5e1" font-size="10" font-weight="bold">-</text>
        </g>

        <!-- PTC Fuse -->
        <g id="comp-fuse" class="schematic-node" cursor="pointer">
          <rect x="155" y="98" width="50" height="24" rx="4" fill="#1e293b" stroke="#eab308" stroke-width="1.5" />
          <text x="180" y="114" fill="#eab308" font-size="10" font-weight="bold" text-anchor="middle">PTC 5A</text>
        </g>

        <!-- 2. BUCK CONVERTER (12V to 5V 3A) -->
        <g id="comp-buck" class="schematic-node" cursor="pointer">
          <rect x="320" y="230" width="80" height="75" rx="6" fill="#1e293b" stroke="#f97316" stroke-width="1.5" />
          <text x="360" y="255" fill="#f97316" font-size="11" font-weight="bold" text-anchor="middle">BUCK CONV</text>
          <text x="360" y="272" fill="#cbd5e1" font-size="9" text-anchor="middle">12V -> 5V 3A</text>
          <text x="360" y="290" fill="#94a3b8" font-size="8" text-anchor="middle">MP1584 Synch</text>
        </g>

        <!-- 3. ESP32 MICROCONTROLLER -->
        <g id="comp-esp32" class="schematic-node" cursor="pointer">
          <rect x="490" y="310" width="120" height="150" rx="8" fill="url(#grad-esp32)" stroke="#10b981" stroke-width="2" />
          <text x="550" y="338" fill="#fff" font-size="13" font-weight="bold" text-anchor="middle">ESP32-WROOM</text>
          <text x="550" y="354" fill="#6ee7b7" font-size="9" text-anchor="middle">Dual-Core 240MHz</text>

          <!-- ESP32 Pin Labels -->
          <text x="500" y="334" fill="#f97316" font-size="9" font-family="monospace">5V</text>
          <text x="500" y="440" fill="#64748b" font-size="9" font-family="monospace">GND</text>
          <text x="600" y="334" fill="#eab308" font-size="9" font-family="monospace" text-anchor="end">3V3</text>
          <text x="600" y="354" fill="#10b981" font-size="9" font-family="monospace" text-anchor="end">G18 (FAN)</text>
          <text x="600" y="374" fill="#00f0ff" font-size="9" font-family="monospace" text-anchor="end">G21 (SDA)</text>
          <text x="600" y="394" fill="#a855f7" font-size="9" font-family="monospace" text-anchor="end">G22 (SCL)</text>
          <text x="600" y="414" fill="#ec4899" font-size="9" font-family="monospace" text-anchor="end">G25 (TEC)</text>
          <text x="550" y="425" fill="#38bdf8" font-size="9" text-anchor="middle">FreeRTOS Tasks</text>
        </g>

        <!-- 4. PELTIER TEC MODULE + MOSFET DRIVER -->
        <g id="comp-peltier" class="schematic-node" cursor="pointer">
          <rect x="450" y="160" width="90" height="90" rx="6" fill="#1e1e2f" stroke="#ec4899" stroke-width="1.5" />
          <text x="495" y="185" fill="#ec4899" font-size="11" font-weight="bold" text-anchor="middle">PELTIER TEC</text>
          <text x="495" y="202" fill="#fff" font-size="9" text-anchor="middle">TEC1-12706</text>
          <text x="495" y="218" fill="#cbd5e1" font-size="8" text-anchor="middle">Spine Cold Plate</text>
          <rect x="475" y="228" width="40" height="14" rx="2" fill="#2d1b40" stroke="#ec4899" stroke-width="1"/>
          <text x="495" y="239" fill="#f472b6" font-size="8" text-anchor="middle">LC Filter</text>
        </g>

        <!-- 5. DUAL CENTRIFUGAL BLOWER FANS -->
        <g id="comp-fans" class="schematic-node" cursor="pointer">
          <rect x="760" y="160" width="130" height="85" rx="8" fill="#0f172a" stroke="#00f0ff" stroke-width="2" />
          <text x="825" y="184" fill="#00f0ff" font-size="11" font-weight="bold" text-anchor="middle">DUAL BLOWERS</text>
          <text x="825" y="200" fill="#fff" font-size="9" text-anchor="middle">9733 Lower Torso (12V)</text>
          <text x="825" y="216" fill="#94a3b8" font-size="8" text-anchor="middle">38 CFM Static Pressure</text>
          <text x="825" y="232" fill="#10b981" font-size="8" font-family="monospace" text-anchor="middle">GPIO18 (PWM 25kHz)</text>
        </g>

        <!-- 5.1 DUAL SHOULDER MICRO-TURBOFANS (NEW!) -->
        <g id="comp-shoulder-fans" class="schematic-node" cursor="pointer">
          <rect x="760" y="260" width="130" height="85" rx="8" fill="#0f172a" stroke="#10b981" stroke-width="2" />
          <text x="825" y="284" fill="#10b981" font-size="11" font-weight="bold" text-anchor="middle">SHOULDER FANS (x2)</text>
          <text x="825" y="300" fill="#fff" font-size="9" text-anchor="middle">5015 Face & Neck Blowers</text>
          <text x="825" y="316" fill="#94a3b8" font-size="8" text-anchor="middle">เป่าคอ/คาง ไม่ต้องถือพัดลม</text>
          <text x="825" y="332" fill="#00f0ff" font-size="8" font-family="monospace" text-anchor="middle">GPIO26 (PWM 25kHz)</text>
        </g>

        <!-- 5.2 BATTERY DEDICATED THERMAL MANAGEMENT (BTMS) (NEW!) -->
        <g id="comp-batt-cooling" class="schematic-node" cursor="pointer">
          <rect x="30" y="200" width="180" height="70" rx="8" fill="#0c1929" stroke="#38bdf8" stroke-width="2" />
          <text x="120" y="222" fill="#38bdf8" font-size="11" font-weight="bold" text-anchor="middle">BATTERY COOLING (BTMS)</text>
          <text x="120" y="238" fill="#fff" font-size="9" text-anchor="middle">Graphene Pad + Al Heatsink</text>
          <text x="120" y="254" fill="#94a3b8" font-size="8" text-anchor="middle">NTC Sensor (GPIO39) + Air Duct</text>
        </g>

        <!-- 6. SENSOR NODES (I2C) -->
        <g id="comp-bme280" class="schematic-node" cursor="pointer">
          <rect x="720" y="415" width="160" height="55" rx="6" fill="#111827" stroke="#eab308" stroke-width="1.5" />
          <text x="800" y="437" fill="#eab308" font-size="11" font-weight="bold" text-anchor="middle">BME280 SENSOR (I2C)</text>
          <text x="800" y="454" fill="#cbd5e1" font-size="9" text-anchor="middle">Temp / Humidity / Dew Point (0x76)</text>
        </g>

        <g id="comp-health-sensors" class="schematic-node" cursor="pointer">
          <rect x="720" y="490" width="160" height="60" rx="6" fill="#111827" stroke="#a855f7" stroke-width="1.5" />
          <text x="800" y="512" fill="#a855f7" font-size="11" font-weight="bold" text-anchor="middle">BIOMETRIC & IMU</text>
          <text x="800" y="528" fill="#cbd5e1" font-size="9" text-anchor="middle">MAX30102 PPG (0x57) Heart Rate</text>
          <text x="800" y="542" fill="#94a3b8" font-size="9" text-anchor="middle">MPU6050 Fall Detect (0x68)</text>
        </g>

        <!-- Legend Callouts -->
        <g transform="translate(40, 480)">
          <rect width="160" height="70" rx="6" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.1)" />
          <text x="12" y="18" fill="#94a3b8" font-size="10" font-weight="bold">WIRE COLOR CODING:</text>
          <circle cx="18" cy="32" r="4" fill="#ff3344" />
          <text x="28" y="35" fill="#cbd5e1" font-size="9">12V Power Bus</text>
          <circle cx="18" cy="46" r="4" fill="#f97316" />
          <text x="28" y="49" fill="#cbd5e1" font-size="9">5V Logic Bus</text>
          <circle cx="18" cy="60" r="4" fill="#00f0ff" />
          <text x="28" y="63" fill="#cbd5e1" font-size="9">PWM / I2C Bus</text>
        </g>
      </svg>
    `;

    this.container.innerHTML = svgHTML;
  }

  bindInteractions() {
    const nodes = this.container.querySelectorAll('.schematic-node');
    const infoPanel = document.getElementById('schematic-detail-card');

    const details = {
      'comp-battery': {
        title: '3S Li-ion Battery & Hardware BMS',
        specs: '11.1V Nominal (12.6V Peak) | 7,000 mAh Capacity (3S2P 18650)',
        safety: 'BMS ป้องกัน Over-charge (4.25V), Over-discharge (2.8V), Over-current (10A trip) พร้อม NTC เช็คความร้อนแบตเตอรี่ตัดไฟที่ 60°C',
        wiring: 'ขั้วสายซิลิโคน 18 AWG ทนกระแส 15A ผ่านขั้วต่อกันน้ำ XT30'
      },
      'comp-fuse': {
        title: '5A Resettable PTC Fuse (PolySwitch)',
        specs: 'Trip Current: 5.0A | Hold Current: 2.5A | Max Voltage: 16V',
        safety: 'ตัดวงจรทันทีเมื่อเกิด Short Circuit ภายใน 50ms และคืนสภาพอัตโนมัติเมื่ออุณหภูมิลดลง ป้องกันสายไฟไหม้จากเหงื่อหรือการลัดวงจร',
        wiring: 'อนุกรมคั่นระหว่างขั้วบวกแบตเตอรี่กับบัสจ่ายไฟหลัก'
      },
      'comp-buck': {
        title: 'Synchronous Step-Down Buck Converter (MP1584)',
        specs: 'Input: 7V - 28V | Output: 5.0V DC (±1%) | Eff: 92% | Current: Up to 3.0A',
        safety: 'แยกภาคจ่ายไฟ Microcontroller ไม่ให้สัญญาณรบกวนจากมอเตอร์พัดลมเข้ามารบกวนระบบประมวลผล',
        wiring: 'Input รับ 12V Main Rail -> Output จ่ายเข้าขา VIN ของ ESP32'
      },
      'comp-esp32': {
        title: 'ESP32-WROOM-32E Central Processing Unit',
        specs: 'Xtensa Dual-Core 32-bit 240MHz | 520KB SRAM | BLE 5.0 & Wi-Fi',
        safety: 'มี Hardware Watchdog Timer (WDT) รีเซ็ตหากโปรแกรมค้าง และระบบ Safe-State ปิดพัดลมและ Peltier ทันทีหาก MCU ไม่ตอบสนอง',
        wiring: 'GPIO18 (PWM พัดลม), GPIO25 (PWM Peltier), GPIO21/22 (I2C Bus), GPIO34 (ADC วัดแรงดันแบต), GPIO4 (Buzzer Alarm)'
      },
      'comp-peltier': {
        title: 'Spine Thermoelectric Cooler (TEC1-12706)',
        specs: 'Vmax: 12V | Imax: 4.5A (จำกัดที่ 2.5A เพื่อ Max COP) | Qmax: 35W',
        safety: 'ควบคุมผ่าน Dew-Point Watchdog Algorithm: ปรับกำลังไฟไม่ให้อุณหภูมิเพลทต่ำกว่าจุดน้ำค้าง เพื่อกันเหงื่อหรือไอน้ำกลั่นตัวซึมเข้าเสื้อ',
        wiring: 'ขับด้วย N-MOSFET IRLZ44N พร้อมวงจรกรอง LC Filter (L=47uH, C=470uF) ป้อนกระแส DC เรียบ ยืดอายุการใช้งานแผ่น Peltier'
      },
      'comp-fans': {
        title: 'Dual 9733 High-Pressure Brushless Blowers (ลำตัว & หลัง)',
        specs: '12V DC | 0.85A per fan | 5,400 RPM | 38 CFM High Static Pressure',
        safety: 'พัดลมหอยโข่งแบบกันฝุ่น/ละอองน้ำ มีตะแกรงกันเศษผ้าหรือวัตถุแปลกปลอมดูดเข้า มี Flyback Schottky Diode (SS34) ป้องกันไฟย้อน',
        wiring: 'ขับด้วย PWM 25kHz (GPIO18) ตามมาตรฐาน 4-Wire Fan มีขา Tachometer (GPIO19) ส่ง Pulse วัดรอบ RPM จริงกลับมายัง ESP32'
      },
      'comp-shoulder-fans': {
        title: 'Dual 5015 Shoulder / Collar Micro-Turbofans (บ่าไหล่เป่าหน้า/คอ)',
        specs: '12V DC | 0.25A per fan | 5,000 RPM | องศาเป่าขึ้น 45° สู่ใบหน้าและต้นคอ',
        safety: 'ออกแบบช่อง Louver ป้องกันเส้นผมดูดเข้าใบพัด มีวงจร Soft-Start และตะแกรงเซฟตี้คู่ สามารถเลือกเปิด/ปิดแยกอิสระได้ ผู้ใช้ไม่ต้องถือพัดลมมือถือหรือคล้องคอเพิ่มอีกต่อไป',
        wiring: 'ขับด้วยสัญญาณ PWM 25kHz จาก GPIO 26 ผ่าน Logic N-MOSFET (AO3400A) แยกโซนอิสระจากพัดลมลำตัว'
      },
      'comp-batt-cooling': {
        title: 'Battery Thermal Management System (BTMS - ระบบระบายความร้อนแบตเตอรี่โดยเฉพาะ)',
        specs: 'Graphene Thermal Spreader Sheet + Anodized Aluminum Heatsink + Forced Air Bypass Channel',
        safety: 'แบตเตอรี่ลิเธียมมีโอกาสร้อนสะสมสูงเมื่อจ่ายกระแสหนักกลางแดดจัด ระบบติดตั้งแผ่นกราฟีนเกลี่ยความร้อน ฮีตซิงก์ดึงความร้อน และดึงลมเย็นจากพัดลมมาระบายความร้อนแบตเตอรี่โดยตรง พร้อม NTC Sensor (GPIO 39) สั่งเร่งความเย็นหากอุณหภูมิแบตเตอรี่เกิน 38°C ป้องกันแบตเตอรี่เสื่อมสภาพหรือ Thermal Runaway อย่างปลอดภัย 100%',
        wiring: 'NTC 10K Thermistor แปะติดผิวเซลล์แบตเตอรี่ เชื่อมเข้าขา ADC GPIO 39 (ADC1_CH3)'
      },
      'comp-bme280': {
        title: 'BME280 Environmental Sensor Module',
        specs: 'Temp: -40 to +85°C (±0.5°C) | Humidity: 0 to 100% RH (±3%) | Pressure',
        safety: 'ติดตั้งในช่องกระเป๋าภายนอกที่มีแผ่นเยื่อ Gore-Tex ระบายอากาศกันน้ำเข้า เพื่อวัดอุณหภูมิและความชื้นแวดล้อมที่แท้จริง',
        wiring: 'เชื่อมต่อผ่าน I2C Bus (SDA: GPIO21, SCL: GPIO22) ใช้ไฟ 3.3V จาก LDO'
      },
      'comp-health-sensors': {
        title: 'MAX30102 PPG Biometric & MPU6050 Motion Sensor',
        specs: 'Heart Rate (BPM), SpO2 (%) + 6-Axis Accelerometer / Gyroscope',
        safety: 'ตรวจจับภาวะหัวใจเต้นเร็วผิดปกติจากโรคลมแดด (Heat Stroke Tachycardia) และตรวจจับแรงกระแทก/การล้มของผู้ปฏิบัติงาน (Fall Detection)',
        wiring: 'I2C Bus ร่วม พร้อมสายสัญญาณชีวภาพชีลด์ป้องกันคลื่นรบกวน'
      }
    };

    const showDetails = (id, isClick = false) => {
      const d = details[id];
      if (d && infoPanel) {
        if (isClick) {
          nodes.forEach(n => n.classList.remove('selected'));
          const targetNode = document.getElementById(id);
          if (targetNode) targetNode.classList.add('selected');
        }
        infoPanel.innerHTML = `
          <div style="border-left: 3px solid var(--accent-cyan); padding-left: 12px; margin-bottom: 12px;">
            <div style="font-size: 10px; font-family: var(--font-mono); color: var(--accent-cyan); text-transform: uppercase; margin-bottom: 2px;">
              ${isClick ? '🔒 ล็อกการตรวจสอบ (LOCKED)' : '🔍 กำลังตรวจสอบ (INSPECTING)'}
            </div>
            <h3 style="font-size: 16px; color: #fff; margin-bottom: 4px; font-weight: 700;">${d.title}</h3>
            <p style="font-size: 11px; color: var(--accent-cyan); font-family: var(--font-mono); line-height: 1.4;">${d.specs}</p>
          </div>
          <div style="margin-bottom: 10px; background: rgba(0,0,0,0.25); padding: 8px 10px; border-radius: 6px; border-left: 3px solid var(--accent-green);">
            <span style="font-size: 11px; font-weight: 700; color: var(--accent-green); text-transform: uppercase;">🛡️ มาตรฐานความปลอดภัย & การป้องกัน:</span>
            <p style="font-size: 12px; color: #cbd5e1; margin-top: 3px; line-height: 1.5;">${d.safety}</p>
          </div>
          <div style="background: rgba(0,0,0,0.25); padding: 8px 10px; border-radius: 6px; border-left: 3px solid var(--accent-warning);">
            <span style="font-size: 11px; font-weight: 700; color: var(--accent-warning); text-transform: uppercase;">🔌 การเดินสายไฟ & พินเชื่อมต่อ ESP32:</span>
            <p style="font-size: 12px; color: #cbd5e1; margin-top: 3px; line-height: 1.5;">${d.wiring}</p>
          </div>
        `;
      }
    };

    nodes.forEach(node => {
      node.addEventListener('mouseenter', () => {
        showDetails(node.id, false);
      });
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        showDetails(node.id, true);
        if (window.smartVestApp && window.smartVestApp.playBeep) {
          window.smartVestApp.playBeep(900, 0.04);
        }
      });
    });
  }
}

window.VestWiringInspector = VestWiringInspector;
