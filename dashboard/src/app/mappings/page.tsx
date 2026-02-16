"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Settings2, Trash2, Check, X, MapPin } from "lucide-react";

interface Mapping {
    id: string;
    name: string;
    source_key: string;
    field_map: Record<string, string>;
    static_data: Record<string, any>;
    is_active: boolean;
}

export default function MappingsPage() {
    const [mappings, setMappings] = useState<Mapping[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState("");
    const [newSourceKey, setNewSourceKey] = useState("");
    const supabase = createClient();

    const handleSave = async () => {
        if (!newName || !newSourceKey) return;

        const { data, error } = await supabase
            .from("zap_mappings")
            .insert([
                {
                    name: newName,
                    source_key: newSourceKey,
                    field_map: {
                        "email": "email",
                        "firstName": "firstName",
                        "lastName": "lastName",
                        "phone": "phone"
                    },
                    static_data: {
                        "tags": ["Automated"]
                    }
                }
            ])
            .select();

        if (!error && data) {
            setMappings([data[0], ...mappings]);
            setIsAdding(false);
            setNewName("");
            setNewSourceKey("");
        } else {
            console.error("Save Error:", error);
            alert("Error saving mapping: " + (error as any).message);
        }
    };

    useEffect(() => {
        fetchMappings();
    }, []);

    const fetchMappings = async () => {
        const { data, error } = await supabase
            .from("zap_mappings")
            .select("*")
            .order("created_at", { ascending: false });

        if (!error && data) {
            setMappings(data);
        }
        setIsLoading(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Mappings</h1>
                    <p className="text-gray-500 mt-1">Define how incoming data maps to GoHighLevel fields.</p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-sm"
                >
                    <Plus size={20} />
                    Create Mapping
                </button>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-48 bg-gray-100 animate-pulse rounded-xl border border-gray-200" />
                    ))}
                </div>
            ) : mappings.length === 0 && !isAdding ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                    <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MapPin className="text-blue-600" size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800">No Mappings Yet</h3>
                    <p className="text-gray-500 mt-2 mb-6">Start by creating your first connection rule.</p>
                    <button
                        onClick={() => setIsAdding(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-all"
                    >
                        Create Your First Mapping
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Add mapping card (conditional) */}
                    {isAdding && (
                        <div className="bg-white p-6 rounded-xl border-2 border-blue-500 shadow-lg animate-in fade-in zoom-in duration-200">
                            <h3 className="font-bold text-lg mb-4 text-gray-800">New Connection</h3>
                            <div className="space-y-3">
                                <input
                                    autoFocus
                                    placeholder="Mapping Name (e.g. Typeform Sync)"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                />
                                <input
                                    placeholder="Source Key (e.g. typeform_v1)"
                                    value={newSourceKey}
                                    onChange={(e) => setNewSourceKey(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                />
                                <p className="text-[10px] text-gray-400 mt-1">
                                    *Source Key must be unique (use this in your webhook payload).
                                </p>
                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={handleSave}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => setIsAdding(false)}
                                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2 rounded-lg font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {mappings.map((m) => (
                        <div key={m.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">{m.name}</h3>
                                    <p className="text-xs text-gray-400 font-mono mt-1">Source: {m.source_key}</p>
                                </div>
                                <div className={`w-3 h-3 rounded-full ${m.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                            </div>

                            <div className="space-y-2 mb-6">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Fields mapped:</span>
                                    <span className="font-medium">{Object.keys(m.field_map).length}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Static tags:</span>
                                    <span className="font-medium">{m.static_data.tags?.length || 0}</span>
                                </div>
                            </div>

                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="flex-1 flex items-center justify-center gap-2 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 text-gray-600 py-2 rounded-lg text-sm font-medium transition-colors">
                                    <Settings2 size={16} /> Edit
                                </button>
                                <button className="p-2 bg-gray-50 hover:bg-red-50 hover:text-red-600 text-gray-400 rounded-lg transition-colors">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
