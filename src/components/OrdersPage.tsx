import React, { useState, useEffect } from 'react';
import { listOrders, updateOrderStatus, ApiOrder } from '../lib/api';
import DashboardHeader from './DashboardHeader';

export default function OrdersPage() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadOrders = () => {
    listOrders().then(setOrders).catch((err) => console.error('Failed to load orders:', err));
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleStatusChange = async (id: string, status: 'Pending' | 'Fulfilled' | 'Cancelled') => {
    setUpdatingId(id);
    try {
      const updated = await updateOrderStatus(id, status);
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
    } catch (err) {
      console.error('Failed to update order status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = orders.filter((o) =>
    o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.items.some((i) => i.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="w-full flex-grow flex flex-col text-left">
      <DashboardHeader
        title="Orders"
        searchPlaceholder="Search orders..."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
      />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-4 sm:py-6 md:py-8 lg:py-10 w-full flex-grow space-y-6 pb-16">
        <div className="bg-[#0c0c0e]/80 border border-white/[0.06] rounded-xl p-5 space-y-5">
          <div className="flex justify-between items-center pb-3 border-b border-white/[0.04]">
            <div>
              <h3 className="font-sans font-bold text-base text-white tracking-tight">Real Orders</h3>
              <p className="text-[11px] text-white/45 mt-0.5">
                {filteredOrders.length} order{filteredOrders.length === 1 ? '' : 's'} created from real conversations
              </p>
            </div>
          </div>

          <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-[#0c0c0e]/30 w-full">
            <div className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#121215] border-b border-white/[0.04] text-[9px] font-sans text-white/40 uppercase tracking-widest font-bold">
                    <th className="p-4">Customer</th>
                    <th className="p-4">Items</th>
                    <th className="p-4">Address</th>
                    <th className="p-4">Total</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Placed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03] font-sans text-xs">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-white/30 font-sans text-xs">
                        No orders yet. Orders appear here once a merchant confirms a customer's cart from the Inbox.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-white/[0.01] transition-colors">
                        <td className="p-4 font-sans font-bold text-white">{order.customerName}</td>
                        <td className="p-4 text-white/60">
                          {order.items.map((item) => `${item.name} x${item.quantity}`).join(', ')}
                        </td>
                        <td className="p-4 text-white/45 max-w-[220px] truncate" title={order.address}>{order.address}</td>
                        <td className="p-4 font-sans text-white font-bold">${order.total.toFixed(2)}</td>
                        <td className="p-4">
                          <select
                            value={order.status}
                            disabled={updatingId === order.id}
                            onChange={(e) => handleStatusChange(order.id, e.target.value as 'Pending' | 'Fulfilled' | 'Cancelled')}
                            className={`bg-transparent border rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer outline-none disabled:opacity-50 ${
                              order.status === 'Fulfilled'
                                ? 'text-emerald-400 border-emerald-500/20'
                                : order.status === 'Cancelled'
                                  ? 'text-red-400 border-red-500/20'
                                  : 'text-amber-500 border-amber-500/20'
                            }`}
                          >
                            <option className="bg-[#121215]" value="Pending">Pending</option>
                            <option className="bg-[#121215]" value="Fulfilled">Fulfilled</option>
                            <option className="bg-[#121215]" value="Cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td className="p-4 text-white/30 text-[10px]">
                          {new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
