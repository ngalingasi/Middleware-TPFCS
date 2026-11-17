// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ GePG sign-in form: credentials, OTP channel and OTP code steps
// └──────────────────────────────────────────────────────────────────────────┘

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import Label from '../form/Label';
import Input from '../form/input/InputField';
import Button from '../ui/button/Button';
import { EyeIcon, EyeCloseIcon } from '../../icons/EyeIcons';
import { gepgAuthApi } from '../../api/gepgAuth';
import { useGepgAuth } from '../../store/gepgAuthStore';
import { toast } from '../tpfcs/Toast';
import type { OtpChannel } from '../../types/gepg';

type Step = 'credentials' | 'must-change-password' | 'channel' | 'otp';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

const otpInputClass =
  'h-12 w-full rounded-lg border border-gray-300 bg-transparent text-center text-xl font-bold text-gray-800 shadow-theme-xs focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white';

// large button, same size as the ICDV sign-in
const wideButton = 'w-full px-4! py-3!';

export function LogoHeader({ hideOnDesktop }: { hideOnDesktop?: boolean }) {
  return (
    <div className={`mb-8 text-center ${hideOnDesktop ? 'lg:hidden' : ''}`}>
      <img
        src="/logo.png"
        alt="Tanzania Police Force Corporation Sole"
        className={`mx-auto mb-3 object-contain ${hideOnDesktop ? 'h-20 w-20' : 'h-24 w-24 drop-shadow-md'}`}
      />
      <h1 className="text-base font-bold text-gray-800 dark:text-white">Tanzania Police Force</h1>
      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Corporation Sole</p>
      <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">Middleware</p>
    </div>
  );
}

function ChannelIcon({ type }: { type: OtpChannel['type'] }) {
  return type === 'email' ? (
    <svg className="h-5 w-5 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ) : (
    <svg className="h-5 w-5 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function StepHeading({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white">{title}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">{children}</p>
    </div>
  );
}

interface CredentialsStepProps {
  username: string;
  password: string;
  showPassword: boolean;
  loading: boolean;
  onUsername: (v: string) => void;
  onPassword: (v: string) => void;
  onTogglePassword: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function CredentialsStep(p: CredentialsStepProps) {
  return (
    <form onSubmit={p.onSubmit} className="space-y-5">
      <StepHeading title="Sign In">Enter your credentials to continue</StepHeading>
      <div>
        <Label>
          Username or Email <span className="text-red-500">*</span>
        </Label>
        <Input size="md" placeholder="Username or email" value={p.username} onChange={(e) => p.onUsername(e.target.value)} />
      </div>
      <div>
        <Label>
          Password <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <Input
            size="md"
            type={p.showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            value={p.password}
            onChange={(e) => p.onPassword(e.target.value)}
          />
          <span onClick={p.onTogglePassword} className="absolute right-4 top-1/2 z-30 -translate-y-1/2 cursor-pointer">
            {p.showPassword ? (
              <EyeIcon className="size-5 fill-gray-500" />
            ) : (
              <EyeCloseIcon className="size-5 fill-gray-500" />
            )}
          </span>
        </div>
      </div>
      <Button className={wideButton} disabled={p.loading || !p.username || !p.password}>
        {p.loading ? 'Verifying...' : 'Continue →'}
      </Button>
    </form>
  );
}

export function PasswordChangeStep({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-5">
      <StepHeading title="Password Change Required">
        Your account needs a password change before you can sign in. Contact an administrator to have it reset.
      </StepHeading>
      <button type="button" onClick={onBack} className="w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
        ← Back
      </button>
    </div>
  );
}

interface ChannelStepProps {
  channels: OtpChannel[];
  loading: boolean;
  selectedType: OtpChannel['type'] | null;
  onSelect: (channel: OtpChannel) => void;
  onBack: () => void;
}

export function ChannelStep(p: ChannelStepProps) {
  return (
    <div className="space-y-5">
      <StepHeading title="Choose Verification Method">Select how you want to receive your OTP</StepHeading>
      <div className="space-y-3">
        {p.channels.map((ch) => (
          <button
            key={ch.type}
            type="button"
            onClick={() => p.onSelect(ch)}
            disabled={p.loading}
            className="flex w-full items-center gap-4 rounded-xl border-2 border-gray-200 p-4 transition-all hover:border-brand-400 hover:bg-brand-50 disabled:opacity-60 dark:border-gray-700 dark:hover:border-brand-500 dark:hover:bg-brand-500/10"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-500/20">
              <ChannelIcon type={ch.type} />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-gray-800 dark:text-white">{ch.label}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{ch.display}</p>
            </div>
            {p.loading && p.selectedType === ch.type && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            )}
          </button>
        ))}
      </div>
      <button type="button" onClick={p.onBack} className="w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
        ← Back
      </button>
    </div>
  );
}

interface OtpStepProps {
  maskedContact: string;
  digits: string[];
  inputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  loading: boolean;
  resendCooldown: number;
  onChange: (value: string, index: number) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, index: number) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onChangeMethod: () => void;
  onResend: () => void;
}

export function OtpStep(p: OtpStepProps) {
  const complete = p.digits.join('').length === OTP_LENGTH;

  return (
    <form onSubmit={p.onSubmit} className="space-y-5">
      <StepHeading title="Enter Verification Code">
        Code sent to <span className="font-medium text-gray-700 dark:text-gray-300">{p.maskedContact}</span>
      </StepHeading>
      <div>
        <Label>6-digit security code</Label>
        <div className="flex gap-2">
          {p.digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                p.inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              value={digit}
              onChange={(e) => p.onChange(e.target.value, index)}
              onKeyDown={(e) => p.onKeyDown(e, index)}
              onPaste={p.onPaste}
              className={otpInputClass}
            />
          ))}
        </div>
      </div>
      <Button className={wideButton} disabled={p.loading || !complete}>
        {p.loading ? 'Verifying...' : 'Verify & Sign In'}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={p.onChangeMethod} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
          ← Change method
        </button>
        <button
          type="button"
          onClick={p.onResend}
          disabled={p.resendCooldown > 0 || p.loading}
          className="text-brand-500 hover:text-brand-600 disabled:opacity-50"
        >
          {p.resendCooldown > 0 ? `Resend code (${p.resendCooldown}s)` : 'Resend code'}
        </button>
      </div>
    </form>
  );
}

export default function GepgSignInForm() {
  const navigate = useNavigate();
  const { login } = useGepgAuth();

  const [step, setStep] = useState<Step>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [channels, setChannels] = useState<OtpChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<OtpChannel | null>(null);
  const [maskedContact, setMaskedContact] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const resetOtp = () => setOtpDigits(Array(OTP_LENGTH).fill(''));

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
      setChannels(data.data.channels);
      setStep('channel');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const requestOtp = async (channel: OtpChannel) => {
    setError('');
    setLoading(true);
    setSelectedChannel(channel);
    try {
      const { data } = await gepgAuthApi.sendOtp(username, channel.type);
      setMaskedContact(data.data.maskedContact);
      resetOtp();
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setStep('otp');
      // the boxes mount on the step change, so focus the first one afterwards
      setTimeout(() => otpInputsRef.current[0]?.focus(), 0);
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

  const handleOtpChange = (value: string, index: number) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setOtpDigits((prev) => prev.map((d, i) => (i === index ? digit : d)));
    if (digit && index < OTP_LENGTH - 1) otpInputsRef.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) otpInputsRef.current[index - 1]?.focus();
      setOtpDigits((prev) => prev.map((d, i) => (i === index ? '' : d)));
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH).split('');
    if (pasted.length === 0) return;
    setOtpDigits((prev) => prev.map((d, i) => pasted[i] ?? d));
    otpInputsRef.current[pasted.length - 1]?.focus();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join('');
    if (code.length < OTP_LENGTH) {
      setError('Please enter the complete 6-digit code.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data } = await gepgAuthApi.verifyOtp(username, code);
      login(data.data.user, data.data.token);
      toast.success('Signed in', `Welcome back, ${data.data.user.full_name}`);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Invalid or expired OTP. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  const backToCredentials = () => {
    setError('');
    setStep('credentials');
    setChannels([]);
    setSelectedChannel(null);
    resetOtp();
  };

  const backToChannels = () => {
    setError('');
    setSelectedChannel(null);
    resetOtp();
    setStep('channel');
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4">
        {step === 'credentials' ? <LogoHeader hideOnDesktop /> : <LogoHeader />}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </div>
        )}

        {step === 'credentials' && (
          <CredentialsStep
            username={username}
            password={password}
            showPassword={showPassword}
            loading={loading}
            onUsername={setUsername}
            onPassword={setPassword}
            onTogglePassword={() => setShowPassword((v) => !v)}
            onSubmit={handleCredentialsSubmit}
          />
        )}

        {step === 'must-change-password' && <PasswordChangeStep onBack={backToCredentials} />}

        {step === 'channel' && (
          <ChannelStep
            channels={channels}
            loading={loading}
            selectedType={selectedChannel?.type ?? null}
            onSelect={requestOtp}
            onBack={backToCredentials}
          />
        )}

        {step === 'otp' && (
          <OtpStep
            maskedContact={maskedContact}
            digits={otpDigits}
            inputRefs={otpInputsRef}
            loading={loading}
            resendCooldown={resendCooldown}
            onChange={handleOtpChange}
            onKeyDown={handleOtpKeyDown}
            onPaste={handleOtpPaste}
            onSubmit={handleVerifyOtp}
            onChangeMethod={backToChannels}
            onResend={handleResend}
          />
        )}
      </div>
    </div>
  );
}
