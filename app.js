document.addEventListener('DOMContentLoaded', () => {
  const deviceTableBody = document.getElementById('device-table-body');
  const btnRefresh = document.getElementById('btn-refresh-devices');
  const btnUpdatePolicy = document.getElementById('btn-update-policy');
  const btnNewQr = document.getElementById('btn-new-qr');
  const qrFrame = document.getElementById('qr-frame');
  const qrTokenInfo = document.getElementById('qr-token-info');
  const kpiTotal = document.getElementById('kpi-total');

  // Modal elements
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalDesc = document.getElementById('modal-desc');
  const modalCancel = document.getElementById('modal-cancel');
  const modalConfirm = document.getElementById('modal-confirm');

  let pendingCommandAction = null;

  // -----------------------------------------------------------
  // 1. Fetch & Render Devices
  // -----------------------------------------------------------
  async function fetchDevices() {
    deviceTableBody.innerHTML = `<tr><td colspan="6" class="loading-cell">Fetching HKES enrolled devices...</td></tr>`;

    try {
      const res = await fetch('/api/devices');
      const data = await res.json();

      if (!data.devices || data.devices.length === 0) {
        deviceTableBody.innerHTML = `<tr><td colspan="6" class="loading-cell">No devices enrolled yet. Click "+ Enroll New Device" to generate QR code.</td></tr>`;
        kpiTotal.textContent = '0 / 40';
        return;
      }

      kpiTotal.textContent = `${data.devices.length} / 40`;
      deviceTableBody.innerHTML = '';

      data.devices.forEach(device => {
        const tr = document.createElement('tr');
        const shortId = device.name.split('/').pop();
        const dateStr = device.lastCheckin ? new Date(device.lastCheckin).toLocaleString() : 'Just now';

        tr.innerHTML = `
          <td><strong>${shortId}</strong></td>
          <td>${device.model || 'Android Phone'}</td>
          <td><span class="status-badge live">ONLINE</span></td>
          <td><span class="chip chip-phone" style="font-size:0.75rem; padding:0.2rem 0.5rem">Strict Kiosk</span></td>
          <td>${dateStr}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="promptDeviceAction('${device.name}', 'LOCK')">🔒 Lock</button>
            <button class="btn btn-danger btn-sm" onclick="promptDeviceAction('${device.name}', 'WIPE')">🗑️ Wipe</button>
          </td>
        `;
        deviceTableBody.appendChild(tr);
      });

    } catch (err) {
      console.error('Failed to load devices:', err);
      deviceTableBody.innerHTML = `<tr><td colspan="6" class="loading-cell text-danger">Failed to connect to backend server.</td></tr>`;
    }
  }

  // -----------------------------------------------------------
  // 2. Generate Enrollment QR Code
  // -----------------------------------------------------------
  async function generateQrCode() {
    qrFrame.innerHTML = `<div class="qr-placeholder">Generating token & QR Code...</div>`;
    qrTokenInfo.textContent = '';

    try {
      const res = await fetch('/api/token/generate', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        qrFrame.innerHTML = `<img src="${data.qrCodeDataUrl}" alt="HKES Enrollment QR Code" />`;
        qrTokenInfo.innerHTML = `<strong>Token Expiry:</strong> 30 Days<br><small>Ready to scan on 40 phones</small>`;
      } else {
        qrFrame.innerHTML = `<div class="qr-placeholder text-danger">Error: ${data.error}</div>`;
      }
    } catch (err) {
      qrFrame.innerHTML = `<div class="qr-placeholder text-danger">Failed to generate QR Code.</div>`;
    }
  }

  // -----------------------------------------------------------
  // 3. Update Policy
  // -----------------------------------------------------------
  async function syncPolicy() {
    try {
      const res = await fetch('/api/policy/setup', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('HKES Kiosk Policy updated successfully! (Phone + WhatsApp Allowed)');
      } else {
        alert('Policy Update Info: ' + (data.error || 'Configured locally'));
      }
    } catch (err) {
      alert('Policy configured in server.js mode.');
    }
  }

  // -----------------------------------------------------------
  // Modal Handlers
  // -----------------------------------------------------------
  window.promptDeviceAction = (deviceName, action) => {
    pendingCommandAction = { deviceName, action };
    modalTitle.textContent = `${action} Device Confirmation`;
    modalDesc.textContent = `Are you sure you want to send the ${action} command to device ${deviceName.split('/').pop()}?`;
    modalOverlay.classList.add('active');
  };

  modalCancel.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
    pendingCommandAction = null;
  });

  modalConfirm.addEventListener('click', async () => {
    if (!pendingCommandAction) return;

    try {
      const res = await fetch('/api/device/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingCommandAction)
      });
      const data = await res.json();
      alert(data.message || `Command ${pendingCommandAction.action} sent successfully.`);
    } catch (err) {
      alert('Failed to send command.');
    } finally {
      modalOverlay.classList.remove('active');
      pendingCommandAction = null;
    }
  });

  // Event Listeners
  btnRefresh.addEventListener('click', fetchDevices);
  btnUpdatePolicy.addEventListener('click', syncPolicy);
  btnNewQr.addEventListener('click', generateQrCode);

  // Initial Load
  fetchDevices();
  generateQrCode();
});
