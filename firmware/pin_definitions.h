#ifndef PIN_DEFINITIONS_H
#define PIN_DEFINITIONS_H

// ==============================================================================
// ESP32 GPIO Pin Assignment for Smart Cooling Vest
// ==============================================================================

// Actuator & Motor PWM Outputs
#define PIN_FAN_PWM         18    // Dual 9733 Centrifugal Blower PWM Output (25 kHz - Torso)
#define PIN_FAN_TACH        19    // Blower Tachometer Feedback (Interrupt Input)
#define PIN_SHOULDER_FAN_PWM 26   // Dual 5015 Shoulder / Collar Micro-Turbofans (25 kHz - Face/Neck)
#define PIN_TEC_PWM         25    // Peltier TEC1-12706 Driver PWM (40 kHz, LC Filtered - Spine)

// I2C Sensor Bus (BME280, MAX30102, MPU6050, MLX90614)
#define PIN_I2C_SDA         21    // I2C Serial Data
#define PIN_I2C_SCL         22    // I2C Serial Clock

// Analog Monitoring Inputs (ADC)
#define PIN_BATT_SENSE      34    // Battery Voltage Divider (R1=30k, R2=10k, Max 13.2V)
#define PIN_BATT_NTC        39    // Battery Cell Dedicated NTC 10K Thermistor (BTMS)
#define PIN_HEATSINK_NTC    35    // Hot-side Heat Sink NTC 10K Thermistor
#define PIN_SKIN_NTC        36    // Medical-grade Inner Mesh Skin Contact NTC 10K

// Haptic & Audio Alert Outputs
#define PIN_BUZZER           4    // Piezo Buzzer 85dB (Warning & Emergency SOS)
#define PIN_HAPTIC           2    // Collar Haptic Eccentric Vibration Motor

// User Interface
#define PIN_USER_BTN         0    // Boot/Mode Toggle Button (Internal Pullup)
#define PIN_STATUS_LED      13    // Onboard Status Indicator LED

// System Thresholds & Parameters
#define MAX_SAFE_HEATSINK_TEMP  55.0f // Celsius - instant thermal cutoff threshold
#define MAX_SAFE_BATT_TEMP      45.0f // Celsius - battery cell thermal safety cutoff
#define BATT_COOLING_BOOST_TEMP 38.0f // Celsius - trigger active battery cooling priority
#define BATT_MIN_CUTOFF_VOLTAGE 9.6f  // Volts - 3.2V per cell 3S cutoff
#define BATT_FULL_VOLTAGE      12.6f  // Volts - 4.2V per cell 3S full
#define DEW_POINT_SAFETY_MARGIN  1.5f // Celsius - maintain T_cold >= T_dew + 1.5C

#endif // PIN_DEFINITIONS_H
