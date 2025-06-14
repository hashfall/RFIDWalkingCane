import { Buffer } from 'buffer';
import { Audio, AVPlaybackSource } from 'expo-av';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, FlatList, StyleSheet, Text, View } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import {
    PERMISSIONS,
    requestMultiple,
    RESULTS,
} from 'react-native-permissions';

const SERVICE_UUID = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
const CHARACTERISTIC_UUID = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';

// Mapeamento RFID UIDs para arquivos de audio (URIs)
const UID_AUDIO_MAP: Record<string, AVPlaybackSource> = {
    '30623A63613A33663A3032': require('../assets/audio/escada.mp3'),
    '31333A31313A39663A3134': require('../assets/audio/laboratorio01.mp3'),
};

const permissions = [
    PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
    PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
    PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    PERMISSIONS.ANDROID.NEARBY_WIFI_DEVICES,
    PERMISSIONS.IOS.BLUETOOTH,
];

export default function App() {
    const [bleManager] = useState(() => new BleManager());
    const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [receivedUid, setReceivedUid] = useState<string | null>(null);
    const [log, setLog] = useState<string[]>([]);
    const soundRef = useRef<Audio.Sound | null>(null);

    useEffect(() => {
        // Requisição de permissões para utilizar Bluetooth ao iniciar o app
        (async () => {
            // Checa o status atual das permissões de localização
            let { status } = await Location.getForegroundPermissionsAsync();
            if (status !== 'granted') {
                // Requisita permissões de localização
                const { status: requestStatus } =
                    await Location.requestForegroundPermissionsAsync();
                if (requestStatus !== 'granted') {
                    Alert.alert(
                        'Permissão necessária',
                        'A permissão de localização é necessária para usar o Bluetooth.'
                    );
                }
            }
        })();

        requestMultiple(permissions)
            .then((result) => {
                if (
                    result[PERMISSIONS.ANDROID.BLUETOOTH_SCAN] ===
                        RESULTS.GRANTED &&
                    result[PERMISSIONS.ANDROID.BLUETOOTH_CONNECT] ===
                        RESULTS.GRANTED &&
                    result[PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION] ===
                        RESULTS.GRANTED &&
                    result[PERMISSIONS.ANDROID.NEARBY_WIFI_DEVICES] ===
                        RESULTS.GRANTED
                ) {
                    //VAZIO
                } else if (
                    result[PERMISSIONS.ANDROID.BLUETOOTH_SCAN] ===
                        RESULTS.DENIED ||
                    result[PERMISSIONS.ANDROID.BLUETOOTH_CONNECT] ===
                        RESULTS.DENIED ||
                    result[PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION] ===
                        RESULTS.DENIED ||
                    result[PERMISSIONS.ANDROID.NEARBY_WIFI_DEVICES] ===
                        RESULTS.DENIED
                ) {
                    Alert.alert(
                        'Permissão necessária',
                        'A permissão de Dispositivos Próximos é necessária para usar o Bluetooth.'
                    );
                }
            })
            .catch((error) => {});

        return () => {
            bleManager.destroy();
            if (soundRef.current) {
                soundRef.current.unloadAsync();
            }
        };
    }, []);

    const logMsg = (msg: string) => setLog((prev) => [msg, ...prev]);

    const scanAndConnect = () => {
        setIsScanning(true);
        logMsg('Procurando ESP32...');
        bleManager.startDeviceScan(null, null, async (error, device) => {
            if (error) {
                Alert.alert('Scan error', error.message);
                setIsScanning(false);
                return;
            }
            // Filtrando por device name ou Service UUID
            if (device?.name?.includes('ESP32_RFID')) {
                bleManager.stopDeviceScan();
                logMsg(`Dispositivo encontrado: ${device.name}`);
                try {
                    const connected = await device.connect();
                    setConnectedDevice(connected);
                    logMsg('Conectado ao ESP32');
                    await connected.discoverAllServicesAndCharacteristics();
                    subscribeToUidNotifications(connected);
                } catch (err: any) {
                    Alert.alert('Erro de conexão', err.message);
                }
                setIsScanning(false);
            }
        });
    };

    const subscribeToUidNotifications = async (device: Device) => {
        logMsg('Inscrevendo-se às notificaçãos UID...');
        device.monitorCharacteristicForService(
            SERVICE_UUID,
            CHARACTERISTIC_UUID,
            (error, characteristic) => {
                if (error) {
                    logMsg('Erro de notificação: ' + error.message);
                    return;
                }
                if (characteristic?.value) {
                    const uid = Buffer.from(characteristic.value, 'base64')
                        .toString('hex')
                        .toUpperCase();
                    logMsg('Recebido UID: ' + uid);
                    console.log('Received UID:', uid);
                    setReceivedUid(uid);
                    playAudioForUid(uid);
                }
            }
        );
    };

    const playAudioForUid = async (uid: string) => {
        if (soundRef.current) {
            await soundRef.current.unloadAsync();
            soundRef.current = null;
        }
        const audioSource = UID_AUDIO_MAP[uid];
        if (!audioSource) {
            logMsg('Nenhum audio para UID: ' + uid);
            return;
        }
        try {
            const { sound } = await Audio.Sound.createAsync(audioSource);
            soundRef.current = sound;
            await sound.playAsync();
            logMsg('Reproduzindo audio para UID: ' + uid);
        } catch (err: any) {
            logMsg('Audio error: ' + err.message);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Smart Walking Cane</Text>
            <Button
                title={
                    connectedDevice
                        ? 'Conectado ao ESP32'
                        : isScanning
                        ? 'Procurando...'
                        : 'Conectar ao ESP32'
                }
                onPress={scanAndConnect}
                disabled={!!connectedDevice || isScanning}
            />
            <Text style={styles.uid}>
                {receivedUid
                    ? `Último UID: ${receivedUid}`
                    : 'Nenhum UID recebido.'}
            </Text>
            <FlatList
                data={log}
                renderItem={({ item }) => (
                    <Text style={styles.log}>{item}</Text>
                )}
                keyExtractor={(_, i) => i.toString()}
                style={styles.logList}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24, backgroundColor: '#fff' },
    title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
    uid: { fontSize: 16, marginVertical: 16 },
    log: { fontSize: 12, color: '#333' },
    logList: { marginTop: 16, maxHeight: 200 },
});
