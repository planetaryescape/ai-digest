import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { 
  LayoutDashboard, 
  Users, 
  Settings,
  Mail,
  Activity
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Senders', href: '/dashboard/senders', icon: Users },
  { name: 'Diagnostics', href: '/dashboard/diagnostics', icon: Activity },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Mail className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-semibold">AI Digest</h1>
            </div>
            <nav className="hidden md:flex space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.name}
                </Link>
              ))}
            </nav>
            <div className="flex items-center">
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}