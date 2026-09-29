import { AgentCatalogItem } from '../../server/agent';

// Fixture catalog for the evaluation harness — mirrors the mix of everyday and high-value
// items seen in real test conversations, with two items deliberately out of stock so
// stock-check and buy-intent cases can verify the agent never claims an out-of-stock item
// was added to the cart.
export const evalCatalog: AgentCatalogItem[] = [
  { name: 'Coca Cola 500ml', sku: 'COKE-500', price: 1.5, inventory: 50, status: 'Trained' },
  { name: 'Premium Cotton T-Shirt', sku: 'TSHIRT-01', price: 12.99, inventory: 20, status: 'Trained' },
  { name: 'Wireless Mouse', sku: 'MOUSE-01', price: 9.99, inventory: 0, status: 'Trained' },
  { name: 'MacBook M3', sku: 'SM-1001', price: 3999, inventory: 15, status: 'Trained' },
  { name: 'iPhone 17 Pro', sku: 'SM-1002', price: 2999, inventory: 8, status: 'Trained' },
  { name: 'Apple Mouse', sku: 'SM-1003', price: 100, inventory: 25, status: 'Trained' },
  { name: 'APEX GP Desk Lamp', sku: 'SM-1004', price: 120, inventory: 0, status: 'Trained' },
  { name: 'Bluetooth Speaker', sku: 'SPKR-01', price: 45, inventory: 12, status: 'Trained' },
];
