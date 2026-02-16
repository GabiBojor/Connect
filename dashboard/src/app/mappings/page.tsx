"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Settings2, Trash2, X, MapPin, Database, Tag, RefreshCw, MousePointerClick, ChevronRight, Check } from "lucide-react";

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

    // New Mapping State
    const [newName, setNewName] = useState("");
    const [newSourceKey, setNewSourceKey] = useState("");
    const [emailPath, setEmailPath] = useState("email");
    const [firstNamePath, setFirstNamePath] = useState("firstName");
    const [lastNamePath, setLastNamePath] = useState("lastName");
    const [phonePath, setPhonePath] = useState("phone");
    const [tagsInput, setTagsInput] = useState("Automated");

    // Sample Data State
    const [sampleData, setSampleData] = useState<any>(null);
    const [isLoadingSample, setIsLoadingSample] = useState(false);
    const [activeFieldForMapping, setActiveFieldForMapping] = useState<string | null>(null);

    const supabase = createClient();

    const fetchLatestSample = async () => {
        if (!newSourceKey) {
            alert("Please enter a Source Key first (e.g. typeform_leads)");
            return;
        }
        setIsLoadingSample(true);
        const { data, error } = await supabase
            .from("zap_incoming_webhooks")
            .select("payload")
            .eq("source", newSourceKey)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        setIsLoadingSample(false);
        if (data) {
            setSampleData(data.payload);
        } else {
            alert("No recent webhooks found for this Source Key. Send a test submission first!");
        }
    };

    const handleSelectPath = (path: string, value: any) => {
        if (!activeFieldForMapping) return;

        if (activeFieldForMapping === 'email') setEmailPath(path);
        if (activeFieldForMapping === 'firstName') setFirstNamePath(path);
        if (activeFieldForMapping === 'lastName') setLastNamePath(path);
        if (activeFieldForMapping === 'phone') setPhonePath(path);

        setActiveFieldForMapping(null); // Close selection mode
    };

    const handleSave = async () => {
        if (!newName || !newSourceKey) return;

        const { data, error } = await supabase
            .from("zap_mappings")
            .insert([
                {
                    name: newName,
                    source_key: newSourceKey,
                    field_map: {
                        "email": emailPath,
                        "firstName": firstNamePath,
                        "lastName": lastNamePath,
                        "phone": phonePath
                    },
                    static_data: {
                        "tags": tagsInput.split(',').map(t => t.trim()).filter(t => t)
                    }
                }
            ])
            .select();

        if (!error && data) {
            setMappings([data[0], ...mappings]);
            resetForm();
        } else {
            console.error("Save Error:", error);
            alert("Error saving mapping: " + (error as any).message);
        }
    };

    const resetForm = () => {
        setIsAdding(false);
        setNewName("");
        setNewSourceKey("");
        setEmailPath("email");
        setFirstNamePath("firstName");
        setLastNamePath("lastName");
        setPhonePath("phone");
        setTagsInput("Automated");
        setSampleData(null);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this mapping?")) return;
        const { error } = await supabase.from("zap_mappings").delete().eq("id", id);
        if (!error) {
            setMappings(mappings.filter(m => m.id !== id));
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
        <div className="max-w-6xl mx-auto space-y-8 pb-20">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-gray-900 mb-2">Automations</h1>
                    <p className="text-gray-500 text-lg">Create rules to transform webhook data into GHL contacts.</p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-xl active:scale-95 translate-y-[-4px]"
                >
                    <Plus size={20} />
                    New Workflow
                </button>
            </div>

            {isAdding && (
                <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-black text-2xl text-gray-900">Configure Workflow</h3>
                        <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        {/* Left Column: Configuration */}
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <h4 className="font-bold text-sm uppercase tracking-widest text-blue-600 flex items-center gap-2">
                                    <Database size={16} /> Basic Info
                                </h4>
                                <div className="space-y-4">
                                    <label className="block">
                                        <span className="text-xs font-bold text-gray-500 ml-1 mb-1 block">WORKFLOW NAME</span>
                                        <input
                                            autoFocus
                                            placeholder="e.g. Typeform to GHL"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-bold"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="text-xs font-bold text-gray-500 ml-1 mb-1 block">SOURCE KEY (from URL)</span>
                                        <div className="flex gap-2">
                                            <input
                                                placeholder="e.g. typeform_leads"
                                                value={newSourceKey}
                                                onChange={(e) => setNewSourceKey(e.target.value)}
                                                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
                                            />
                                            <button
                                                onClick={fetchLatestSample}
                                                disabled={isLoadingSample}
                                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-colors"
                                            >
                                                {isLoadingSample ? <RefreshCw className="animate-spin" size={16} /> : <Database size={16} />}
                                                Load Last Data
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-1 ml-1">Use this in your specific Typeform webhook URL: <code>?source=YOUR_KEY</code></p>
                                    </label>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                <h4 className="font-bold text-sm uppercase tracking-widest text-orange-600 flex items-center gap-2">
                                    <MapPin size={16} /> Field Mapping
                                </h4>
                                <p className="text-xs text-gray-500">
                                    {sampleData ? "Click a field in the Data Inspector (right) to map it." : "Enter paths manually or load data to select visually."}
                                </p>

                                <div className="space-y-3">
                                    <MappingInput
                                        label="Email Address"
                                        value={emailPath}
                                        onChange={setEmailPath}
                                        active={activeFieldForMapping === 'email'}
                                        onFocus={() => setActiveFieldForMapping('email')}
                                    />
                                    <MappingInput
                                        label="First Name"
                                        value={firstNamePath}
                                        onChange={setFirstNamePath}
                                        active={activeFieldForMapping === 'firstName'}
                                        onFocus={() => setActiveFieldForMapping('firstName')}
                                    />
                                    <MappingInput
                                        label="Last Name"
                                        value={lastNamePath}
                                        onChange={setLastNamePath}
                                        active={activeFieldForMapping === 'lastName'}
                                        onFocus={() => setActiveFieldForMapping('lastName')}
                                    />
                                    <MappingInput
                                        label="Phone Number"
                                        value={phonePath}
                                        onChange={setPhonePath}
                                        active={activeFieldForMapping === 'phone'}
                                        onFocus={() => setActiveFieldForMapping('phone')}
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                                <label className="block">
                                    <span className="text-xs font-bold text-purple-600 ml-1 mb-1 block uppercase tracking-widest flex items-center gap-2"><Tag size={14} /> GHL Tags</span>
                                    <input
                                        placeholder="Tag1, Tag2..."
                                        value={tagsInput}
                                        onChange={(e) => setTagsInput(e.target.value)}
                                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-purple-500 outline-none transition-all font-medium"
                                    />
                                </label>
                            </div>
                        </div>

                        {/* Right Column: Data Inspector */}
                        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200 overflow-hidden flex flex-col h-full max-h-[600px]">
                            <h4 className="font-bold text-sm uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
                                <MousePointerClick size={16} /> Data Inspector
                            </h4>

                            {sampleData ? (
                                <div className="overflow-auto flex-1 pr-2 custom-scrollbar">
                                    <p className="text-xs text-green-600 font-bold mb-3 flex items-center gap-1">
                                        <Check size={12} /> Loaded data from recent webhook
                                    </p>
                                    <div className="space-y-1">
                                        <RecursiveObjectRenderer data={sampleData} onSelect={handleSelectPath} />
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 p-8 border-2 border-dashed border-gray-200 rounded-xl">
                                    <RefreshCw size={32} className="mb-2 opacity-20" />
                                    <p className="font-medium text-sm">No data loaded.</p>
                                    <p className="text-xs mt-1">1. Enter Source Key<br />2. Click "Load Last Data"</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-4 mt-8 pt-6 border-t border-gray-100">
                        <button
                            onClick={handleSave}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-lg transition-all shadow-lg shadow-blue-200 active:scale-95"
                        >
                            Save Workflow
                        </button>
                        <button
                            onClick={resetForm}
                            className="px-8 bg-gray-100 hover:bg-gray-200 text-gray-600 py-4 rounded-2xl font-bold transition-all active:scale-95 border border-gray-200"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[1, 2].map((i) => (
                        <div key={i} className="h-64 bg-gray-100 animate-pulse rounded-3xl border border-gray-200" />
                    ))}
                </div>
            ) : mappings.length === 0 && !isAdding ? (
                <EmptyState onAdd={() => setIsAdding(true)} />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {mappings.map((m) => (
                        <MappingCard key={m.id} m={m} onDelete={() => handleDelete(m.id)} />
                    ))}
                </div>
            )}
        </div>
    );
}

// Helper Components

function MappingInput({ label, value, onChange, active, onFocus }: any) {
    return (
        <div className={`relative transition-all duration-200 ${active ? 'scale-[1.02]' : ''}`}>
            <label className="block group cursor-pointer" onClick={onFocus}>
                <span className={`text-[10px] font-black mb-1 block uppercase flex justify-between ${active ? 'text-blue-600' : 'text-gray-400'}`}>
                    {label}
                    {active && <span className="text-[9px] bg-blue-100 text-blue-600 px-2 rounded-full animate-pulse">Running Selection...</span>}
                </span>
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={onFocus}
                    className={`w-full px-3 py-3 border rounded-lg outline-none transition-all font-mono text-xs text-gray-800 ${active
                        ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/10'
                        : 'bg-white border-gray-300 focus:border-gray-400'
                        }`}
                />
            </label>
        </div>
    );
}

// Recursive visualizer for JSON that allows clicking
function RecursiveObjectRenderer({ data, parentPath = "", onSelect }: { data: any, parentPath?: string, onSelect: (p: string, v: any) => void }) {
    if (typeof data !== 'object' || data === null) {
        return (
            <button
                onClick={() => onSelect(parentPath, data)}
                className="flex items-center gap-2 group hover:bg-blue-50 px-2 py-1 rounded w-full text-left"
            >
                <span className="text-gray-400 text-[10px] font-mono mr-1">.</span>
                <span className="font-mono text-xs text-blue-600 font-bold group-hover:underline break-all">{String(data)}</span>
                <span className="text-[9px] text-gray-300 ml-auto opacity-0 group-hover:opacity-100 font-mono hidden md:block">{parentPath}</span>
            </button>
        );
    }

    return (
        <div className="pl-3 border-l-2 border-gray-100 ml-1">
            {Object.entries(data).map(([key, value]) => {
                const currentPath = parentPath ? `${parentPath}.${key}` : key;
                return (
                    <div key={key}>
                        {typeof value === 'object' && value !== null ? (
                            <div className="py-1">
                                <span className="text-gray-500 text-xs font-bold font-mono px-2">{key}:</span>
                                <RecursiveObjectRenderer data={value} parentPath={currentPath} onSelect={onSelect} />
                            </div>
                        ) : (
                            <div className="flex items-center group">
                                <span className="text-gray-500 text-xs font-mono px-2 shrink-0">{key}:</span>
                                <RecursiveObjectRenderer data={value} parentPath={currentPath} onSelect={onSelect} />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function MappingCard({ m, onDelete }: { m: Mapping, onDelete: () => void }) {
    return (
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-blue-500 group-hover:w-3 transition-all"></div>
            <div className="flex justify-between items-start mb-6 pl-4">
                <div>
                    <h3 className="font-black text-xl text-gray-800">{m.name}</h3>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-md uppercase tracking-tight border border-blue-100">Key: {m.source_key}</span>
                    </div>
                </div>
                <button
                    onClick={onDelete}
                    className="p-2 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-xl transition-colors"
                >
                    <Trash2 size={20} />
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4 pl-4 text-xs">
                <div className="space-y-2">
                    <p className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">Field Mappings</p>
                    {Object.entries(m.field_map).map(([key, path]) => (
                        <div key={key} className="flex flex-col border-b border-gray-50 pb-1 last:border-0">
                            <span className="text-gray-900 font-bold">{key}</span>
                            <span className="text-gray-500 font-mono truncate text-[10px]" title={path} >{path}</span>
                        </div>
                    ))}
                </div>
                <div className="space-y-4">
                    <div>
                        <p className="text-gray-400 font-bold uppercase text-[9px] mb-2 tracking-wider">Tags</p>
                        <div className="flex flex-wrap gap-1">
                            {m.static_data.tags?.map((t: string) => (
                                <span key={t} className="px-2 py-1 bg-purple-50 text-purple-700 rounded-md font-bold text-[10px] border border-purple-100">{t}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
    return (
        <div className="text-center py-32 bg-white rounded-[40px] border border-dashed border-gray-200 shadow-sm mx-4">
            <div className="bg-blue-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <Database className="text-blue-600" size={40} />
            </div>
            <h3 className="text-2xl font-black text-gray-900">No active workflows</h3>
            <p className="text-gray-500 mt-2 mb-10 max-w-sm mx-auto">Connect your apps and start automating your lead generation process.</p>
            <button
                onClick={onAdd}
                className="bg-black text-white px-10 py-4 rounded-2xl font-black text-lg hover:scale-105 transition-transform active:scale-95 shadow-2xl"
            >
                Create Your First Workflow
            </button>
        </div>
    );
}
