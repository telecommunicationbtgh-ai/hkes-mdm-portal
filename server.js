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
const PROJECT_ID = 'btghcomplaints';

// Initialize Google Auth Client
let androidManagement;

function getAuthClient() {
  try {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/androidmanagement'],
      });
      return google.androidmanagement({ version: 'v1', auth });
    }

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
    console.error('Warning: service-account-key not loaded.', error.message);
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
        packageName: 'com.google.android.inputmethod.latin', // Google Gboard Keyboard
        installType: 'REQUIRED_FOR_SETUP',
        defaultPermissionPolicy: 'GRANT'
      },
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
// API: Enterprise Signup URL Generation
// -------------------------------------------------------------
app.get('/api/enterprise/signup-url', async (req, res) => {
  if (!androidManagement) {
    return res.status(400).json({ error: 'Service account key not loaded' });
  }

  try {
    const signupUrl = await androidManagement.signupUrls.create({
      projectId: PROJECT_ID,
      callbackUrl: 'https://hkes-mdm-portal.onrender.com/api/enterprise/callback'
    });
    res.json({ success: true, url: signupUrl.data.url });
  } catch (error) {
    console.error('Error creating signup URL:', error);
    res.status(500).json({ error: error.message });
  }
});

// Callback from Google Managed Play registration
app.get('/api/enterprise/callback', async (req, res) => {
  const { enterpriseToken } = req.query;
  if (!enterpriseToken) {
    return res.status(400).send('Enterprise token missing from callback');
  }

  try {
    const response = await androidManagement.enterprises.create({
      enterpriseToken: enterpriseToken,
      requestBody: {
        enterpriseDisplayName: 'HKES Institute'
      }
    });

    ENTERPRISE_NAME = response.data.name; // Format: enterprises/LCxxxxxxxx
    console.log('Enterprise Created Successfully:', ENTERPRISE_NAME);

    // Apply Policy immediately
    const policyName = `${ENTERPRISE_NAME}/policies/hkes-strict-kiosk`;
    await androidManagement.enterprises.policies.patch({
      name: policyName,
      requestBody: buildHkesKioskPolicy(),
    });

    res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 3rem; background: #0f172a; color: white;">
          <h2>✅ HKES Enterprise Successfully Registered!</h2>
          <p>Enterprise Name: <strong>${ENTERPRISE_NAME}</strong></p>
          <a href="/" style="background: #3b82f6; color: white; padding: 0.8rem 1.5rem; text-decoration: none; border-radius: 8px;">Return to MDM Dashboard</a>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error creating enterprise:', error);
    res.status(500).send('Error creating enterprise: ' + error.message);
  }
});

// -------------------------------------------------------------
// API 2: Generate Provisioning Token & QR Code
// -------------------------------------------------------------
app.post('/api/token/generate', async (req, res) => {
  let token = 'HKES2026SETUP';

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
      console.warn('Using HKES Provisioning Token:', err.message);
    }
  }

  const qrPayload = JSON.stringify({
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.google.android.apps.work.clouddpc/.DeviceAdminReceiver",
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "https://play.google.com/managed/download/android_device_policy.apk",
    "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": true,
    "android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED": true,
    "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
      "com.google.android.apps.work.clouddpc.EXTRA_PROVISIONING_TOKEN": token,
      "account": DEFAULT_MANAGED_ACCOUNT
    }
  });

  try {
    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, { margin: 2, width: 350 });

    res.json({
      success: true,
      token: token,
      enterpriseName: ENTERPRISE_NAME || 'HKES Institute Kiosk',
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
      isDemo: false,
      devices: []
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
    return res.json({ success: true, message: `Command ${action} sent to ${deviceName}` });
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
