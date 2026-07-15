# Email Notification Configuration

## Overview
The system now supports sending email notifications for **IDLE alerts only** to configured customers. Web notifications for idle, alarm, and disconnect continue as before.

## Features
- **Web Notifications**: idle, alarm, disconnect (always sent)
- **Email Notifications**: idle only (optional, customer-specific)
- **Customer Filtering**: Configure which customers receive email notifications
- **Smart Server Check**: Email feature only activates when using `smart.yantra` server

## Environment Configuration

Add the following to your `.env` file:

```env
# Email notification settings
email_from=your-email@gmail.com
email_pass=your-app-password
email_to=recipient@company.com

# Customer configuration for email notifications
# Options:
# - "all" → sends email to all customers
# - "Customer Name1,Customer Name2" → sends email only to these customers
customer_name=Precicraft CNC Works
```

### Configuration Details

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `email_from` | Yes* | Gmail sender address (Gmail only) | `dharshini.r@yantra24x7.com` |
| `email_pass` | Yes* | Gmail app password (not regular password) | `najcywkebsmjnyjb` |
| `email_to` | Yes* | Recipient email(s) - supports multiple emails | `email@example.com` or `email1@example.com,email2@example.com,email3@example.com` |
| `customer_name` | Yes* | Customer(s) to receive emails. Use "all" for all customers, or comma-separated list | `"all"` or `"Precicraft CNC Works,Another Customer"` |
| `TB_BASE_URL` | Auto | Must contain "smart.yantra" for email feature to activate | Must be `http://smart.yantra...` |

**\* Only required if you want email notifications enabled**

## How It Works

### Smart Server Check
The email feature **only activates** if:
1. `TB_BASE_URL` contains "smart.yantra" (checked automatically)
2. Email credentials are configured (`email_from`, `email_pass`, `email_to`)
3. Customer name filter is configured (`customer_name`)

### Customer Filtering
- If `customer_name=all` → sends emails for all customers
- If `customer_name=Customer1,Customer2` → sends emails only for those customers (case-insensitive)
- Other customers: only web notifications sent

### Notification Types

#### IDLE Alerts
- **Web**: Sent to all admin users (as before)
- **Email**: Sent to configured recipient only if customer is in the filter

#### ALARM Alerts
- **Web**: Sent to all admin users (as before)
- **Email**: NOT sent

#### DISCONNECT Alerts
- **Web**: Sent to all admin users (as before)
- **Email**: NOT sent

#### All Resolutions (Idle/Alarm/Disconnect Resolved)
- **Web**: Sent to all admin users (as before)
- **Email**: NOT sent (only initial alerts are emailed)

## Example Configurations

### Example 1: Single Email Address
```env
email_from=dharshini.r@yantra24x7.com
email_pass=najcywkebsmjnyjb
email_to=anushika@yantra24x7.com
customer_name=Precicraft CNC Works
```
Result: Precicraft CNC Works' idle alerts send to 1 recipient

### Example 2: Multiple Email Addresses
```env
email_from=dharshini.r@yantra24x7.com
email_pass=najcywkebsmjnyjb
email_to=thooyavan.venkatachalam@yantra24x7.com,manikandan@yantra24x7.com,admin@yantra24x7.com
customer_name=Precicraft CNC Works
```
Result: Precicraft CNC Works' idle alerts send to 3 recipients

### Example 3: All Customers + Multiple Emails
```env
email_from=dharshini.r@yantra24x7.com
email_pass=najcywkebsmjnyjb
email_to=email1@example.com,email2@example.com
customer_name=all
```
Result: All customers' idle alerts send to 2 recipients

### Example 4: Multiple Customers + Multiple Emails
```env
email_from=dharshini.r@yantra24x7.com
email_pass=najcywkebsmjnyjb
email_to=team1@example.com,team2@example.com
customer_name=Precicraft CNC Works,ABC Manufacturing,XYZ Factory
```
Result: These 3 customers' idle alerts send to 2 recipients

### Example 3: No Email (Default)
```env
# Don't set email_from, email_pass, email_to, or customer_name
# OR set them empty
```
Result: Only web notifications sent (original behavior)

## Gmail App Password
You need a Gmail app password, not your regular Gmail password:
1. Go to https://myaccount.google.com/apppasswords
2. Select "Mail" and "Windows Computer" (or your device)
3. Copy the generated 16-character password
4. Use it as `email_pass` in .env

## Multiple Email Addresses

You can send alerts to **1, 2, 3, or more email addresses** by separating them with commas (no spaces):

```env
# 1 email
email_to=admin@company.com

# 2 emails
email_to=admin@company.com,manager@company.com

# 3 emails
email_to=admin@company.com,manager@company.com,supervisor@company.com

# Many emails (no limit)
email_to=email1@company.com,email2@company.com,email3@company.com,email4@company.com
```

All configured recipients will receive the same alert email when an IDLE condition is detected.

## Logging
Email notifications are logged with timestamps, showing how many recipients received the email:
```
[2026-07-15T10:30:45.123Z] [TB1] Email sent to 2 recipient(s) — "Machine Idle"
```

This means the email was sent to both recipients successfully.

Errors are also logged:
```
[2026-07-15T10:30:45.123Z] [TB1] Email error: ECONNREFUSED
```

## No Changes to Other Features
- Existing web notifications continue unchanged
- All device thresholds and shift settings work as before
- Other customers not in the filter are unaffected
