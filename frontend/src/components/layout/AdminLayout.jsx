import { useState } from 'react'
import AdminHeader from './AdminHeader'
import Sidebar from './Sidebar'

export default function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <AdminHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main Content */}
      <div className="flex pt-16 md:pt-20">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} />

        {/* Content */}
        <main className="flex-1 md:ml-64 overflow-y-auto">
          <div className="p-4 md:p-8">{children}</div>
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
