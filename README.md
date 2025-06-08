# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

    ```bash
    npm install
    ```

2. Start the app

    ```bash
    npx expo start
    ```

In the output, you'll find options to open the app in a

-   [development build](https://docs.expo.dev/develop/development-builds/introduction/)
-   [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
-   [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
-   [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

---

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

## Learn more

To learn more about developing your project with Expo, look at the following resources:

-   [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
-   [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

-   [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
-   [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## ESP32 Code

```cpp

/**********************************************************************
  Filename    : BLE_USART
  Description : Esp32 communicates with the phone by BLE and sends incoming RFID data via a serial port
  Auther      : www.freenove.com + Hash Fall
  Modification: 2025/06/08
**********************************************************************/
#include "BLEDevice.h"
#include "BLEServer.h"
#include "BLEUtils.h"
#include "BLE2902.h"
#include <Wire.h>
#include <SPI.h>
#include <Adafruit_PN532.h>

BLECharacteristic *pCharacteristic;
bool deviceConnected = false;
uint8_t txValue = 0;
long lastMsg = 0;
String rxload="Test\n";

#define SERVICE_UUID           "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_RX "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_TX "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"
#define SDA_PIN 21
#define SCL_PIN 22

// Inicialização do leitor RFID
Adafruit_PN532 nfc(SDA_PIN, SCL_PIN);

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
    };
    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      //pServer->getAdvertising()->start();  //Reopen the pServer and wait for the connection.
    }
};

class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String rxValue = pCharacteristic->getValue();
      if (rxValue.length() > 0) {
        rxload="";
        for (int i = 0; i < rxValue.length(); i++){
          rxload +=(char)rxValue[i];
        }
      }
    }
};

void setupBLE(String BLEName){
  const char *ble_name=BLEName.c_str();
  BLEDevice::init(ble_name);
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);
  pCharacteristic= pService->createCharacteristic(CHARACTERISTIC_UUID_TX,BLECharacteristic::PROPERTY_NOTIFY);
  pCharacteristic->addDescriptor(new BLE2902());
  BLECharacteristic *pCharacteristic = pService->createCharacteristic(CHARACTERISTIC_UUID_RX,BLECharacteristic::PROPERTY_WRITE);
  pCharacteristic->setCallbacks(new MyCallbacks());
  pService->start();
  pServer->getAdvertising()->start();
  Serial.println("Aguardando a conexão de um cliente para notificar...");
}

void setup() {
  Serial.begin(115200);
  setupBLE("ESP32_RFID");
  Serial.println("Bluetooth pronto!");

  // Inicializa o módulo PN532
  nfc.begin();
  delay(1000);
  nfc.SAMConfig();
  Serial.println("Leitor RFID pronto!");
}

void loop() {

  uint8_t uid[] = { 0, 0, 0, 0, 0, 0, 0 };
  uint8_t uidLength;
  String uidStr = "";

  if (nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength)) {
      Serial.print("Cartão detectado! UID: ");
      uidStr = "";
      for (uint8_t i = 0; i < uidLength; i++) {
          Serial.print(uid[i], HEX);
          Serial.print(" ");
          uidStr += String(uid[i], HEX) + " ";
      }
      Serial.println();

      // Envia o UID por Bluetooth
      delay(2000); // Pequeno atraso para evitar leituras duplicadas
  }


  long now = millis();
  if (now - lastMsg > 100) {
    if (deviceConnected&&rxload.length()>0) {
        Serial.println(rxload);
        rxload="";
    }
    if(Serial.available()>0){
        String str=uidStr;
        const char *newValue=str.c_str();
        pCharacteristic->setValue(newValue);
        pCharacteristic->notify();
    }
    lastMsg = now;
  }
}

```
