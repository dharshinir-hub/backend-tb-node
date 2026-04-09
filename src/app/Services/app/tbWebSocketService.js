/**
 * ThingsBoard WebSocket Service
 * Manages a single WS connection per instance for LATEST_TELEMETRY subscriptions.
 * Each device gets a unique cmdId; responses carry that cmdId as subscriptionId.
 */

export function createTbWebSocket({ url, onOpen, onMessage, onClose, onError }) {
    let ws = null;
    let cmdIdToDeviceId = {};
    let nextCmdId = 1;

    function connect() {
        if (ws) disconnect();
        ws = new WebSocket(url);

        ws.onopen = () => {
            onOpen?.();
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                // Ignore ACK messages (subscriptionId 0) and messages without data
                if (msg.subscriptionId && msg.data && Object.keys(msg.data).length > 0) {
                    onMessage?.(msg, cmdIdToDeviceId);
                }
            } catch (e) {
                console.error('[TbWS] Parse error:', e);
            }
        };

        ws.onerror = (e) => {
            console.error('[TbWS] Error:', e);
            onError?.(e);
        };

        ws.onclose = () => {
            onClose?.();
        };
    }

    /**
     * Subscribe multiple devices to LATEST_TELEMETRY.
     * @param {string[]} deviceIds
     */
    function subscribe(deviceIds) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const cmds = deviceIds.map((id) => {
            const cmdId = nextCmdId++;
            cmdIdToDeviceId[cmdId] = id;
            return { entityType: 'DEVICE', entityId: id, scope: 'LATEST_TELEMETRY', cmdId };
        });
        ws.send(JSON.stringify({ tsSubCmds: cmds, historyCmds: [], attrSubCmds: [] }));
    }

    function disconnect() {
        if (ws) {
            ws.onopen = null;
            ws.onmessage = null;
            ws.onerror = null;
            ws.onclose = null;
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
            }
            ws = null;
        }
        cmdIdToDeviceId = {};
        nextCmdId = 1;
    }

    function isConnected() {
        return ws?.readyState === WebSocket.OPEN;
    }

    return { connect, subscribe, disconnect, isConnected };
}
