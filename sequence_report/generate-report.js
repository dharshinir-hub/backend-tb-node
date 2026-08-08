/**
 * On-demand sequence_report generation for a manually given date range.
 *
 * Reuses the SAME logic the live service (index.js, every 2 minutes) uses —
 * replays parts_count/live_component/live_operator/etc. through
 * ScheduledReportUpdater.generateAndPostReports() and POSTs the regenerated
 * sequence_report records back to ThingsBoard. This is the sequence-report
 * equivalent of ../backfill/backfill.js for the macro streams.
 *
 * The live service already does this continuously for the last
 * TELEMETRY_LOOKBACK_HOURS (see .env) — this script is for forcing an
 * immediate refresh, or reaching dates OLDER than that lookback window.
 *
 * Usage:
 *   node generate-report.js <startTime> <endTime> [machine]
 *
 * Examples:
 *   node generate-report.js 2026-07-27 2026-07-28
 *   node generate-report.js "2026-07-27 09:00:00" "2026-07-27 17:30:00"
 *   node generate-report.js 2026-07-27 2026-07-28 SURIN-BFW_XTRON_1
 *
 * Dates without a time default to 00:00:00 (start) / 23:59:59 (end), IST.
 * If [machine] is omitted, every device under CUSTOMER_ID is processed.
 */

const fs = require('fs');
const path = require('path');
const ThingsboardReportService = require('./src/thingsboardReportService');
const ScheduledReportUpdater = require('./src/scheduledReportUpdater');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value && !key.startsWith('#')) {
      process.env[key.trim()] = value.trim();
    }
  });
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node generate-report.js <startTime> <endTime> [machine]');
  console.error('Example: node generate-report.js 2026-07-27 2026-07-28');
  console.error('Example: node generate-report.js "2026-07-27 09:00:00" "2026-07-27 17:30:00" SURIN-BFW_XTRON_1');
  process.exit(1);
}

const [startArg, endArg, machineArg] = args;

function parseStart(input) {
  const hasTime = input.includes('T') || input.includes(' ') && /\d{2}:\d{2}/.test(input);
  const normalized = input.trim().replace(' ', 'T');
  const withTime = hasTime ? normalized : `${normalized}T00:00:00`;
  return new Date(`${withTime}+05:30`).getTime();
}

function parseEnd(input) {
  const hasTime = input.includes('T') || input.includes(' ') && /\d{2}:\d{2}/.test(input);
  const normalized = input.trim().replace(' ', 'T');
  const withTime = hasTime ? normalized : `${normalized}T23:59:59`;
  return new Date(`${withTime}+05:30`).getTime();
}

const fromTs = parseStart(startArg);
const toTs = parseEnd(endArg);

if (isNaN(fromTs) || isNaN(toTs)) {
  console.error('❌ Could not parse start/end time. Use YYYY-MM-DD or "YYYY-MM-DD HH:mm:ss".');
  process.exit(1);
}

async function main() {
  console.log(`\n🔄 Generating + posting sequence reports to ThingsBoard`);
  console.log(`   From: ${new Date(fromTs).toString()}`);
  console.log(`   To:   ${new Date(toTs).toString()}\n`);

  const reportService = new ThingsboardReportService();
  const updater = new ScheduledReportUpdater();

  const customerIds = ScheduledReportUpdater.getCustomerIds();
  if (customerIds.length === 0) {
    console.error('❌ No CUSTOMER_ID configured');
    process.exit(1);
  }

  // Devices are tagged with the customer they came from, so each one is
  // later processed with its OWN customer's shift schedule.
  const allDevices = [];
  const shiftsByCustomer = new Map();
  for (const customerId of customerIds) {
    const devices = await reportService.getDevicesByCustomer(customerId);
    devices.forEach(d => { d.__customerId = customerId; allDevices.push(d); });
    shiftsByCustomer.set(customerId, await updater.fetchShifts(customerId));
  }

  if (allDevices.length === 0) {
    console.error('❌ No devices found for any configured customer');
    process.exit(1);
  }

  const devices = machineArg
    ? allDevices.filter(d => d.name === machineArg || d.label === machineArg)
    : allDevices;

  if (devices.length === 0) {
    console.error(`❌ Machine "${machineArg}" not found. Available: ${allDevices.map(d => d.name).join(', ')}`);
    process.exit(1);
  }

  for (const device of devices) {
    process.stdout.write(`📊 ${device.name}... `);
    const shifts = shiftsByCustomer.get(device.__customerId) || [];
    const reports = await updater.generateAndPostReports(device, shifts, fromTs, toTs);
    console.log(`${reports.length} parts posted to ThingsBoard`);
  }

  console.log('\n✅ Done — refresh the API (or wait for its next 2-minute cycle) to see it there too.');
}

main().catch(err => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
