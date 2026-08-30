import { SidebarProvider, useSidebar } from '../context/SidebarContext';
import { Outlet } from 'react-router';
import GepgHeader from './GepgHeader';
import Backdrop from './Backdrop';
import GepgSidebar from './GepgSidebar';

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  return (
    <div className="min-h-screen lg:flex">
      <GepgSidebar />
      <Backdrop />
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isExpanded || isHovered ? 'lg:ml-[260px]' : 'lg:ml-[72px]'
        } ${isMobileOpen ? 'ml-0' : ''}`}
      >
        <GepgHeader />
        <main className="px-4 py-3 md:px-5 md:py-4 pb-12 w-full max-w-screen-xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const GepgAppLayout: React.FC = () => (
  <SidebarProvider>
    <LayoutContent />
  </SidebarProvider>
);

export default GepgAppLayout;
