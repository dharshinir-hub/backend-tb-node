# Troubleshooting: Missing Notifications

## Case: PCW-VMC-02 was idle but didn't get notification

### Device Configuration
```
Device: PCW-VMC-02
Threshold: 10 seconds
Customer: Precicraft CNC Works
```

### System Status ✓
- ✓ Monitor is running (PID 27429)
- ✓ Smart server enabled (smart.yantra24x7.com)
- ✓ Email configured for Precicraft CNC Works
- ✓ Current time is within active shift (08:30-20:30)

### Possible Reasons Why Alert Didn't Send

#### 1️⃣ **Machine Status Didn't Stay IDLE Long Enough**
- **Threshold**: 10 seconds
- **Requirement**: Machine must stay in IDLE status for **FULL 10 seconds** before alert fires
- **What happens**: If machine changes status (IDLE → RUNNING) before 10 seconds, timer resets

**Fix**: Check when the machine actually went IDLE and for how long

#### 2️⃣ **Alert Already Sent for This IDLE Session**
- **Logic**: Once alert fires, it won't repeat until the machine changes state
- **State tracking**: `state.alertSent = "IDLE"`
- **Reset**: Only when machine changes to RUNNING or another status

**Fix**: Machine needs to change status (RUNNING) first, then go back to IDLE

#### 3️⃣ **Machine Status Event Not Received**
- The WebSocket might not have received the status update from ThingsBoard
- Or the device might not be sending telemetry updates

**Fix**: Verify the device is actively sending machine_status telemetry

#### 4️⃣ **Outside Shift Window** ❌
- **Current**: ✓ ACTIVE (14:25 is within 08:30-20:30)
- **If outside**: Alert is silently skipped
- **Configured shifts**: 
  - Shift 1: 08:30 - 20:30 (active now)
  - Shift 2: 20:30 - 08:30 (next night)

**Fix**: Verify the idle event occurred during an active shift

### How to Diagnose

#### Option 1: Check Monitor Logs
```bash
# If using nohup
tail -f nohup.out | grep "PCW-VMC-02"

# If using systemd
journalctl -u status-monitor -f | grep "PCW-VMC-02"
```

#### Option 2: Run Test to Verify Email Works
```bash
node test-email-alert.js

# Output should show:
# ✓ WEB NOTIFICATION SENT
# ✓ EMAIL SENT
```

#### Option 3: Temporarily Lower Threshold
Set `idle_threshold` to a very low value (5 seconds) to test:
1. Log into ThingsBoard
2. Edit device PCW-VMC-02
3. Go to Server attributes
4. Set `idle_threshold` = `{"mode":"enabled","threshold":5}`
5. Wait 5 seconds while machine is idle
6. Should trigger notification

### Alert Lifecycle

```
Machine Status Changes
        ↓
Device → ThingsBoard (via MQTT/HTTP)
        ↓
Monitor receives via WebSocket
        ↓
Classify Status (IDLE/RUNNING/ALARM/DISCONNECT)
        ↓
Check: In Active Shift? NO → Skip
       YES ↓
Check: Within threshold time? NO → Schedule timer
       YES ↓
ALERT FIRED! 🔔
        ↓
Send Web Notification ✓
Send Email (if IDLE & customer configured) ✓
        ↓
Wait for status change to RUNNING
        ↓
Send Resolution Notification ✓
```

### Common Issues & Solutions

| Issue | Reason | Solution |
|-------|--------|----------|
| No notification at all | Monitor not running | `node status_monitor/monitor.js` |
| No email, only web | Customer not in filter | Check `.env` customer_name |
| Threshold too short | Alert fires immediately | Increase threshold value |
| Multiple alerts for one idle | Timer not working | Restart monitor |
| Alert outside shift | Shift check enabled | Disable shift or adjust timing |

### Monitor Health Check

```bash
# 1. Is monitor running?
ps aux | grep "monitor.js" | grep -v grep

# 2. Is email configured?
grep "email_from" .env

# 3. Is customer configured?
grep "customer_name" .env

# 4. Is smart server enabled?
grep "TB_BASE_URL" .env | grep "smart.yantra"
```

### Manual Alert Test

Run the test script which forces an alert regardless of timing:
```bash
node test-email-alert.js
```

This will:
- Read current machine_status from ThingsBoard
- If IDLE, send notification immediately
- Show if email is working
- Show if customer filtering works

### Enabling Debug Logging

Add to `monitor.js` to see detailed logs:
```javascript
console.log(`[${ts()}] Device state for ${deviceId}:`, {
  currentCategory: state.currentCategory,
  pendingCategory: state.pendingCategory,
  alertSent: state.alertSent,
  timerActive: state.timer !== null
});
```

Then restart monitor and check the output.
