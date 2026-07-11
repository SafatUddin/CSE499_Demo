import React, { useState } from 'react';
import { motion } from 'motion/react';
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
import { 
  RECHART_DATA_30_DAYS, 
  RECHART_DATA_90_DAYS 
} from '../data/mockData';
import DashboardHeader from './DashboardHeader';

export default function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<'30' | '90'>('30');
  const chartData = timeRange === '30' ? RECHART_DATA_30_DAYS : RECHART_DATA_90_DAYS;

  return (
    <div className="w-full flex-grow flex flex-col text-left">
      {/* Shared Dashboard Header */}
      <DashboardHeader 
        title="Analytics Dashboard" 
        searchPlaceholder="Search commands..." 
      />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-4 sm:py-6 md:py-8 lg:py-10 w-full flex-grow space-y-6 pb-16">

      {/* KPI Metrics row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: AI Automation Rate */}
        <div className="bg-[#0c0c0e]/80 border border-white/[0.06] p-5 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="font-sans text-[10px] text-white/50 uppercase tracking-wider font-bold">AI Automation Rate</span>
            <Sparkles className="h-4 w-4 text-white/40" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h3 className="text-[32px] font-sans font-bold text-white tracking-tight leading-none">82%</h3>
            <span className="text-[11px] text-emerald-400 font-sans font-bold">+4.2%</span>
          </div>
        </div>

        {/* KPI 2: Avg Response Time */}
        <div className="bg-[#0c0c0e]/80 border border-white/[0.06] p-5 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="font-sans text-[10px] text-white/50 uppercase tracking-wider font-bold">Avg Response Time</span>
            <Clock className="h-4 w-4 text-white/40" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h3 className="text-[32px] font-sans font-bold text-white tracking-tight leading-none">14.5m</h3>
            <span className="text-[11px] text-amber-500 font-sans font-bold">-2.1m</span>
          </div>
        </div>

        {/* KPI 3: Order Uplift */}
        <div className="bg-[#0c0c0e]/80 border border-white/[0.06] p-5 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="font-sans text-[10px] text-white/50 uppercase tracking-wider font-bold">Order Uplift</span>
            <TrendingUp className="h-4 w-4 text-white/40" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h3 className="text-[32px] font-sans font-bold text-white tracking-tight leading-none">+28%</h3>
            <span className="text-[10px] text-white/40 font-sans font-bold uppercase tracking-wider">Peak Performance</span>
          </div>
        </div>

        {/* KPI 4: AI Messages Used */}
        <div className="bg-[#0c0c0e]/80 border border-white/[0.06] p-5 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="font-sans text-[10px] text-white/50 uppercase tracking-wider font-bold">AI Messages Used</span>
            <MessageSquare className="h-4 w-4 text-white/40" />
          </div>
          <div className="mt-3">
            <h3 className="text-[32px] font-sans font-bold text-white tracking-tight leading-none">
              4,230 <span className="text-sm text-white/30 font-medium">/ 5,000</span>
            </h3>
          </div>
        </div>
      </div>

      {/* Main analytics panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Recharts Area card (8 Columns) */}
        <div className="lg:col-span-8 bg-[#0c0c0e]/80 border border-white/[0.06] rounded-xl p-5 flex flex-col justify-between">
          <header className="flex justify-between items-center pb-4 mb-4">
            <div>
              <h3 className="font-sans font-bold text-base text-white tracking-tight">Conversations vs. Sales</h3>
              <p className="text-[11px] text-white/45 mt-0.5">
                Performance metrics across the last 30 operational days.
              </p>
            </div>

            {/* Range controls */}
            <div className="flex bg-[#121215] border border-white/[0.06] p-0.5 rounded-lg">
              <button
                onClick={() => setTimeRange('30')}
                className={`px-3 py-1 rounded-md font-sans text-[10px] uppercase font-bold tracking-wider cursor-pointer transition-colors ${
                  timeRange === '30' 
                    ? 'bg-white/[0.08] text-white' 
                    : 'text-white/40 hover:text-white'
                }`}
              >
                30 Days
              </button>
              <button
                onClick={() => setTimeRange('90')}
                className={`px-3 py-1 rounded-md font-sans text-[10px] uppercase font-bold tracking-wider cursor-pointer transition-colors ${
                  timeRange === '90' 
                    ? 'bg-white/[0.08] text-white' 
                    : 'text-white/40 hover:text-white'
                }`}
              >
                90 Days
              </button>
            </div>
          </header>

          {/* Area Chart visual container */}
          <div className="h-[300px] w-full pr-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 0, left: -25, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorConversations" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffffff" stopOpacity={0.06}/>
                    <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorConverted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#52525b" stopOpacity={0.04}/>
                    <stop offset="95%" stopColor="#52525b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="rgba(255,255,255,0.2)" 
                  fontSize={8} 
                  fontFamily="Inter" 
                  tickLine={false} 
                  dy={10}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.2)" 
                  fontSize={8} 
                  fontFamily="Inter" 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#121215', 
                    border: '1px solid rgba(255, 255, 255, 0.08)', 
                    borderRadius: '8px',
                    fontFamily: 'Inter',
                    fontSize: '11px'
                  }}
                  itemStyle={{ color: '#e5e5e5' }}
                  labelStyle={{ color: '#a1a1aa', fontSize: '9px', fontWeight: 'bold' }}
                />
                <Area 
                  name="Conversations"
                  type="monotone" 
                  dataKey="conversations" 
                  stroke="#ffffff" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorConversations)" 
                />
                <Area 
                  name="Converted Sales"
                  type="monotone" 
                  dataKey="convertedSales" 
                  stroke="#52525b" 
                  strokeWidth={1.5}
                  fillOpacity={1} 
                  fill="url(#colorConverted)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Simple Custom Legend */}
          <div className="flex gap-4 pt-4 mt-2 border-t border-white/[0.04] text-[10px] font-sans text-white/50">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              <span>Conversations</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
              <span>Converted Sales</span>
            </div>
          </div>
        </div>

        {/* Recent logs stream (4 Columns) */}
        <div className="lg:col-span-4 bg-[#0c0c0e]/80 border border-white/[0.06] rounded-xl p-5 flex flex-col h-[435px]">
          <header className="flex justify-between items-center pb-3 border-b border-white/[0.04] mb-4">
            <h3 className="font-sans font-bold text-base text-white tracking-tight">
              Recent Activity
            </h3>
            <button className="text-white/40 hover:text-white transition-colors cursor-pointer p-1">
              <MoreVertical className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-grow overflow-y-auto space-y-3.5 pr-1">
            {/* Card 1 */}
            <div className="bg-[#121215]/40 border border-white/[0.04] p-3 rounded-lg flex gap-3 text-left items-start hover:bg-white/[0.01] transition-all">
              <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/80 border border-white/10 shrink-0 mt-0.5">
                <CheckCircle className="h-3.5 w-3.5" />
              </div>
              <div className="flex-grow space-y-1">
                <div className="flex justify-between items-center text-[9px] font-sans font-bold">
                  <span className="text-white/40">#ORD-9021</span>
                  <span className="text-white/30 uppercase tracking-wider">JUST NOW</span>
                </div>
                <p className="text-xs text-white font-medium leading-tight">AI completed checkout for Alex J.</p>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="bg-[#161619] border border-white/[0.08] text-white/60 text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded font-sans uppercase">SILK BLAZER</span>
                  <span className="bg-[#161619] border border-white/[0.08] text-white/60 text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded font-sans uppercase">$240.00</span>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-[#121215]/40 border border-white/[0.04] p-3 rounded-lg flex gap-3 text-left items-start hover:bg-white/[0.01] transition-all">
              <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/80 border border-white/10 shrink-0 mt-0.5">
                <MessageSquare className="h-3.5 w-3.5" />
              </div>
              <div className="flex-grow space-y-1">
                <div className="flex justify-between items-center text-[9px] font-sans font-bold">
                  <span className="text-white/40">New Inquiry</span>
                  <span className="text-white/30 uppercase tracking-wider">14M AGO</span>
                </div>
                <p className="text-xs text-white/70 leading-tight">"Does the summer collection..."</p>
                <div className="flex items-center gap-1 pt-1 text-[8px] font-bold text-white/40 tracking-wider">
                  <span>✨ AI DRAFTING RESPONSE...</span>
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-[#121215]/40 border border-white/[0.04] p-3 rounded-lg flex gap-3 text-left items-start hover:bg-white/[0.01] transition-all">
              <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/80 border border-white/10 shrink-0 mt-0.5">
                <CheckCircle className="h-3.5 w-3.5" />
              </div>
              <div className="flex-grow space-y-1">
                <div className="flex justify-between items-center text-[9px] font-sans font-bold">
                  <span className="text-white/40">#ORD-9018</span>
                  <span className="text-white/30 uppercase tracking-wider">2H AGO</span>
                </div>
                <p className="text-xs text-white font-medium leading-tight">AI handled sizing return for Mara K.</p>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="bg-[#161619] border border-white/[0.08] text-white/60 text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded font-sans uppercase">EXCHANGE</span>
                  <span className="bg-[#161619] border border-white/[0.08] text-white/60 text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded font-sans uppercase">RESOLVED</span>
                </div>
              </div>
            </div>

            {/* Card 4 */}
            <div className="bg-[#121215]/40 border border-white/[0.04] p-3 rounded-lg flex gap-3 text-left items-start hover:bg-white/[0.01] transition-all">
              <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/80 border border-white/10 shrink-0 mt-0.5">
                <ClipboardList className="h-3.5 w-3.5" />
              </div>
              <div className="flex-grow space-y-1">
                <div className="flex justify-between items-center text-[9px] font-sans font-bold">
                  <span className="text-white/40">Inventory Alert</span>
                  <span className="text-white/30 uppercase tracking-wider">5H AGO</span>
                </div>
                <p className="text-xs text-white/70 leading-tight">Product <span className="underline cursor-pointer text-white">Tech Tote v2</span> is running low.</p>
              </div>
            </div>
          </div>

          <button className="w-full mt-3 bg-transparent hover:bg-white/5 border border-white/[0.06] text-white text-[10px] font-bold py-2 rounded-lg font-sans uppercase tracking-wider transition-all cursor-pointer">
            View All History
          </button>
        </div>
      </div>

      {/* Strategy Banner at Bottom */}
      <div className="bg-[#0c0c0e]/85 border border-white/[0.07] p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-left">
          <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-white shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-sans font-bold text-sm text-white">AI Sales Strategy Update</h4>
            <p className="text-xs text-white/50 mt-0.5">
              Based on last week's data, ShopMate suggests a flash bundle for "Organic Tees".
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
          <button className="flex-grow md:flex-grow-0 bg-[#e2e2e2] hover:bg-white text-black font-sans font-bold text-[10px] uppercase tracking-wider px-4 py-2.5 rounded-lg transition-all cursor-pointer">
            Apply Insight
          </button>
          <button className="flex-grow md:flex-grow-0 bg-transparent hover:bg-white/5 text-white/80 border border-white/[0.06] font-sans font-bold text-[10px] uppercase tracking-wider px-4 py-2.5 rounded-lg transition-all cursor-pointer">
            Dismiss
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
