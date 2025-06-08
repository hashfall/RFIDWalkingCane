import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Button,
    FlatList,
    PermissionsAndroid,
    Platform,
    Text,
    View,
} from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';

const bleManager = new BleManager();

export default function Index() {
    const [devices, setDevices] = useState<Device[]>([]);
    const [scanning, setScanning] = useState(false);
    const [status, setStatus] = useState<string>('Idle');
    const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
    const scanTimeout = useRef<NodeJS.Timeout | null>(null);

    // Request permissions on Android
    useEffect(() => {
        async function requestPermissions() {
            if (Platform.OS === 'android') {
                try {
                    await PermissionsAndroid.requestMultiple([
                        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    ]);
                } catch (err) {
                    console.warn('Permission error:', err);
                }
            }
        }
        requestPermissions();
        return () => {
            bleManager.destroy();
            if (scanTimeout.current) clearTimeout(scanTimeout.current);
        };
    }, []);

    // Scan for BLE devices
    const scanForDevices = () => {
        setStatus('Scanning...');
        setDevices([]);
        setScanning(true);
        bleManager.startDeviceScan(null, null, (error, device) => {
            if (error) {
                setStatus('Scan error');
                setScanning(false);
                console.warn('BLE scan error:', error);
                return;
            }
            if (device && device.id) {
                setDevices((prev) => {
                    if (!prev.find((d) => d.id === device.id)) {
                        return [...prev, device];
                    }
                    return prev;
                });
            }
        });
        // Stop scan after 10 seconds
        if (scanTimeout.current) clearTimeout(scanTimeout.current);
        scanTimeout.current = setTimeout(() => {
            bleManager.stopDeviceScan();
            setStatus('Scan stopped');
            setScanning(false);
        }, 10000);
    };

    // Helper to display device name or fallback
    const getDeviceLabel = (device: Device) => {
        if (device.name && device.name.length > 0) return device.name;
        if (device.localName && device.localName.length > 0)
            return device.localName;
        return device.id;
    };

    // Connect to selected device
    const connectToDevice = async (device: Device) => {
        setStatus('Connecting...');
        try {
            const connected = await bleManager.connectToDevice(device.id);
            setConnectedDevice(connected);
            setStatus('Connected');
        } catch (e: any) {
            setStatus('Connection failed');
            Alert.alert('Connection error', e?.message || 'Unknown error');
        }
    };

    return (
        <View
            style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                padding: 16,
            }}
        >
            <Text style={{ fontSize: 18, marginBottom: 12 }}>
                Status: {status}
            </Text>
            <Button
                title={scanning ? 'Scanning...' : 'Scan for Devices'}
                onPress={scanForDevices}
                disabled={scanning}
            />
            {scanning && (
                <ActivityIndicator size='large' style={{ margin: 12 }} />
            )}
            <FlatList
                style={{ width: '100%', marginTop: 16 }}
                data={devices}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={
                    <Text style={{ textAlign: 'center', marginTop: 24 }}>
                        No BLE devices found
                    </Text>
                }
                renderItem={({ item }) => {
                    const label = getDeviceLabel(item);
                    if (!label) return null;
                    return (
                        <View
                            style={{
                                marginVertical: 6,
                                padding: 12,
                                backgroundColor: '#f0f0f0',
                                borderRadius: 8,
                            }}
                        >
                            <Text style={{ fontSize: 16, marginBottom: 4 }}>
                                {label}
                            </Text>
                            <Text
                                style={{
                                    fontSize: 12,
                                    color: '#888',
                                    marginBottom: 8,
                                }}
                            >
                                {item.id}
                            </Text>
                            <Button
                                title='Connect'
                                onPress={() => connectToDevice(item)}
                            />
                        </View>
                    );
                }}
            />
            {connectedDevice && (
                <Text style={{ marginTop: 20, fontWeight: 'bold' }}>
                    Connected to: {getDeviceLabel(connectedDevice)}
                </Text>
            )}
        </View>
    );
}
