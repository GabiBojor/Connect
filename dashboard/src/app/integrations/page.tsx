
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    Video,
    CheckCircle2,
    XCircle,
    ExternalLink,
    RefreshCw,
    AlertCircle
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function IntegrationsContent() {
    const [zoomConnection, setZoomConnection] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const supabase = createClient();
    const router = useRouter();
    const searchParams = useSearchParams();
    const success = searchParams.get('success');

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('zoom_connections')
            .select('*')
            .maybeSingle();

        if (!error) {
            setZoomConnection(data);
        }
        setIsLoading(false);
    };

    const handleConnectZoom = () => {
        window.location.href = '/api/auth/zoom';
    };

    const disconnectZoom = async () => {
        if (!confirm("Are you sure you want to disconnect Zoom?")) return;

        const { error } = await supabase
            .from('zoom_connections')
            .delete()
            .match({ id: zoomConnection.id });

        if (!error) {
            setZoomConnection(null);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-4xl font-black tracking-tight text-gray-900 mb-2">Integrations</h1>
                <p className="text-gray-500 text-lg">Connect your external accounts to automate everything.</p>
            </div>

            {success === 'zoom' && (
                <div className="bg-green-50 border border-green-100 text-green-700 px-6 py-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
                    <CheckCircle2 size={24} className="text-green-500" />
                    <div className="font-bold">Zoom connected successfully!</div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6">
                {/* Zoom Card */}
                <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden p-8 flex flex-col md:flex-row gap-8 items-center md:items-start">
                    <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0">
                        <Video size={40} fill="currentColor" />
                    </div>

                    <div className="flex-1 space-y-2 text-center md:text-left">
                        <div className="flex items-center gap-3 justify-center md:justify-start">
                            <h3 className="text-2xl font-black text-gray-900">Zoom</h3>
                            {zoomConnection ? (
                                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest bg-green-100 text-green-600 px-2 py-0.5 rounded-full">
                                    Connected
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                                    Disconnected
                                </span>
                            )}
                        </div>
                        <p className="text-gray-500 leading-relaxed">
                            Sync participants from your Zoom Webinars and Meetings directly into GoHighLevel.
                        </p>

                        {zoomConnection && (
                            <div className="pt-2 flex flex-col gap-1">
                                <span className="text-sm font-bold text-gray-700">Account: {zoomConnection.zoom_account_email}</span>
                                <span className="text-xs text-gray-400 font-medium font-mono uppercase tracking-tighter">ID: {zoomConnection.zoom_account_id}</span>
                            </div>
                        )}
                    </div>

                    <div className="shrink-0">
                        {isLoading ? (
                            <button disabled className="bg-gray-100 text-gray-400 px-8 py-4 rounded-2xl font-bold flex items-center gap-2">
                                <RefreshCw className="animate-spin" size={20} />
                                Loading...
                            </button>
                        ) : zoomConnection ? (
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={disconnectZoom}
                                    className="bg-white border-2 border-red-100 text-red-500 hover:bg-red-50 px-8 py-3 rounded-2xl font-bold transition-all active:scale-95"
                                >
                                    Disconnect
                                </button>
                                <button
                                    className="flex items-center justify-center gap-2 text-gray-400 hover:text-gray-600 text-sm font-semibold transition-colors"
                                    onClick={fetchStatus}
                                >
                                    <RefreshCw size={14} /> Refresh Status
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleConnectZoom}
                                className="bg-[#2D8CFF] hover:bg-[#1f73d4] text-white px-10 py-4 rounded-2xl font-black text-lg shadow-xl shadow-blue-200 transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
                            >
                                <ExternalLink size={20} />
                                Connect Zoom
                            </button>
                        )}
                    </div>
                </div>

                {/* GHL Card (Static for now since it's global) */}
                <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden p-8 flex flex-col md:flex-row gap-8 items-center md:items-start opacity-70">
                    <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 shrink-0">
                        <CheckCircle2 size={40} />
                    </div>

                    <div className="flex-1 space-y-2 text-center md:text-left">
                        <div className="flex items-center gap-3 justify-center md:justify-start">
                            <h3 className="text-2xl font-black text-gray-900">GoHighLevel</h3>
                            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                                Active (API Key)
                            </span>
                        </div>
                        <p className="text-gray-500 leading-relaxed">
                            Your GHL connection is managed via environment variables. In the future, we can move this to OAuth as well for multiple sub-accounts.
                        </p>
                    </div>
                </div>
            </div>

            {/* Help Section */}
            {!zoomConnection && !isLoading && (
                <div className="bg-amber-50 rounded-3xl p-8 border border-amber-100 flex gap-6 items-start">
                    <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
                        <AlertCircle size={28} />
                    </div>
                    <div className="space-y-2">
                        <h4 className="text-xl font-bold text-amber-900">How to get started with Zoom?</h4>
                        <div className="text-amber-800 text-sm space-y-3 opacity-90">
                            <p>1. Ensure your Zoom App is correctly configured in the Zoom Marketplace.</p>
                            <p>2. Set the <b>Redirect URI</b> to: <code className="bg-white/50 px-2 py-1 rounded font-mono font-bold text-xs">/api/auth/zoom/callback</code></p>
                            <p>3. Once connected, your webinars will automatically appear in the Workflow builder.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function IntegrationsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[400px]">
                <RefreshCw className="animate-spin text-gray-400" size={32} />
            </div>
        }>
            <IntegrationsContent />
        </Suspense>
    );
}
