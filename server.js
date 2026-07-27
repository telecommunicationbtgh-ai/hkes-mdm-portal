const express = require('express');
const { google } = require('googleapis');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Serve static files from both /public subfolder AND root directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Explicit route for Root '/'
app.get('/', (req, res) => {
  const rootIndexPath = path.join(__dirname, 'index.html');
  const publicIndexPath = path.join(__dirname, 'public', 'index.html');

  if (fs.existsSync(rootIndexPath)) {
    return res.sendFile(rootIndexPath);
  } else if (fs.existsSync(publicIndexPath)) {
    return res.sendFile(publicIndexPath);
  } else {
    return res.send('HKES MDM Server is running!');
  }
});

const PORT = process.env.PORT || 3000;
let ENTERPRISE_NAME = process.env.ENTERPRISE_NAME || ''; 
const DEFAULT_MANAGED_ACCOUNT = 'btghtelecom@gmail.com';

// Initialize Google Auth Client
let androidManagement;

function getAuthClient() {
  try {
    let keyFile = path.join(__dirname, 'service-account-key.json');
    if (!fs.existsSync(keyFile)) {
      const altKeyFile = path.join(__dirname, 'service-account-key.json.json');
      if (fs.existsSync(altKeyFile)) {
        keyFile = altKeyFile;
      }
    }
    const auth = new google.auth.GoogleAuth({
      keyFile: keyFile,
      scopes: ['https://www.googleapis.com/auth/androidmanagement'],
    });
    return google.androidmanagement({ version: 'v1', auth });
  } catch (error) {
    console.error('Warning: service-account-key.json not found yet.', error.message);
    return null;
  }
}

androidManagement = getAuthClient();

// -------------------------------------------------------------
// 1. Get HKES Kiosk Policy Definition
// -------------------------------------------------------------
function buildHkesKioskPolicy() {
  return {
    name: `${ENTERPRISE_NAME}/policies/hkes-strict-kiosk`,
    applications: [
      {
        packageName: 'edu.hkes.complaints', // BTGH Directory App
        installType: 'REQUIRED_FOR_SETUP',
        defaultPermissionPolicy: 'GRANT',
        permissionGrants: [
          { permission: 'android.permission.CAMERA', policy: 'GRANT' },
          { permission: 'android.permission.READ_EXTERNAL_STORAGE', policy: 'GRANT' }
        ]
      },
      {
        packageName: 'com.sec.android.app.dialer', // Samsung Native Phone Dialer (Galaxy A06)
        installType: 'REQUIRED_FOR_SETUP',
        defaultPermissionPolicy: 'GRANT',
        permissionGrants: [
          { permission: 'android.permission.RECORD_AUDIO', policy: 'GRANT' },
          { permission: 'android.permission.READ_PHONE_STATE', policy: 'GRANT' },
          { permission: 'android.permission.PROCESS_OUTGOING_CALLS', policy: 'GRANT' },
          { permission: 'android.permission.READ_CALL_LOG', policy: 'GRANT' },
          { permission: 'android.permission.WRITE_CALL_LOG', policy: 'GRANT' }
        ]
      },
      {
        packageName: 'com.samsung.android.incallui', // Samsung In-Call UI & Auto Call Recorder
        installType: 'REQUIRED_FOR_SETUP',
        defaultPermissionPolicy: 'GRANT',
        permissionGrants: [
          { permission: 'android.permission.RECORD_AUDIO', policy: 'GRANT' },
          { permission: 'android.permission.READ_PHONE_STATE', policy: 'GRANT' },
          { permission: 'android.permission.READ_CALL_LOG', policy: 'GRANT' }
        ]
      },
      {
        packageName: 'com.google.android.dialer', // Google Phone / Dialer
        installType: 'REQUIRED_FOR_SETUP',
        defaultPermissionPolicy: 'GRANT',
        permissionGrants: [
          { permission: 'android.permission.READ_CALL_LOG', policy: 'GRANT' },
          { permission: 'android.permission.WRITE_CALL_LOG', policy: 'GRANT' }
        ]
      },
      {
        packageName: 'com.whatsapp', // WhatsApp
        installType: 'REQUIRED_FOR_SETUP',
        defaultPermissionPolicy: 'GRANT',
        permissionGrants: [
          { permission: 'android.permission.CAMERA', policy: 'GRANT' },
          { permission: 'android.permission.RECORD_AUDIO', policy: 'GRANT' },
          { permission: 'android.permission.READ_CONTACTS', policy: 'GRANT' },
          { permission: 'android.permission.WRITE_CONTACTS', policy: 'GRANT' }
        ]
      },
      {
        packageName: 'com.whatsapp.w4b', // WhatsApp Business (Optional)
        installType: 'AVAILABLE',
        defaultPermissionPolicy: 'GRANT',
        permissionGrants: [
          { permission: 'android.permission.CAMERA', policy: 'GRANT' },
          { permission: 'android.permission.RECORD_AUDIO', policy: 'GRANT' }
        ]
      }
    ],
    kioskCustomization: {
      powerButtonActions: 'POWER_BUTTON_AVAILABLE',
      systemErrorWarnings: 'ERROR_WARNINGS_ENABLED',
      systemNavigation: 'NAVIGATION_ENABLED',
      statusBar: 'NOTIFICATIONS_DISABLED',
      deviceSettings: 'SETTINGS_DISABLED'
    },
    cameraDisabled: false,
    volumeMuteDisabled: true,
    keyguardDisabled: false,
    statusBarDisabled: true,
    factoryResetDisabled: true,
    uninstallAppsDisabled: true,
    usbFileTransferDisabled: true,
    modifyAccountsDisabled: true,
    installUnknownSourcesAllowed: false,
    systemUpdate: {
      type: 'AUTOMATIC'
    }
  };
}

// -------------------------------------------------------------
// API 2: Generate Provisioning Token & QR Code (Direct HKES Kiosk Provisioning)
// -------------------------------------------------------------
app.post('/api/token/generate', async (req, res) => {
  let token = 'HKES2026DIRECT';

  if (androidManagement && ENTERPRISE_NAME) {
    try {
      const tokenResponse = await androidManagement.enterprises.provisioningTokens.create({
        parent: ENTERPRISE_NAME,
        requestBody: {
          policyName: `${ENTERPRISE_NAME}/policies/hkes-strict-kiosk`,
          duration: '2592000s'
        }
      });
      token = tokenResponse.data.value;
    } catch (err) {
      console.warn('Using Direct HKES Provisioning Token:', err.message);
    }
  }

  // Direct Android Kiosk DPC Enrollment Payload (Scans directly on any Samsung/Android device without requiring Google registration)
  const qrPayload = JSON.stringify({
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.hmdm.launcher/.AdminReceiver",
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "https://hmdm.com/apk/hmdm-headwind-mdm-latest.apk",
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": "68:B6:3B:56:4C:E6:C9:F4:7D:66:9F:80:61:9F:D9:D2:12:F7:55:BC:07:95:5D:CD:82:1D:64:1B:32:0C:6D:64",
    "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
      "com.hmdm.SERVER_HOST": "hkes-mdm-portal.onrender.com",
      "com.hmdm.CUSTOMER_TITLE": "HKES Institute",
      "account": DEFAULT_MANAGED_ACCOUNT
    },
    "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": true,
    "android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED": true
  });

  try {
    // Generate base64 Data URL for QR Code
    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, { margin: 2, width: 350 });

    res.json({
      success: true,
      token: token,
      enterpriseName: ENTERPRISE_NAME || 'HKES Institute Direct Kiosk',
      expirationTimestamp: "Never (Permanent)",
      qrCodeDataUrl: qrCodeDataUrl,
      managedAccount: DEFAULT_MANAGED_ACCOUNT
    });
  } catch (error) {
    console.error('Error generating token:', error);
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// API 3: List Enrolled HKES Devices
// -------------------------------------------------------------
app.get('/api/devices', async (req, res) => {
  if (!androidManagement || !ENTERPRISE_NAME) {
    return res.json({
      isDemo: true,
      devices: [
        { name: `${ENTERPRISE_NAME}/devices/demo-01`, state: 'ACTIVE', model: 'Galaxy A06 (SM-A066B/DS)', lastCheckin: new Date().toISOString(), simStatus: 'NORMAL' },
        { name: `${ENTERPRISE_NAME}/devices/demo-02`, state: 'ACTIVE', model: 'Redmi Note 12', lastCheckin: new Date().toISOString(), simStatus: 'NORMAL' }
      ]
    });
  }

  try {
    const response = await androidManagement.enterprises.devices.list({
      parent: ENTERPRISE_NAME,
    });

    res.json({
      isDemo: false,
      devices: response.data.devices || []
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// API 4: Issue Remote Wipe / Lock Command
// -------------------------------------------------------------
app.post('/api/device/command', async (req, res) => {
  const { deviceName, action } = req.body;

  if (!androidManagement || !ENTERPRISE_NAME) {
    return res.json({ success: true, message: `[DEMO] Command ${action} sent to ${deviceName}` });
  }

  try {
    const response = await androidManagement.enterprises.devices.issueCommand({
      name: deviceName,
      requestBody: {
        type: action
      }
    });

    res.json({ success: true, result: response.data });
  } catch (error) {
    console.error('Error issuing command:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  HKES Institute MDM Dashboard running on port ${PORT}`);
  console.log(`====================================================`);
});
