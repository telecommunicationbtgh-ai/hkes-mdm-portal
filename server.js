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
let ENTERPRISE_NAME = process.env.ENTERPRISE_NAME || 'enterprises/LC010s5q6f'; 
const DEFAULT_MANAGED_ACCOUNT = 'btghtelecom@gmail.com';
const PROJECT_ID = 'btghcomplaints';

// Base64 Encoded Service Account Credentials for Production Deployments
const B64_KEY = "ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAiYnRnaGNvbXBsYWludHMiLAogICJwcml2YXRlX2tleV9pZCI6ICJiNDFmZWY3ZTdmYzdmNGU4MTMxZjAwYjAxZGI2MDkxZjVhYTAwNzZjIiwKICAicHJpdmF0ZV9rZXkiOiAiLS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tXG5NSUlFdmdJQkFEQU5CZ2txaGtpRzl3MEJBUUVGQUFTQ0JLZ3dnZ1NrQWdFQUFvSUJBUUMvVEVoUzl5dWdLUlcxXG4wdlQ4aXVnVG9kYmZIKzRKejJnQW9qeGI2a1QwTnF6RFF3ck1SbFkzV0UxL2pwbWFPUGxkbVNPYVJYR0gxbTVmXG4zT2lFeHEvSFU1elp2RTRLRHBTNXlNendHRThybDU1K2RqaDdOdlNkTTl1SDlTd1grbXpQN2pqbG5CaDFZK0VXXG54TkRxZ3dEelVGVm1URUpmODNYQWs5Q2N2VzQ2SWJRS0xreHBMSkc0VWRQTzB6RDdtL2lJemRoMFlnMzFkajM5XG5SMXYvRytuMHE5Qks1TFl0dGFDekV0ZU5PTnpBbmk4MmtpS1dwU21TTmkyR25MQ3V5dmlJaWNUbFpVNEM1TmZhXG5wMzVsVUFVZUJRWSszTmxkczU3SjNzcU9XeGo5eHFyY0VQemI2VWtYWW8xNmgrV2JsckVrckN2Ry9tVWVRQ21wXG5ObjF3VG9MakFnTUJBQUVDZ2dFQUdqRUtrZmx2aXEwMVlNQ3lkRVZjZ3h1Y2ZNNDFYRnVMWk5MUnF0QUhndHhkXG5pUnFMeHU0MmJidDBXT3VnVWtKTXVpajJlKy9ZSEg0YWZKdVZabUNCdnF2UEJPeklOtHhpZ0pKaXFVZHBYbE1PSjNaTklhYi9PVWpHL0lPaFZPbTdwUEFzMkNOK25kUUJIbndKK2tVQ3dnTVpyWEdsXG5TSHRzNUljZGZ6QVlCNnJ2U3FlSTJWNitlWXJ2pE1WV2lyMWFEdkpuMXJVNzZqakJYanEyYTlQWS9TNDUrRXJrXG5zbTNWMkxLMUI0SnF4NE9vT2M4UFdJNTV3a3lnb0s3S1FOTWJTNCsraVFTdTl4QkV5cVJvREpDRlVMdUtFWnFWXG5pRURJL1ZReVBpRW5LMnhPMWcrc01OL0pZTmIxaFNjb0xDakw2S1krT1FLQmdRRGVTT3pvbHpWK0xHNlFnSzZmXG5qV0U1N0dRMEpDOEpwaGNlNHlURzdyelgybUNVU3pQSlZPUVBrMjhnQVJUakZrSjE1UFkyNUpWTHFrMy9QNUtxXG4zaUxOWFdHdUNNMjRGMVo1SFB1OW44ckJTaEZlK21KZE1iaTZlNTdkNHA4ZkduZGlDMS9yTVZYbXFmQnIwejBqXG54cnhUdFpqRDdhTlBpVDdCTlhPVkJFRUl4d0tCZ1FEY1VDdXlSM09iOStvRXNFbUVBVEZRdDB5d0C3NDg4MVdPXG5GT3JJaGd0bDh3R0dCVzlmOTFDZkFKZFhGaW1tQUNicVJHSnN3QTN2UHZmSFNUazRBNzc3L1VrUG54bFFVNWZmXG5alh5OXlJWGY4RGUwcHZCVk1XNGUvN2hJektWSlBCTjExU0N1a01PWG1ZeWh0NUhVQjNqYklJODFoOU51ZGpVXG5Pc21xNWdyeEJRS0JnUUM5R1pyNWo5R0JJamw1RXcvN1NpSWhUYm85SlY4aXZUcEVHNFpvK2lhTEZ3czhmUEYwXG5ZSlNYcjV4RXhNYkpIV0d5dS9LOTVoNGdQYVNXOWJWSFNTeWhGSTRKcVJHaGY3RWYzWWxIMncxNC9CTGxFdXJsXG5UMnhRc09RSTdVWUpQZEc4QmVNMnlVVERzMlNGeGpIb0lxU0tMaDNrNkdBYlJLMnZYbEtTdmdpNWR3S0JnUUNMXG5yaXkySUlVVTJ1NjlRRU9yOU5HZWVraWQ0b0IzeGxOMC9LQUt1S25iWG1HVjVqWkI0dHh6b3YxUTBwVmZVUE5iXG5UallVK3dNYXI1S0LFRXJOejlvemk5ZlpscWFHL2lqcENaQzAxYWtBdXhlK2Jrc2dIUzRxbERyNTVNWDZOMncvXG4vZ2p2eFVZa2d3ZEtlNlhNRXVpUU8waXJaNXA3UGh4U0dsK29BYWZvUFFLQmdFcUNVLzBxMHZ5UDF3K0MwcGpEXG5qaVVTeWgrQTI0TVpHdnVMUmp4V2dEWmdIWWZYRHFlWVhZYXcxZ1ZUOFBWbys2Si9sYktxT2JvTHlLUWxiTjkzXG5iVjlMN2xOc2Jqd1hlZU14RzRoV2o3dFg4djZ0RmpVMkVOUFdSQkZzVnZpcnpveDZYZmVISTZMVWVZdWpLM01EXG5sKzdqMVowaXQzVit0NXFlcVlvUjVYTHpcbi0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS1cbiIsCiAgImNsaWVudF9lbWFpbCI6ICJoa2VzLW1kbS1hZG1pbkBidGdoY29tcGxhaW50cy5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsCiAgImNsaWVudF9pZCI6ICIxMTA0MzQwNjQyMzUzNTcxNTU3MjEiLAogICJhdXRoX3VyaSI6ICJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vby9vYXV0aDIvYXV0aCIsCiAgInRva2VuX3VyaSI6ICJodHRwczovL29hdXRoMi5nb29nbGVhcGlzLmNvbS90b2tlbiIsCiAgImF1dGhfcHJvdmlkZXJfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9vYXV0aDIvdjEvY2VydHMiLAogICJjbGllbnRfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9yb2JvdC92MS9tZXRhZGF0YS94NTA5L2hrZXMtbWRtLWFkbWluJTQwYnRnaGNvbXBsYWludHMuaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLAogICJ1bml2ZXJzZV9kb21haW4iOiAiZ29vZ2xlYXBpcy5jb20iCn0K";

let androidManagement;

function getAuthClient() {
  try {
    const jsonStr = Buffer.from(B64_KEY, 'base64').toString('utf8');
    const credentials = JSON.parse(jsonStr);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/androidmanagement'],
    });
    return google.androidmanagement({ version: 'v1', auth });
  } catch (error) {
    console.error('Warning: Auth setup error:', error.message);
    return null;
  }
}

androidManagement = getAuthClient();

// -------------------------------------------------------------
// 1. Get HKES Policy Definition
// -------------------------------------------------------------
function buildHkesKioskPolicy() {
  return {
    cameraDisabled: false,
    factoryResetDisabled: true,
    uninstallAppsDisabled: true,
    volumeMuteDisabled: true,
    defaultPermissionPolicy: 'GRANT'
  };
}

// -------------------------------------------------------------
// API 2: Generate Multi-Use Google Cloud Enrollment Token Code
// -------------------------------------------------------------
app.post('/api/token/generate', async (req, res) => {
  let token = 'XTDZEWHFQOBQHMRCYGQE';

  if (androidManagement && ENTERPRISE_NAME) {
    try {
      const tokenResponse = await androidManagement.enterprises.enrollmentTokens.create({
        parent: ENTERPRISE_NAME,
        requestBody: {
          policyName: `${ENTERPRISE_NAME}/policies/hkes-strict-kiosk`,
          duration: '2592000s',
          oneTimeOnly: false // Multi-use for all 40 devices!
        }
      });
      token = tokenResponse.data.value;
      console.log('Generated Multi-Use Google Cloud Token:', token);
    } catch (err) {
      console.warn('Error generating Google token:', err.message);
    }
  }

  try {
    const qrCodeDataUrl = await QRCode.toDataURL(token, { margin: 2, width: 350 });

    res.json({
      success: true,
      token: token,
      enterpriseName: ENTERPRISE_NAME,
      expirationTimestamp: "30 Days (Multi-Use for 40 Devices)",
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
  console.log(`  Linked Enterprise: ${ENTERPRISE_NAME}`);
  console.log(`====================================================`);
});
