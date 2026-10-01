import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProofsService } from '../proofs/proofs.service';
import { PayoutRequestsService } from '../payout-requests/payout-requests.service';
import { verifyTelegramInitData } from '../../common/telegram-init-data';

// Minimal shape of a Multer memory file (avoids needing @types/multer).
export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

@Injectable()
export class MiniAppService {
  private readonly logger = new Logger(MiniAppService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly proofs: ProofsService,
    private readonly payoutRequests: PayoutRequestsService,
  ) { }

  private botToken(): string {
    return this.config.get<string>('telegram.botToken') ?? '';
  }

  // Payout details to render in the Mini App (auth'd by the Telegram signature).
  async getPayoutDetails(ref: string, initData: string) {
    const v = verifyTelegramInitData(initData, this.botToken());
    if (!v.valid || !v.user) throw new BadRequestException('Invalid Telegram session');
    const req = await this.payoutRequests.findByRef(ref);
    if (!req || req.status !== 'announced') {
      return { ok: false, reason: 'This payout is no longer awaiting proof.' };
    }
    if (!req.claimedBy || req.claimedBy !== String(v.user.id)) {
      return { ok: false, reason: 'You are not the authorized claimant for this payout.' };
    }
    return {
      ok: true,
      ref,
      amount: req.matchedAmount ?? req.requestedAmount,
      upiId: req.upiId,
    };
  }

  // Receive the private screenshot upload and fulfil the payout.
  async handleUpload(ref: string, initData: string, file?: UploadedImage) {
    const v = verifyTelegramInitData(initData, this.botToken());
    if (!v.valid || !v.user) {
      throw new BadRequestException('Invalid Telegram session');
    }
    if (!file || !file.buffer?.length) {
      throw new BadRequestException('Screenshot file is required');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Please upload an image (screenshot)');
    }
    return this.proofs.fulfilFromMiniApp(ref, file.buffer, String(v.user.id));
  }

  renderPage(): string {
    return PAGE_HTML;
  }
}

const PAGE_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Confirm Payment</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
  :root {
    --bg-color: #f4f5f7;
    --card-bg: #ffffff;
    --text-color: #1a1a1c;
    --hint-color: #8e8e93;
    --link-color: #248bfe;
    --button-color: #248bfe;
    --button-text-color: #ffffff;
    --border-color: rgba(0, 0, 0, 0.08);
    --accent-green: #34c759;
    --accent-red: #ff3b30;
    --shadow-sm: 0 4px 12px rgba(0, 0, 0, 0.02);
  }

  body.dark-mode {
    --bg-color: #121214;
    --card-bg: #1c1c1e;
    --text-color: #f3f4f6;
    --hint-color: #8e8e93;
    --border-color: rgba(255, 255, 255, 0.06);
    --shadow-sm: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  * { box-sizing: border-box; }
  
  body {
    font-family: 'Inter', -apple-system, system-ui, sans-serif;
    background: var(--bg-color);
    color: var(--text-color);
    margin: 0;
    padding: 24px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100vh;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.25s ease, color 0.25s ease;
  }

  .app-container {
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Header */
  .header-section {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin: 8px 0;
  }
  
  .secure-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(52, 199, 89, 0.08);
    color: var(--accent-green);
    font-size: 11px;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: 100px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border: 1px solid rgba(52, 199, 89, 0.15);
  }
  
  .secure-badge svg {
    width: 12px;
    height: 12px;
  }
  
  .amount-title {
    font-size: 11px;
    font-weight: 700;
    color: var(--hint-color);
    letter-spacing: 0.8px;
    margin-top: 4px;
    opacity: 0.8;
  }
  
  .amount-value {
    font-size: 38px;
    font-weight: 800;
    color: var(--text-color);
    display: flex;
    align-items: baseline;
    justify-content: center;
  }
  
  .currency-symbol {
    font-size: 24px;
    font-weight: 600;
    margin-right: 4px;
    opacity: 0.85;
  }

  /* Cards */
  .card {
    background: var(--card-bg);
    border-radius: 16px;
    padding: 16px;
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    transition: background 0.25s ease, border-color 0.25s ease;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 28px;
  }
  
  .detail-label {
    font-size: 13px;
    color: var(--hint-color);
    font-weight: 500;
  }
  
  .detail-value-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .detail-value {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-color);
    font-family: 'Inter', monospace;
  }
  
  .divider {
    height: 1px;
    background: var(--border-color);
    margin: 12px 0;
  }

  /* Copy Button */
  .icon-btn {
    background: transparent;
    border: none;
    padding: 6px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--hint-color);
    transition: all 0.2s ease;
  }
  
  .icon-btn:hover {
    background: rgba(0, 0, 0, 0.04);
    color: var(--text-color);
  }
  
  body.dark-mode .icon-btn:hover {
    background: rgba(255, 255, 255, 0.04);
  }
  
  .icon-btn.success {
    color: var(--accent-green) !important;
    background: rgba(52, 199, 89, 0.08);
  }
  
  .icon-btn svg {
    width: 15px;
    height: 15px;
  }

  /* Skeletal Loaders */
  .skeleton-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .skeleton-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .skeleton {
    height: 16px;
    background: linear-gradient(90deg, var(--border-color) 25%, rgba(0,0,0,0.02) 50%, var(--border-color) 75%);
    background-size: 200% 100%;
    animation: loading-skeleton 1.5s infinite;
    border-radius: 4px;
  }
  
  .skeleton-label { width: 65px; }
  .skeleton-value { width: 140px; }
  
  @keyframes loading-skeleton {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* Custom File Dropzone Uploader */
  .upload-container {
    background: var(--card-bg);
    border: 2px dashed var(--border-color);
    border-radius: 16px;
    padding: 24px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: var(--shadow-sm);
    text-align: center;
    position: relative;
    min-height: 150px;
  }
  
  .upload-container.dragover {
    border-color: var(--link-color);
    background: rgba(36, 139, 254, 0.04);
  }
  
  .upload-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  
  .upload-icon-circle {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(36, 139, 254, 0.08);
    color: var(--link-color);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease;
  }
  
  .upload-container:hover .upload-icon-circle {
    transform: translateY(-2px);
  }
  
  .upload-icon-circle svg {
    width: 22px;
    height: 22px;
  }
  
  .upload-text {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-color);
  }
  
  .upload-subtext {
    font-size: 12px;
    color: var(--hint-color);
  }

  /* Preview selected file */
  .upload-preview-container {
    width: 100%;
    animation: fadeIn 0.2s ease;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.98); }
    to { opacity: 1; transform: scale(1); }
  }
  
  .preview-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }
  
  .preview-image-wrapper {
    position: relative;
    width: 100%;
    max-height: 240px;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--border-color);
    background: rgba(0,0,0,0.02);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .preview-image-wrapper img {
    width: 100%;
    max-height: 240px;
    object-fit: contain;
    border-radius: 12px;
  }
  
  .remove-image-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    border: none;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    padding: 0;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    flex-shrink: 0;
  }
  
  .remove-image-btn:hover {
    background: rgba(255, 59, 48, 0.9);
    transform: scale(1.05);
  }
  
  .remove-image-btn svg {
    width: 14px;
    height: 14px;
  }
  
  .preview-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 0 4px;
  }
  
  .preview-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: left;
    min-width: 0;
    flex: 1;
  }
  
  .preview-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .preview-size {
    font-size: 11px;
    color: var(--hint-color);
  }
  
  .change-image-btn {
    background: rgba(36, 139, 254, 0.1);
    color: var(--link-color);
    border: none;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  body.dark-mode .change-image-btn {
    background: rgba(36, 139, 254, 0.15);
  }
  
  .change-image-btn:hover {
    background: rgba(36, 139, 254, 0.2);
  }

  /* Notification Banners */
  .notification {
    display: flex;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 12px;
    font-size: 13px;
    line-height: 1.4;
    align-items: flex-start;
    animation: slideIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .notification.success {
    background: rgba(52, 199, 89, 0.08);
    border: 1px solid rgba(52, 199, 89, 0.15);
    color: var(--accent-green);
  }
  
  .notification.error {
    background: rgba(255, 59, 48, 0.08);
    border: 1px solid rgba(255, 59, 48, 0.15);
    color: var(--accent-red);
  }
  
  .notification-icon svg {
    width: 18px;
    height: 18px;
    margin-top: 1px;
    flex-shrink: 0;
  }
  
  .notification-title {
    font-weight: 700;
    margin-bottom: 2px;
  }
  
  .notification-message {
    opacity: 0.95;
  }

  /* Fallback submit btn */
  .submit-btn {
    width: 100%;
    background: var(--button-color);
    color: var(--button-text-color);
    border: none;
    border-radius: 14px;
    padding: 15px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(36, 139, 254, 0.15);
    transition: all 0.2s ease;
    display: none;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  
  .submit-btn:hover:not(:disabled) {
    opacity: 0.95;
    transform: translateY(-1px);
  }
  
  .submit-btn:active:not(:disabled) {
    transform: translateY(1px);
  }
  
  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }
</style>
</head>
<body>
  <div class="app-container">
    <!-- Header -->
    <div class="header-section">
      <div class="secure-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Awaiting Payment Proof
      </div>
      <div class="amount-title">PAYMENT AMOUNT</div>
      <div class="amount-value" id="amount-text">
        <span class="currency-symbol">₹</span><span class="amount-number">--</span>
      </div>
    </div>

    <!-- Payout details -->
    <div class="card" id="details-card">
      <div class="skeleton-container" id="details-skeleton">
        <div class="skeleton-row">
          <div class="skeleton skeleton-label"></div>
          <div class="skeleton skeleton-value"></div>
        </div>
        <div class="divider"></div>
        <div class="skeleton-row">
          <div class="skeleton skeleton-label"></div>
          <div class="skeleton skeleton-value"></div>
        </div>
      </div>
      
      <div class="details-content" id="details-content" style="display:none; flex-direction: column;">
        <div class="detail-row">
          <span class="detail-label">UPI ID</span>
          <div class="detail-value-wrapper">
            <span class="detail-value" id="upi-val">--</span>
            <button class="icon-btn" id="copy-upi" onclick="copyToClipboard('upi-val', 'copy-upi')" title="Copy UPI ID">
              <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:none">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </button>
          </div>
        </div>
        <div class="divider"></div>
        <div class="detail-row">
          <span class="detail-label">Reference ID</span>
          <div class="detail-value-wrapper">
            <span class="detail-value" id="ref-val">--</span>
            <button class="icon-btn" id="copy-ref" onclick="copyToClipboard('ref-val', 'copy-ref')" title="Copy Reference ID">
              <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:none">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Dropzone -->
    <div class="upload-container" id="drop-zone">
      <input type="file" id="file" accept="image/*" capture="environment" style="display: none;" />
      
      <div class="upload-placeholder" id="upload-placeholder">
        <div class="upload-icon-circle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </div>
        <div class="upload-text">Upload Payment Screenshot</div>
        <div class="upload-subtext">Tap or drag image here (Max 2MB)</div>
      </div>

      <div class="upload-preview-container" id="upload-preview-container" style="display: none;">
        <div class="preview-body">
          <div class="preview-image-wrapper">
            <img id="preview-image" src="" alt="Screenshot Preview" />
            <button class="remove-image-btn" id="remove-image-btn" type="button" title="Remove Screenshot">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="preview-footer">
            <div class="preview-info">
              <span class="preview-name" id="preview-name">screenshot.png</span>
              <span class="preview-size" id="preview-size">0 KB</span>
            </div>
            <button class="change-image-btn" id="change-image-btn" type="button">
              Change Image
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Fallback Button -->
    <button id="submit" class="submit-btn" disabled>Confirm Payment</button>

    <!-- Inline notifications -->
    <div class="notification" id="notification" style="display: none;">
      <div class="notification-icon" id="notification-icon"></div>
      <div class="notification-content">
        <div class="notification-title" id="notification-title"></div>
        <div class="notification-message" id="notification-message"></div>
      </div>
    </div>
  </div>

<script>
  var tg = window.Telegram ? window.Telegram.WebApp : null;
  
  // Theme initialization
  if (tg) {
    tg.ready();
    tg.expand();
    if (tg.colorScheme === 'dark') {
      document.body.classList.add('dark-mode');
    }
    tg.MainButton.setText('Confirm Payment');
    tg.MainButton.onClick(handleUpload);
  } else {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.body.classList.add('dark-mode');
    }
  }

  var initData = tg ? tg.initData : '';
  var ref = new URLSearchParams(location.search).get('ref')
    || (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || '';

  // DOM Elements
  var fileEl = document.getElementById('file');
  var btn = document.getElementById('submit');
  var dropZone = document.getElementById('drop-zone');
  var uploadPlaceholder = document.getElementById('upload-placeholder');
  var previewContainer = document.getElementById('upload-preview-container');
  var previewImg = document.getElementById('preview-image');
  var previewName = document.getElementById('preview-name');
  var previewSize = document.getElementById('preview-size');
  var removeBtn = document.getElementById('remove-image-btn');
  var notificationEl = document.getElementById('notification');
  var notifTitle = document.getElementById('notification-title');
  var notifMsg = document.getElementById('notification-message');
  var notifIcon = document.getElementById('notification-icon');
  
  var detailsSkeleton = document.getElementById('details-skeleton');
  var detailsContent = document.getElementById('details-content');
  var amountText = document.querySelector('.amount-number');
  
  var isUploading = false;

  // Show fallback button if outside Telegram
  if (!tg) {
    btn.style.display = 'flex';
  }

  // Fetch payout details
  fetch('/miniapp/payout?ref=' + encodeURIComponent(ref), { headers: { 'x-init-data': initData } })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d.ok) {
        detailsSkeleton.style.display = 'none';
        showNotification('Invalid Payment', d.reason || 'Payout details not available.', 'error');
        return;
      }
      
      amountText.textContent = Number(d.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      document.getElementById('upi-val').textContent = d.upiId;
      document.getElementById('ref-val').textContent = d.ref;
      
      detailsSkeleton.style.display = 'none';
      detailsContent.style.display = 'flex';
    })
    .catch(function () {
      detailsSkeleton.style.display = 'none';
      showNotification('Error', 'Could not load payout details. Please close and retry.', 'error');
    });

  // Dropzone click handlers
  dropZone.addEventListener('click', function (e) {
    var hasFile = !!fileEl.files.length;
    if (hasFile) {
      if (e.target.closest('#change-image-btn')) {
        fileEl.click();
      }
      return;
    }
    if (e.target.closest('#remove-image-btn')) return;
    fileEl.click();
  });

  // Drag and Drop
  dropZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  
  dropZone.addEventListener('dragleave', function () {
    dropZone.classList.remove('dragover');
  });
  
  dropZone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      fileEl.files = e.dataTransfer.files;
      handleFileSelected();
    }
  });

  fileEl.addEventListener('change', handleFileSelected);
  
  removeBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    fileEl.value = '';
    handleFileSelected();
  });

  btn.addEventListener('click', handleUpload);

  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    var k = 1024;
    var sizes = ['Bytes', 'KB', 'MB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function handleFileSelected() {
    var file = fileEl.files[0];
    if (file) {
      previewName.textContent = file.name;
      previewSize.textContent = formatBytes(file.size);
      
      var reader = new FileReader();
      reader.onload = function (e) {
        previewImg.src = e.target.result;
        uploadPlaceholder.style.display = 'none';
        previewContainer.style.display = 'block';
        dropZone.style.borderStyle = 'solid';
        dropZone.style.borderColor = 'var(--link-color)';
      };
      reader.readAsDataURL(file);

      // Enable submit action
      if (tg) {
        tg.MainButton.enable();
        tg.MainButton.show();
      } else {
        btn.disabled = false;
      }
    } else {
      previewImg.src = '';
      uploadPlaceholder.style.display = 'flex';
      previewContainer.style.display = 'none';
      dropZone.style.borderStyle = 'dashed';
      dropZone.style.borderColor = 'var(--border-color)';
      
      // Disable submit action
      if (tg) {
        tg.MainButton.hide();
      } else {
        btn.disabled = true;
      }
    }
  }

  function handleUpload() {
    if (isUploading) return;
    var file = fileEl.files[0];
    if (!file) return;

    isUploading = true;
    setLoadingState(true);
    
    var fd = new FormData();
    fd.append('ref', ref);
    fd.append('initData', initData);
    fd.append('screenshot', file);

    fetch('/miniapp/upload', { method: 'POST', body: fd })
      .then(function (r) {
        return r.json().then(function (j) { return { status: r.status, body: j }; });
      })
      .then(function (res) {
        setLoadingState(false);
        if (res.status >= 200 && res.status < 300 && res.body.ok) {
          showNotification('Success', '✅ Payment confirmed. Thank you!', 'success');
          if (tg) {
            tg.MainButton.hide();
            setTimeout(function () { tg.close(); }, 1500);
          }
        } else {
          var errorMsg = res.body.reason || res.body.message || 'Upload failed';
          showNotification('Upload Failed', '❌ ' + errorMsg, 'error');
          isUploading = false;
          if (tg) {
            tg.MainButton.hide();
            setTimeout(function () { tg.close(); }, 2500);
          }
        }
      })
      .catch(function () {
        setLoadingState(false);
        showNotification('Network Error', '❌ Please check your connection and try again.', 'error');
        isUploading = false;
      });
  }

  function setLoadingState(loading) {
    if (loading) {
      if (tg) {
        tg.MainButton.showProgress();
        tg.MainButton.disable();
      } else {
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner"></div>Uploading...';
      }
      dropZone.style.pointerEvents = 'none';
      dropZone.style.opacity = '0.7';
    } else {
      if (tg) {
        tg.MainButton.hideProgress();
        tg.MainButton.enable();
      } else {
        btn.disabled = false;
        btn.innerHTML = 'Confirm Payment';
      }
      dropZone.style.pointerEvents = 'auto';
      dropZone.style.opacity = '1';
    }
  }

  function showNotification(title, message, type) {
    notifTitle.textContent = title;
    notifMsg.textContent = message.replace(/^[✅❌]\s*/, '');
    notificationEl.className = 'notification ' + type;
    
    if (type === 'success') {
      notifIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
    } else {
      notifIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    }
    
    notificationEl.style.display = 'flex';
  }

  function copyToClipboard(elementId, buttonId) {
    var text = document.getElementById(elementId).textContent;
    if (!text || text === '--') return;
    
    var btn = document.getElementById(buttonId);
    var copyIcon = btn.querySelector('.copy-icon');
    var checkIcon = btn.querySelector('.check-icon');
    
    function showSuccess() {
      copyIcon.style.display = 'none';
      checkIcon.style.display = 'block';
      btn.classList.add('success');
      setTimeout(function () {
        copyIcon.style.display = 'block';
        checkIcon.style.display = 'none';
        btn.classList.remove('success');
      }, 2000);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(showSuccess).catch(function() {
        fallbackCopy(text, showSuccess);
      });
    } else {
      fallbackCopy(text, showSuccess);
    }
  }

  function fallbackCopy(text, callback) {
    var textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      callback();
    } catch (err) {
      console.error('Copy failed', err);
    }
    document.body.removeChild(textArea);
  }
</script>
</body>
</html>`;
