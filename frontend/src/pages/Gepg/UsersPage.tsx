import { useEffect, useState } from 'react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import Badge from '../../components/ui/badge/Badge';
import Button from '../../components/ui/button/Button';
import { Modal } from '../../components/ui/modal';
import { useModal } from '../../hooks/useModal';
import Label from '../../components/form/Label';
import Input from '../../components/form/input/InputField';
import { gepgUsersApi } from '../../api/gepgUsers';
import { gepgAuthApi } from '../../api/gepgAuth';
import { EyeIcon, EyeCloseIcon } from '../../icons/EyeIcons';
import type { GepgRole, GepgUser } from '../../types/gepg';
import { toast } from '../../components/tpfcs/Toast';

export default function GepgUsersPage() {
  const createModal = useModal();
  const [users, setUsers] = useState<GepgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<GepgRole>('USER');

  const load = () => {
    setLoading(true);
    gepgUsersApi
      .list()
      .then((res) => setUsers(res.data.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    if (!username || !email || !fullName || password.length < 6) {
      toast.error('Missing fields', 'All fields are required and password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await gepgAuthApi.register({ username, email, password, fullName, role });
      toast.success('User created');
      createModal.closeModal();
      setUsername('');
      setEmail('');
      setFullName('');
      setPassword('');
      setRole('USER');
      load();
    } catch (err: any) {
      toast.error('Failed to create user', err?.response?.data?.message ?? 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (user: GepgUser) => {
    const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await gepgUsersApi.update(user.id, { status: newStatus });
      toast.success(`User ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}`);
      load();
    } catch {
      toast.error('Failed to update user');
    }
  };

  const handleDelete = async (user: GepgUser) => {
    if (!window.confirm(`Delete user "${user.username}"?`)) return;
    try {
      await gepgUsersApi.delete(user.id);
      toast.success('User deleted');
      load();
    } catch (err: any) {
      toast.error('Failed to delete user', err?.response?.data?.message ?? 'Unknown error');
    }
  };

  return (
    <div>
      <PageMeta title="Users | Tanzania Police Force Corporation Sole" description="Manage dashboard users" />
      <PageBreadcrumb pageTitle="Users" />

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-gray-800">
          <div>
            <h3 className="text-base font-medium text-gray-800 dark:text-white/90">Dashboard Users</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage who can access this dashboard</p>
          </div>
          <Button onClick={createModal.openModal}>+ New User</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-100 dark:bg-white/[0.05]">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Username</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Full Name</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Email</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Role</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Status</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-sm text-gray-400">
                    Loading…
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="odd:bg-white even:bg-gray-50 dark:odd:bg-transparent dark:even:bg-white/[0.03]">
                  <td className="px-3 py-2 text-sm font-medium text-gray-800 dark:text-white/90">{u.username}</td>
                  <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{u.full_name}</td>
                  <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{u.email}</td>
                  <td className="px-3 py-2">
                    <Badge color={u.role === 'ADMIN' ? 'primary' : 'light'} size="sm">
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge color={u.status === 'ACTIVE' ? 'success' : 'error'} size="sm">
                      {u.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-3 text-sm">
                      <button onClick={() => toggleStatus(u)} className="text-brand-600 hover:underline dark:text-brand-400">
                        {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => handleDelete(u)} className="text-error-500 hover:underline">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={createModal.isOpen}
        onClose={createModal.closeModal}
        className="relative w-full max-w-md rounded-3xl bg-white p-6 dark:bg-gray-900"
      >
        <h4 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90">New User</h4>
        <div className="space-y-4">
          <div>
            <Label>Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <Label>Full Name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Password</Label>
            <div className="relative">
              <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} />
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
            <Label>Role</Label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as GepgRole)}
              className="h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              <option value="VIEWER">Viewer</option>
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={createModal.closeModal}>
            Close
          </Button>
          <Button type="button" onClick={handleCreate} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create User'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
