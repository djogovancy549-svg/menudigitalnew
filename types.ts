/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  category: 'makanan' | 'minuman' | 'cemilan' | 'paket';
  image: string;
  tags: string[]; // e.g. ["Pedas", "Favorit", "Rekomendasi", "Best Seller"]
  isAvailable?: boolean;
  options?: {
    name: string;
    choices: string[];
    required: boolean;
  }[];
}

export interface CartItem {
  id: string; // Unique combination of menuItem.id + selectedOptions
  menuItem: MenuItem;
  quantity: number;
  selectedOptions: { [key: string]: string };
  notes: string;
}

export interface Order {
  id: string; // e.g. "WRG-001"
  timestamp: number;
  items: CartItem[];
  tableNumber: string; // "Meja 1" to "Meja 12" or "Bawa Pulang (Takeaway)"
  customerName: string;
  subtotal: number;
  tax: number; // 10% PB1
  serviceCharge: number; // e.g., Rp 2.000 for service
  total: number;
  paymentMethod: 'CASH' | 'QRIS' | 'TRANSFER';
  paymentStatus: 'Belum Bayar' | 'Lunas';
  status: 'Diterima' | 'Dimasak' | 'Selesai' | 'Dibatalkan';
}

export interface TopupRequest {
  id: string;
  amount: number;
  senderName: string;
  bankSender: string;
  date: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  buktiTransfer?: string; // Base64 data URI of the proof of transfer
}

