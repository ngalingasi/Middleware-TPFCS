import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import GridShape from '../../components/common/GridShape';
import ThemeTogglerTwo from '../../components/common/ThemeTogglerTwo';
import Label from '../../components/form/Label';
import Input from '../../components/form/input/InputField';
import Button from '../../components/ui/button/Button';
import { EyeIcon, EyeCloseIcon } from '../../icons/EyeIcons';
import { gepgAuthApi } from '../../api/gepgAuth';
import { useGepgAuth } from '../../store/gepgAuthStore';
import { toast } from '../../components/tpfcs/Toast';
import type { OtpChannel } from '../../types/gepg';

type Step = 'credentials' | 'must-change-password' | 'channel' | 'otp';

const RESEND_COOLDOWN_SECONDS = 30;

export default function GepgSignIn() {
  const navigate = useNavigate();
  const { login } = useGepgAuth();

  const [step, setStep] = useState<Step>('credentials');

  // Step 1 - credentials
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 2 - channel choice
  const [channels, setChannels] = useState<OtpChannel[]>([]);

  // Step 3 - OTP entry
  const [selectedChannel, setSelectedChannel] = useState<OtpChannel | null>(null);
  const [maskedContact, setMaskedContact] = useState('');
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // ── Step 1: credentials ──────────────────────────────────────────────────
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await gepgAuthApi.validateCredentials(username, password);

      if (data.mustChangePassword) {
        setStep('must-change-password');
        return;
      }

      const availableChannels = data.data.channels;
      setChannels(availableChannels);
      setStep('channel');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2 -> 3: request the OTP on a chosen channel ─────────────────────
  const requestOtp = async (channel: OtpChannel) => {
    setError('');
    setLoading(true);
    try {
      const { data } = await gepgAuthApi.sendOtp(username, channel.type);
      setSelectedChannel(channel);
      setMaskedContact(data.data.maskedContact);
      setOtp('');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setStep('otp');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    if (resendCooldown > 0 || !selectedChannel) return;
    requestOtp(selectedChannel);
  };

  // ── Step 3: verify OTP ───────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    setError('');
    setLoading(true);
    try {
      const { data } = await gepgAuthApi.verifyOtp(username, otp);
      login(data.data.user, data.data.token);
      toast.success('Signed in', `Welcome back, ${data.data.user.full_name}`);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  const backToCredentials = () => {
    setError('');
    setStep('credentials');
    setChannels([]);
    setSelectedChannel(null);
    setOtp('');
  };

  return (
    <div className="relative p-6 bg-white z-1 dark:bg-gray-900 sm:p-0">
      <div className="relative flex flex-col justify-center w-full h-screen lg:flex-row dark:bg-gray-900 sm:p-0">
        <div className="flex w-full flex-1 flex-col lg:w-1/2">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
            <div>
              {/* ── Step 1: username + password ──────────────────────────── */}
              {step === 'credentials' && (
                <>
                  <div className="mb-6">
                    <h1 className="mb-2 text-2xl font-bold text-gray-800 dark:text-white/90">Sign In</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Enter your credentials to continue</p>
                  </div>

                  {error && (
                    <div className="mb-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleCredentialsSubmit}>
                    <div className="space-y-5">
                      <div>
                        <Label>
                          Username or Email <span className="text-error-500">*</span>
                        </Label>
                        <Input size="md" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
                      </div>
                      <div>
                        <Label>
                          Password <span className="text-error-500">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            size="md"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                          />
                          <span
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                          >
                            {showPassword ? (
                              <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                            ) : (
                              <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                            )}
                          </span>
                        </div>
                      </div>
                      <div>
                        <Button size="md" className="w-full" disabled={loading}>
                          {loading ? 'Checking…' : 'Continue →'}
                        </Button>
                      </div>
                    </div>
                  </form>
                </>
              )}

              {/* ── Must change password (no OTP was sent) ───────────────── */}
              {step === 'must-change-password' && (
                <>
                  <div className="mb-6">
                    <h1 className="mb-2 text-2xl font-bold text-gray-800 dark:text-white/90">Password change required</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Your account requires a password change before you can sign in. Please contact an administrator
                      to have your password reset.
                    </p>
                  </div>
                  <Button type="button" size="md" variant="outline" className="w-full" onClick={backToCredentials}>
                    Back to sign in
                  </Button>
                </>
              )}

              {/* ── Step 2: choose OTP delivery channel ───────────────────── */}
              {step === 'channel' && (
                <>
                  <div className="mb-6">
                    <h1 className="mb-2 text-2xl font-bold text-gray-800 dark:text-white/90">Verify it's you</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Choose where to receive your one-time verification code.
                    </p>
                  </div>

                  {error && (
                    <div className="mb-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
                      {error}
                    </div>
                  )}

                  <div className="space-y-3">
                    {channels.map((channel) => (
                      <button
                        key={channel.type}
                        type="button"
                        onClick={() => requestOtp(channel)}
                        disabled={loading}
                        className="flex w-full items-center justify-between rounded-lg border border-gray-300 px-4 py-3 text-left transition hover:border-brand-300 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:hover:bg-white/[0.03]"
                      >
                        <span>
                          <span className="block text-sm font-medium text-gray-800 dark:text-white/90">
                            {channel.label}
                          </span>
                          <span className="block text-sm text-gray-500 dark:text-gray-400">{channel.display}</span>
                        </span>
                        <span className="text-gray-400">→</span>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={backToCredentials}
                    className="mt-5 text-sm text-gray-500 hover:underline dark:text-gray-400"
                  >
                    Back to sign in
                  </button>
                </>
              )}

              {/* ── Step 3: enter OTP ──────────────────────────────────────── */}
              {step === 'otp' && (
                <>
                  <div className="mb-6">
                    <h1 className="mb-2 text-2xl font-bold text-gray-800 dark:text-white/90">Enter verification code</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      We sent a 6-digit code to {maskedContact} via {selectedChannel?.label}.
                    </p>
                  </div>

                  {error && (
                    <div className="mb-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleVerifyOtp}>
                    <div className="space-y-5">
                      <div>
                        <Label>
                          Verification Code <span className="text-error-500">*</span>
                        </Label>
                        <Input
                          size="md"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="123456"
                          className="text-center tracking-[0.5em]"
                        />
                      </div>
                      <div>
                        <Button size="md" className="w-full" disabled={loading || otp.length !== 6}>
                          {loading ? 'Verifying…' : 'Verify & Sign In'}
                        </Button>
                      </div>
                    </div>
                  </form>

                  <div className="mt-5 flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={backToCredentials}
                      className="text-gray-500 hover:underline dark:text-gray-400"
                    >
                      Back to sign in
                    </button>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendCooldown > 0 || loading}
                      className="text-brand-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline dark:text-brand-400"
                    >
                      {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="items-center hidden w-full h-full lg:w-1/2 bg-brand-950 dark:bg-white/5 lg:grid">
          <div className="relative flex items-center justify-center z-1">
            <GridShape />
            <div className="flex flex-col items-center max-w-sm px-8">
              <img src="/logo.png" alt="Tanzania Police Force Corporation Sole" className="mb-6 h-48 w-48 object-contain drop-shadow-2xl" />
              <h2 className="mb-2 text-xl font-bold text-center text-white">Tanzania Police Force Corporation Sole</h2>
              <p className="text-center text-sm text-gray-300 dark:text-white/70">Middleware</p>
              <p className="mt-4 text-center text-sm italic text-gray-400 dark:text-white/60">
                Manage bills, payments, and reconciliation with the Government Electronic Payment Gateway.
              </p>
            </div>
          </div>
        </div>

        <div className="fixed z-50 hidden bottom-6 right-6 sm:block">
          <ThemeTogglerTwo />
        </div>
      </div>
    </div>
  );
}
