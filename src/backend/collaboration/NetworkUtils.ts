import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as os from 'os';


export class NetworkUtils {

    static getLocalIp(): string {
        const interfaces = os.networkInterfaces();
        for (const iface of Object.values(interfaces).flat()) {
            if (iface && iface.family === 'IPv4' && !iface.internal) {
                if (iface.address.startsWith('10.')) {
                    return iface.address;
                }
                if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(iface.address)) {
                    return iface.address;
                }
                if (iface.address.startsWith('192.168.')) {
                    return iface.address;
                }
            }
        }
        return '0.0.0.0';
    }

    /**
     * Get broadcast addresses for all network interfaces
     */
    static getBroadcastAddresses(): string[] {
        const broadcasts = new Set<string>();
        const interfaces = os.networkInterfaces();

        // Add general broadcast address
        broadcasts.add('255.255.255.255');

        // Add specific broadcast addresses for each interface
        for (const iface of Object.values(interfaces).flat()) {
            if (iface && iface.family === 'IPv4' && !iface.internal) {
                // Calculate broadcast address based on IP and netmask
                const ipParts = iface.address.split('.').map(p => parseInt(p));
                const maskParts = iface.netmask.split('.').map(p => parseInt(p));

                const broadcastParts = ipParts.map((part, i) => {
                    return (part | (~maskParts[i] & 255)).toString();
                });

                broadcasts.add(broadcastParts.join('.'));
            }
        }

        return Array.from(broadcasts);
    }
}