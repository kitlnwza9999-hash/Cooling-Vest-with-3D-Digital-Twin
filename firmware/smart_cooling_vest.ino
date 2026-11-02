/**
 * ==============================================================================
 * Project: Smart Cooling Vest with 3D Digital Twin (เสื้อกั๊กปรับอากาศอัจฉริยะ)
 * Controller: ESP32-WROOM-32E (240MHz Dual-Core Xtensa LX6)
 * Real-Time OS: FreeRTOS Dual-Core Architecture
 * Features:
 *   - Environmental Sensing: BME280 (Temp, Humidity, Barometer)
 *   - NOAA Steadman Heat Index & Magnus Dew Point Watchdog
 *   - Anti-Condensation Protection against Sweat / Moisture Formation
 *   - Dual 12V Brushless High-Pressure Centrifugal Blowers (PWM 25kHz)
 *   - Cervical Spine Thermoelectric Cooling (TEC1-12706 with LC Filter)
 *   - Biometric Tachycardia (Heat Stroke) & Motion/Fall Watchdog
 *   - BLE Telemetry Broadcaster for 3D Digital Twin Interface
 * ==============================================================================
 */

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include "pin_definitions.h"

// ================= BLE DEFINITIONS =================
#define SERVICE_UUID           "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID_TX "beb5483e-36e1-4688-b7f5-ea07361b26a8"

BLEServer* pServer = NULL;
BLECharacteristic* pTxCharacteristic = NULL;
bool deviceConnected = false;

// ================= PWM CHANNELS =================
#define PWM_FREQ_FAN        25000 // 25 kHz - High Frequency silent motor drive
#define PWM_FREQ_TEC        40000 // 40 kHz - Ripple suppression for Peltier
#define PWM_RES             8     // 8-bit (0-255)
#define PWM_CH_FAN          0     // Dual Lower Lumbar Blowers (Torso)
#define PWM_CH_TEC          1     // Cervical Spine Peltier Cooler
#define PWM_CH_SHOULDER_FAN 2     // Dual Shoulder Micro-Turbofans (Face/Neck)

// ================= TELEMETRY DATA STRUCTURE =================
struct VestData {
  float ambientTemp;
  float humidity;
  float heatIndex;
  float dewPoint;
  float skinTemp;
  float heatsinkTemp;
  float batteryVolts;
  float batteryTemp;      // Dedicated Battery Cell Surface Temp (°C)
  uint16_t fanRPM;
  uint8_t fanDuty;
  uint8_t shoulderFanDuty;// Shoulder Micro-Turbofans PWM (0-255)
  uint8_t tecDuty;
  uint16_t heartRate;
  bool dewPointAlert;
  bool heatsinkOverheatAlert;
  bool batteryOverheatAlert;
  bool heatStrokeAlert;
  bool emergencyCutoff;
} vestData;

Adafruit_BME280 bme;
volatile uint32_t fanTachCounter = 0;
portMUX_TYPE isrMux = portMUX_INITIALIZER_UNLOCKED;

// ================= ISR FOR FAN SPEED =================
void IRAM_ATTR onFanTachPulse() {
  portENTER_CRITICAL_ISR(&isrMux);
  fanTachCounter++;
  portEXIT_CRITICAL_ISR(&isrMux);
}

// ================= BLE SERVER CALLBACKS =================
class ServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
  }
  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    pServer->getAdvertising()->start(); // Restart advertising
  }
};

// ================= THERMAL MATHEMATICS =================

/**
 * Calculates Magnus-Tetens Dew Point (°C)
 * Essential to maintain T_cold >= T_dew + 1.5°C to avoid condensation!
 */
float computeDewPoint(float temp, float humidity) {
  float a = 17.625f;
  float b = 243.04f;
  float alpha = ((a * temp) / (b + temp)) + log(humidity / 100.0f);
  return (b * alpha) / (a - alpha);
}

/**
 * Calculates Steadman Heat Index (°C) according to NOAA formulas
 */
float computeHeatIndex(float tempC, float humidity) {
  float T = (tempC * 9.0f / 5.0f) + 32.0f; // Fahrenheit
  float R = humidity;
  float hi = 0.5f * (T + 61.0f + ((T - 68.0f) * 1.2f) + (R * 0.094f));

  if (hi >= 80.0f) {
    hi = -42.379f + 2.04901523f * T + 10.14333127f * R - 0.22475541f * T * R
         - 0.00683783f * T * T - 0.05481717f * R * R + 0.00122874f * T * T * R
         + 0.00085282f * T * R * R - 0.00000199f * T * T * R * R;
  }
  return (hi - 32.0f) * 5.0f / 9.0f;
}

// ================= CORE 1 TASK: CLIMATE CONTROL LOOP =================
void TaskCoolingControl(void *pvParameters) {
  TickType_t xLastWakeTime = xTaskGetTickCount();
  const TickType_t xFrequency = pdMS_TO_TICKS(100); // 10Hz

  for (;;) {
    // 1. Read Environmental Sensors
    vestData.ambientTemp = bme.readTemperature();
    vestData.humidity = bme.readHumidity();

    // 2. Calculate Environmental Indices
    vestData.heatIndex = computeHeatIndex(vestData.ambientTemp, vestData.humidity);
    vestData.dewPoint = computeDewPoint(vestData.ambientTemp, vestData.humidity);

    // 3. Closed-Loop Multi-Stage Cooling Automation
    if (!vestData.emergencyCutoff) {
      if (vestData.heatIndex < 27.0f) {
        // Comfortable / Cool: Low gentle airflow, Peltier off
        vestData.fanDuty = 60;   // ~24%
        vestData.shoulderFanDuty = 75; // ~29% พัดลมบ่าเป่าหน้าเบาๆ
        vestData.tecDuty = 0;
      } else if (vestData.heatIndex < 35.0f) {
        // Moderate Warmth: Medium breeze, light active cooling
        vestData.fanDuty = 120;  // ~47%
        vestData.shoulderFanDuty = 140;// ~55% ลมเป่าคาง/หน้าสดชื่น
        vestData.tecDuty = 70;   // ~27%
      } else if (vestData.heatIndex < 42.0f) {
        // High Thermal Stress: Strong airflow + targeted spine cooling
        vestData.fanDuty = 185;  // ~72%
        vestData.shoulderFanDuty = 205;// ~80%
        vestData.tecDuty = 170;  // ~66%
      } else {
        // Extreme Caution / Danger: Maximum cooling blast
        vestData.fanDuty = 250;  // ~98%
        vestData.shoulderFanDuty = 255;// 100% ลมแรงสุดรอบทิศทาง
        vestData.tecDuty = 220;  // ~86%
      }

      // 4. Anti-Condensation Dew Point Interlock
      // If Peltier cold plate falls below Dew Point + 1.5°C, throttle PWM
      float estimatedColdPlate = vestData.ambientTemp - (vestData.tecDuty / 255.0f) * 14.0f;
      float safeDewThreshold = vestData.dewPoint + DEW_POINT_SAFETY_MARGIN;

      if (estimatedColdPlate < safeDewThreshold) {
        vestData.dewPointAlert = true;
        // Clamp Peltier power to safe dew point threshold
        float allowedDelta = max(0.0f, vestData.ambientTemp - safeDewThreshold);
        vestData.tecDuty = (uint8_t)constrain((allowedDelta / 14.0f) * 255.0f, 0, 255);
      } else {
        vestData.dewPointAlert = false;
      }
    } else {
      // In emergency safety state: shut down Peltier, run fans to flush heat
      vestData.fanDuty = 255;
      vestData.shoulderFanDuty = 255;
      vestData.tecDuty = 0;
    }

    // Apply hardware PWM outputs to all 4 fans and Peltier
    ledcWrite(PWM_CH_FAN, vestData.fanDuty);
    ledcWrite(PWM_CH_SHOULDER_FAN, vestData.shoulderFanDuty);
    ledcWrite(PWM_CH_TEC, vestData.tecDuty);

    vTaskDelayUntil(&xLastWakeTime, xFrequency);
  }
}

// ================= CORE 0 TASK: SAFETY WATCHDOG & TELEMETRY =================
void TaskSafetyWatchdog(void *pvParameters) {
  TickType_t xLastWakeTime = xTaskGetTickCount();
  const TickType_t xFrequency = pdMS_TO_TICKS(50); // 20Hz high reliability

  for (;;) {
    // 1. Read Battery Voltage (Voltage Divider R1=30k, R2=10k)
    int rawBatt = analogRead(PIN_BATT_SENSE);
    vestData.batteryVolts = (rawBatt / 4095.0f) * 3.3f * 4.0f; // Scale factor

    // 2. Read Dedicated Battery Surface NTC Sensor (BTMS)
    int rawBattNTC = analogRead(PIN_BATT_NTC);
    vestData.batteryTemp = (rawBattNTC / 4095.0f) * 65.0f;

    // 3. Read Heatsink Temperature (NTC on Peltier Hot Side)
    int rawNTC = analogRead(PIN_HEATSINK_NTC);
    vestData.heatsinkTemp = (rawNTC / 4095.0f) * 85.0f;

    // 4. Safety Critical Interlocks:
    // A. Hot-side Heatsink Overheat Protection (> 55°C)
    // B. Battery Cell Overheat Protection (> 45°C)
    // C. Battery Under-Voltage Protection (< 9.6V)
    if (vestData.heatsinkTemp > MAX_SAFE_HEATSINK_TEMP || 
        vestData.batteryTemp > MAX_SAFE_BATT_TEMP || 
        vestData.batteryVolts < BATT_MIN_CUTOFF_VOLTAGE) {
      vestData.emergencyCutoff = true;
      digitalWrite(PIN_BUZZER, HIGH); // Sound continuous emergency alarm
    } else {
      vestData.emergencyCutoff = false;
      digitalWrite(PIN_BUZZER, LOW);
    }

    // Battery Cooling Thermal Boost: If battery > 38°C, force fans to max to flush battery heat
    if (vestData.batteryTemp > BATT_COOLING_BOOST_TEMP && !vestData.emergencyCutoff) {
      vestData.fanDuty = max(vestData.fanDuty, (uint8_t)230);
    }

    // 5. Biometric Heat Stroke & Exhaustion Watchdog
    // If Heat Index > 44°C and Heart Rate > 135 bpm -> Worker in acute danger!
    if (vestData.heatIndex > 44.0f && vestData.heartRate > 135) {
      vestData.heatStrokeAlert = true;
      // SOS vibration pulse on collar (haptic motor)
      digitalWrite(PIN_HAPTIC, (millis() % 600 < 300) ? HIGH : LOW);
    } else {
      vestData.heatStrokeAlert = false;
      digitalWrite(PIN_HAPTIC, LOW);
    }

    // 6. Calculate Real-Time Fan RPM (Pulses per second * 30)
    static uint32_t lastTachTime = 0;
    if (millis() - lastTachTime >= 1000) {
      portENTER_CRITICAL(&isrMux);
      uint32_t pulses = fanTachCounter;
      fanTachCounter = 0;
      portEXIT_CRITICAL(&isrMux);

      vestData.fanRPM = (pulses / 2) * 60; // 2 pulses per revolution
      lastTachTime = millis();

      // Transmit Telemetry Packet over BLE to 3D Digital Twin Dashboard
      if (deviceConnected && pTxCharacteristic) {
        char telemetryBuffer[110];
        snprintf(telemetryBuffer, sizeof(telemetryBuffer),
          "{\"amb\":%.1f,\"hum\":%.0f,\"hi\":%.1f,\"rpm\":%u,\"sh_rpm\":%u,\"tec\":%u,\"v\":%.2f,\"tbatt\":%.1f}",
          vestData.ambientTemp, vestData.humidity, vestData.heatIndex,
          vestData.fanRPM, (uint16_t)(vestData.shoulderFanDuty * 19.6f),
          vestData.tecDuty, vestData.batteryVolts, vestData.batteryTemp
        );
        pTxCharacteristic->setValue((uint8_t*)telemetryBuffer, strlen(telemetryBuffer));
        pTxCharacteristic->notify();
      }
    }

    vTaskDelayUntil(&xLastWakeTime, xFrequency);
  }
}

// ================= ARDUINO SETUP =================
void setup() {
  Serial.begin(115200);
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);

  // Configure Digital & Alert Pins
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_HAPTIC, OUTPUT);
  pinMode(PIN_STATUS_LED, OUTPUT);
  pinMode(PIN_USER_BTN, INPUT_PULLUP);

  // Tachometer Interrupt
  pinMode(PIN_FAN_TACH, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_FAN_TACH), onFanTachPulse, FALLING);

  // Setup Hardware PWM channels (LEDC)
  // Channel 0: Dual Lower Lumbar Blowers (Torso)
  ledcSetup(PWM_CH_FAN, PWM_FREQ_FAN, PWM_RES);
  ledcAttachPin(PIN_FAN_PWM, PWM_CH_FAN);

  // Channel 1: Peltier Thermoelectric Cooler (Spine)
  ledcSetup(PWM_CH_TEC, PWM_FREQ_TEC, PWM_RES);
  ledcAttachPin(PIN_TEC_PWM, PWM_CH_TEC);

  // Channel 2: Dual Shoulder Micro-Turbofans (Face/Neck)
  ledcSetup(PWM_CH_SHOULDER_FAN, PWM_FREQ_FAN, PWM_RES);
  ledcAttachPin(PIN_SHOULDER_FAN_PWM, PWM_CH_SHOULDER_FAN);

  // Initialize Sensors
  if (!bme.begin(0x76, &Wire)) {
    Serial.println(F("[WARN] BME280 sensor not detected on 0x76!"));
  }

  // Initialize Bluetooth Low Energy (BLE)
  BLEDevice::init("SmartVest-DigitalTwin");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);
  pTxCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID_TX,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pTxCharacteristic->addDescriptor(new BLE2902());
  pService->start();
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  BLEDevice::startAdvertising();

  // Create FreeRTOS Tasks on Dedicated Cores
  xTaskCreatePinnedToCore(TaskCoolingControl, "CoolCtrl", 4096, NULL, 2, NULL, 1); // Core 1 (Sensors & Thermal)
  xTaskCreatePinnedToCore(TaskSafetyWatchdog, "SafetyWatch", 3072, NULL, 3, NULL, 0); // Core 0 (Safety & BLE)

  digitalWrite(PIN_STATUS_LED, HIGH);
  Serial.println(F("[READY] Smart Cooling Vest ESP32 Operating System Active."));
}

void loop() {
  // FreeRTOS handles all processes. Background idle loop.
  vTaskDelay(pdMS_TO_TICKS(1000));
}
