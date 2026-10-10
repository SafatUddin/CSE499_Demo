import React, { useEffect, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Bot, Clock3, MessageSquare, Users, Zap } from 'lucide-react';
import { fetchAnalytics, ApiAnalytics } from '../lib/api';
import DashboardHeader from './DashboardHeader';

const COLORS = { blue: '#4d8bff', cyan: '#63d8ff', amber: '#ffcf6b', green: '#7ff0b0', red: '#ff9d92', muted: 'rgba(255,255,255,0.42)' };
const chartTooltip = { backgroundColor: '#0d0f15', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '10px', color: '#fff', fontSize: '11px' };

type IconType = typeof Activity;
function MetricCard({ label, value, detail, icon: Icon, accent = COLORS.blue }: { label: string; value: string | number; detail?: string; icon?: IconType; accent?: string }) {
  return <div className="zone-b-grey3 p-4 rounded-xl border border-white/[0.08] min-h-[92px]"><div className="flex items-center justify-between gap-2"><span className="text-[10px] uppercase tracking-[0.12em] font-bold text-white/45">{label}</span>{Icon && <Icon className="h-3.5 w-3.5" style={{ color: accent }} />}</div><div className="mt-3 flex items-end gap-2"><strong className="text-[25px] leading-none text-white font-bold">{value}</strong>{detail && <span className="text-[10px] text-white/40 mb-0.5">{detail}</span>}</div></div>;
}

function Panel({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return <section className={`zone-b-grey2 min-w-0 rounded-xl border border-white/[0.08] p-4 ${className}`}><header className="border-b border-white/[0.07] pb-3"><h3 className="text-[13px] font-bold text-white">{title}</h3>{subtitle && <p className="mt-1 text-[10px] text-white/40">{subtitle}</p>}</header>{children}</section>;
}

function EmptyPanel({ text = 'No data in this window.' }: { text?: string }) {
  return <div className="h-[118px] flex items-center justify-center text-[11px] text-white/35">{text}</div>;
}

export default function AnalyticsDashboard() {
  const [range, setRange] = useState<'7' | '14' | '30'>('30');
  const [view, setView] = useState<'overview' | 'pipeline'>('overview');
  const [data, setData] = useState<ApiAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetchAnalytics(Number(range) as 7 | 14 | 30).then(setData).catch(() => setError(true)).finally(() => setLoading(false));
  }, [range]);

  const series = data?.series ?? [];
  const split = data ? [
    { name: 'AI', value: data.currentSplit.aiManaged, color: COLORS.blue },
    { name: 'Human', value: data.currentSplit.humanActive, color: COLORS.amber },
    { name: 'Resolved', value: data.currentSplit.closed, color: COLORS.green },
  ] : [];
  const firstReplyData = series.map((item) => ({ date: item.date, replies: item.aiReplies + item.humanReplies }));
  const sourceRows = data?.bySource ?? [];

  return <div className="w-full flex-grow flex flex-col text-left">
    <DashboardHeader searchPlaceholder="Search analytics…" />
    <main className="w-full flex-grow space-y-4 p-5 md:p-7">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.16em] text-white/40 font-bold">Analytics</p><h1 className="mt-1 text-[23px] font-bold text-white">Analytics</h1><p className="mt-1 text-[11px] text-white/45">Messages handled, how much the AI finished, and where the first reply slows down.</p></div><div className="flex bg-black/40 border border-white/10 p-1 rounded-lg self-start md:self-auto">{(['7', '14', '30'] as const).map((item) => <button key={item} onClick={() => setRange(item)} className={`px-3 py-1.5 rounded-md text-[10px] font-bold cursor-pointer ${range === item ? 'bg-white/15 border border-white/20 text-white' : 'text-white/40 hover:text-white'}`}>{item}d</button>)}</div></header>
      <nav className="flex gap-1 border-b border-white/[0.08]">{(['overview', 'pipeline'] as const).map((item) => <button key={item} onClick={() => setView(item)} className={`px-3 py-2 text-[10px] font-bold capitalize border-b-2 cursor-pointer ${view === item ? 'text-white border-[#4d8bff]' : 'text-white/40 border-transparent hover:text-white'}`}>{item}</button>)}</nav>

      {error ? <div className="h-64 flex items-center justify-center text-sm text-white/45">Unable to load analytics data.</div> : view === 'pipeline' ? <div className="zone-b-grey2 rounded-xl border border-white/[0.08] p-8 text-center text-sm text-white/45">Pipeline data will appear when lead stages and follow-up events are configured.</div> : <>
        <section><div className="flex items-center justify-between mb-2"><h2 className="text-[11px] uppercase tracking-[0.12em] font-bold text-white/60">Conversations</h2><span className="text-[10px] text-white/35">Last {range} days</span></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-2"><MetricCard label="Messages handled" value={loading ? '—' : data?.kpis.customerMessages ?? 0} detail="incoming" icon={MessageSquare} /><MetricCard label="AI replies" value={loading ? '—' : data?.kpis.aiReplies ?? 0} detail="delivered" icon={Bot} accent={COLORS.cyan} /><MetricCard label="Human replies" value={loading ? '—' : data?.kpis.humanReplies ?? 0} detail="delivered" icon={Users} accent={COLORS.amber} /><MetricCard label="People reached" value={loading ? '—' : data?.kpis.peopleReached ?? 0} detail="unique chats" icon={Users} accent={COLORS.green} /></div></section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3"><Panel title="Messages per day" subtitle="Customer messages, AI replies, and human replies" className="lg:col-span-8"><div className="h-[190px] pt-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={series} margin={{ top: 4, right: 4, left: -25, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} /><XAxis dataKey="date" stroke={COLORS.muted} fontSize={9} tickLine={false} /><YAxis stroke={COLORS.muted} fontSize={9} tickLine={false} axisLine={false} allowDecimals={false} /><Tooltip contentStyle={chartTooltip} /><Legend wrapperStyle={{ fontSize: '10px', color: COLORS.muted }} /><Bar name="Customer" dataKey="customerMessages" fill={COLORS.amber} radius={[2, 2, 0, 0]} /><Bar name="AI" dataKey="aiReplies" fill={COLORS.blue} radius={[2, 2, 0, 0]} /><Bar name="Human" dataKey="humanReplies" fill={COLORS.green} radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer></div></Panel><Panel title="Handled by AI alone" subtitle="Current conversation split" className="lg:col-span-4"><div className="h-[190px] pt-1"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={split} dataKey="value" nameKey="name" innerRadius={48} outerRadius={68} paddingAngle={3} stroke="none">{split.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip contentStyle={chartTooltip} /><Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '10px', color: COLORS.muted }} /></PieChart></ResponsiveContainer></div></Panel></div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3"><Panel title="WhatsApp messages" subtitle="Message flow over the selected window" className="lg:col-span-6"><div className="h-[145px] pt-4"><ResponsiveContainer width="100%" height="100%"><AreaChart data={series} margin={{ top: 5, right: 4, left: -25, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} /><XAxis dataKey="date" stroke={COLORS.muted} fontSize={9} tickLine={false} /><YAxis stroke={COLORS.muted} fontSize={9} tickLine={false} axisLine={false} allowDecimals={false} /><Tooltip contentStyle={chartTooltip} /><Area type="monotone" dataKey="customerMessages" name="Messages" stroke={COLORS.cyan} fill="rgba(99,216,255,0.12)" /></AreaChart></ResponsiveContainer></div></Panel><Panel title="How fast the first reply comes" subtitle="Delivered replies after the first customer message" className="lg:col-span-6"><div className="h-[145px] pt-4"><ResponsiveContainer width="100%" height="100%"><AreaChart data={firstReplyData} margin={{ top: 5, right: 4, left: -25, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} /><XAxis dataKey="date" stroke={COLORS.muted} fontSize={9} tickLine={false} /><YAxis stroke={COLORS.muted} fontSize={9} tickLine={false} axisLine={false} allowDecimals={false} /><Tooltip contentStyle={chartTooltip} /><Area type="monotone" dataKey="replies" name="Replies" stroke={COLORS.green} fill="rgba(127,240,176,0.12)" /></AreaChart></ResponsiveContainer></div></Panel></div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3"><Panel title="What are people asking about?" subtitle="Top conversation source data"><EmptyPanel text={sourceRows.length ? `${sourceRows.reduce((sum, item) => sum + item.conversations, 0)} conversations categorized` : 'No data in this window.'} /></Panel><Panel title="Busiest pages" subtitle="Conversation volume by page"><EmptyPanel text="No data in this window." /></Panel></div>
        <Panel title="Follow-ups" subtitle="Follow-up activity · selected window"><div className="h-[48px] flex items-center text-[11px] text-white/35">No reminders planned or sent. Configure a channel-safe follow-up rule before sending proactive messages.</div></Panel>

        <section><div className="flex items-center justify-between mb-2"><h2 className="text-[11px] uppercase tracking-[0.12em] font-bold text-white/60">Handoffs</h2><span className="text-[10px] text-white/35">When a person is needed</span></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-2"><MetricCard label="Requests to humans" value={data?.handoffs.requestsToHumans ?? 0} icon={Users} accent={COLORS.amber} /><MetricCard label="Auto-returned" value={data?.handoffs.autoReturned ?? 0} icon={Bot} accent={COLORS.blue} /><MetricCard label="Total events" value={data?.handoffs.totalEvents ?? 0} icon={Activity} /><MetricCard label="Avg events / day" value={data?.handoffs.averageEventsPerDay ?? 0} icon={Zap} accent={COLORS.cyan} /></div></section>
        <section><div className="flex items-center justify-between mb-2"><h2 className="text-[11px] uppercase tracking-[0.12em] font-bold text-white/60">Response & SLA</h2><span className="text-[10px] text-white/35">First-response target: 15m</span></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-2"><MetricCard label="Avg first response" value={data?.kpis.averageResponseTimeSeconds != null ? `${data.kpis.averageResponseTimeSeconds}s` : '—'} icon={Clock3} /><MetricCard label="SLA breach rate" value={`${data?.kpis.slaBreachRate ?? 0}%`} icon={Activity} accent={COLORS.red} /><MetricCard label="Avg handling time" value={data?.kpis.averageHandlingTimeSeconds != null ? `${data.kpis.averageHandlingTimeSeconds}s` : '—'} icon={Clock3} /><MetricCard label="Longest wait now" value={data?.kpis.longestWaitingSeconds != null ? `${Math.floor(data.kpis.longestWaitingSeconds / 60)}m` : '—'} detail={`${data?.kpis.waitingConversations ?? 0} waiting`} icon={Clock3} accent={COLORS.amber} /></div></section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3"><Panel title="Activity over time" subtitle="Incoming messages and delivered replies" className="lg:col-span-8"><div className="h-[175px] pt-4"><ResponsiveContainer width="100%" height="100%"><AreaChart data={series} margin={{ top: 4, right: 4, left: -25, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} /><XAxis dataKey="date" stroke={COLORS.muted} fontSize={9} tickLine={false} /><YAxis stroke={COLORS.muted} fontSize={9} tickLine={false} axisLine={false} allowDecimals={false} /><Tooltip contentStyle={chartTooltip} /><Area type="monotone" dataKey="customerMessages" name="Customer" stroke={COLORS.amber} fill="rgba(255,207,107,0.1)" /><Area type="monotone" dataKey="aiReplies" name="Auto-replies" stroke={COLORS.blue} fill="rgba(77,139,255,0.1)" /></AreaChart></ResponsiveContainer></div></Panel><Panel title="Current split" subtitle="All conversations" className="lg:col-span-4"><div className="h-[175px] pt-1"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={split} dataKey="value" nameKey="name" innerRadius={42} outerRadius={62} paddingAngle={3} stroke="none">{split.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip contentStyle={chartTooltip} /><Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '10px', color: COLORS.muted }} /></PieChart></ResponsiveContainer></div></Panel></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3"><Panel title="Busiest pages" subtitle="No handoffs in this window"><EmptyPanel /></Panel><Panel title="By source" subtitle="Connected channels"><div className="min-h-[118px] py-3">{sourceRows.length ? sourceRows.map((item) => <div key={item.source} className="flex justify-between py-2 border-b border-white/[0.07] text-[11px] text-white/55"><span className="capitalize">{item.source}</span><strong className="text-white">{item.conversations}</strong></div>) : <EmptyPanel />}</div></Panel></div>
  </>}
    </main>
  </div>;
}
