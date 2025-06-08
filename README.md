# Documentação do App Smart Walking Cane

Este é um projeto [Expo](https://expo.dev) criado com [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Visão Geral

Este aplicativo React Native (Expo) conecta-se a um dispositivo ESP32 via Bluetooth Low Energy (BLE), recebe UIDs de RFID/NFC e reproduz arquivos de áudio específicos mapeados para cada UID.  
Ele foi projetado para auxiliar pessoas com deficiência visual, fornecendo sinais sonoros quando etiquetas RFID são detectadas.

---

## Como Funciona

1. **Escanear e Conectar:**

    - Pressione o botão para iniciar a busca por dispositivos BLE.
    - O app procura por dispositivos com nomes contendo `ESP32_RFID`.
    - Ao encontrar o dispositivo, conecta e descobre os serviços/características.

2. **Assinar Notificações de UID:**

    - Assina notificações na característica com UUID `6E400003-B5A3-F393-E0A9-E50E24DCCA9E`.
    - Quando um UID é recebido (em base64), ele é convertido para uma string hexadecimal.

3. **Reproduzir Áudio:**

    - Se o UID corresponder a uma entrada em `UID_AUDIO_MAP`, o arquivo de áudio correspondente é reproduzido usando `expo-av`.

4. **Log:**
    - Todas as ações e erros são registrados e exibidos no app.

---

## Primeiros Passos

1. Instale as dependências

    ```bash
    npm install
    ```

2. Inicie o app

    ```bash
    npx expo start
    ```

## Build com EAS

Para preparar e construir seu app para produção usando [EAS Build](https://docs.expo.dev/build/introduction/):

1. **Instale o EAS CLI**

    ```bash
    npm install -g eas-cli
    ```

2. **Faça login no Expo**

    ```bash
    eas login
    ```

3. **Construa seu app**

    - Para Android:
        ```bash
        eas build --platform android --profile development
        ```

Siga as instruções para configurar credenciais e perfis de build conforme necessário.

---

## Detalhes do BLE

-   **Service UUID:**  
    `6E400001-B5A3-F393-E0A9-E50E24DCCA9E`
-   **Characteristic UUID:**  
    `6E400003-B5A3-F393-E0A9-E50E24DCCA9E` (deve suportar notificações)

---

## Mapeamento de Áudio

Edite o objeto `UID_AUDIO_MAP` para mapear UIDs (em strings hexadecimais maiúsculas) para arquivos de áudio no seu diretório de áudio:

```tsx
const UID_AUDIO_MAP: Record<string, AVPlaybackSource> = {
    '30623A63613A33663A3032': require('../assets/audio/escada.mp3'),
    '31333A31313A39663A3134': require('../assets/audio/laboratorio01.mp3'),
};
```

---

## Personalização

-   **Adicionar mais UIDs:**  
    Adicione novas entradas em `UID_AUDIO_MAP` com o UID como chave e o arquivo de áudio como valor.
-   **Alterar UUIDs do BLE:**  
    Atualize `SERVICE_UUID` e `CHARACTERISTIC_UUID` caso seu ESP32 utilize valores diferentes.

---

## Solução de Problemas

-   **Problemas de conexão BLE:**  
    Certifique-se de que o ESP32 está anunciando (advertising) e que os UUIDs estão corretos.
-   **Sem áudio para o UID:**  
    Verifique se o UID está mapeado em `UID_AUDIO_MAP` e se o arquivo de áudio existe.
-   **Permissões:**  
    Certifique-se de que seu app possui permissões de Bluetooth e localização no Android.

---

## Dependências

-   [expo-av](https://docs.expo.dev/versions/latest/sdk/av/)
-   [react-native-ble-plx](https://github.com/dotintent/react-native-ble-plx)
-   [buffer](https://www.npmjs.com/package/buffer)

---

## Código ESP32

```cpp
/**********************************************************************
 * Filename    : BLE_USART
 * Description : Esp32 se comunica com o celular via BLE e envia dados RFID recebidos pela serial
 * Autor       : www.freenove.com + Hash Fall + Levy + SimTum
 * Modificação : 2025/06/08
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

## Licença

MIT
