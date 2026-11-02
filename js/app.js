/**
 * Smart Cooling Vest - Main Application Controller & Simulation Engine
 * Calculates Heat Index (NOAA Steadman), Magnus Dew Point, Closed-loop PID cooling,
 * Battery consumption, audio synthesis alarms, and telemetry synchronizer.
 */

class SmartVestApp {
  constructor() {
    this.scene = null;
    this.wiring = null;
    this.audioCtx = null;
    
    // Live Simulation Inputs
    this.ambientTemp = 36.0;   // Celsius
    this.ambientHumidity = 65; // % RH
    this.workerExertion = 2;   // 1=Rest, 2=Moderate Work, 3=Heavy Labor
    this.operatingMode = 'AUTO'; // AUTO, TURBO, ECO, MANUAL

    // Calculated / Internal Physics States
    this.heatIndex = 42.0;
    this.dewPoint = 28.5;
    this.skinTemp = 34.2;
    this.heartRate = 95;       // BPM
    this.peltierWatts = 18;
    this.peltierColdTemp = 23.5;
    this.heatsinkTemp = 38.0;
    this.fanRPM = 3100;
    this.fanPWM = 65;          // %
    this.waistFanActive = true; // Lower Waist Fans Active Switch
    this.shoulderFanRPM = 3400; // Shoulder Neck/Face Blower RPM
    this.shoulderFanPWM = 70;   // %
    this.shoulderFanActive = true;
    this.batteryMah = 7000;
    this.batteryVolts = 11.8;
    this.batteryTemp = 31.8;   // Dedicated battery temperature
    this.batteryCoolingActive = true; // Dedicated battery thermal management
    this.currentAmps = 2.15;
    this.estimatedHours = 3.2;
    this.systemPower = true;
    this.alarmActive = false;

    // Safety status checks
    this.safetyStates = {
      dewPointOk: true,
      heatsinkOk: true,
      batteryOk: true,
      batteryTempOk: true,
      sweatIsolationOk: true,
      workerSafe: true
    };

    this.init();
  }

  init() {
    // 1. Initialize 3D Digital Twin Scene
    if (window.VestDigitalTwinScene) {
      this.scene = new window.VestDigitalTwinScene('canvas3d');
    }

    // 2. Initialize Wiring Inspector
    if (window.VestWiringInspector) {
      this.wiring = new window.VestWiringInspector('schematic-container');
    }

    // 3. Bind UI Controls
    this.bindNavigationTabs();
    this.bindViewModeButtons();
    this.bindSimulationSliders();
    this.bindPresetButtons();
    this.bindOperatingModes();
    this.bindActionButtons();
    this.bindMobileControls();

    // 4. Start Physics & Telemetry Engine (10Hz loop)
    setInterval(() => this.updatePhysicsLoop(), 100);

    // Initial calculation
    this.recomputeAll();
    console.log('[SmartVestApp] Initialized successfully.');
  }

  /**
   * Navigation Tabs (3D Twin, Wiring, Firmware, Specs)
   */
  bindNavigationTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetId = tab.dataset.target;
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        const targetContent = document.getElementById(targetId);
        if (targetContent) {
          targetContent.classList.add('active');
        }

        // Trigger resize if switching back to 3D tab
        if (targetId === 'tab-3d' && this.scene) {
          setTimeout(() => this.scene.onWindowResize(), 50);
        }
      });
    });
  }

  /**
   * 3D View Mode Switches (Normal, X-Ray, Exploded, Airflow, Thermal)
   */
  bindViewModeButtons() {
    const pills = document.querySelectorAll('.view-mode-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const mode = pill.dataset.mode;
        if (this.scene) {
          this.scene.setViewMode(mode);
        }
        this.playBeep(800, 0.04);
      });
    });

    const resetBtn = document.getElementById('btn-reset-cam');
    if (resetBtn && this.scene) {
      resetBtn.addEventListener('click', () => {
        this.scene.resetCamera();
        this.playBeep(1000, 0.05);
      });
    }

    // Toggle Shell Visibility Mode (Translucent / Hidden / Solid)
    const shellBtn = document.getElementById('btn-shell-toggle');
    if (shellBtn && this.scene) {
      shellBtn.addEventListener('click', () => {
        const mode = this.scene.cycleShellMode();
        const labels = ['👔 เปลือกเสื้อ: ทึบ', '👔 เปลือกเสื้อ: โปร่งใส', '👔 เปลือกเสื้อ: ซ่อน'];
        shellBtn.innerHTML = `<span>${labels[mode]}</span>`;
        this.playBeep(850, 0.04);
      });
    }
  }

  /**
   * Sliders (Ambient Temp, Humidity, Workload Exertion)
   */
  bindSimulationSliders() {
    const tempSlider = document.getElementById('slider-ambient-temp');
    const humSlider = document.getElementById('slider-ambient-hum');
    const exertSlider = document.getElementById('slider-exertion');

    if (tempSlider) {
      tempSlider.addEventListener('input', (e) => {
        this.ambientTemp = parseFloat(e.target.value);
        document.getElementById('val-slider-temp').textContent = `${this.ambientTemp.toFixed(1)}°C`;
        this.recomputeAll();
      });
    }

    if (humSlider) {
      humSlider.addEventListener('input', (e) => {
        this.ambientHumidity = parseInt(e.target.value, 10);
        document.getElementById('val-slider-hum').textContent = `${this.ambientHumidity}%`;
        this.recomputeAll();
      });
    }

    if (exertSlider) {
      exertSlider.addEventListener('input', (e) => {
        this.workerExertion = parseInt(e.target.value, 10);
        const labels = ['พักผ่อน / ยืนเฝ้า', 'ทำงานระดับปานกลาง', 'ทำงานหนักกลางแจ้ง'];
        document.getElementById('val-slider-exert').textContent = labels[this.workerExertion - 1] || 'ปานกลาง';
        this.recomputeAll();
      });
    }
  }

  /**
   * Operating Mode Switches (AUTO, TURBO, ECO, MANUAL)
   */
  bindOperatingModes() {
    const modeBtns = document.querySelectorAll('.mode-btn');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.operatingMode = btn.dataset.mode;
        this.recomputeAll();
        this.playBeep(900, 0.06);
      });
    });
  }

  /**
   * Preset Test Environments
   */
  bindPresetButtons() {
    const presets = document.querySelectorAll('.preset-grid .preset-btn');
    presets.forEach(btn => {
      btn.addEventListener('click', () => {
        presets.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');

        const presetKey = btn.dataset.preset;
        this.applyPreset(presetKey);
        this.playBeep(700, 0.08);
      });
    });
  }

  applyPreset(presetKey) {
    const tempSlider = document.getElementById('slider-ambient-temp');
    const humSlider = document.getElementById('slider-ambient-hum');
    const exertSlider = document.getElementById('slider-exertion');

    switch (presetKey) {
      case 'bkk_noon': // Bangkok summer noon: Extreme Heat Index
        this.ambientTemp = 41.0;
        this.ambientHumidity = 76;
        this.workerExertion = 2;
        this.operatingMode = 'AUTO';
        break;

      case 'factory': // Heavy factory / Steel mill: High temp, moderate humidity
        this.ambientTemp = 39.5;
        this.ambientHumidity = 52;
        this.workerExertion = 3;
        this.operatingMode = 'AUTO';
        break;

      case 'logistics': // Fast-paced active logistics
        this.ambientTemp = 34.0;
        this.ambientHumidity = 68;
        this.workerExertion = 3;
        this.operatingMode = 'AUTO';
        break;

      case 'office': // Moving into air-conditioned office: Auto idle eco
        this.ambientTemp = 24.0;
        this.ambientHumidity = 50;
        this.workerExertion = 1;
        this.operatingMode = 'AUTO';
        break;

      case 'heatstroke': // Simulated Emergency Heat Stroke & Fall
        this.ambientTemp = 43.5;
        this.ambientHumidity = 85;
        this.workerExertion = 3;
        this.operatingMode = 'TURBO';
        break;
    }

    if (tempSlider) {
      tempSlider.value = this.ambientTemp;
      document.getElementById('val-slider-temp').textContent = `${this.ambientTemp.toFixed(1)}°C`;
    }
    if (humSlider) {
      humSlider.value = this.ambientHumidity;
      document.getElementById('val-slider-hum').textContent = `${this.ambientHumidity}%`;
    }
    if (exertSlider) {
      exertSlider.value = this.workerExertion;
      const labels = ['พักผ่อน / ยืนเฝ้า', 'ทำงานระดับปานกลาง', 'ทำงานหนักกลางแจ้ง'];
      document.getElementById('val-slider-exert').textContent = labels[this.workerExertion - 1];
    }

    this.recomputeAll();
  }

  bindActionButtons() {
    // Copy code button
    const copyBtn = document.getElementById('btn-copy-code');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const codeElement = document.getElementById('esp32-code-block');
        if (codeElement) {
          navigator.clipboard.writeText(codeElement.innerText).then(() => {
            copyBtn.textContent = '✓ คัดลอกสำเร็จ!';
            setTimeout(() => { copyBtn.textContent = '📋 คัดลอกโค้ด C++'; }, 2000);
          });
        }
      });
    }

    // Toggle Power Switch
    const pwrBtn = document.getElementById('btn-power-toggle');
    if (pwrBtn) {
      pwrBtn.addEventListener('click', () => {
        this.systemPower = !this.systemPower;
        pwrBtn.textContent = this.systemPower ? '⚡ ปิดระบบ' : '⚡ เปิดระบบ';
        pwrBtn.style.background = this.systemPower ? 'rgba(255, 51, 102, 0.2)' : 'rgba(0, 255, 136, 0.2)';
        this.recomputeAll();
        this.playBeep(this.systemPower ? 1200 : 400, 0.1);
      });
    }

    // Toggle Dual Lower Waist Blowers (พัดลมล่าง 70mm คู่)
    const waistBtn = document.getElementById('btn-toggle-waist-fan');
    if (waistBtn) {
      waistBtn.addEventListener('click', () => {
        this.waistFanActive = !this.waistFanActive;
        waistBtn.innerHTML = `<span>🌪️ พัดลมล่าง: ${this.waistFanActive ? 'เปิด' : 'ปิด'}</span>`;
        waistBtn.classList.toggle('active', this.waistFanActive);
        this.recomputeAll();
        this.playBeep(this.waistFanActive ? 1000 : 500, 0.05);
      });
    }

    // Toggle Dual Shoulder Face/Neck Micro-Fans
    const shoulderBtn = document.getElementById('btn-toggle-shoulder-fan');
    if (shoulderBtn) {
      shoulderBtn.addEventListener('click', () => {
        this.shoulderFanActive = !this.shoulderFanActive;
        shoulderBtn.innerHTML = `<span>🌬️ พัดลมบ่า: ${this.shoulderFanActive ? 'เปิด' : 'ปิด'}</span>`;
        shoulderBtn.classList.toggle('active', this.shoulderFanActive);
        this.recomputeAll();
        this.playBeep(this.shoulderFanActive ? 1000 : 500, 0.05);
      });
    }

    // Toggle Dedicated Battery Thermal Management (BTMS)
    const battCoolingBtn = document.getElementById('btn-toggle-batt-cooling');
    if (battCoolingBtn) {
      battCoolingBtn.addEventListener('click', () => {
        this.batteryCoolingActive = !this.batteryCoolingActive;
        battCoolingBtn.innerHTML = `<span>❄️ หล่อเย็นแบต: ${this.batteryCoolingActive ? 'เปิด' : 'ปิด'}</span>`;
        battCoolingBtn.classList.toggle('active', this.batteryCoolingActive);
        this.recomputeAll();
        this.playBeep(this.batteryCoolingActive ? 1100 : 450, 0.05);
      });
    }
  }

  /**
   * Mobile Responsive Bottom Sheet Drawer Controls
   */
  bindMobileControls() {
    const toggleBtn = document.getElementById('btn-mobile-sidebar-toggle');
    const closeBtn = document.getElementById('btn-close-mobile-sidebar');
    const sidebar = document.querySelector('.telemetry-sidebar');
    const backdrop = document.getElementById('mobile-sidebar-backdrop');

    const openSidebar = () => {
      if (sidebar) sidebar.classList.add('mobile-open');
      if (backdrop) backdrop.classList.add('active');
      this.playBeep(850, 0.03);
    };

    const closeSidebar = () => {
      if (sidebar) sidebar.classList.remove('mobile-open');
      if (backdrop) backdrop.classList.remove('active');
      this.playBeep(700, 0.03);
    };

    if (toggleBtn) toggleBtn.addEventListener('click', openSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    if (backdrop) backdrop.addEventListener('click', closeSidebar);

    // Also close drawer if user clicks on nav tabs
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(t => t.addEventListener('click', () => {
      if (sidebar && sidebar.classList.contains('mobile-open')) {
        closeSidebar();
      }
    }));
  }

  /**
   * Thermodynamics & Physiological Simulation Engine
   */
  recomputeAll() {
    // 1. Calculate Magnus Dew Point (จุดน้ำค้าง)
    const T = this.ambientTemp;
    const RH = this.ambientHumidity;
    const a = 17.625;
    const b = 243.04;
    const alpha = ((a * T) / (b + T)) + Math.log(RH / 100);
    this.dewPoint = (b * alpha) / (a - alpha);

    // 2. Calculate NOAA Steadman Heat Index (ดัชนีความร้อน)
    const T_F = (T * 9 / 5) + 32;
    let HI_F = 0.5 * (T_F + 61.0 + ((T_F - 68.0) * 1.2) + (RH * 0.094));
    if (HI_F >= 80) {
      HI_F = -42.379 + 2.04901523 * T_F + 10.14333127 * RH - 0.22475541 * T_F * RH
             - 0.00683783 * T_F * T_F - 0.05481717 * RH * RH + 0.00122874 * T_F * T_F * RH
             + 0.00085282 * T_F * RH * RH - 0.00000199 * T_F * T_F * RH * RH;
    }
    this.heatIndex = (HI_F - 32) * 5 / 9;

    // 3. Control Logic depending on Mode & Heat Index
    if (!this.systemPower) {
      this.fanPWM = 0;
      this.fanRPM = 0;
      this.shoulderFanPWM = 0;
      this.shoulderFanRPM = 0;
      this.peltierWatts = 0;
      this.peltierColdTemp = this.ambientTemp;
      this.skinTemp = 36.5 + (this.ambientTemp - 30) * 0.2;
      this.batteryTemp = this.ambientTemp;
      this.currentAmps = 0.08;
      this.heatsinkTemp = this.ambientTemp;
    } else {
      let targetPWM = 30;
      let targetWatts = 0;
      let targetShoulderPWM = 40;

      if (this.operatingMode === 'TURBO') {
        targetPWM = 100;
        targetWatts = 28;
        targetShoulderPWM = 100;
      } else if (this.operatingMode === 'ECO') {
        targetPWM = 40;
        targetWatts = 6;
        targetShoulderPWM = 35;
      } else { // AUTO AI Adaptive
        if (this.heatIndex < 28) {
          targetPWM = 25; // Gentle breeze
          targetWatts = 0;
          targetShoulderPWM = 30;
        } else if (this.heatIndex < 35) {
          targetPWM = 45;
          targetWatts = 8;
          targetShoulderPWM = 55;
        } else if (this.heatIndex < 42) {
          targetPWM = 70;
          targetWatts = 18;
          targetShoulderPWM = 80;
        } else {
          targetPWM = 95;
          targetWatts = 26;
          targetShoulderPWM = 100;
        }

        // Add workload bias
        if (this.workerExertion === 3) {
          targetPWM = Math.min(targetPWM + 20, 100);
          targetWatts = Math.min(targetWatts + 8, 30);
          targetShoulderPWM = Math.min(targetShoulderPWM + 20, 100);
        }
      }

      // Lower Waist Blowers Control (Dual 70mm Centrifugal Fans)
      if (this.waistFanActive) {
        this.fanPWM = targetPWM;
        this.fanRPM = Math.round(5400 * (this.fanPWM / 100));
      } else {
        this.fanPWM = 0;
        this.fanRPM = 0;
      }

      // Shoulder Turbofans Control (Direct Neck & Face Cooling)
      if (this.shoulderFanActive) {
        this.shoulderFanPWM = targetShoulderPWM;
        this.shoulderFanRPM = Math.round(5000 * (this.shoulderFanPWM / 100));
      } else {
        this.shoulderFanPWM = 0;
        this.shoulderFanRPM = 0;
      }

      // Calculate Cold Plate Temp based on Peltier Watts
      // Cold plate achieves delta T of up to 14°C below ambient
      const deltaT = (targetWatts / 30) * 14.0;
      let rawColdPlate = this.ambientTemp - deltaT;

      // 4. Anti-Condensation Watchdog Interlock!
      // Must not fall below Dew Point + 1.5°C to avoid moisture condensation inside clothing
      const minSafeColdTemp = this.dewPoint + 1.5;
      if (rawColdPlate < minSafeColdTemp) {
        this.safetyStates.dewPointOk = false;
        // Throttle back Peltier power to prevent condensation
        rawColdPlate = minSafeColdTemp;
        targetWatts = Math.max(0, ((this.ambientTemp - rawColdPlate) / 14.0) * 30);
      } else {
        this.safetyStates.dewPointOk = true;
      }

      this.peltierWatts = Math.round(targetWatts);
      this.peltierColdTemp = rawColdPlate;

      // Calculate Heatsink Temp (Waste heat blown away by fan)
      const heatRejectionEffect = (this.fanRPM / 5400) * 12;
      this.heatsinkTemp = this.ambientTemp + (this.peltierWatts * 0.45) - heatRejectionEffect;

      // Skin Temp Simulation (Comfort regulation with 4-fan airflow & face cooling)
      const lowerCoolingBonus = this.waistFanActive ? (this.fanPWM * 0.04) : 0;
      const faceCoolingBonus = this.shoulderFanActive ? (this.shoulderFanPWM * 0.03) : 0;
      const coolingPower = lowerCoolingBonus + (this.peltierWatts * 0.12) + faceCoolingBonus;
      this.skinTemp = 36.5 + (this.ambientTemp - 32) * 0.12 + (this.workerExertion * 0.4) - coolingPower;
      this.skinTemp = Math.max(28.0, Math.min(this.skinTemp, 40.5));

      // Heart Rate Simulation (BPM)
      let baseBpm = 75;
      if (this.workerExertion === 2) baseBpm = 95;
      if (this.workerExertion === 3) baseBpm = 125;
      if (this.heatIndex > 45) baseBpm += 18;
      this.heartRate = baseBpm;

      // Current Draw: Dual Lower Blowers (1.6A max) + Dual Shoulder Fans (0.7A max) + Peltier (2.5A max) + Logic
      const fanAmps = this.waistFanActive ? (this.fanPWM / 100) * 1.5 : 0.0;
      const shoulderAmps = this.shoulderFanActive ? (this.shoulderFanPWM / 100) * 0.7 : 0.0;
      const tecAmps = (this.peltierWatts / 12);
      this.currentAmps = fanAmps + shoulderAmps + tecAmps + 0.15;
      this.estimatedHours = (this.batteryMah / 1000) / this.currentAmps;

      // Dedicated Battery Thermal Management Physics
      // Battery Joule self-heating (I^2 * R) + ambient radiation
      const jouleHeating = Math.pow(this.currentAmps, 1.8) * 0.85;
      const ambientConduction = (this.ambientTemp - 25.0) * 0.25;
      const coolingDissipation = this.batteryCoolingActive ? 5.8 : 0.8;
      this.batteryTemp = 28.0 + ambientConduction + jouleHeating - coolingDissipation;
      this.batteryTemp = Math.max(26.0, Math.min(this.batteryTemp, 52.0));

      // Battery Thermal Overheat Interlock
      this.safetyStates.batteryTempOk = this.batteryTemp < 45.0;
      if (this.batteryTemp >= 42.0) {
        // Auto-boost battery cooling to prevent degradation
        this.batteryCoolingActive = true;
      }
    }

    // 5. Safety Interlocks Checks
    this.safetyStates.heatsinkOk = this.heatsinkTemp < 55.0;
    this.safetyStates.batteryOk = this.currentAmps < 5.0 && this.safetyStates.batteryTempOk;
    this.safetyStates.sweatIsolationOk = true;
    
    // Check for Heat Stroke Condition (Heat Index > 42°C & HR > 130 bpm & Skin > 38°C)
    if (this.heatIndex >= 44 && this.heartRate >= 130) {
      this.alarmActive = true;
      this.safetyStates.workerSafe = false;
    } else {
      this.alarmActive = false;
      this.safetyStates.workerSafe = true;
    }

    this.updateUI();
  }

  /**
   * Update HTML DOM Values
   */
  updateUI() {
    // Metrics
    this.setVal('val-amb-temp', `${this.ambientTemp.toFixed(1)}`);
    this.setVal('val-amb-hum', `${this.ambientHumidity}`);
    this.setVal('val-heat-index', `${this.heatIndex.toFixed(1)}`);
    this.setVal('val-dew-point', `${this.dewPoint.toFixed(1)}`);
    this.setVal('val-skin-temp', `${this.skinTemp.toFixed(1)}`);
    this.setVal('val-heart-rate', `${this.heartRate}`);
    this.setVal('val-fan-rpm', `${this.fanRPM}`);
    this.setVal('val-fan-pwm', `${this.fanPWM}%`);
    this.setVal('val-shoulder-rpm', `${this.shoulderFanRPM}`);
    this.setVal('val-shoulder-pwm', `${this.shoulderFanPWM}%`);
    this.setVal('val-batt-temp', `${this.batteryTemp.toFixed(1)}°C`);
    this.setVal('val-tec-watts', `${this.peltierWatts}`);
    this.setVal('val-tec-temp', `${this.peltierColdTemp.toFixed(1)}°C`);
    this.setVal('val-current', `${this.currentAmps.toFixed(2)}`);
    this.setVal('val-runtime', `${this.estimatedHours.toFixed(1)} ชม.`);

    // Heat Index Status Badge & Banner
    const banner = document.getElementById('heat-index-banner');
    const badge = document.getElementById('heat-index-badge');
    const desc = document.getElementById('heat-index-desc');

    if (banner && badge && desc) {
      if (this.heatIndex < 30) {
        banner.className = 'heat-index-banner';
        badge.textContent = 'ปกติ (Safe)';
        badge.style.color = 'var(--accent-green)';
        desc.textContent = 'สภาพอากาศปลอดภัย สามารถทำงานกลางแจ้งได้ตามปกติ';
      } else if (this.heatIndex < 38) {
        banner.className = 'heat-index-banner';
        badge.textContent = 'ระวัง (Caution)';
        badge.style.color = 'var(--accent-warning)';
        desc.textContent = 'อาจมีอาการเมื่อยล้าเมื่อทำกิจกรรมกลางแจ้งต่อเนื่อง';
      } else if (this.heatIndex < 46) {
        banner.className = 'heat-index-banner danger';
        badge.textContent = 'ระวังขั้นสูง (Extreme Caution)';
        badge.style.color = 'var(--accent-danger)';
        desc.textContent = 'เสี่ยงต่อตะคริวจากความร้อนและภาวะหมดแรง ควรรีบระบายความร้อน';
      } else {
        banner.className = 'heat-index-banner danger';
        badge.textContent = 'อันตรายสูงสุด (Danger!)';
        badge.style.color = '#ff0033';
        desc.textContent = 'เสี่ยงต่อโรคลมแดด (Heat Stroke) อย่างยิ่ง! ระบบปรับสู่ระดับฉุกเฉิน';
      }
    }

    // Update Mobile Drawer Badge
    const mobileBadge = document.getElementById('mobile-heat-badge');
    if (mobileBadge) {
      mobileBadge.textContent = `${this.heatIndex.toFixed(1)}°C`;
      if (this.heatIndex >= 46) {
        mobileBadge.style.color = '#ff3366';
        mobileBadge.style.background = 'rgba(255, 51, 102, 0.25)';
      } else if (this.heatIndex >= 38) {
        mobileBadge.style.color = 'var(--accent-warning)';
        mobileBadge.style.background = 'rgba(255, 183, 3, 0.25)';
      } else {
        mobileBadge.style.color = 'var(--accent-green)';
        mobileBadge.style.background = 'rgba(0, 255, 136, 0.2)';
      }
    }

    // Safety Interlock UI Badges
    this.setSafetyItem('safe-dew', this.safetyStates.dewPointOk ? 'ปกติ (Safe)' : 'ตัดกำลังป้องกันหยดน้ำ', this.safetyStates.dewPointOk ? 'good' : 'warning');
    this.setSafetyItem('safe-heat', this.safetyStates.heatsinkOk ? 'ปกติ (<55°C)' : 'ฮีตซิงก์ร้อนเกิน', this.safetyStates.heatsinkOk ? 'good' : 'danger');
    this.setSafetyItem('safe-batt-temp', this.safetyStates.batteryTempOk ? 'อุณหภูมิปกติ (<45°C)' : 'แบตเตอรี่ร้อนเกิน!', this.safetyStates.batteryTempOk ? 'good' : 'danger');
    this.setSafetyItem('safe-batt', this.safetyStates.batteryOk ? 'จ่ายกระแสปกติ' : 'ตัดวงจรเกินพิกัด', this.safetyStates.batteryOk ? 'good' : 'danger');
    this.setSafetyItem('safe-worker', this.safetyStates.workerSafe ? 'สภาวะร่างกายปลอดภัย' : 'เตือนความเสี่ยงฮีทสโตรก!', this.safetyStates.workerSafe ? 'good' : 'danger');

    // Update 3D Scene states
    if (this.scene) {
      this.scene.updateSimulationState({
        fanRPM: this.fanRPM,
        fanPWM: this.fanPWM,
        waistFanActive: this.waistFanActive,
        shoulderFanRPM: this.shoulderFanRPM,
        shoulderFanPWM: this.shoulderFanPWM,
        shoulderFanActive: this.shoulderFanActive,
        batteryTemp: this.batteryTemp,
        batteryCoolingActive: this.batteryCoolingActive,
        peltierWatts: this.peltierWatts,
        peltierTemp: this.peltierColdTemp,
        skinTemp: this.skinTemp,
        ambientTemp: this.ambientTemp,
        alertActive: this.alarmActive,
        systemPower: this.systemPower
      });
    }

    // Sound alert if emergency
    if (this.alarmActive) {
      this.playAlarmChirp();
    }
  }

  setVal(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  setSafetyItem(id, text, status) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = text;
      el.className = `safety-badge ${status}`;
    }
  }

  /**
   * Sound Synthesis via Web Audio API (100% offline, zero assets)
   */
  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  playBeep(freq = 800, duration = 0.05) {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  playAlarmChirp() {
    if (this.lastAlarmTime && Date.now() - this.lastAlarmTime < 1800) return;
    this.lastAlarmTime = Date.now();
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(900, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(1400, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
  }

  /**
   * Component Selection from 3D Viewport Raycasting & Interactive Schematic
   * Displays full, comprehensive engineering specs, safety interlocks, pinouts, and live readings
   */
  onComponentSelected(key) {
    const card = document.getElementById('component-inspect-overlay');
    if (!card) return;
    if (!key) {
      card.style.display = 'none';
      return;
    }

    const liveRPM = this.systemPower ? this.fanRPM : 0;
    const livePWM = this.systemPower ? this.fanPWM : 0;
    const liveShoulderRPM = (this.systemPower && this.shoulderFanActive) ? this.shoulderFanRPM : 0;
    const liveShoulderPWM = (this.systemPower && this.shoulderFanActive) ? this.shoulderFanPWM : 0;
    const liveBattTemp = this.batteryTemp.toFixed(1);
    const liveTecWatts = this.systemPower ? this.peltierWatts : 0;
    const liveTecTemp = this.systemPower ? this.peltierColdTemp.toFixed(1) : this.ambientTemp.toFixed(1);
    const liveSkinTemp = this.skinTemp.toFixed(1);
    const liveAmps = this.currentAmps.toFixed(2);
    const liveHours = this.estimatedHours.toFixed(1);

    const compDb = {
      // 0. Smart Micro-OLED Chest HUD Screen
      'oled': {
        title: 'จอแสดงผลสมาร์ทไมโครโอเลด (1.5" Smart Micro-OLED Chest HUD)',
        category: 'อินเตอร์เฟสแสดงผลข้อมูลสดบนหน้าอกเสื้อ (Front Chest Display)',
        location: 'หน้าอกเสื้อด้านซ้ายบน (Upper Left Chest)',
        liveStatus: `30 FPS Real-time Rendering | Temp: ${this.skinTemp.toFixed(1)}°C | HR: ${this.heartRate} BPM | Fan: ${this.fanRPM} RPM`,
        specs: [
          ['ขนาดจอภาพ', '1.5 นิ้ว Full RGB Micro-OLED (128×128 pixel resolution)'],
          ['อัตราการรีเฟรช', '30 FPS Animated Display with Dynamic ECG Waveform'],
          ['กระจกป้องกันหน้าจอ', 'Gorilla Glass 3 เคลือบ Oleophobic Coating ป้องกันรอยและคราบเหงื่อ'],
          ['มาตรฐานความทนทาน', 'IP67 Waterproof & Dustproof ขอบเฟรมไททาเนียม CNC'],
          ['การใช้พลังงาน', 'Active Matrix OLED กินไฟต่ำพิเศษเพียง 0.12W']
        ],
        func: 'แสดงผลข้อมูลสถิติสำคัญระดับวิกฤตของผู้สวมใส่แบบเรียลไทม์บนหน้าอกเสื้อ ได้แก่ อุณหภูมิร่างกาย, กราฟคลื่นไฟฟ้าหัวใจ (ECG Waveform), อัตราการเต้นของหัวใจ, ไอคอนพัดลมหมุนแสดงความเร็วรอบ, เปอร์เซ็นต์แบตเตอรี่ และสถานะบลูทูธ เพื่อให้เพื่อนร่วมงานหรือหัวหน้างานสามารถมองเห็นสถานะสุขภาพของคนงานได้ทันทีจากระยะไกลโดยไม่ต้องหยิบสมาร์ทโฟน',
        pinout: 'เชื่อมต่อผ่านบัสความเร็วสูง SPI 20MHz (CS: GPIO 5, DC: GPIO 16, RST: GPIO 17, CLK: GPIO 18, MOSI: GPIO 23) จำลองผลด้วย Dynamic Canvas Texture 512×360',
        safety: 'กระจกนิรภัยทนแรงกระแทก เคลือบสารป้องกันรังสี UV มองเห็นชัดเจนแม้อยู่กลางแดดจัด (Sunlight Readable 1000 nits) พร้อมระบบ Sleep Mode เมื่อไม่พบการเคลื่อนไหวเพื่อถนอมอายุหน้าจอ'
      },

      // 1. Dual Waist Blowers
      'fan': {
        title: 'พัดลมหอยโข่งแรงดันสถิตสูงคู่ (Dual 9733 Rear Waist Blowers)',
        category: 'ระบบอากาศพลศาสตร์และระบายความร้อนลำตัว',
        location: 'ชายเสื้อด้านหลังซ้าย-ขวา ระดับเอว (Lumbar Region)',
        liveStatus: `${this.waistFanActive ? '🟢 เปิดทำงาน' : '⚪ ปิดการทำงาน'}: ${liveRPM} RPM (${livePWM}%) | แรงดันไฟ: 12.0V | กระแส: ${(livePWM / 100 * 1.5).toFixed(2)} A`,
        specs: [
          ['ขนาด / ชนิดพัดลม', '97 × 94 × 33 มม. (Centrifugal Blower) × 2 ตัว'],
          ['แรงดันไฟ / กระแส', '12V DC | 0.85A ต่อตัว (รวม 1.70A สูงสุด)'],
          ['ความเร็วรอบสูงสุด', '5,400 RPM (PWM Controlled)'],
          ['ปริมาณลมรวม', '38.5 CFM | แรงดันสถิตสูง 42 mmH2O'],
          ['ระดับเสียงรบกวน', '< 46 dBA ที่ความเร็วรอบ 60%']
        ],
        func: 'อัดลมความดันสถิตสูงเข้าสู่ช่องว่าง 3D Honeycomb Spacer Mesh (หนา 8 มม.) เพื่อสร้างการไหลเวียนแบบลามินาร์แนบแผ่นหลังและหน้าอก เร่งการระเหยของเหงื่อตามธรรมชาติ (Latent Heat of Vaporization: 2,426 J/g) ช่วยดึงความร้อนสะสมออกจากร่างกายอย่างรวดเร็ว',
        pinout: 'ขับด้วยสัญญาณ PWM 25kHz จาก <strong>GPIO 18</strong> (LEDC Channel 0) | วัดความเร็วรอบจริงด้วย Tachometer เข้า <strong>GPIO 19</strong> (Hardware Interrupt)',
        safety: 'ติดตั้งตะแกรงป้องกันนิรภัยสองชั้น (Dual Finger Guard) ป้องกันเศษผ้าหรือนิ้วดูดเข้าใบพัด, ไดโอด Flyback Schottky SS34 ป้องกันแรงดันกระชาก Back-EMF, ซอฟต์แวร์ตรวจจับพัดลมติดขัด (Stall Detection) ตัดไฟอัตโนมัติ'
      },

      // 2. Dual Shoulder Turbofans
      'sfan': {
        title: 'พัดลมไมโครเทอร์โบคู่บ่าไหล่ (Dual 5015 Shoulder Turbofans)',
        category: 'ระบบทำความเย็นส่วนศีรษะและใบหน้าแบบแฮนด์ฟรี',
        location: 'อินทรธนูบ่าไหล่ทั้งสองข้าง (Shoulder Straps) ทำมุม 45°',
        liveStatus: `${this.shoulderFanActive ? '🟢 เปิดทำงาน' : '⚪ ปิดการทำงาน'}: ${liveShoulderRPM} RPM (${liveShoulderPWM}%) | ทิศทาง: เล็งสู่ใบหน้า/ซอกคอ`,
        specs: [
          ['ขนาด / ชนิดพัดลม', '50 × 50 × 15 มม. (Micro Turbofan) × 2 ตัว'],
          ['แรงดันไฟ / กระแส', '12V DC | 0.25A ต่อตัว (รวม 0.50A สูงสุด)'],
          ['ความเร็วรอบสูงสุด', '5,000 RPM (PWM Controlled)'],
          ['มุมระบายลม', 'ทำมุมเอียง 45° เล็งตรงสู่คาง แก้ม และต้นคอ'],
          ['ระดับเสียงรบกวน', '< 38 dBA (ออกแบบช่องแอร์เงียบพิเศษ)']
        ],
        func: 'แก้ปัญหาจุดอ่อนของเสื้อติดแอร์ทั่วไป โดยเป่าลมเย็นตรงเข้าสู่ใบหน้า ซอกคอ และทางเดินหายใจทันที ช่วยระบายความร้อนบริเวณศีรษะและเส้นเลือดใหญ่ Carotid ป้องกันอาการวิงเวียนหน้ามืดจากความร้อน <strong>ผู้สวมใส่ไม่ต้องพกหรือถือพัดลมมือถือเพิ่มอีกต่อไป เสื้อตัวเดียวจบครบทั้งตัว</strong>',
        pinout: 'ขับด้วยสัญญาณ PWM 25kHz จาก <strong>GPIO 26</strong> (LEDC Channel 2) ผ่าน Logic MOSFET AO3400A แยกโซนอิสระจากพัดลมลำตัว',
        safety: 'ออกแบบช่องตะแกรงทรง Louver สเปเซอร์แคบ ป้องกันเส้นผม ฝุ่น หรือเหงื่อดูดเข้าใบพัด, สามารถเลือกกดปิด/เปิดโซนบ่าไหล่แยกได้อิสระจากปุ่มบนหน้าจอหรือหน้าอกเสื้อ'
      },

      // 3. Battery BTMS Cooler
      'bfan': {
        title: 'ระบบพัดลมหล่อเย็นแบตเตอรี่ (BTMS Active Micro-Blower)',
        category: 'ระบบจัดการความร้อนแบตเตอรี่ (Battery Thermal Management)',
        location: 'ประกบติดบนชุดระบายความร้อนก้อนแบตเตอรี่ด้านหลัง',
        liveStatus: `${this.batteryCoolingActive ? '🟢 ระบบหล่อเย็นกำลังทำงาน' : '⚪ สแตนด์บาย'}: ควบคุมอุณหภูมิเซลล์ที่ ${liveBattTemp}°C`,
        specs: [
          ['ขนาดพัดลม', '30 × 30 × 10 มม. (3010 Brushless DC Fan)'],
          ['แรงดันไฟ / กระแส', '12V DC | 0.08A (กินไฟต่ำมากเพียง 0.96W)'],
          ['ความเร็วรอบ', '6,200 RPM High Airflow'],
          ['เกณฑ์อุณหภูมิเริ่มทำงาน', 'Auto Start เมื่ออุณหภูมิแบตเตอรี่ > 38.0°C'],
          ['เกณฑ์อุณหภูมิตัดฉุกเฉิน', 'Critical Alarm & Throttle เมื่ออุณหภูมิ > 45.0°C']
        ],
        func: 'แบตเตอรี่ลิเธียมมีโอกาสร้อนสะสมสูงกว่าชิ้นส่วนอื่นเมื่อต้องจ่ายกระแสหนักต่อเนื่องกลางแดดจัด พัดลมตัวนี้จะดูดอากาศดึงความร้อนสะสมออกจากแผ่นกราฟีนและครีบอลูมิเนียมของแบตเตอรี่โดยเฉพาะ ป้องกันเซลล์แบตเตอรี่บวม เสื่อมสภาพเร็ว หรือเกิดความเสี่ยง Thermal Runaway',
        pinout: 'ควบคุมเปิด/ปิดแบบ Closed-loop อัตโนมัติตามค่า NTC Sensor บน <strong>GPIO 39</strong>',
        safety: 'หากอุณหภูมิแบตเตอรี่สูงเกิน 45°C ระบบจะสั่งเร่งพัดลมตัวนี้ 100% พร้อมลดกำลังจ่ายไฟของระบบลงครึ่งหนึ่งเพื่อความปลอดภัยสูงสุด'
      },

      // 4. Battery Heat Spreader & Fin Block
      'shield': {
        title: 'แผงเกลี่ยความร้อนและครีบอลูมิเนียม (Graphene Spreader & Heatsink)',
        category: 'ระบบจัดการความร้อนเชิงรับ (Passive BTMS Heat Dissipation)',
        location: 'แนบประกบตลอดแนวเซลล์แบตเตอรี่ 3S2P ด้านหลัง',
        liveStatus: `อุณหภูมิสะสมแผง: ${liveBattTemp}°C | วัสดุ: Anodized 6063-T5 Aluminium`,
        specs: [
          ['วัสดุแผ่นเกลี่ยความร้อน', 'Graphene Sheet สัมผัสเซลล์ (สภาพนำความร้อน 1,500 W/m·K)'],
          ['แผงครีบระบายความร้อน', 'ครีบอลูมิเนียมอะโนไดซ์ 7 ช่อง (7-Fin Extruded Block)'],
          ['พื้นที่ระบายความร้อน', '185 ตารางเซนติเมตร (Surface Area)'],
          ['ฉนวนกันความร้อนสู่หลัง', 'Aerogel Thermal Insulation Barrier หนา 3 มม.']
        ],
        func: 'กระจายความร้อนจากจุดศูนย์กลางของก้อนแบตเตอรี่ออกสู่ครีบอลูมิเนียมอย่างสม่ำเสมอ พร้อมมีฉนวน Aerogel คั่นด้านหลัง ป้องกันไม่ให้ความร้อนจากแบตเตอรี่ถ่ายเทกลับเข้าสู่แผ่นหลังของผู้สวมใส่',
        pinout: 'ติดตั้งเซนเซอร์ NTC 10K แนบติดกึ่งกลางแผง นำสัญญาณเข้า <strong>GPIO 39</strong>',
        safety: 'เคลือบผิวอะโนไดซ์ไม่นำไฟฟ้า (Dielectric Insulation) ป้องกันการลัดวงจรกับขั้วเซลล์แบตเตอรี่ 100%'
      },

      // 5. Battery Pack
      'bat': {
        title: 'ชุดแบตเตอรี่ลิเธียมไอออนอัจฉริยะ (3S2P 7,000mAh High-Drain Pack)',
        category: 'แหล่งพลังงานหลักระบบเสื้อกั๊กปรับอากาศ',
        location: 'กระเป๋าเก็บแบตเตอรี่กึ่งกลางหลัง ออกแบบสมดุลน้ำหนัก (Center-Back Balanced)',
        liveStatus: `แรงดัน: ${this.batteryVolts}V (86%) | อุณหภูมิ: ${liveBattTemp}°C | จ่ายกระแส: ${liveAmps} A | ใช้งานได้อีก: ${liveHours} ชม.`,
        specs: [
          ['โครงสร้างเซลล์', '3S2P (6 เซลล์ 18650 Samsung/LG เกรดอุตสาหกรรม)'],
          ['แรงดันไฟระบุ (Nominal)', '11.1V DC (ชาร์จเต็ม 12.6V | ตัดการทำงานที่ 9.6V)'],
          ['ความจุรวม (Capacity)', '7,000 mAh (77.7 Watt-Hours)'],
          ['กระแสจ่ายต่อเนื่อง', 'สูงสุด 15.0A Continuous Discharge'],
          ['น้ำหนักก้อนแบตเตอรี่', '360 กรัม (รวมกล่องเคสและโมดูล BTMS)']
        ],
        func: 'จ่ายพลังงานไฟฟ้าหลักให้แก่พัดลมเอวคู่, พัดลมบ่าคู่, แผ่นทำความเย็น Peltier TEC, วงจร Buck Converter, บอร์ด ESP32 และเซนเซอร์ทั้งหมดต่อเนื่อง 3.2 - 8 ชั่วโมง',
        pinout: 'ขั้วต่อกระแสสูง XT30 ชุบทองกันน้ำ | ตรวจวัดแรงดันผ่านวงจร Voltage Divider (R1=30k, R2=10k) เข้า <strong>GPIO 34</strong> (ADC)',
        safety: 'มี Hardware BMS ป้องกันครบวงจร, กล่องเคสโพลีคาร์บอเนตทนแรงกระแทก ซีลกันเหงื่อมาตรฐาน IP54 พร้อมช่องระบายความร้อน BTMS'
      },

      // 6. BMS Board
      'bms': {
        title: 'บอร์ดบริหารจัดการแบตเตอรี่ฮาร์ดแวร์ (3S 15A Hardware BMS Board)',
        category: 'ระบบควบคุมความปลอดภัยของแบตเตอรี่ระดับเซลล์',
        location: 'ติดตั้งภายในกล่องแพ็กเกจแบตเตอรี่',
        liveStatus: 'สถานะ: ปกติ (Active Balance & Cell Monitoring) | พิกัดตัดกระแส: 15A',
        specs: [
          ['การป้องกันแรงดันเกิน', 'Overcharge Protection: 4.25V ±0.05V ต่อเซลล์'],
          ['การป้องกันแรงดันต่ำเกิน', 'Overdischarge Cutoff: 2.80V ±0.08V ต่อเซลล์'],
          ['การตัดกระแสเกินพิกัด', 'Overcurrent Trip: 15.0A (ตัดวงจรภายใน 15ms)'],
          ['การบาลานซ์เซลล์', 'Passive Cell Balancing 42mA per cell']
        ],
        func: 'ตรวจสอบแรงดันและกระแสของแต่ละเซลล์แบบเรียลไทม์ ป้องกันไม่ให้แบตเตอรี่ชาร์จเกิน หรือคายประจุลึกเกินไปจนเซลล์เสื่อม และตัดการจ่ายไฟทันทีหากเกิดความผิดปกติในระดับฮาร์ดแวร์',
        pinout: 'ต่ออนุกรมระหว่างเซลล์ Li-ion กับสายไฟหลัก 18 AWG',
        safety: 'ทำงานแบบอิสระ 100% โดยไม่ต้องพึ่งพาไมโครคอนโทรลเลอร์ ให้ความปลอดภัยสูงสุดระดับ Hardware-Fail-Safe'
      },

      // 7. Resettable PTC Fuse
      'fuse': {
        title: 'ฟิวส์โพลีเมอร์ตัดวงจรอัตโนมัติ (PolySwitch 5A Resettable PTC Fuse)',
        category: 'อุปกรณ์ป้องกันกระแสไฟฟ้าลัดวงจรระดับแรก',
        location: 'อนุกรมคั่นบนบัสขั้วบวกหลัก (12V Main Rail)',
        liveStatus: 'สถานะ: ต่อวงจรสมบูรณ์ (Normal Conducting State) | ความต้านทานภายใน: < 0.04 Ω',
        specs: [
          ['พิกัดกระแสปกติ (Hold)', '2.50A Continuous Hold Current'],
          ['พิกัดกระแสตัดวงจร (Trip)', '5.00A Fault Trip Current'],
          ['ความเร็วในการตัดวงจร', '< 50 มิลลิวินาที (ที่กระแสลัดวงจร 10A)'],
          ['แรงดันไฟฟ้าทนได้สูงสุด', '16.0V DC Max Rating']
        ],
        func: 'ตัดวงจรไฟฟ้าทันทีหากเกิดการลัดวงจรจากเหงื่อเค็ม สายไฟชำรุด หรือมอเตอร์ติดขัด ป้องกันสายไฟร้อนละลายและป้องกันแบตเตอรี่ไหม้ และคืนสภาพเชื่อมต่อใหม่อัตโนมัติเมื่ออุณหภูมิลดลง',
        pinout: 'ต่ออนุกรมคั่นขั้วบวกหลักจากแบตเตอรี่ก่อนจ่ายไปยังบอร์ด Buck และ MOSFET',
        safety: 'ไม่ต้องเปลี่ยนฟิวส์ใหม่เมื่อเกิดปัญหา คืนสภาพตัวเองได้มากกว่า 1,000 ครั้ง (Self-Recovery Safety)'
      },

      // 8. Spine Peltier TEC
      'tec': {
        title: 'แผ่นความเย็นกระดูกสันหลัง (Spine Peltier Thermoelectric Cooler TEC1-12706)',
        category: 'ระบบทำความเย็นเชิงสรีระแบบสัมผัสโดยตรง (Direct Active Contact Cooling)',
        location: 'แนวกระดูกสันหลังส่วนบน (Upper Spine / Cervical Vertebrae C7-T3)',
        liveStatus: `${liveTecWatts > 0 ? '🟢 กำลังทำความเย็น' : '⚪ ปิดประหยัดพลังงาน'}: ${liveTecWatts}W | อุณหภูมิแผ่นเย็น: ${liveTecTemp}°C (จุดน้ำค้าง: ${this.dewPoint.toFixed(1)}°C)`,
        specs: [
          ['รุ่นแผ่นทำความเย็น', 'TEC1-12706 (Ceramic Thermoelectric Module 40×40 มม.)'],
          ['แรงดันไฟ / กระแส', '12V DC | จำกัดกระแสใช้งานที่ 2.5A เพื่อประสิทธิภาพสูงสุด (Max COP)'],
          ['กำลังความเย็นสูงสุด (Qmax)', 'กินไฟ 18 - 30W | สร้างความต่างอุณหภูมิ ΔT สูงสุด 14.0°C ต่ำกว่าแวดล้อม'],
          ['ท่อระบายความร้อน', 'Dual 6mm Sintered Copper Heatpipes ส่งความร้อนสู่ช่องลมพัดลม'],
          ['แผ่นกระจายความเย็น', 'อลูมิเนียมเกรดการแพทย์ผิวสัมผัสเรียบ แนบกระดูกสันหลัง']
        ],
        func: 'สร้างจุดสัมผัสความเย็นที่แนวกระดูกสันหลังส่วนบน ซึ่งเป็นศูนย์รวมเส้นประสาทรับรู้อุณหภูมิ (Thermoreceptors) และใกล้หลอดเลือดสำคัญ ทำให้ผู้สวมใส่รู้สึกสดชื่น ผ่อนคลาย และคลายความร้อนได้เร็วกว่าการเป่าลมเพียงอย่างเดียว',
        pinout: 'ขับด้วยสัญญาณ PWM 40kHz จาก <strong>GPIO 25</strong> (LEDC Channel 1) ผ่าน Logic MOSFET IRLZ44N และวงจรกรอง LC Filter (L=47uH, C=470uF) ป้อนกระแส DC เรียบ ยืดอายุแผ่น Peltier',
        safety: '<strong>Dew-Point Watchdog Algorithm:</strong> คำนวณจุดน้ำค้างเรียลไทม์ และจำกัดไม่ให้อุณหภูมิแผ่นเย็นต่ำกว่าจุดน้ำค้าง + 1.5°C ป้องกันการเกิดหยดน้ำซึมเข้าเสื้อผ้า 100% พร้อมระบบตัดไฟหากฮีตซิงก์ร้อนเกิน 55°C'
      },

      // 9. ESP32 Controller Pod
      'esp': {
        title: 'กล่องควบคุมหลัก ESP32 Dual-Core (Central Processing Pod)',
        category: 'สมองกลประมวลผลและส่งสัญญาณข้อมูลระบบ',
        location: 'ชายเสื้อด้านหลังส่วนล่าง บรรจุในกล่องกันกระแทกกันน้ำ IP54',
        liveStatus: 'สถานะ: 🟢 ONLINE (240MHz Dual-Core) | การเชื่อมต่อ: BLE 5.0 Active | WDT: Active',
        specs: [
          ['ไมโครคอนโทรลเลอร์', 'ESP32-WROOM-32E (Xtensa Dual-Core 32-bit LX6 240MHz)'],
          ['หน่วยความจำ', '520 KB SRAM | 4 MB SPI Flash Memory'],
          ['การจัดสรรคอร์ (FreeRTOS)', 'Core 1: Cooling Engine (10Hz) | Core 0: Safety & BLE (20Hz)'],
          ['การสื่อสารไร้สาย', 'Bluetooth Low Energy 5.0 (ส่ง Telemetry สู่ 3D Digital Twin)'],
          ['การป้องกันความชื้น', 'กล่อง Enclosure ซีลยางซิลิโคน + เคลือบ Silicone Conformal Coating']
        ],
        func: 'ประมวลผลข้อมูลเซนเซอร์สภาพแวดล้อมและร่างกาย คำนวณ Heat Index, Dew Point, ควบคุมความเร็วรอบพัดลม 4 ตัว 2 โซน, แผ่นเย็น Peltier, ควบคุมระบบหล่อเย็นแบตเตอรี่ BTMS และส่ง Telemetry แบบไร้สายสู่แดชบอร์ด 3D Digital Twin',
        pinout: 'GPIO 18 (พัดลมเอว), GPIO 26 (พัดลมบ่า), GPIO 25 (Peltier), GPIO 19 (Tach), GPIO 21/22 (I2C), GPIO 34 (Batt ADC), GPIO 39 (Batt NTC), GPIO 4 (Buzzer), GPIO 2 (Haptic)',
        safety: 'มี Hardware Watchdog Timer (WDT) รีเซ็ตโปรแกรมอัตโนมัติภายใน 1 วินาทีหากค้าง และมี Safe-State ตัดการทำงานของมอเตอร์และแผ่นเย็นทันทีหาก MCU ผิดปกติ'
      },

      // 10. MOSFET Drivers
      'mos': {
        title: 'โมดูลขับกำลังทริปเปิลมอสเฟต (Triple Logic N-MOSFET Power Stage)',
        category: 'วงจรกำลังสวิตชิ่งขับโหลดไฟฟ้ากระแสสูง',
        location: 'ติดตั้งบนแผงวงจรหลักภายในกล่องคอนโทรลเลอร์',
        liveStatus: `กระแสโหลดรวม: ${liveAmps} A | อุณหภูมิไดรเวอร์: ปกติ (< 36°C) | การสวิตชิ่ง: PWM 25-40kHz`,
        specs: [
          ['โซนพัดลมเอว (Channel 0)', 'Logic MOSFET IRLZ44N (Vds: 55V, Id: 47A, Rds(on): 0.022Ω)'],
          ['โซนพัดลมบ่า (Channel 2)', 'Dual Logic MOSFET AO3400A (Vds: 30V, Id: 5.8A, Rds(on): 0.028Ω)'],
          ['โซนแผ่น Peltier (Channel 1)', 'Logic MOSFET IRLZ44N + วงจรกรอง LC Filter เรียบเนียน'],
          ['ความถี่สวิตชิ่ง (PWM)', '25 kHz (พัดลม - เหนือช่วงหูมนุษย์ได้ยิน ไร้เสียงฮัม) | 40 kHz (Peltier)']
        ],
        func: 'รับสัญญาณลอจิก PWM 3.3V จาก ESP32 เพื่อสวิตชิ่งจ่ายกระแสไฟ 12V ให้แก่มอเตอร์พัดลมและแผ่นทำความเย็นได้อย่างแม่นยำและสูญเสียความร้อนต่ำมาก (< 0.2W)',
        pinout: 'Gate 0 -> GPIO 18 | Gate 1 -> GPIO 25 | Gate 2 -> GPIO 26 | Source ลงกราวด์ร่วม (GND Rail)',
        safety: 'ไดโอด Schottky SS34 คร่อมขดลวดมอเตอร์ดูดซับ Back-EMF, ตัวต้านทาน Gate Pulldown 10kΩ ป้องกันมอเตอร์หมุนเองขณะรีบูต'
      },

      // 11. DC-DC Buck Converter
      'buck': {
        title: 'วงจรสเต็ปดาวน์ประสิทธิภาพสูง (Synchronous DC-DC Buck Converter MP1584)',
        category: 'ระบบแปลงแรงดันไฟฟ้าและกรองสัญญาณรบกวน',
        location: 'ติดตั้งบนแผงวงจรจ่ายไฟหลัก',
        liveStatus: 'แรงดันเข้า: 11.8V DC | แรงดันออก: 5.02V DC (คงที่) | ประสิทธิภาพ: 92.4%',
        specs: [
          ['ไอซีควบคุมสเต็ปดาวน์', 'Monolithic Power MP1584 High-Frequency Step-Down'],
          ['ช่วงแรงดันรับเข้า (Vin)', '7.0V - 28.0V DC'],
          ['แรงดันจ่ายออก (Vout)', '5.0V DC คงที่ (จ่ายเข้า VIN ของ ESP32 และเซนเซอร์)'],
          ['กระแสจ่ายออกสูงสุด', 'จ่ายต่อเนื่อง 2.0A (กระชากสูงสุด 3.0A)'],
          ['ประสิทธิภาพการแปลงผัน', 'สูงถึง 92% ความร้อนสะสมต่ำมาก']
        ],
        func: 'แปลงลดแรงดัน 12V จากก้อนแบตเตอรี่ลิเธียมลงเป็น 5V ที่สะอาด เพื่อจ่ายไฟเลี้ยงไมโครคอนโทรลเลอร์ ESP32, เซนเซอร์สภาพแวดล้อม และวงจรลอจิก พร้อมแยกสัญญาณรบกวนทางไฟฟ้า',
        pinout: 'Vin (+) ต่อผ่านฟิวส์ PTC 5A | Vout (+) จ่ายเข้าขา VIN ของ ESP32',
        safety: 'มีวงจรตัดเมื่อความร้อนเกิน (Thermal Shutdown 150°C) และการป้องกันกระแสเกินในตัว (Cycle-by-cycle Current Limit)'
      },

      // 12. BME280 / SHT31 Environmental Sensor
      'sht': {
        title: 'เซนเซอร์สภาพแวดล้อมภายนอก (BME280 / SHT31 Weather Sensor)',
        category: 'ระบบตรวจวัดบรรยากาศเพื่อคำนวณดัชนีความร้อน',
        location: 'กระเป๋าหน้าอกเสื้อภายนอก (External Chest Pocket) มีเยื่อ Gore-Tex ระบายอากาศ',
        liveStatus: `อุณหภูมิแวดล้อม: ${this.ambientTemp.toFixed(1)}°C | ความชื้น: ${this.ambientHumidity}% RH | Heat Index: ${this.heatIndex.toFixed(1)}°C`,
        specs: [
          ['ช่วงการวัดอุณหภูมิ', '-40°C ถึง +85°C (ความแม่นยำสูง ±0.5°C)'],
          ['ช่วงการวัดความชื้น', '0% ถึง 100% RH (ความแม่นยำสูง ±3% RH)'],
          ['การเชื่อมต่อข้อมูล', 'I2C Bus (Standard-Mode 100kHz / Fast-Mode 400kHz)'],
          ['ที่อยู่บนบัส (I2C Address)', '0x76 (หรือ 0x44 สำหรับ SHT31)'],
          ['การป้องกันสิ่งแวดล้อม', 'แผ่นเยื่อ Gore-Tex กันละอองน้ำและฝุ่น แต่ให้อากาศผ่านได้']
        ],
        func: 'ตรวจวัดอุณหภูมิและความชื้นสัมพัทธ์ของอากาศภายนอกที่แท้จริง เพื่อให้ ESP32 นำไปคำนวณดัชนีความร้อน NOAA Steadman Heat Index และจุดน้ำค้าง Magnus Dew Point แบบเรียลไทม์',
        pinout: 'SDA เชื่อมต่อ <strong>GPIO 21</strong> | SCL เชื่อมต่อ <strong>GPIO 22</strong> | ไฟเลี้ยง 3.3V จาก ESP32',
        safety: 'ติดตั้งภายนอกเสื้อ แยกจากไอร้อนและเหงื่อของร่างกาย เพื่อให้ได้ค่าสภาพอากาศที่แท้จริง ไม่คลาดเคลื่อน'
      },

      // 13. MPU6050 Motion & Fall Detection
      'mpu': {
        title: 'เซนเซอร์ตรวจจับการล้มและท่าทาง (MPU6050 6-Axis Motion IMU)',
        category: 'ระบบความปลอดภัยและตรวจจับอุบัติเหตุผู้ปฏิบัติงาน (Man-Down Detection)',
        location: 'แนบกึ่งกลางแผ่นหลังเสื้อกั๊ก (ใกล้จุดศูนย์ถ่วงร่างกาย)',
        liveStatus: 'สถานะ: ทรงตัวปกติ (Normal Upright Posture) | ตรวจจับการล้ม: เฝ้าระวัง Active',
        specs: [
          ['เซนเซอร์วัดความเร่ง', '3-Axis Accelerometer (สเกลวัด ±2g / ±4g / ±8g / ±16g)'],
          ['เซนเซอร์วัดการหมุน', '3-Axis Gyroscope (สเกลวัด ±250 / ±500 / ±2000 dps)'],
          ['อัตราการสุ่มตัวอย่าง', '50 Hz (ตรวจจับแรงกระแทกเฉียบพลันได้ภายใน 20ms)'],
          ['อินเตอร์เฟส', 'I2C Bus ร่วม (I2C Address: 0x68)']
        ],
        func: 'ตรวจจับแรงกระแทกเฉียบพลันร่วมกับการนอนราบผิดปกติของผู้ปฏิบัติงาน (Fall / Impact Detection) หากคนงานเป็นลมหมดสติจากโรคลมแดด (Heat Stroke) หรือพลัดตก ระบบจะส่งสัญญาณเตือนภัย SOS และแจ้งพิกัดทันที',
        pinout: 'เชื่อมต่อ I2C Bus ร่วม (SDA: GPIO 21, SCL: GPIO 22) | ขา Interrupt ต่อเข้า GPIO 23',
        safety: 'มีอัลกอริทึมกรอง False Alarm (แยกแยะระหว่างการก้มตัวทำงานปกติ กับการล้มกระแทกพื้นหมดสติ)'
      },

      // 14. DS18B20 Skin Sensor
      'ds': {
        title: 'เซนเซอร์วัดอุณหภูมิร่างกายแบบสัมผัส (DS18B20 Skin Contact Probe)',
        category: 'ระบบตรวจสอบสรีรวิทยาและควบคุมแบบ Closed-loop PID',
        location: 'แถบซับในแนบชิดผิวหนังบริเวณหน้าอก/ซี่โครงด้านใน',
        liveStatus: `อุณหภูมิผิวหนังสด: ${liveSkinTemp}°C (ช่วงปกติ: 33.0 - 35.5°C) | สภาวะ: ${this.skinTemp > 37.5 ? '⚠️ ร่างกายร้อนเกิน' : 'ปกติปลอดภัย'}`,
        specs: [
          ['ความละเอียดการวัด', '12-bit Digital (0.0625°C Resolution)'],
          ['ความแม่นยำทางการแพทย์', '±0.1°C ในช่วงอุณหภูมิ 30°C ถึง 45°C'],
          ['ปลอกหุ้มเซนเซอร์', 'สแตนเลสเกรด 304 กันน้ำกันเหงื่อ 100% (IP68 Waterproof)'],
          ['โปรโตคอลสื่อสาร', '1-Wire Bus (สายสัญญาณเส้นเดียว)']
        ],
        func: 'ตรวจวัดอุณหภูมิผิวหนังของผู้สวมใส่แบบเรียลไทม์ ป้อนกลับเข้าสู่อัลกอริทึม Closed-loop PID เพื่อเร่งพัดลมเมื่อร่างกายเริ่มร้อน หรือหรี่กำลังลงเมื่อร่างกายเย็นลง ช่วยรักษาสมดุลความสบายและประหยัดแบตเตอรี่',
        pinout: 'สายสัญญาณต่อเข้า <strong>GPIO 27</strong> (พร้อมตัวต้านทาน Pull-up 4.7kΩ) | ไฟเลี้ยง 3.3V',
        safety: 'หุ้มฉนวนซิลิโคนทางการแพทย์ ปลอดภัยต่อผิวหนัง ไม่ก่อให้เกิดการระคายเคืองหรือแพ้'
      },

      // 15. Battery NTC Thermistor
      'ntc': {
        title: 'เซนเซอร์วัดความร้อนเซลล์แบตเตอรี่ (Battery NTC 10K Thermistor)',
        category: 'ระบบเฝ้าระวังความปลอดภัยของแบตเตอรี่ (BTMS Overheat Sensor)',
        location: 'แปะแนบกึ่งกลางผิวเซลล์แบตเตอรี่ลิเธียมด้านในกล่อง',
        liveStatus: `อุณหภูมิเซลล์แบตเตอรี่: ${liveBattTemp}°C | เกณฑ์ความปลอดภัย: < 45.0°C (ปกติ)`,
        specs: [
          ['ชนิดเซนเซอร์', 'Negative Temperature Coefficient (NTC) Thermistor 10kΩ'],
          ['ค่าสัมประสิทธิ์ B-Value', 'B25/85 = 3950K ±1%'],
          ['ช่วงการวัดอุณหภูมิ', '-20°C ถึง +105°C'],
          ['ความเร็วในการตอบสนอง', 'Thermal Time Constant < 1.5 วินาที']
        ],
        func: 'ตรวจจับอุณหภูมิของเซลล์แบตเตอรี่ลิเธียมอย่างใกล้ชิด เมื่ออุณหภูมิเริ่มสูงเกิน 38°C จะสั่งเปิดพัดลม BTMS ระบายความร้อน และหากอุณหภูมิสูงเกิน 45°C จะสั่งตัดการจ่ายไฟทันทีเพื่อป้องกันแบตเตอรี่เสื่อมหรือลุกไหม้',
        pinout: 'ต่อวงจรแบ่งแรงดัน (Voltage Divider 10kΩ) เข้าขาแอนะล็อก <strong>GPIO 39</strong> (ADC1_CH3)',
        safety: 'ทำงานร่วมกับ FreeRTOS TaskSafetyWatchdog ตรวจสอบทุกๆ 50ms ให้ความมั่นใจในความปลอดภัยระดับสูงสุด'
      },

      // 16. Haptic Vibration Motor
      'vib': {
        title: 'มอเตอร์สั่นแจ้งเตือนเตือนภัยสรีรวิทยา (Haptic Vibration Motor)',
        category: 'ระบบแจ้งเตือนแบบสัมผัสทางกายภาพ (Tactile Alerting System)',
        location: 'บริเวณปกคอด้านหลัง สัมผัสกับผิวต้นคอโดยตรง',
        liveStatus: `${this.alarmActive ? '🔴 กำลังสั่นเตือนภัยฉุกเฉิน (SOS Pattern)' : '⚪ สแตนด์บาย'}`,
        specs: [
          ['ชนิดมอเตอร์', 'Coreless DC Vibration Motor ขนาด 10 × 3 มม.'],
          ['ความเร็วรอบการสั่น', '12,000 RPM (ความถี่สัมผัสชัดเจนบนผิวหนัง)'],
          ['แรงดันไฟ / กระแส', '3.3V DC | 65mA'],
          ['รูปแบบการสั่น (Patterns)', 'สั่นสั้น 1 ครั้ง (เปลี่ยนโหมด) | สั่นยาว (แบตเตอรี่ต่ำ) | สั่นจังหวะ SOS (เสี่ยงฮีทสโตรก)']
        ],
        func: 'แจ้งเตือนสถานะสำคัญให้ผู้ปฏิบัติงานทราบทันทีผ่านการสัมผัสที่ต้นคอ โดยผู้ใช้ไม่ต้องก้มมองหน้าจอหรือพึ่งพาเสียงในไซต์งานก่อสร้างหรือโรงงานที่มีเสียงดังรบกวน',
        pinout: 'ขับผ่านทรานซิสเตอร์ NPN จากขาดิจิทัล <strong>GPIO 2</strong>',
        safety: 'กระแสไฟต่ำ ทำงานแยกอิสระ หุ้มฉนวนซิลิโคนกันเหงื่อสมบูรณ์แบบ'
      },

      // 17. Tactical Front Button
      'btn': {
        title: 'ปุ่มกดมัลติฟังก์ชันกันน้ำ (Tactical Front Chest Button)',
        category: 'อินเตอร์เฟสควบคุมฮาร์ดแวร์แบบกายภาพ (Physical User Interface)',
        location: 'หน้าอกเสื้อฝั่งขวา กดสะดวกแม้สวมถุงมือก่อสร้างหนา',
        liveStatus: 'สถานะ: สแตนด์บาย | รองรับ Single Click, Double Click, Long Press',
        specs: [
          ['มาตรฐานกันน้ำกันฝุ่น', 'IP67 Sealed Waterproof Tactile Switch'],
          ['แรงกดในการสั่งการ', 'Tactile Actuation Force: 250 gf (กดชัดเจน มีเสียงคลิก)'],
          ['อายุการใช้งานการกด', '> 100,000 ครั้ง'],
          ['ไฟบอกสถานะบนปุ่ม', 'วงแหวนไฟ LED แสดงโหมดการทำงาน']
        ],
        func: 'กดสั้นเพื่อวนสลับโหมดทำความเย็น (AUTO AI -> TURBO -> ECO), กดยาว 3 วินาทีเพื่อเปิดหรือปิดระบบ และกดย้ำ 3 ครั้งเพื่อส่งสัญญาณฉุกเฉิน SOS ขอความช่วยเหลือ',
        pinout: 'ต่อเข้าขาดิจิทัล <strong>GPIO 15</strong> (พร้อมวงจร Debounce ฮาร์ดแวร์)',
        safety: 'ป้องกันการกดลั่นโดยไม่ตั้งใจ (Accidental Press Protection)'
      },

      // 18. 3D Spacer Mesh Air Ducts
      'duct': {
        title: 'ช่องทางเดินลมโครงข่าย 3 มิติ (3D Honeycomb Spacer Mesh Channels)',
        category: 'โครงสร้างสถาปัตยกรรมทางเดินลม (Air Distribution Core)',
        location: 'ชั้นซับในรองรอบตัวเสื้อ (แนบแผ่นหลัง ซอกคอ และแผงอก)',
        liveStatus: `การไหลเวียนลม: ลามินาร์รอบลำตัว | แรงดันลมสถิต: ${(livePWM * 0.42).toFixed(1)} mmH2O`,
        specs: [
          ['ความหนาของโครงข่าย', '8.0 มม. (3D Honeycomb Monofilament Structure)'],
          ['ความทนทานต่อแรงกดทับ', 'รับน้ำหนักกดทับได้มากกว่า 45 kPa โดยไม่ตีบตัน'],
          ['อัตราการไหลของอากาศ', 'Air Permeability > 1,200 mm/s'],
          ['น้ำหนักและเนื้อผ้า', 'Polyester Monofilament 100% ไม่อมเหงื่อ แห้งไว']
        ],
        func: 'ทำหน้าที่เป็นโพรงอุโมงค์ลมที่กระจายลมแรงดันสถิตจากพัดลมหอยโข่งให้แผ่กระจายอย่างทั่วถึงรอบลำตัว โดยไม่ถูกน้ำหนักของกระเป๋าหรือเสื้อผ้ากดทับจนแบน ช่วยให้เหงื่อระเหยได้เต็มประสิทธิภาพ 360 องศา',
        pinout: 'โครงสร้างทางกายภาพแบบไร้สาย (Passive Apparel Layer)',
        safety: 'เคลือบสารต่อต้านแบคทีเรียและเชื้อรา (Anti-Microbial & Anti-Odor Treatment) ถอดซักทำความสะอาดได้ง่าย'
      },

      // 19. 3M Scotchlite Reflective Stripes
      'stripes': {
        title: 'แถบสะท้อนแสงนิรภัย 3M (3M Scotchlite Retroreflective Safety Stripes)',
        category: 'มาตรฐานความปลอดภัยการทำงานกะกลางคืน (High-Visibility Safety)',
        location: 'พาดผ่านรอบอก เอว และแนวบ่าไหล่ (ลายลูกศรและบ่า)',
        liveStatus: 'มาตรฐาน: ANSI/ISEA 107 Class 2 & EN ISO 20471 Compliant | ค่าสะท้อนย้อนกลับ: 500 cd/(lx·m²)',
        specs: [
          ['วัสดุสะท้อนแสง', '3M Scotchlite Reflective Material 8912 Silver Fabric'],
          ['เทคโนโลยีการสะท้อน', 'Micro-Glass Bead Technology สะท้อนแสงไฟย้อนกลับสู่ต้นทาง'],
          ['ระยะการมองเห็น', 'มองเห็นได้ไกลกว่า 300 เมตรเมื่อถูกแสงไฟหน้ารถกระทบ'],
          ['ความทนทานต่อการซัก', 'คงคุณสมบัติสะท้อนแสงสูงหลังการซักอุตสาหกรรม > 50 รอบ']
        ],
        func: 'ช่วยให้ผู้ขับขี่ยานพาหนะและเพื่อนร่วมงานมองเห็นผู้ปฏิบัติงานได้อย่างชัดเจนในเวลากลางคืน ไซต์งานก่อสร้างทางหลวง หรือในอุโมงค์และโกดังสินค้าที่แสงสว่างน้อย เพิ่มความปลอดภัยในชีวิตสูงสุด',
        pinout: 'แถบผ้าสะท้อนแสงเชิงกายภาพ',
        safety: 'ผ่านการรับรองมาตรฐานชุดทำงานความปลอดภัยสูงสากล ไม่ติดไฟและทนต่อสารเคมีเจือจาง'
      },

      // 20. YKK Waterproof Zipper
      'zipper': {
        title: 'ซิปกันน้ำและเหงื่อคุณภาพสูง (YKK AquaGuard Waterproof Zipper)',
        category: 'ระบบซีลแรงดันลมและป้องกันน้ำซึม (Pneumatic & Moisture Sealing)',
        location: 'แนวกึ่งกลางด้านหน้าเสื้อกั๊ก และขอบปกคอเสื้อ',
        liveStatus: 'สถานะ: รูดปิดสนิท (Full Pressure Sealed) | ป้องกันลมเย็นรั่วไหลออกด้านหน้า',
        specs: [
          ['ยี่ห้อและรุ่น', 'YKK AquaGuard 5CN Reverse Coil Waterproof Zipper'],
          ['ฟิล์มเคลือบกันน้ำ', 'Polyurethane (PU) Film Lamination'],
          ['ระดับการป้องกันความชื้น', 'IP65 Water-Resistant Barrier'],
          ['ความทนทานต่อแรงดึง', 'Crosswise Tensile Strength > 600 N']
        ],
        func: 'ปิดผนึกไม่ให้ลมเย็นแรงดันสถิตที่พัดลมสร้างขึ้นรั่วไหลออกทางด้านหน้าเสื้อ บังคับให้ลมไหลผ่านชั้น 3D Spacer Mesh ไปสู่ลำคอและศีรษะอย่างเต็มเม็ดเต็มหน่วย พร้อมป้องกันฝนและเหงื่อจากภายนอกไม่ให้ซึมเข้าสู่วงจรอิเล็กทรอนิกส์',
        pinout: 'ชิ้นส่วนเสื้อผ้ากลไก (Mechanical Apparel Hardware)',
        safety: 'หัวซิปแบบ Smooth Glide รูดเปิดออกได้อย่างรวดเร็วในขั้นตอนเดียว (Quick-Release) เมื่อเกิดเหตุฉุกเฉิน'
      },

      // 21. Vest Shell
      'shell': {
        title: 'เปลือกนอกเสื้อกั๊กผ้าคอร์ดูรา (Cordura 500D Ripstop Vest Shell)',
        category: 'โครงสร้างเนื้อผ้าภายนอกทนทานสูง (Durable Outer Shell)',
        location: 'ชั้นนอกสุดของเสื้อกั๊กปรับอากาศ',
        liveStatus: 'เนื้อผ้า: Cordura 500D Ripstop | สี: High-Tech Cyan/Teal | เคลือบ DWR กันน้ำ',
        specs: [
          ['ชนิดเนื้อผ้า', 'INVISTA Cordura 500D Nylon with Ripstop Grid'],
          ['การเคลือบผิวผ้า', 'DWR (Durable Water Repellent) + PU Coating ด้านใน'],
          ['ความทนทานต่อการขัดสี', 'ทนต่อการเสียดสีและการเจาะทะลุได้สูงกว่าไนลอนปกติ 3 เท่า'],
          ['น้ำหนักตัวเสื้อเปล่า', '350 กรัม (เบาสบาย กระจายน้ำหนักตามหลักการยศาสตร์)']
        ],
        func: 'เป็นโครงสร้างหลักในการยึดเกาะพัดลมทั้ง 4 ตัว, โมดูลแบตเตอรี่, แผ่น Peltier, และกล่องคอนโทรลเลอร์ ให้แนบชิดกับสรีระอย่างมั่นคง ไม่แกว่งหรือถ่วงหลังขณะก้ม เงย หรือยกของหนัก',
        pinout: 'โครงสร้างผ้าหลัก',
        safety: 'ทนต่อสะเก็ดไฟและรอยขีดข่วนจากงานก่อสร้าง ระบายความชื้นได้และทำความสะอาดง่าย'
      },

      // 22. Mannequin / Worker
      'mannequin': {
        title: 'แบบจำลองสรีรวิทยาผู้สวมใส่ (Ergonomic Physiological Model)',
        category: 'มนุษย์จำลองและการตอบสนองทางชีวภาพ (Human Digital Twin)',
        location: 'แกนกลางร่างกายผู้สวมใส่',
        liveStatus: `อุณหภูมิร่างกาย: ${liveSkinTemp}°C | ชีพจร: ${this.heartRate} BPM | ดัชนีความร้อนสะสม: ${this.heatIndex.toFixed(1)}°C`,
        specs: [
          ['ขนาดสรีระจำลอง', 'มาตรฐานไซส์ L ชายไทย (รอบอก 40-42 นิ้ว, ส่วนสูง 175 ซม.)'],
          ['จุดสัมผัสความเย็นสำคัญ', 'กระดูกสันหลังส่วนบน (Peltier) + ใบหน้า/ซอกคอ (พัดลมบ่า) + ลำตัว (พัดลมเอว)'],
          ['เกณฑ์เตือนภัยฮีทสโตรก', 'Heart Rate > 130 BPM ร่วมกับ Heat Index > 42°C']
        ],
        func: 'แสดงผลการตอบสนองของร่างกายแบบ Closed-loop การถ่ายเทความร้อนจากผิวหนังไปยังกระแสลม และการตรวจจับความผิดปกติของสัญญาณชีพแบบเรียลไทม์',
        pinout: 'ติดตามผ่านเซนเซอร์ MAX30102 (PPG), DS18B20 (Skin Temp), MPU6050 (Motion)',
        safety: 'ระบบเตือนภัยฮีทสโตรกล่วงหน้า สั่นเตือนที่ต้นคอพร้อมส่งเสียงบี๊บแจ้งเตือนเมื่อพบสัญญาณชีพผิดปกติ'
      }
    };

    // Normalize keys to support aliases
    const keyMap = {
      'oled': 'oled', 'oled_screen': 'oled', 'hud': 'oled', 'screen': 'oled',
      'fan': 'fan', 'fan_l': 'fan', 'fan_r': 'fan', 'comp-fans': 'fan',
      'sfan': 'sfan', 'shoulder_fan_l': 'sfan', 'shoulder_fan_r': 'sfan', 'comp-shoulder-fans': 'sfan',
      'bfan': 'bfan', 'btms': 'bfan', 'comp-batt-cooling': 'bfan',
      'shield': 'shield',
      'bat': 'bat', 'comp-battery': 'bat',
      'bms': 'bms',
      'fuse': 'fuse', 'comp-fuse': 'fuse',
      'tec': 'tec', 'comp-peltier': 'tec',
      'esp': 'esp', 'comp-esp32': 'esp',
      'mos': 'mos', 'driver': 'mos',
      'buck': 'buck', 'comp-buck': 'buck',
      'sht': 'sht', 'comp-bme280': 'sht',
      'mpu': 'mpu', 'comp-health-sensors': 'mpu',
      'ds': 'ds', 'ds18': 'ds',
      'ntc': 'ntc',
      'vib': 'vib',
      'btn': 'btn',
      'duct': 'duct',
      'stripes': 'stripes',
      'zipper': 'zipper',
      'shell': 'shell',
      'mannequin': 'mannequin'
    };

    const mappedKey = keyMap[key] || key;
    const item = compDb[mappedKey];

    if (!item) {
      card.style.display = 'none';
      return;
    }

    // Build specs table HTML
    let specsRowsHtml = '';
    if (item.specs && item.specs.length > 0) {
      specsRowsHtml = item.specs.map(row => `
        <tr>
          <td>${row[0]}</td>
          <td>${row[1]}</td>
        </tr>
      `).join('');
    }

    // Render Compact Collapsible Accordion Inspector Card
    card.classList.remove('minimized');
    card.innerHTML = `
      <div class="inspect-header">
        <div class="inspect-badge">SPEC INSPECTOR</div>
        <div class="inspect-actions">
          <button id="btn-min-inspect" class="inspect-ctrl-btn" title="ย่อ / ขยายกล่อง">_</button>
          <button id="btn-close-inspect" class="inspect-ctrl-btn close" title="ปิดหน้าต่าง">✕</button>
        </div>
      </div>

      <!-- Minimized Bar View (shown when minimized) -->
      <div id="inspect-min-bar" style="display: none; align-items: center; justify-content: space-between; font-size: 11px;">
        <span style="font-weight: 700; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 190px;">${item.title.split('(')[0]}</span>
        <button id="btn-expand-inspect" class="inspect-ctrl-btn" style="width: auto; padding: 2px 7px; font-size: 10px;" title="ขยายกลับ">▲ ขยาย</button>
      </div>

      <!-- Full Collapsible Accordion Content -->
      <div id="inspect-full-content">
        <h3 class="inspect-title">${item.title}</h3>
        <div class="inspect-subtitle">📌 ${item.category} • ${item.location}</div>

        <div class="inspect-live-pill">
          <div class="inspect-live-dot"></div>
          <span><strong>สถานะ:</strong> ${item.liveStatus}</span>
        </div>

        ${specsRowsHtml ? `
        <details class="inspect-accordion">
          <summary>⚡ สเปกวิศวกรรม (Specs)</summary>
          <div class="inspect-accordion-content">
            <table class="inspect-specs-table">
              <tbody>${specsRowsHtml}</tbody>
            </table>
          </div>
        </details>
        ` : ''}

        <details class="inspect-accordion">
          <summary>🎯 หน้าที่ในระบบ (Function)</summary>
          <div class="inspect-accordion-content">
            <p class="inspect-text" style="margin: 0;">${item.func}</p>
          </div>
        </details>

        <details class="inspect-accordion">
          <summary>🔌 พิน ESP32 & ความปลอดภัย</summary>
          <div class="inspect-accordion-content">
            <div class="inspect-text inspect-box-green" style="font-size: 10.5px; margin-bottom: 6px;">
              ${item.pinout}
            </div>
            <div class="inspect-text inspect-box-warning" style="font-size: 10.5px; margin-bottom: 0;">
              ${item.safety}
            </div>
          </div>
        </details>
      </div>
    `;

    card.style.display = 'block';
    this.playBeep(920, 0.04);

    // Minimize / Maximize toggle logic
    const fullContent = document.getElementById('inspect-full-content');
    const minBar = document.getElementById('inspect-min-bar');
    const minBtn = document.getElementById('btn-min-inspect');
    const expBtn = document.getElementById('btn-expand-inspect');

    const toggleMin = (e) => {
      if (e) e.stopPropagation();
      const isMin = card.classList.toggle('minimized');
      if (isMin) {
        fullContent.style.display = 'none';
        minBar.style.display = 'flex';
        minBtn.textContent = '▲';
      } else {
        fullContent.style.display = 'block';
        minBar.style.display = 'none';
        minBtn.textContent = '_';
      }
      this.playBeep(750, 0.03);
    };

    if (minBtn) minBtn.onclick = toggleMin;
    if (expBtn) expBtn.onclick = toggleMin;

    card.onclick = (e) => {
      if (card.classList.contains('minimized') && e.target !== closeBtn) {
        toggleMin(e);
      }
    };

    const closeBtn = document.getElementById('btn-close-inspect');
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        card.style.display = 'none';
        if (this.scene) this.scene.highlightComponent(null);
      };
    }
  }

  /**
   * Periodic Physics Update (Continuous small noise / heart flutter)
   */
  updatePhysicsLoop() {
    // Add realistic subtle jitter to live sensor readouts
    if (this.systemPower) {
      const jitter = (Math.random() - 0.5) * 15;
      const liveRPM = Math.max(0, Math.round(this.fanRPM + jitter));
      this.setVal('val-fan-rpm', `${liveRPM}`);
    }
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.smartVestApp = new SmartVestApp();
});
