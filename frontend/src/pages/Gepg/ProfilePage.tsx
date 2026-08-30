import { Link } from 'react-router';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ComponentCard from '../../components/common/ComponentCard';
import Badge from '../../components/ui/badge/Badge';
import { useGepgAuth } from '../../store/gepgAuthStore';

export default function ProfilePage() {
  const { user } = useGepgAuth();

  if (!user) return null;

  return (
    <div>
      <PageMeta title="Profile | Tanzania Police Force Corporation Sole" description="Your profile" />
      <PageBreadcrumb pageTitle="Profile" />

      <div className="max-w-md">
        <ComponentCard title="Account">
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400">Full Name</p>
              <p className="font-medium text-gray-800 dark:text-white/90">{user.full_name}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Username</p>
              <p className="font-medium text-gray-800 dark:text-white/90">{user.username}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Email</p>
              <p className="font-medium text-gray-800 dark:text-white/90">{user.email}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Role</p>
              <Badge color={user.role === 'ADMIN' ? 'primary' : 'light'}>{user.role}</Badge>
            </div>
            <Link to="/change-password" className="inline-block text-sm text-brand-600 hover:underline dark:text-brand-400">
              Change password
            </Link>
          </div>
        </ComponentCard>
      </div>
    </div>
  );
}
