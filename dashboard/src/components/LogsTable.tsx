"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { Eye, CheckCircle, XCircle, Clock } from "lucide-react";

interface Log {
    id: string;
    source: string;
    payload: any;
    status: string;
    created_at: string;
}

export default function LogsTableComponent() {
    const [logs, setLogs] = useState<Log[]>([]);
    const [selectedLog, setSelectedLog] = useState<Log | null>(null);
    const supabase = createClient();

    useEffect(() => {
        // Initial fetch
        const fetchLogs = async () => {
            const { data } = await supabase
                .from("zap_incoming_webhooks")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(50);

            if (data) {
                setLogs(data as Log[]);
            }
        };

        fetchLogs();

        // Realtime subscription
        const channel = supabase
            .channel("incoming_webhooks_logs")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "zap_incoming_webhooks" },
                (payload) => {
                    setLogs((prev) => [payload.new as Log, ...prev]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Source</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize 
                  ${log.source === 'typeform' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                    {log.source}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                {log.status === 'processed' ? (
                                    <div className="flex items-center text-green-600 gap-1.5 text-sm font-medium">
                                        <CheckCircle size={16} /> Processed
                                    </div>
                                ) : log.status === 'failed' ? (
                                    <div className="flex items-center text-red-600 gap-1.5 text-sm font-medium">
                                        <XCircle size={16} /> Failed
                                    </div>
                                ) : (
                                    <div className="flex items-center text-yellow-600 gap-1.5 text-sm font-medium">
                                        <Clock size={16} /> Pending
                                    </div>
                                )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                                {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td className="px-6 py-4">
                                <button
                                    onClick={() => setSelectedLog(log)}
                                    className="text-gray-400 hover:text-blue-600 transition-colors"
                                >
                                    <Eye size={20} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* JSON Modal */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedLog(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-6 border-b border-gray-100">
                            <h3 className="font-bold text-lg text-gray-800">Payload Details</h3>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>
                        <div className="p-6 overflow-auto bg-gray-50 font-mono text-xs text-gray-800 flex-1">
                            <pre>{JSON.stringify(selectedLog.payload, null, 2)}</pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
