# Smart Walking Cane App Documentation

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Overview

This React Native (Expo) app connects to an ESP32 device via Bluetooth Low Energy (BLE), receives RFID/NFC UIDs, and plays specific audio files mapped to each UID.
It is designed to assist visually impaired users by providing audio cues when RFID tags are detected.

## Main Features

-   **BLE Scanning & Connection:**  
    Scans for BLE devices named `ESP32_RFID` and connects automatically.

-   **UID Notification Subscription:**  
    Subscribes to a BLE characteristic to receive UID data from the ESP32.

-   **Audio Playback:**  
    Plays a specific audio file for each recognized UID.

-   **Logging:**  
    Displays connection status, received UIDs, and errors in a log list.

---

## How It Works

1. **Scan and Connect:**

    - Press the button to start scanning for BLE devices.
    - The app looks for devices with names containing `ESP32_RFID`.
    - On finding the device, it connects and discovers services/characteristics.

2. **Subscribe to UID Notifications:**

    - Subscribes to notifications on the characteristic with UUID `6E400003-B5A3-F393-E0A9-E50E24DCCA9E`.
    - When a UID is received (as base64), it is converted to a hex string.

3. **Play Audio:**

    - If the UID matches an entry in `UID_AUDIO_MAP`, the corresponding audio file is played using `expo-av`.

4. **Logging:**
    - All actions and errors are logged and displayed in the app.

---

## Get started

1. Install dependencies

    ```bash
    npm install
    ```

2. Start the app

    ```bash
    npx expo start
    ```

## Build with EAS

To prepare and build your app for production using [EAS Build](https://docs.expo.dev/build/introduction/):

1. **Install EAS CLI**

    ```bash
    npm install -g eas-cli
    ```

2. **Login to Expo**

    ```bash
    eas login
    ```

3. **Build your app**

    - For Android:
        ```bash
        eas build --platform android --profile development
        ```

Follow the prompts to set up credentials and build profiles as needed.

---

## BLE Details

-   **Service UUID:**  
    `6E400001-B5A3-F393-E0A9-E50E24DCCA9E`
-   **Characteristic UUID:**  
    `6E400003-B5A3-F393-E0A9-E50E24DCCA9E` (must support notifications)

---

## Audio Mapping

Edit the `UID_AUDIO_MAP` object to map UIDs (as uppercase hex strings) to audio files in your audio directory:

```tsx
const UID_AUDIO_MAP: Record<string, AVPlaybackSource> = {
    '30623A63613A33663A3032': require('../assets/audio/escada.mp3'),
    '31333A31313A39663A3134': require('../assets/audio/laboratorio01.mp3'),
};
```

---

## Customization

-   **Add more UIDs:**  
    Add new entries to `UID_AUDIO_MAP` with the UID as the key and the audio file as the value.
-   **Change BLE UUIDs:**  
    Update `SERVICE_UUID` and `CHARACTERISTIC_UUID` if your ESP32 uses different values.

---

## Troubleshooting

-   **BLE connection issues:**  
    Ensure the ESP32 is advertising and the UUIDs match.
-   **No audio for UID:**  
    Make sure the UID is mapped in `UID_AUDIO_MAP` and the audio file exists.
-   **Permissions:**  
    Ensure your app has Bluetooth and location permissions on Android.

---

## Dependencies

-   [expo-av](https://docs.expo.dev/versions/latest/sdk/av/)
-   [react-native-ble-plx](https://github.com/dotintent/react-native-ble-plx)
-   [buffer](https://www.npmjs.com/package/buffer)

---

## ESP32 Code

```cpp

/**********************************************************************
 * Filename    : BLE_USART
 * Description : Esp32 communicates with the phone by BLE and sends incoming RFID data via a serial port
 * Author      : www.freenove.com + Hash Fall + Levy + SimTum
 * Modification: 2025/06/08
**********************************************************************/
#include "BLEDevice.h"
#include "BLEServer.h"
#include "BLEUtils.h"
#include "BLE2902.h"
#include <Wire.h>
#include <SPI.h>
#include <Adafruit_PN532.h>

// --- Variáveis Globais ---
BLECharacteristic *pTxCharacteristic; // Característica para Transmitir (Notify)
bool deviceConnected = false;
String rxload = "";

#define SERVICE_UUID           "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_RX "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_TX "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"
#define SDA_PIN 21
#define SCL_PIN 22

// Inicialização do leitor RFID
Adafruit_PN532 nfc(SDA_PIN, SCL_PIN);

// --- Callbacks do Servidor BLE ---
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      Serial.println("Dispositivo Conectado!");
    };
    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      Serial.println("Dispositivo Desconectado, reiniciando advertising...");
      pServer->getAdvertising()->start(); // Reinicia o advertising para permitir nova conexão
    }
};

// --- Callbacks da Característica BLE (para receber dados) ---
class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String rxValue = pCharacteristic->getValue();
      if (rxValue.length() > 0) {
        rxload = "";
        for (int i = 0; i < rxValue.length(); i++){
          rxload += (char)rxValue[i];
        }
        Serial.print("Recebido via BLE: ");
        Serial.println(rxload);
      }
    }
};

// --- Configuração do BLE ---
void setupBLE(String BLEName){
  const char *ble_name = BLEName.c_str();
  BLEDevice::init(ble_name);
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  // Característica de Transmissão (TX) - para enviar dados do ESP32 para o celular
  pTxCharacteristic = pService->createCharacteristic(CHARACTERISTIC_UUID_TX, BLECharacteristic::PROPERTY_NOTIFY);
  pTxCharacteristic->addDescriptor(new BLE2902());

  // Característica de Recepção (RX) - para receber dados do celular no ESP32
  BLECharacteristic *pRxCharacteristic = pService->createCharacteristic(CHARACTERISTIC_UUID_RX, BLECharacteristic::PROPERTY_WRITE);
  pRxCharacteristic->setCallbacks(new MyCallbacks());

  pService->start();
  pServer->getAdvertising()->start();
  Serial.println("Aguardando a conexão de um cliente...");
}

// --- Setup Principal ---
void setup() {
  Serial.begin(115200);
  setupBLE("ESP32_RFID");
  Serial.println("Bluetooth pronto! ✅");

  // Inicializa o módulo PN532
  nfc.begin();
  delay(1000);
  nfc.SAMConfig();
  Serial.println("Leitor RFID pronto! 🏷️");
}

// --- Loop Principal ---
void loop() {
  uint8_t uid[] = { 0, 0, 0, 0, 0, 0, 0 };
  uint8_t uidLength;

  // Tenta ler um cartão RFID
  if (nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength)) {
    String uidStr = "";
    Serial.print("Cartão detectado! UID: ");

    // Constrói a string do UID
    for (uint8_t i = 0; i < uidLength; i++) {
      if (uid[i] < 0x10) {
        Serial.print("0"); // Adiciona zero à esquerda para melhor formatação
        uidStr += "0";
      }
      Serial.print(uid[i], HEX);
      Serial.print(" ");
      uidStr += String(uid[i], HEX);
      if (i < uidLength - 1) {
          uidStr += ":";
      }
    }
    Serial.println();

    // Se um dispositivo estiver conectado, envia o UID via BLE
    if (deviceConnected) {
      Serial.print("Enviando UID via BLE: ");
      Serial.println(uidStr);
      pTxCharacteristic->setValue(uidStr.c_str());
      pTxCharacteristic->notify(); // Envia a notificação
    }

    // Atraso para evitar múltiplas leituras do mesmo cartão
    delay(2000);
  }
}

```

---

## License

MIT
