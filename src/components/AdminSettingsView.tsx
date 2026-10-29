import React, { useState } from 'react';
import { AdminRecord, SettingRecord } from '../types';
import {
  saveGlobalSettings,
  updateAdminRecord,
} from '../services/dbService';

interface AdminSettingsViewProps {
  admin: AdminRecord;
  settings: SettingRecord;
  onAdminUpdated: (updated: AdminRecord) => void;
}

export const AdminSettingsView: React.FC<AdminSettingsViewProps> = ({
  admin,
  settings,
  onAdminUpdated,
}) => {
  const [upiId, setUpiId] = useState(settings.admin_upi_id || '');
  const [qrCodeUrl, setQrCodeUrl] = useState(settings.qr_code_url || '');

  const [adminUsername, setAdminUsername] = useState(admin.username);
  const [adminPassword, setAdminPassword] = useState(admin.password);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleQrFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 110 * 1024) {
      setFeedback({
        type: 'error',
        message:
          'QR image file is too large. Please select an image under 100 KB or paste an image URL.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setQrCodeUrl(reader.result);
        setFeedback({
          type: 'success',
          message: 'QR Code image loaded! Click Save UPI & QR Settings to publish.',
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveUpiSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!upiId.trim()) {
      setFeedback({
        type: 'error',
        message: 'Please enter your Admin UPI ID.',
      });
      return;
    }

    setSaving(true);
    try {
      await saveGlobalSettings({
        ...settings,
        admin_upi_id: upiId.trim(),
        qr_code_url: qrCodeUrl,
      });
      setFeedback({
        type: 'success',
        message:
          'Admin UPI ID and QR Code saved to the database! Players will now see these in the Add Money modal.',
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to save UPI settings.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAdminCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!adminUsername.trim() || !adminPassword) {
      setFeedback({
        type: 'error',
        message: 'Admin username and password cannot be empty.',
      });
      return;
    }

    setSaving(true);
    try {
      const updated: AdminRecord = {
        ...admin,
        username: adminUsername.trim(),
        password: adminPassword,
      };
      await updateAdminRecord(updated);
      onAdminUpdated(updated);
      setFeedback({
        type: 'success',
        message: 'Admin credentials updated successfully!',
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to update admin credentials.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-white">
          Admin Settings & UPI Configuration
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure your Merchant UPI ID, upload your payment QR code image, and manage Admin login credentials.
        </p>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs sm:text-sm font-medium flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-700/70 text-emerald-200'
              : 'bg-rose-950/70 border-rose-700/70 text-rose-200'
          }`}
        >
          <i
            className={`fa-solid ${
              feedback.type === 'success'
                ? 'fa-circle-check text-emerald-400'
                : 'fa-circle-exclamation text-rose-400'
            } text-base`}
          ></i>
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form 1: Admin UPI ID & QR Code Image Upload (Follow-up Prompt 1 & 2) */}
        <form
          onSubmit={handleSaveUpiSettings}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <h2 className="font-display font-bold text-base text-white flex items-center gap-2">
            <i className="fa-solid fa-qrcode text-amber-400 text-sm"></i>
            <span>Merchant UPI ID & QR Code Setup</span>
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              1. Enter Admin UPI ID
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g., skillarena@upi"
              className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              2. Upload QR Code Image (PNG / JPG / SVG)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleQrFileUpload}
              className="w-full bg-[#0B0F17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400"
            />
          </div>

          {qrCodeUrl && (
            <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-4 flex items-center gap-4">
              <img
                src={qrCodeUrl}
                alt="QR Code Preview"
                referrerPolicy="no-referrer"
                className="w-24 h-24 object-contain bg-white p-1.5 rounded-lg border border-slate-700 shrink-0"
              />
              <div className="text-xs text-slate-400">
                <div className="font-semibold text-white mb-1">
                  Live QR Preview
                </div>
                <div>
                  Displayed inside the User Wallet &quot;Add Money&quot; modal along with{' '}
                  <span className="font-mono text-amber-400">{upiId}</span>.
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs min-h-[48px] transition-colors"
          >
            {saving ? 'Saving...' : 'Save UPI ID & QR Code'}
          </button>
        </form>

        {/* Form 2: Update Admin Info / Password (admin/setting.php) */}
        <form
          onSubmit={handleSaveAdminCredentials}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <h2 className="font-display font-bold text-base text-white flex items-center gap-2">
              <i className="fa-solid fa-user-shield text-amber-400 text-sm"></i>
              <span>Update Admin Info & Password</span>
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Admin Username
              </label>
              <input
                type="text"
                required
                maxLength={50}
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Admin Password
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-xs min-h-[48px] transition-colors"
          >
            Update Admin Credentials
          </button>
        </form>
      </div>
    </div>
  );
};
