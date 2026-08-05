import React, { useState, useEffect } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { 
  Sparkles, 
  Clock, 
  TrendingUp, 
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  MoreVertical,
  ClipboardList
} from 'lucide-react';
import { fetchAnalytics, ApiAnalytics, ApiAnalyticsActivity } from '../lib/api';
import DashboardHeader from './DashboardHeader';

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ActivityIcon({ type }: { type: ApiAnalyticsActivity['type'] }) {
  if (type === 'complaint') return <AlertTriangle className="h-4 w-4 text-[#ff9d92]" />;
  if (type === 'inventory')  return <ClipboardList className="h-4 w-4 text-[#ffcf6b]" />;
  return <CheckCircle className="h-4 w-4 text-[#7ff0b0]" />;
}

function KpiSkeleton() {
  return (
    <div className="zone-b-grey3 p-6 flex flex-col justify-between h-32">
      <div className="animate-pulse space-y-3">
        <div className="h-3 w-24 bg-white/10 rounded-full" />
        <div className="h-9 w-20 bg-white/10 rounded-xl" />
      </div>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] p-3.5 rounded-xl flex gap-3 items-start animate-pulse">
      <div className="w-8 h-8 rounded-full bg-white/10 shrink-0 mt-0.5" />
      <div className="flex-grow space-y-2 pt-1">
        <div className="h-3 w-32 bg-white/10 rounded" />
        <div className="h-3 w-48 bg-white/10 rounded" />
      </div>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<'30' | '90'>('30');
  const [data, setData]           = useState<ApiAnalytics | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [dismissedBanner, setDismissedBanner] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetchAnalytics(timeRange === '90' ? 90 : 30)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [timeRange]);

  const chartData = data?.series ?? [];

  return (
    <div className="w-full flex-grow flex flex-col text-left">
      <DashboardHeader 
        searchPlaceholder="Search commands…" 
      />

      <div className="w-full flex-grow space-y-6 p-6 md:p-8 pb-16">

        {error && !loading && (
          <div className="flex items-center justify-center h-64 text-white/50 text-sm font-sans">
            Unable to load analytics data.
          </div>
        )}

        {!error && (
          <>
            {/* 4 Stat Cards (§5.10) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

              {loading ? (
                <>
                  <KpiSkeleton />
                  <KpiSkeleton />
                  <KpiSkeleton />
                  <KpiSkeleton />
                </>
              ) : (
                <>
                  {/* KPI 1: AI automation rate */}
                  <div className="zone-b-grey3 p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="font-sans text-[11px] text-white/60 font-bold tracking-[0.10em]">AI automation rate</span>
                      <Sparkles className="h-5 w-5 text-[#4d8bff]" />
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                      <h3 className="text-[34px] font-[750] tracking-[-0.02em] text-white leading-none">
                        {data?.kpis.automationRate ?? 0}%
                      </h3>
                      <span className="status-success px-2 py-0.5 text-[10.5px] font-bold rounded-full">+4.2%</span>
                    </div>
                  </div>

                  {/* KPI 2: Avg response time */}
                  <div className="zone-b-grey3 p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="font-sans text-[11px] text-white/60 font-bold tracking-[0.10em]">Avg response time</span>
                      <Clock className="h-5 w-5 text-[#4d8bff]" />
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                      <h3 className="text-[34px] font-[750] tracking-[-0.02em] text-white leading-none">1.2s</h3>
                      <span className="status-success px-2 py-0.5 text-[10.5px] font-bold rounded-full">-0.4s</span>
                    </div>
                  </div>

                  {/* KPI 3: Order uplift */}
                  <div className="zone-b-grey3 p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="font-sans text-[11px] text-white/60 font-bold tracking-[0.10em]">Order uplift</span>
                      <TrendingUp className="h-5 w-5 text-[#4d8bff]" />
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                      <h3 className="text-[34px] font-[750] tracking-[-0.02em] text-white leading-none">
                        +18.4%
                      </h3>
                      <span className="status-success px-2 py-0.5 text-[10.5px] font-bold rounded-full">Active</span>
                    </div>
                  </div>

                  {/* KPI 4: AI messages used */}
                  <div className="zone-b-grey3 p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="font-sans text-[11px] text-white/60 font-bold tracking-[0.10em]">AI messages used</span>
                      <MessageSquare className="h-5 w-5 text-[#4d8bff]" />
                    </div>
                    <div className="mt-4">
                      <h3 className="text-[34px] font-[750] tracking-[-0.02em] text-white leading-none">
                        {(data?.kpis.aiMessages ?? 0).toLocaleString()}
                      </h3>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Main Chart + Activity Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Curve Chart (8 Cols) */}
              <div className="lg:col-span-8 zone-b-grey2 p-6 flex flex-col justify-between space-y-4">
                <header className="flex justify-between items-center pb-4 border-b border-white/[0.07]">
                  <div>
                    <h3 className="font-sans font-bold text-[19px] text-white tracking-tight">Conversations vs. sales</h3>
                    <p className="text-[13px] text-white/55 mt-0.5">
                      Operational performance metrics over the last {timeRange} days.
                    </p>
                  </div>

                  {/* 30/90-day Segmented Control (§5.8) */}
                  <div className="flex bg-black/45 border border-white/10 p-1 rounded-[13px]">
                    <button
                      onClick={() => setTimeRange('30')}
                      className={`px-3.5 py-1.5 rounded-lg font-sans text-xs font-semibold cursor-pointer transition-all ${
                        timeRange === '30' 
                          ? 'bg-gradient-to-b from-white/20 to-white/[0.07] border border-white/20 text-white shadow-md' 
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      30 days
                    </button>
                    <button
                      onClick={() => setTimeRange('90')}
                      className={`px-3.5 py-1.5 rounded-lg font-sans text-xs font-semibold cursor-pointer transition-all ${
                        timeRange === '90' 
                          ? 'bg-gradient-to-b from-white/20 to-white/[0.07] border border-white/20 text-white shadow-md' 
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      90 days
                    </button>
                  </div>
                </header>

                {/* Catmull-Rom smooth curve styling (§5.10) */}
                <div className="h-[320px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorConversations" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4d8bff" stopOpacity={0.38}/>
                          <stop offset="95%" stopColor="#4d8bff" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorConverted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ffffff" stopOpacity={0.16}/>
                          <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        stroke="rgba(255,255,255,0.35)" 
                        fontSize={10.5} 
                        fontFamily="Inter" 
                        tickLine={false} 
                        dy={10}
                      />
                      <YAxis 
                        stroke="rgba(255,255,255,0.35)" 
                        fontSize={10.5} 
                        fontFamily="Inter" 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#0c0c0e', 
                          border: '1px solid rgba(255, 255, 255, 0.15)', 
                          borderRadius: '12px',
                          fontFamily: 'Inter',
                          fontSize: '12px'
                        }}
                        itemStyle={{ color: '#ffffff' }}
                        labelStyle={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px', fontWeight: 'bold' }}
                      />
                      <Area 
                        name="Conversations"
                        type="monotone" 
                        dataKey="conversations" 
                        stroke="#4d8bff" 
                        strokeWidth={2.75}
                        fillOpacity={1} 
                        fill="url(#colorConversations)" 
                      />
                      <Area 
                        name="Converted sales"
                        type="monotone" 
                        dataKey="convertedSales" 
                        stroke="rgba(255,255,255,0.50)" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorConverted)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex gap-6 pt-4 border-t border-white/[0.07] text-xs font-sans text-white/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#4d8bff]" />
                    <span>Conversations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-white/50" />
                    <span>Converted sales</span>
                  </div>
                </div>
              </div>

              {/* Recent activity feed (4 Cols) */}
              <div className="lg:col-span-4 zone-b-grey2 p-6 flex flex-col h-[460px]">
                <header className="flex justify-between items-center pb-4 border-b border-white/[0.07] mb-4">
                  <h3 className="font-sans font-bold text-[19px] text-white tracking-tight">
                    Recent activity
                  </h3>
                  <button className="text-white/40 hover:text-white transition-colors cursor-pointer p-1">
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </header>

                <div className="flex-grow overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-white/10">
                  {loading ? (
                    <>
                      <ActivitySkeleton />
                      <ActivitySkeleton />
                      <ActivitySkeleton />
                    </>
                  ) : (
                    (data?.recentActivity ?? []).map(item => (
                      <div
                        key={item.id}
                        className="zone-b-grey3 p-3.5 rounded-xl flex gap-3 text-left items-start hover:bg-white/[0.06] transition-all"
                      >
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                          <ActivityIcon type={item.type} />
                        </div>
                        <div className="flex-grow space-y-1">
                          <div className="flex justify-between items-center text-[11px] font-sans font-bold">
                            <span className="text-white">{item.title}</span>
                            <span className="text-white/40 font-normal">{relativeTime(item.time)}</span>
                          </div>
                          <p className="text-xs text-white/65 leading-relaxed">{item.body}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <button className="w-full mt-4 btn-glass py-2.5 font-sans font-bold text-xs cursor-pointer">
                  View all history
                </button>
              </div>
            </div>

            {/* AI sales strategy update banner (§8) */}
            {!dismissedBanner && (
              <div className="zone-b-grey3 p-5 rounded-2xl border border-white/14 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-left">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#4d8bff]/30 to-[#183aa7]/20 border border-[#7aa8ff]/40 flex items-center justify-center text-[#7aa8ff] shrink-0 shadow-lg">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-sans font-bold text-base text-white">AI sales strategy update</h4>
                    <p className="text-xs text-white/60 mt-0.5">
                      Based on performance trends, ShopMate AI recommends a promotional bundle for high-converting items.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                  <button className="btn-light-primary px-5 py-2.5 text-xs font-bold cursor-pointer">
                    Apply insight
                  </button>
                  <button 
                    onClick={() => setDismissedBanner(true)}
                    className="btn-glass px-4 py-2.5 text-xs font-bold cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
