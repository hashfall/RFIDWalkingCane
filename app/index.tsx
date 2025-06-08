import { Audio, AVPlaybackSource } from 'expo-av';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, FlatList, StyleSheet, Text, View } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';

const SERVICE_UUID = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
const CHARACTERISTIC_UUID = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';

// Map NFC UIDs to audio file URIs (place your audio files in assets/audio/)
const UID_AUDIO_MAP: Record<string, AVPlaybackSource> = {
    //"04AABBCCDD": require("../assets/audio/uid1.mp3"),
    //"04EEFF0011": require("../assets/audio/uid2.mp3"),
    // Add more mappings as needed
};

export default function App() {
    const [bleManager] = useState(() => new BleManager());
    const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [receivedUid, setReceivedUid] = useState<string | null>(null);
    const [log, setLog] = useState<string[]>([]);
    const soundRef = useRef<Audio.Sound | null>(null);

    useEffect(() => {
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
            // You may want to filter by device name or service UUID
            if (device?.name?.includes('ESP32')) {
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
