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
const ENTERPRISE_NAME = process.env.ENTERPRISE_NAME || ''; // Format: enterprises/LCxxxxxxxx

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
// 1. Get HKES Kiosk Policy Definition (Phone + WhatsApp + BTGH App + Samsung + Sound Policy)
// -------------------------------------------------------------
function buildHkesKioskPolicy() {
  return {
    name: `${ENTERPRISE_NAME}/policies/hkes-strict-kiosk`,
    applications: [
      {
        packageName: 'edu.hkes.complaints', // BTGH Directory App
        installType: 'REQUIRED_FOR_SETUP',
        defaultPermissionPolicy: 'GRANT'
      },
      {
        packageName: 'com.sec.android.app.dialer', // Samsung Native Phone Dialer (Galaxy A06)
        installType: 'REQUIRED_FOR_SETUP',
        defaultPermissionPolicy: 'GRANT'
      },
      {
        packageName: 'com.samsung.android.incallui', // Samsung In-Call UI & Native Call Recorder
        installType: 'REQUIRED_FOR_SETUP',
        defaultPermissionPolicy: 'GRANT'
      },
      {
        packageName: 'com.google.android.dialer', // Google Phone / Dialer
        installType: 'REQUIRED_FOR_SETUP',
        defaultPermissionPolicy: 'GRANT'
      },
      {
        packageName: 'com.whatsapp', // WhatsApp
        installType: 'REQUIRED_FOR_SETUP',
        defaultPermissionPolicy: 'GRANT'
      },
      {
        packageName: 'com.whatsapp.w4b', // WhatsApp Business (Optional)
        installType: 'AVAILABLE',
        defaultPermissionPolicy: 'GRANT'
      }
    ],
    // Multi-App Kiosk settings
    kioskCustomization: {
      powerButtonActions: 'POWER_BUTTON_AVAILABLE',
      systemErrorWarnings: 'ERROR_WARNINGS_ENABLED',
      systemNavigation: 'NAVIGATION_ENABLED',
      statusBar: 'NOTIFICATIONS_DISABLED', // Prevent pull-down notification panel
      deviceSettings: 'SETTINGS_DISABLED'    // Block access to System Settings
    },
    // Security, Sound & Hardware Restrictions
    volumeMuteDisabled: true, // Block muting ringtone / volume
    keyguardDisabled: false,
    statusBarDisabled: true,
    factoryResetDisabled: true, // Block Factory Reset
    usbFileTransferDisabled: true, // Block USB File Copying
    modifyAccountsDisabled: true, // Block adding secondary Google accounts
    installUnknownSourcesAllowed: false, // Block APK sideloading
    systemUpdate: {
      type: 'AUTOMATIC'
    }
  };
}

// -------------------------------------------------------------
// API 1: Create or Update HKES Kiosk Policy
// -------------------------------------------------------------
app.post('/api/policy/setup', async (req, res) => {
  if (!androidManagement || !ENTERPRISE_NAME) {
    return res.json({ success: true, message: 'Policy configured in local demo mode.' });
  }

  try {
    const policyName = `${ENTERPRISE_NAME}/policies/hkes-strict-kiosk`;
    const policyBody = buildHkesKioskPolicy();

    const response = await androidManagement.enterprises.policies.patch({
      name: policyName,
      requestBody: policyBody,
    });

    res.json({ success: true, policy: response.data });
  } catch (error) {
    console.error('Error creating policy:', error);
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// API 2: Generate Provisioning Token & QR Code
// -------------------------------------------------------------
app.post('/api/token/generate', async (req, res) => {
  let token = 'hkes-demo-token-99887766';

  if (androidManagement && ENTERPRISE_NAME) {
    try {
      const tokenResponse = await androidManagement.enterprises.provisioningTokens.create({
        parent: ENTERPRISE_NAME,
        requestBody: {
          policyName: `${ENTERPRISE_NAME}/policies/hkes-strict-kiosk`,
          duration: '2592000s' // Token valid for 30 days
        }
      });
      token = tokenResponse.data.value;
    } catch (err) {
      console.warn('Falling back to demo token:', err.message);
    }
  }

  // Android Enterprise standard QR code JSON structure
  const qrPayload = JSON.stringify({
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.google.android.apps.work.clouddpc/.DeviceAdminReceiver",
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": "I5Y2vTO0gOwhxODWiTO6dfMsqbAo4XYAXw3Vz1PywT0",
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "https://play.google.com/managed/download/android_device_policy.apk",
    "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
      "com.google.android.apps.work.clouddpc.EXTRA_PROVISIONING_TOKEN": token
    }
  });

  try {
    // Generate base64 Data URL for QR Code
    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, { margin: 2, width: 350 });

    res.json({
      success: true,
      token: token,
      expirationTimestamp: "30 Days",
      qrCodeDataUrl: qrCodeDataUrl
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
    // Demo Mock Data if not connected to live Google cloud yet
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
  const { deviceName, action } = req.body; // action: LOCK, REBOOT, WIPE

  if (!androidManagement || !ENTERPRISE_NAME) {
    return res.json({ success: true, message: `[DEMO] Command ${action} sent to ${deviceName}` });
  }

  try {
    const response = await androidManagement.enterprises.devices.issueCommand({
      name: deviceName,
      requestBody: {
        type: action // e.g. LOCK, REBOOT, WIPE
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
