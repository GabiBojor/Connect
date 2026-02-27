import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { LayoutDashboard, ScrollText, Network, Settings, Zap, Video } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Automation Dashboard",
  description: "Monitor and configure your automations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning>
        <div className="flex h-screen bg-gray-100">
          {/* Sidebar */}
          <aside className="relative w-64 bg-white shadow-md">
            <div className="p-6 border-b flex items-center gap-2">
              <Zap className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                AutoFlow
              </h1>
            </div>
            <nav className="p-4 space-y-2">
              <Link href="/" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors">
                <LayoutDashboard size={20} />
                <span>Dashboard</span>
              </Link>
              <Link href="/logs" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors">
                <ScrollText size={20} />
                <span>Logs</span>
              </Link>
              <Link href="/integrations" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors">
                <Video size={20} />
                <span>Integrations</span>
              </Link>
              <Link href="/mappings" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors">
                <Network size={20} />
                <span>Mappings</span>
              </Link>
              <Link href="/settings" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors">
                <Settings size={20} />
                <span>Settings</span>
              </Link>
            </nav>
            <div className="absolute bottom-0 left-0 w-64 p-4 border-t border-gray-100 bg-white">
              <LogoutButton />
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
