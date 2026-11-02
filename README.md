# ❄️ Smart Cooling Vest with 3D Digital Twin
### เสื้อกั๊กปรับอากาศอัจฉริยะควบคุมด้วย ESP32 Dual-Core (4-Fan + BTMS + Spine Peltier)

ระบบจำลอง **3D Digital Twin** แบบเรียลไทม์ของเสื้อกั๊กปรับอากาศอัจฉริยะสำหรับผู้ปฏิบัติงานในสภาพแวดล้อมความร้อนสูง พร้อมระบบควบคุมพัดลม 4 ตัวแยกอิสระ, ระบบหล่อเย็นแบตเตอรี่เฉพาะทาง (BTMS), แผ่นทำความเย็นกระดูกสันหลัง Peltier และหน้าจอ Smart Micro-OLED HUD บนหน้าอก

---

## 🚀 ฟีเจอร์หลัก (Key Features)

- **3D Digital Twin & Human Anatomy:** โมเดลหุ่น 3D สรีระมนุษย์นักกีฬาจำลองทางกายวิภาคสมจริง พร้อมระบบตัดเปลือกเสื้อโปร่งใส/ซ่อนชิ้นส่วนเพื่อตรวจสอบอุปกรณ์ภายใน
- **4-Fan Multi-Zone Aerodynamics:**
  - พัดลมหอยโข่งคู่แรงดันสถิตสูง 70mm (Waist Blowers) ระบายความร้อนลำตัว 360°
  - พัดลมไมโครเทอร์โบคู่ 40mm บ่าไหล่ (Shoulder Fans) ทำมุม 45° เป่าตรงสู่ใบหน้าและต้นคอแบบแฮนด์ฟรี
- **Battery Thermal Management System (BTMS):** พัดลมและฮีตซิงก์อะลูมิเนียมประกบแผ่นกราฟีนหล่อเย็นก้อนแบตเตอรี่ 3S2P โดยเฉพาะ ป้องกันความร้อนสะสม
- **Spine Contact Cooling:** แผ่นความเย็นเซรามิก Peltier (TEC1-12706) สัมผัสแนวกระดูกสันหลัง พร้อมอัลกอริทึม Dew-Point Watchdog ป้องกันหยดน้ำ
- **Smart Micro-OLED Chest HUD:** หน้าจอแสดงผลสดบนหน้าอกเสื้อ (อุณหภูมิร่างกาย, กราฟคลื่นไฟฟ้าหัวใจ ECG, รอบพัดลม, แบตเตอรี่)
- **Closed-Loop Safety Interlocks:** ระบบตัดการทำงานฉุกเฉินเมื่ออุณหภูมิเกินพิกัด และระบบตรวจจับการล้ม (Fall / Man-Down Detection)
- **Mobile Responsive & Offline-Ready:** รองรับการใช้งานทั้งบนคอมพิวเตอร์และสมาร์ตโฟน 100% โดยไม่ต้องเชื่อมต่ออินเทอร์เน็ต

---

## 🛠️ โครงสร้างไฟล์ในโปรเจกต์ (Project Structure)

```
Smart Cooling Vest with 3D Digital Twin/
├── index.html                 # หน้าเว็บหลัก Web Application & Dashboard
├── css/
│   └── style.css              # Cyberpunk Industrial UI & Mobile Styles
├── js/
│   ├── scene.js               # 3D Scene, Three.js Rendering & Shaders
│   ├── app.js                 # Thermodynamics Engine & Telemetry Logic
│   └── wiring.js              # Schematic & Wiring Architecture
├── firmware/
│   ├── smart_cooling_vest.ino # ซอร์สโค้ด ESP32 C++ (FreeRTOS Dual-Core)
│   └── pin_definitions.h      # ผังการต่อพิน GPIO และวงจรไดรเวอร์
├── docs/                      # เอกสารสเปกวิศวกรรมและความปลอดภัย
└── assets/                    # ไลบรารีออฟไลน์ Three.js, OrbitControls, Chart.js
```

---

## 💻 วิธีการเปิดใช้งาน (How to Run)

1. **เปิดด้วยเบราว์เซอร์โดยตรง:**
   - ดับเบิลคลิกเปิดไฟล์ `index.html` บน Google Chrome, Microsoft Edge หรือ Safari
2. **เปิดผ่าน Local Server (แนะนำ):**
   - ดับเบิลคลิกไฟล์ `run_digital_twin.bat` หรือรันคำสั่ง:
   ```bash
   python serve.py
   ```
   - เข้าใช้งานที่: `http://localhost:8893`
