"use client";

import LogsTableComponent from "@/components/LogsTable";

export default function LogsPage() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                    Webhook Logs
                </h1>
                <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full animate-pulse">
                    Live Monitoring Active
                </span>
            </div>
            <p className="text-gray-500 max-w-2xl">
                Monitor incoming webhooks in real-time. This table updates automatically as new data arrives from your sources.
            </p>

            <LogsTableComponent />
        </div>
    );
}
