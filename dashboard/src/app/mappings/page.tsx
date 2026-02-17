"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    Plus, Settings2, Trash2, X, MapPin, Database, Tag,
    RefreshCw, MousePointerClick, ChevronRight, Check,
    ArrowDown, Zap, Play, Save, Copy, CheckCircle
} from "lucide-react";

interface Workflow {
    id: string;
    name: string;
    source_key: string;
    field_map: Record<string, string>;
    static_data: Record<string, any>;
    is_active: boolean;
}

export default function WorkflowsPage() {
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);
    const [isBuilderOpen, setIsBuilderOpen] = useState(false);

    // Builder State
    const [step, setStep] = useState(1); // 1 = Trigger, 2 = Action
    const [workflowName, setWorkflowName] = useState("Untitled Workflow");
    const [sourceKey, setSourceKey] = useState("");
    const [emailPath, setEmailPath] = useState("email");
    const [firstNamePath, setFirstNamePath] = useState("firstName");
    const [lastNamePath, setLastNamePath] = useState("lastName");
    const [phonePath, setPhonePath] = useState("phone");
    // Action Config State
    const [actionType, setActionType] = useState<"contact" | "opportunity">("contact");
    const [pipelines, setPipelines] = useState<any[]>([]);
    const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
    const [selectedStageId, setSelectedStageId] = useState<string>("");
    const [opportunityName, setOpportunityName] = useState("New Lead: {{name}}");
    const [opportunityCents, setOpportunityCents] = useState<string>("0");

    const [tagsInput, setTagsInput] = useState("Automated");

    // Sample Data State
    const [sampleData, setSampleData] = useState<any>(null);
    const [isLoadingSample, setIsLoadingSample] = useState(false);
    const [activeFieldForMapping, setActiveFieldForMapping] = useState<string | null>(null);

    const supabase = createClient();



    const fetchPipelines = async () => {
        try {
            const res = await fetch('/api/ghl/pipelines');
            const data = await res.json();
            if (data.pipelines) {
                setPipelines(data.pipelines);
            }
        } catch (e) {
            console.error("Failed to fetch pipelines", e);
        }
    };

    const fetchWorkflows = async () => {
        const { data, error } = await supabase
            .from("zap_mappings")
            .select("*")
            .order("created_at", { ascending: false });

        if (!error && data) {
            setWorkflows(data);
        }
        setIsLoading(false);
    };

    const fetchLatestSample = async () => {
        if (!sourceKey) {
            alert("Please enter a Trigger ID first (e.g. typeform_form_1)");
            return;
        }
        setIsLoadingSample(true);
        const { data, error } = await supabase
            .from("zap_incoming_webhooks")
            .select("payload")
            .eq("source", sourceKey)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        setIsLoadingSample(false);
        if (data) {
            setSampleData(data.payload);
            setStep(2); // Auto-advance to action step if data found
        } else {
            alert("No data found yet. Send a test submission to your webhook URL first!");
        }
    };

    const handleSelectPath = (path: string, value: any) => {
        if (!activeFieldForMapping) return;

        if (activeFieldForMapping === 'email') setEmailPath(path);
        if (activeFieldForMapping === 'firstName') setFirstNamePath(path);
        if (activeFieldForMapping === 'lastName') setLastNamePath(path);
        if (activeFieldForMapping === 'phone') setPhonePath(path);
        if (activeFieldForMapping === 'opportunityName') setOpportunityName(path);
        if (activeFieldForMapping === 'opportunityCents') setOpportunityCents(path);

        setActiveFieldForMapping(null);
    };

    const handleSave = async () => {
        if (!workflowName || !sourceKey) return;

        const workflowData = {
            name: workflowName,
            source_key: sourceKey,
            field_map: {
                "email": emailPath,
                "firstName": firstNamePath,
                "lastName": lastNamePath,
                "phone": phonePath,
                "opportunityName": opportunityName,
                "opportunityCents": opportunityCents
            },
            static_data: {
                action_type: actionType,
                pipeline_id: selectedPipelineId,
                stage_id: selectedStageId,
                opportunity_name: opportunityName,
                monetary_value: opportunityCents, // Now a string
                tags: tagsInput.split(',').map(t => t.trim()).filter(t => t)
            }
        };

        let result;

        if (currentWorkflowId) {
            // Update existing
            result = await supabase
                .from("zap_mappings")
                .update(workflowData)
                .eq("id", currentWorkflowId)
                .select();
        } else {
            // Create new
            result = await supabase
                .from("zap_mappings")
                .insert([workflowData])
                .select();
        }

        const { data, error } = result;

        if (!error && data) {
            if (currentWorkflowId) {
                setWorkflows(workflows.map(w => w.id === currentWorkflowId ? data[0] : w));
            } else {
                setWorkflows([data[0], ...workflows]);
            }
            resetBuilder();
        } else {
            console.error("Save Error:", error);
            alert("Error saving workflow: " + (error as any).message);
        }
    };

    const editWorkflow = (w: Workflow) => {
        setCurrentWorkflowId(w.id);
        setWorkflowName(w.name);
        setSourceKey(w.source_key);
        setEmailPath(w.field_map.email || "");
        setFirstNamePath(w.field_map.firstName || "");
        setLastNamePath(w.field_map.lastName || "");
        setPhonePath(w.field_map.phone || "");
        setTagsInput(w.static_data?.tags?.join(", ") || "Automated");

        // Restore Action Settings
        setActionType(w.static_data?.action_type || "contact");
        setSelectedPipelineId(w.static_data?.pipeline_id || "");
        setSelectedStageId(w.static_data?.stage_id || "");
        setOpportunityName(w.field_map.opportunityName || w.static_data?.opportunity_name || "New Lead: {{name}}");
        setOpportunityCents(w.field_map.opportunityCents || String(w.static_data?.monetary_value || "0"));

        // Try to fetch latest sample data for this source key to populate the inspector
        // We don't await this as it's UI enhancement
        fetchLatestSampleForEdit(w.source_key);

        setIsBuilderOpen(true);
        setStep(1); // Start at beginning to review
    };

    const fetchLatestSampleForEdit = async (key: string) => {
        setIsLoadingSample(true);
        const { data } = await supabase
            .from("zap_incoming_webhooks")
            .select("payload")
            .eq("source", key)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        setIsLoadingSample(false);
        if (data) {
            setSampleData(data.payload);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this workflow?")) return;
        const { error } = await supabase.from("zap_mappings").delete().eq("id", id);
        if (!error) {
            setWorkflows(workflows.filter(w => w.id !== id));
        }
    };

    const resetBuilder = () => {
        setIsBuilderOpen(false);
        setCurrentWorkflowId(null);
        setStep(1);
        setWorkflowName("Untitled Workflow");
        setSourceKey("");
        setEmailPath("email");
        setFirstNamePath("firstName");
        setLastNamePath("lastName");
        setPhonePath("phone");
        setTagsInput("Automated");

        // Reset Action Config
        setActionType("contact");
        setSelectedPipelineId("");
        setSelectedStageId("");
        setOpportunityName("New Lead: {{name}}");
        setOpportunityCents("0");

        setSampleData(null);
    };

    useEffect(() => {
        fetchWorkflows();
        fetchPipelines();
    }, []);

    const getWebhookUrl = () => {
        if (typeof window === 'undefined') return '';
        // Assuming backend is on same domain/port for now or handled via proxy
        return `${window.location.origin}/api/webhook?source=${sourceKey || 'YOUR_TRIGGER_ID'}`;
    };

    const getFlattenedOptions = (obj: any, prefix = '') => {
        let options: { path: string, key: string, preview: string }[] = [];
        if (!obj) return options;

        for (const key in obj) {
            const value = obj[key];
            const currentPath = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'object' && value !== null) {
                options = [...options, ...getFlattenedOptions(value, currentPath)];
            } else {
                options.push({
                    path: currentPath,
                    key: key,
                    preview: String(value).substring(0, 30)
                });
            }
        }
        return options;
    };
    const getRefinedMappingOptions = (data: any) => {
        if (!data) return [];

        let options: { path: string, key: string, preview: string }[] = [];
        const blockList = ['id', 'token', 'event_id', 'landing_id', 'signature', 'event_type'];

        // Typeform Specific Logic
        if (data.form_response && Array.isArray(data.form_response.answers)) {
            // Create a map of Field ID -> Field Title from definition if available
            const fieldTitles: Record<string, string> = {};
            if (data.form_response.definition && Array.isArray(data.form_response.definition.fields)) {
                data.form_response.definition.fields.forEach((f: any) => {
                    fieldTitles[f.id] = f.title;
                });
            }

            // Answers
            data.form_response.answers.forEach((answer: any, index: number) => {
                const fieldType = answer.type;
                const value = answer[fieldType];
                const fieldId = answer.field?.id;

                // Priority: 
                // 1. Title directly on answer
                // 2. Title from definition lookup via ID
                // 3. Field Ref
                // 4. Index fallback
                let label = answer.field?.title || fieldTitles[fieldId] || answer.field?.ref || `Question ${index + 1}`;

                // Truncate long questions for the dropdown
                if (label.length > 40) label = label.substring(0, 37) + '...';

                if (value !== undefined && typeof value !== 'object') {
                    options.push({
                        path: `form_response.answers.${index}.${fieldType}`,
                        key: label,
                        preview: String(value)
                    });
                } else if (typeof value === 'object' && value !== null) {
                    // For choices/objects
                    if (value.label) {
                        options.push({
                            path: `form_response.answers.${index}.${fieldType}.label`,
                            key: label,
                            preview: value.label
                        });
                    } else {
                        options.push({
                            path: `form_response.answers.${index}.${fieldType}`,
                            key: label,
                            preview: JSON.stringify(value)
                        });
                    }
                } else if (fieldType === 'phone_number') {
                    options.push({
                        path: `form_response.answers.${index}.phone_number`,
                        key: label,
                        preview: answer.phone_number
                    });
                }
            });

            // Hidden Fields
            if (data.form_response.hidden) {
                Object.keys(data.form_response.hidden).forEach(key => {
                    options.push({
                        path: `form_response.hidden.${key}`,
                        key: `Hidden: ${key}`,
                        preview: data.form_response.hidden[key]
                    });
                });
            }

            // Calculators/Variables
            if (data.form_response.variables) {
                Object.keys(data.form_response.variables).forEach(key => {
                    options.push({
                        path: `form_response.variables.${key}`,
                        key: `Variable: ${key}`,
                        preview: data.form_response.variables[key]
                    });
                });
            }

            return options;
        }

        // Generic Fallback (Recursive flat) but filtered
        const genericOptions = getFlattenedOptions(data);
        return genericOptions.filter(opt => {
            const parts = opt.path.split('.');
            const lastPart = parts[parts.length - 1];
            // Filter out technical keys and deep definition schemas
            return !blockList.includes(lastPart) &&
                !opt.path.includes('definition') &&
                !opt.path.includes('.field.id') &&
                !opt.path.includes('.field.type') &&
                !opt.path.includes('.field.ref');
        });
    };

    const mappingOptions = sampleData ? getRefinedMappingOptions(sampleData) : [];

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-40">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-gray-900 mb-2">My Workflows</h1>
                    <p className="text-gray-500 text-lg">Manage your automated connections.</p>
                </div>
                {!isBuilderOpen && (
                    <button
                        onClick={() => {
                            setSourceKey(`trigger_${Math.random().toString(36).substr(2, 6)}`);
                            setIsBuilderOpen(true);
                        }}
                        className="flex items-center gap-2 bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-xl active:scale-95 hover:-translate-y-1"
                    >
                        <Plus size={20} />
                        Create Zap
                    </button>
                )}
            </div>


            {/* Builder UI */}
            {
                isBuilderOpen && (
                    <div className="bg-white rounded-[2rem] border border-gray-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
                        {/* Builder Header */}
                        <div className="bg-gray-50/50 border-b border-gray-100 p-6 flex justify-between items-center">
                            <input
                                value={workflowName}
                                onChange={(e) => setWorkflowName(e.target.value)}
                                className="text-2xl font-black bg-transparent border-none outline-none placeholder:text-gray-300 text-gray-900 w-full hover:bg-white focus:bg-white rounded-lg px-2 transition-colors py-1"
                                placeholder="Name your workflow..."
                            />
                            <button onClick={resetBuilder} className="p-2 hover:bg-gray-200 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex h-[800px]">
                            {/* Main Canvas */}
                            <div className="flex-1 bg-gray-50/50 p-10 overflow-y-auto custom-scrollbar relative">
                                {/* Connectors */}
                                <div className="absolute left-[59px] top-20 bottom-0 w-1 bg-gray-200 z-0"></div>

                                {/* Step 1: Trigger */}
                                <div className={`relative z-10 transition-all duration-300 ${step === 1 ? 'scale-100' : 'scale-95 opacity-80 hover:opacity-100'}`}>
                                    <div
                                        className={`bg-white rounded-2xl border-2 p-6 shadow-sm transition-all cursor-pointer ${step === 1 ? 'border-black ring-4 ring-black/5 shadow-xl' : 'border-gray-200 hover:border-gray-300'}`}
                                        onClick={() => setStep(1)}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center shadow-sm text-2xl">
                                                ⚡
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center mb-1">
                                                    <h3 className="font-bold text-gray-900 text-lg">1. Trigger</h3>
                                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Webhook</span>
                                                </div>
                                                <p className="text-gray-500 text-sm mb-4">Start workflow when data is received.</p>

                                                {step === 1 && (
                                                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                                        <div>
                                                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Trigger ID</label>
                                                            <input
                                                                value={sourceKey}
                                                                onChange={(e) => setSourceKey(e.target.value)}
                                                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono font-bold text-gray-700 outline-none focus:border-blue-500 transition-colors"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Webhook URL</label>
                                                            <div className="flex gap-2">
                                                                <div className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-600 truncate">
                                                                    {getWebhookUrl()}
                                                                </div>
                                                                <button
                                                                    onClick={() => navigator.clipboard.writeText(getWebhookUrl())}
                                                                    className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 rounded-lg font-bold"
                                                                    title="Copy URL"
                                                                >
                                                                    <Copy size={16} />
                                                                </button>
                                                            </div>
                                                            <p className="text-[10px] text-gray-400 mt-2">
                                                                Send a <b>POST</b> request to this URL to trigger the workflow.
                                                            </p>
                                                        </div>

                                                        <button
                                                            onClick={fetchLatestSample}
                                                            disabled={isLoadingSample}
                                                            className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                                                        >
                                                            {isLoadingSample ? <RefreshCw className="animate-spin" size={18} /> : <Play size={18} fill="currentColor" />}
                                                            Test Trigger
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Connector Arrow */}
                                <div className="flex justify-start pl-[22px] py-4 relative z-10">
                                    <ArrowDown className="text-gray-300" size={24} />
                                </div>

                                {/* Step 2: Action */}
                                <div className={`relative z-10 transition-all duration-300 ${step === 2 ? 'scale-100' : 'scale-95 opacity-80 hover:opacity-100'}`}>
                                    <div
                                        className={`bg-white rounded-2xl border-2 p-6 shadow-sm transition-all cursor-pointer ${step === 2 ? 'border-black ring-4 ring-black/5 shadow-xl' : 'border-gray-200 hover:border-gray-300'}`}
                                        onClick={() => setStep(2)}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg text-white">
                                                <Database size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center mb-1">
                                                    <h3 className="font-bold text-gray-900 text-lg">2. Action</h3>
                                                    <div className="flex gap-2">
                                                        <select
                                                            value={actionType}
                                                            onChange={(e) => setActionType(e.target.value as any)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="bg-blue-50 text-blue-700 text-xs font-bold uppercase py-1 px-2 rounded outline-none border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors"
                                                        >
                                                            <option value="contact">Create Contact</option>
                                                            <option value="opportunity">Create Opportunity</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <p className="text-gray-500 text-sm mb-4">
                                                    {actionType === 'contact' ? 'Create or update a contact in GHL.' : 'Create an opportunity in a specific pipeline.'}
                                                </p>

                                                {step === 2 && (
                                                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
                                                        {!sampleData && (
                                                            <div className="bg-amber-50 border border-amber-100 text-amber-600 text-xs font-bold p-3 rounded-lg mb-4 flex items-center gap-2">
                                                                ⚠️ Please test the trigger step first to get sample data.
                                                            </div>
                                                        )}

                                                        <div className="space-y-4">
                                                            <MappingInput
                                                                label="Email"
                                                                value={emailPath}
                                                                onChange={setEmailPath}
                                                                options={mappingOptions}
                                                            />
                                                            <MappingInput
                                                                label="First Name"
                                                                value={firstNamePath}
                                                                onChange={setFirstNamePath}
                                                                options={mappingOptions}
                                                            />
                                                            <MappingInput
                                                                label="Last Name"
                                                                value={lastNamePath}
                                                                onChange={setLastNamePath}
                                                                options={mappingOptions}
                                                            />
                                                            <MappingInput
                                                                label="Phone"
                                                                value={phonePath}
                                                                onChange={setPhonePath}
                                                                options={mappingOptions}
                                                            />

                                                            <div className="pt-4 border-t border-gray-100">
                                                                <label className="text-[10px] font-bold text-purple-600 uppercase mb-2 block flex items-center gap-1">
                                                                    <Tag size={12} /> Add Tags
                                                                </label>
                                                                <input
                                                                    value={tagsInput}
                                                                    onChange={(e) => setTagsInput(e.target.value)}
                                                                    placeholder="e.g. Lead, Automated"
                                                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-purple-500 transition-colors"
                                                                />
                                                            </div>

                                                            {actionType === 'opportunity' && (
                                                                <div className="pt-4 border-t border-gray-100 space-y-4 animate-in slide-in-from-top-2 fade-in duration-300">
                                                                    <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
                                                                        <div className="text-xs font-bold text-orange-700 uppercase mb-2 flex items-center gap-1">
                                                                            <Zap size={12} fill="currentColor" /> Opportunity Settings
                                                                        </div>

                                                                        <div className="space-y-3">
                                                                            <div>
                                                                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Pipeline</label>
                                                                                <select
                                                                                    value={selectedPipelineId}
                                                                                    onChange={(e) => {
                                                                                        setSelectedPipelineId(e.target.value);
                                                                                        setSelectedStageId(""); // Reset stage
                                                                                    }}
                                                                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-2 text-xs outline-none focus:border-orange-500"
                                                                                >
                                                                                    <option value="">Select Pipeline...</option>
                                                                                    {pipelines.map((p: any) => (
                                                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>

                                                                            {selectedPipelineId && (
                                                                                <div>
                                                                                    <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Stage</label>
                                                                                    <select
                                                                                        value={selectedStageId}
                                                                                        onChange={(e) => setSelectedStageId(e.target.value)}
                                                                                        className="w-full bg-white border border-gray-200 rounded-lg px-2 py-2 text-xs outline-none focus:border-orange-500"
                                                                                    >
                                                                                        <option value="">Select Stage...</option>
                                                                                        {pipelines.find((p: any) => p.id === selectedPipelineId)?.stages.map((s: any) => (
                                                                                            <option key={s.id} value={s.id}>{s.name}</option>
                                                                                        ))}
                                                                                    </select>
                                                                                </div>
                                                                            )}

                                                                            <div>
                                                                                <MappingInput
                                                                                    label="Opp Name"
                                                                                    value={opportunityName}
                                                                                    onChange={setOpportunityName}
                                                                                    // No options passed here to allow custom template text
                                                                                    active={activeFieldForMapping === 'opportunityName'}
                                                                                    onFocus={() => setActiveFieldForMapping('opportunityName')}
                                                                                />
                                                                            </div>

                                                                            <div>
                                                                                <MappingInput
                                                                                    label="Value (in cents)"
                                                                                    value={opportunityCents}
                                                                                    onChange={setOpportunityCents}
                                                                                    options={mappingOptions}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Save Button */}
                                <div className="mt-8 flex justify-end">
                                    <button
                                        onClick={handleSave}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center gap-2"
                                    >
                                        <Save size={20} />
                                        Publish Workflow
                                    </button>
                                </div>

                            </div>

                            {/* Right Sidebar: Data Inspector */}
                            <div className="w-80 border-l border-gray-200 bg-white flex flex-col">
                                <div className="p-5 border-b border-gray-100">
                                    <h4 className="font-black text-sm uppercase tracking-widest text-gray-500 flex items-center gap-2">
                                        <Database size={16} /> Received Data
                                    </h4>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                    {sampleData ? (
                                        <div className="space-y-1">
                                            <div className="text-[10px] text-green-600 font-bold bg-green-50 px-3 py-2 rounded-lg mb-2 mx-1 border border-green-100 flex items-center gap-2">
                                                <CheckCircle size={12} />
                                                Select fields to insert:
                                            </div>
                                            <RecursiveObjectRenderer data={sampleData} onSelect={handleSelectPath} />
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-64 text-center text-gray-400 p-4">
                                            <Zap size={32} className="mb-2 opacity-20" />
                                            <p className="text-xs font-medium">Test the trigger to see data here.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* List View */}
            {
                !isBuilderOpen && (
                    isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
                            {[1, 2].map(i => <div key={i} className="h-40 bg-gray-100 rounded-2xl" />)}
                        </div>
                    ) : workflows.length === 0 ? (
                        <EmptyState onAdd={() => {
                            setSourceKey(`trigger_${Math.random().toString(36).substr(2, 6)}`);
                            setIsBuilderOpen(true);
                        }} />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {workflows.map(w => (
                                <WorkflowCard key={w.id} w={w} onDelete={() => handleDelete(w.id)} onEdit={() => editWorkflow(w)} />
                            ))}
                        </div>
                    )
                )}
        </div>
    );
}

// Sub-components

function MappingInput({ label, value, onChange, active, onFocus, options }: any) {
    if (options && options.length > 0) {
        return (
            <div className="relative group">
                <label className="block">
                    <span className="text-[10px] font-bold mb-1 block uppercase text-gray-500">
                        {label}
                    </span>
                    <select
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500 transition-colors cursor-pointer appearance-none"
                    >
                        <option value="">-- Select {label} --</option>
                        {options.map((opt: any) => (
                            <option key={opt.path} value={opt.path}>
                                {opt.key} ({opt.preview})
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-[26px] pointer-events-none text-gray-400">
                        <ArrowDown size={14} />
                    </div>
                </label>
            </div>
        );
    }

    return (
        <div className={`relative transition-all duration-200 group`}>
            <label className="block cursor-pointer" onClick={onFocus}>
                <span className={`text-[10px] font-bold mb-1 block uppercase flex justify-between ${active ? 'text-blue-600' : 'text-gray-400'}`}>
                    {label}
                    {active && <span className="text-[9px] bg-blue-100 text-blue-600 px-2 rounded animate-pulse">Selecting...</span>}
                </span>
                <div className="relative">
                    <input
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onFocus={onFocus}
                        placeholder={`Map ${label}...`}
                        className={`w-full px-3 py-2 border rounded-lg outline-none transition-all font-mono text-xs text-gray-800 ${active
                            ? 'border-blue-500 ring-2 ring-blue-50/50 bg-blue-50/10'
                            : 'bg-white border-gray-200 hover:border-gray-300 focus:border-gray-400'
                            }`}
                    />
                    {active && <div className="absolute right-2 top-2 text-blue-500 text-[10px] bg-white px-1 font-bold shadow-sm rounded border border-blue-100">Active</div>}
                </div>
            </label>
        </div>
    );
}

function RecursiveObjectRenderer({ data, parentPath = "", onSelect }: { data: any, parentPath?: string, onSelect: (p: string, v: any) => void }) {
    if (typeof data !== 'object' || data === null) {
        return (
            <button
                onClick={() => onSelect(parentPath, data)}
                className="flex items-center gap-2 group hover:bg-blue-50 px-3 py-2 rounded-lg w-full text-left transition-colors border border-transparent hover:border-blue-100 mb-1"
            >
                <div className="w-1 h-3 bg-gray-200 group-hover:bg-blue-400 rounded-full transition-colors shrink-0" />
                <span className="font-mono text-xs text-blue-600 font-bold group-hover:underline break-all truncate">{String(data)}</span>
                <span className="text-[10px] text-gray-300 ml-auto font-mono shrink-0">{parentPath}</span>
            </button>
        );
    }

    return (
        <div className="pl-2 ml-1 border-l border-gray-100">
            {Object.entries(data).map(([key, value]) => {
                const currentPath = parentPath ? `${parentPath}.${key}` : key;
                return (
                    <div key={key}>
                        {typeof value === 'object' && value !== null ? (
                            <div className="py-1">
                                <span className="text-gray-400 text-[10px] font-bold font-mono px-2 uppercase tracking-wide">{key}</span>
                                <RecursiveObjectRenderer data={value} parentPath={currentPath} onSelect={onSelect} />
                            </div>
                        ) : (
                            <div className="flex items-center group mb-1">
                                <div className="w-20 shrink-0 text-gray-500 text-[10px] font-medium px-2 py-2 truncate text-right">{key}</div>
                                <div className="flex-1 min-w-0">
                                    <RecursiveObjectRenderer data={value} parentPath={currentPath} onSelect={onSelect} />
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function WorkflowCard({ w, onDelete, onEdit }: { w: Workflow, onDelete: () => void, onEdit: () => void }) {
    return (
        <div
            onClick={onEdit}
            className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden cursor-pointer active:scale-[0.98]"
        >
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-colors"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <Zap size={24} fill="currentColor" />
                </div>
                <div>
                    <h3 className="font-bold text-lg text-gray-900 leading-tight">{w.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`w-2 h-2 rounded-full ${w.is_active !== false ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                        <span className="text-xs font-medium text-gray-500">{w.is_active !== false ? 'Active' : 'Draft'}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-400 font-mono mb-4 bg-gray-50 p-2 rounded-lg border border-gray-100">
                <span className="font-bold">ID:</span> {w.source_key}
            </div>

            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-50">
                <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[10px]">⚡</div>
                    <div className="w-6 h-6 rounded-full bg-blue-100 border border-white flex items-center justify-center text-[8px] font-bold text-blue-600">GHL</div>
                </div>
                <span className="text-xs text-gray-400 font-medium">+ {Object.keys(w.field_map).length} mapped fields</span>
            </div>
        </div>
    );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
    return (
        <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-gray-200 shadow-sm mx-4">
            <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner animate-pulse">
                <Zap className="text-blue-600" size={32} />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">Build your first automation</h3>
            <p className="text-gray-500 mb-8 max-w-sm mx-auto">Connect your forms to GoHighLevel in seconds.</p>
            <button
                onClick={onAdd}
                className="bg-black text-white px-8 py-3 rounded-2xl font-bold text-lg hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95"
            >
                Start Building
            </button>
        </div>
    );
}
