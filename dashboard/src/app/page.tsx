import { createClient } from "@/lib/supabase/server";
import { ArrowUpRight, CheckCircle, Activity, Zap } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = await createClient();

  // Fetch stats from zap_incoming_webhooks
  const { count: totalLeads } = await supabase
    .from('zap_incoming_webhooks')
    .select('*', { count: 'exact', head: true });

  const { count: successCount } = await supabase
    .from('zap_incoming_webhooks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'processed');

  const successRate = totalLeads ? Math.round(((successCount || 0) / totalLeads) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-800">Overview</h2>
        <div className="text-sm text-gray-500">Updated just now</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Total Leads */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
              <Zap size={24} />
            </div>
            <span className="flex items-center text-green-500 text-sm font-medium">
              +12% <ArrowUpRight size={16} />
            </span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{totalLeads || 0}</div>
          <div className="text-gray-500 text-sm mt-1">Total Leads Processed</div>
        </div>

        {/* Card 2: Success Rate */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-green-50 rounded-lg text-green-600">
              <CheckCircle size={24} />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{successRate}%</div>
          <div className="text-gray-500 text-sm mt-1">Success Rate</div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3">
            <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${successRate}%` }}></div>
          </div>
        </div>

        {/* Card 3: Active Automations */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-purple-50 rounded-lg text-purple-600">
              <Activity size={24} />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">2</div>
          <div className="text-gray-500 text-sm mt-1">Active Workflows</div>
          <div className="flex gap-2 mt-3">
            <span className="px-2 py-1 bg-gray-100 text-xs rounded text-gray-600">Typeform</span>
            <span className="px-2 py-1 bg-gray-100 text-xs rounded text-gray-600">Zoom</span>
          </div>
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Recent Activity</h3>
        <div className="text-center py-10 text-gray-400">
          Data visualization coming soon...
        </div>
      </div>
    </div>
  );
}
