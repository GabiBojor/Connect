"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { Eye, CheckCircle, XCircle, Clock, RotateCcw, RefreshCw, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

interface Log {
    id: string;
    source: string;
    payload: any;
    notes: string | null;
    status: string;
    created_at: string;
}

const PAGE_SIZE = 25;

export default function LogsTableComponent() {
    const [logs, setLogs] = useState<Log[]>([]);
    const [selectedLog, setSelectedLog] = useState<Log | null>(null);
    const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
    const [retryingAll, setRetryingAll] = useState(false);
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [modalTab, setModalTab] = useState<'payload' | 'notes'>('payload');
    const supabase = createClient();

    const failedLogs = logs.filter(l => l.status === 'failed' || l.status === 'opportunity_failed');
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    const fetchLogs = async (pageNum: number) => {
        setLoading(true);
        const from = pageNum * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, count } = await supabase
            .from("zap_incoming_webhooks")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(from, to);

        if (data) {
            setLogs(data as Log[]);
        }
        if (count !== null) {
            setTotalCount(count);
        }
        setLoading(false);
    };

    const retryWebhooks = async (ids: string[]) => {
        setRetryingIds(prev => new Set([...prev, ...ids]));
        try {
            const res = await fetch('/api/webhook/retry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids }),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(`Retry failed: ${data.error}`);
            }
        } catch (err: any) {
            alert(`Retry error: ${err.message}`);
        } finally {
            setRetryingIds(prev => {
                const next = new Set(prev);
                ids.forEach(id => next.delete(id));
                return next;
            });
        }
    };

    const retryAll = async () => {
        if (failedLogs.length === 0) return;
        setRetryingAll(true);
        await retryWebhooks(failedLogs.map(l => l.id));
        setRetryingAll(false);
    };

    useEffect(() => {
        fetchLogs(page);
    }, [page]);

    useEffect(() => {
        // Realtime subscription for live updates on current page
        const channel = supabase
            .channel("incoming_webhooks_logs")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "zap_incoming_webhooks" },
                (payload) => {
                    if (page === 0) {
                        setLogs((prev) => [payload.new as Log, ...prev.slice(0, PAGE_SIZE - 1)]);
                        setTotalCount(prev => prev + 1);
                    } else {
                        setTotalCount(prev => prev + 1);
                    }
                }
            )
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "zap_incoming_webhooks" },
                (payload) => {
                    setLogs((prev) => prev.map(log => log.id === payload.new.id ? payload.new as Log : log));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [page]);

    const parseNotes = (notes: string | null): any => {
        if (!notes) return null;
        try {
            return JSON.parse(notes);
        } catch {
            return notes;
        }
    };

    const getErrorSummary = (log: Log): string | null => {
        const parsed = parseNotes(log.notes);
        if (!parsed) return null;
        if (parsed.error) return parsed.error;
        if (parsed.opportunity_error) return parsed.opportunity_error;
        if (parsed.retry_error) return parsed.retry_error;
        if (parsed.contact_warnings?.length > 0) return parsed.contact_warnings[0];
        return null;
    };

    const StatusBadge = ({ status }: { status: string }) => {
        switch (status) {
            case 'processed':
                return (
                    <div className="flex items-center text-green-600 gap-1.5 text-sm font-medium">
                        <CheckCircle size={16} /> Processed
                    </div>
                );
            case 'failed':
                return (
                    <div className="flex items-center text-red-600 gap-1.5 text-sm font-medium">
                        <XCircle size={16} /> Failed
                    </div>
                );
            case 'opportunity_failed':
                return (
                    <div className="flex items-center text-orange-600 gap-1.5 text-sm font-medium">
                        <AlertTriangle size={16} /> Opp. Failed
                    </div>
                );
            case 'retried':
                return (
                    <div className="flex items-center text-blue-600 gap-1.5 text-sm font-medium">
                        <RefreshCw size={16} /> Retried
                    </div>
                );
            case 'processing':
                return (
                    <div className="flex items-center text-yellow-600 gap-1.5 text-sm font-medium">
                        <Clock size={16} /> Processing
                    </div>
                );
            default:
                return (
                    <div className="flex items-center text-gray-500 gap-1.5 text-sm font-medium">
                        <Clock size={16} /> {status}
                    </div>
                );
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {failedLogs.length > 0 && (
                <div className="flex items-center justify-between px-6 py-3 bg-red-50 border-b border-red-100">
                    <span className="text-sm text-red-700 font-medium">
                        {failedLogs.length} failed webhook{failedLogs.length > 1 ? 's' : ''} on this page
                    </span>
                    <button
                        onClick={retryAll}
                        disabled={retryingAll}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                        <RefreshCw size={14} className={retryingAll ? 'animate-spin' : ''} />
                        {retryingAll ? 'Retrying...' : 'Retry All Failed'}
                    </button>
                </div>
            )}

            <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Source</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {loading ? (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                <Clock size={20} className="animate-spin inline-block mr-2" />
                                Loading...
                            </td>
                        </tr>
                    ) : logs.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                No webhooks logged yet.
                            </td>
                        </tr>
                    ) : (
                        logs.map((log) => {
                            const errorSummary = getErrorSummary(log);
                            return (
                                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                            ${log.source?.startsWith('zoom') ? 'bg-blue-100 text-blue-800' :
                                            log.source === 'typeform' ? 'bg-purple-100 text-purple-800' :
                                            'bg-gray-100 text-gray-800'}`}>
                                            {log.source}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={log.status} />
                                    </td>
                                    <td className="px-6 py-4">
                                        {errorSummary ? (
                                            <span className="text-xs text-red-600 line-clamp-2 max-w-xs block" title={errorSummary}>
                                                {errorSummary}
                                            </span>
                                        ) : log.status === 'processed' ? (
                                            <span className="text-xs text-gray-400">OK</span>
                                        ) : (
                                            <span className="text-xs text-gray-300">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {new Date(log.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 flex items-center gap-2">
                                        <button
                                            onClick={() => { setSelectedLog(log); setModalTab('payload'); }}
                                            className="text-gray-400 hover:text-blue-600 transition-colors"
                                            title="View details"
                                        >
                                            <Eye size={20} />
                                        </button>
                                        {(log.status === 'failed' || log.status === 'opportunity_failed') && (
                                            <button
                                                onClick={() => retryWebhooks([log.id])}
                                                disabled={retryingIds.has(log.id)}
                                                className="text-gray-400 hover:text-orange-600 transition-colors disabled:opacity-50"
                                                title="Retry this webhook"
                                            >
                                                <RotateCcw size={18} className={retryingIds.has(log.id) ? 'animate-spin' : ''} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <span className="text-sm text-gray-500">
                        {totalCount} total — Page {page + 1} of {totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={16} /> Previous
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Next <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Detail Modal with Tabs */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedLog(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-6 border-b border-gray-100">
                            <div className="flex items-center gap-4">
                                <h3 className="font-bold text-lg text-gray-800">Webhook Details</h3>
                                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                                    <button
                                        onClick={() => setModalTab('payload')}
                                        className={`px-3 py-1 text-xs font-medium transition-colors ${modalTab === 'payload' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                    >
                                        Payload
                                    </button>
                                    <button
                                        onClick={() => setModalTab('notes')}
                                        className={`px-3 py-1 text-xs font-medium transition-colors ${modalTab === 'notes' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                    >
                                        Notes / Errors
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>
                        <div className="p-6 overflow-auto bg-gray-50 font-mono text-xs text-gray-800 flex-1">
                            {modalTab === 'payload' ? (
                                <pre className="whitespace-pre-wrap">{JSON.stringify(selectedLog.payload, null, 2)}</pre>
                            ) : (
                                <pre className="whitespace-pre-wrap">
                                    {selectedLog.notes
                                        ? JSON.stringify(parseNotes(selectedLog.notes), null, 2)
                                        : 'No notes or error details for this webhook.'}
                                </pre>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
