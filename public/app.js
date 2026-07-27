document.addEventListener('DOMContentLoaded', () => {
  const btnNewQr = document.getElementById('btn-new-qr');
  const btnRefreshDevices = document.getElementById('btn-refresh-devices');
  const btnUpdatePolicy = document.getElementById('btn-update-policy');
  const btnQrDirect = document.getElementById('btn-qr-direct');
  const btnQrGoogle = document.getElementById('btn-qr-google');
  
  const qrFrame = document.getElementById('qr-frame');
  const qrTokenInfo = document.getElementById('qr-token-info');
  const deviceTableBody = document.getElementById('device-table-body');
  const kpiTotal = document.getElementById('kpi-total');

  let currentQrMode = 'direct'; // Default to direct Samsung Kiosk for maximum reliability

  // Generate Enrollment Token & QR Code
  async function generateQrCode(mode = 'direct') {
    currentQrMode = mode;
    qrFrame.innerHTML = '<div class="qr-placeholder">Generating Enrollment QR Code...</div>';
    qrTokenInfo.innerHTML = '';

    try {
      const response = await fetch('/api/token/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: mode })
      });
      const data = await response.json();

      if (data.success && data.qrCodeDataUrl) {
        qrFrame.innerHTML = `<img src="${data.qrCodeDataUrl}" alt="Enrollment QR Code" style="width: 100%; height: 100%; object-fit: contain;" />`;
        qrTokenInfo.innerHTML = `
          <div><strong>Engine:</strong> ${mode === 'direct' ? '⚡ Direct Samsung Kiosk' : '🌐 Google Cloud AMAPI'}</div>
          <div><strong>Token:</strong> <code>${data.token}</code></div>
          <div><strong>Account:</strong> ${data.managedAccount}</div>
        `;
      } else {
        qrFrame.innerHTML = '<div class="qr-placeholder" style="color: #ef4444;">Failed to generate QR Code</div>';
      }
    } catch (error) {
      console.error('Error generating QR:', error);
      qrFrame.innerHTML = '<div class="qr-placeholder" style="color: #ef4444;">Network Error. Check console.</div>';
    }
  }

  // Fetch List of Enrolled Devices
  async function fetchDevices() {
    try {
      const response = await fetch('/api/devices');
      const data = await response.json();
      const devices = data.devices || [];

      kpiTotal.textContent = devices.length;

      if (devices.length === 0) {
        deviceTableBody.innerHTML = `
          <tr>
            <td colspan="6" class="empty-cell" style="text-align: center; padding: 2rem; color: var(--text-muted);">
              No devices enrolled yet. Scan the QR code on a factory-reset phone to enroll.
            </td>
          </tr>
        `;
        return;
      }

      deviceTableBody.innerHTML = devices.map(device => {
        const deviceId = device.name ? device.name.split('/').pop() : 'Unknown';
        const model = device.model || 'Samsung A06 (SM-A066B/DS)';
        const state = device.state || 'ACTIVE';
        const lastCheckin = device.lastCheckin ? new Date(device.lastCheckin).toLocaleString() : 'Just now';

        return `
          <tr>
            <td>
              <strong style="color: #f8fafc;">${deviceId}</strong>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${device.name}</div>
            </td>
            <td><span class="device-model-badge">${model}</span></td>
            <td><span class="status-badge ${state === 'ACTIVE' ? 'live' : ''}">${state}</span></td>
            <td><span class="chip chip-phone">Strict Kiosk</span></td>
            <td style="font-size: 0.8rem; color: var(--text-muted);">${lastCheckin}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="triggerDeviceAction('${device.name}', 'LOCK')">🔒 Lock</button>
              <button class="btn btn-secondary btn-sm" onclick="triggerDeviceAction('${device.name}', 'REBOOT')">🔄 Reboot</button>
            </td>
          </tr>
        `;
      }).join('');

    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  }

  // Event Listeners
  if (btnNewQr) btnNewQr.addEventListener('click', () => generateQrCode(currentQrMode));
  if (btnRefreshDevices) btnRefreshDevices.addEventListener('click', fetchDevices);
  if (btnQrDirect) btnQrDirect.addEventListener('click', () => generateQrCode('direct'));
  if (btnQrGoogle) btnQrGoogle.addEventListener('click', () => generateQrCode('google'));

  if (btnUpdatePolicy) {
    btnUpdatePolicy.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/policy/setup', { method: 'POST' });
        const data = await res.json();
        alert('Kiosk Policy Synced Successfully!');
      } catch (err) {
        alert('Error syncing policy: ' + err.message);
      }
    });
  }

  // Global Device Action Trigger
  window.triggerDeviceAction = async (deviceName, action) => {
    if (!confirm(`Are you sure you want to send ${action} command to device?`)) return;

    try {
      const res = await fetch('/api/device/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceName, action })
      });
      const data = await res.json();
      alert(`Command ${action} issued successfully!`);
      fetchDevices();
    } catch (err) {
      alert('Action failed: ' + err.message);
    }
  };

  // Initial Load
  generateQrCode('direct');
  fetchDevices();
  setInterval(fetchDevices, 10000); // Poll every 10 seconds
});
