import React, { useRef } from 'react';
import { Order } from '../types';
import { Printer, Download, CheckCircle, Clock, Copy } from 'lucide-react';

interface OrderReceiptProps {
  order: Order;
  onClose: () => void;
}

export const OrderReceipt: React.FC<OrderReceiptProps> = ({ order, onClose }) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  const formatRupiah = (num: number) => {
    return 'Rp ' + num.toLocaleString('id-ID');
  };

  const handlePrint = () => {
    const printContent = receiptRef.current?.innerHTML;
    if (printContent) {
      const originalContent = document.body.innerHTML;
      const printWindow = window.open('', '', 'height=600,width=400');
      if (printWindow) {
        printWindow.document.write('<html><head><title>Struk Belanja - Warung Rasa Nusantara</title>');
        printWindow.document.write('<style>');
        printWindow.document.write(`
          body { font-family: monospace; padding: 20px; color: #333; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #333; margin: 10px 0; }
          .flex { display: flex; justify-content: space-between; }
          .item-row { margin: 5px 0; }
          .footer { text-align: center; margin-top: 20px; font-size: 11px; }
        `);
        printWindow.document.write('</style></head><body>');
        printWindow.document.write(printContent);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'Diterima': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Dimasak': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Selesai': return 'bg-green-100 text-green-800 border-green-200';
      case 'Dibatalkan': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-neutral-100 text-neutral-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-neutral-900 rounded-2xl max-w-md w-full border border-neutral-800 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in duration-200">
        
        {/* Header Action bar */}
        <div className="px-6 py-4 border-b border-neutral-800 flex justify-between items-center bg-neutral-950">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            <span className="text-white font-medium text-sm">Pesanan Sukses!</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const itemsText = order.items.map(item => `- ${item.menuItem.name} (x${item.quantity}): ${formatRupiah(item.menuItem.price * item.quantity)}`).join('\n');
                const receiptText = `=== STRUK PESANAN ===\nNo. Invoice: ${order.id}\nTanggal: ${new Date(order.timestamp).toLocaleString('id-ID')}\nPelanggan: ${order.customerName}\nMeja: ${order.tableNumber}\nPembayaran: ${order.paymentMethod} (${order.paymentStatus})\n-------------------\nMenu:\n${itemsText}\n-------------------\nSubtotal: ${formatRupiah(order.subtotal)}\nPajak (10%): ${formatRupiah(order.tax)}\nLayanan: ${formatRupiah(order.serviceCharge)}\n===================\nTOTAL AKHIR: ${formatRupiah(order.total)}\n===================`;
                navigator.clipboard.writeText(receiptText);
                alert('Rincian struk belanja berhasil disalin!');
              }}
              className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition-colors"
              title="Salin Rincian Struk"
              id="btn-copy-receipt"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={handlePrint}
              className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition-colors"
              title="Cetak Struk"
              id="btn-print-receipt"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="text-xs px-3 py-1 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold rounded transition-colors"
              id="btn-close-receipt"
            >
              Tutup
            </button>
          </div>
        </div>

        {/* Outer Receipt Paper Container with nice background spacing */}
        <div className="p-6 bg-neutral-900 flex justify-center">
          
          {/* Thermal Paper Styling */}
          <div 
            ref={receiptRef}
            className="w-full bg-amber-50 text-neutral-900 font-mono p-6 rounded-lg shadow-inner relative border-t-8 border-amber-300"
            style={{ backgroundImage: 'radial-gradient(circle, #fcfcfc 10%, transparent 11%)', backgroundSize: '10px 10px' }}
          >
            {/* Tiny thermal jagged edges illusion at the top */}
            <div className="absolute top-0 inset-x-0 h-1 bg-amber-200/50 flex overflow-hidden">
              {Array.from({ length: 40 }).map((_, i) => (
                <div key={i} className="w-2.5 h-1 bg-neutral-900 transform rotate-45 -translate-y-0.5 shrink-0" />
              ))}
            </div>

            {/* Receipt Header */}
            <div className="text-center mt-2">
              <h1 className="text-lg font-bold tracking-tight uppercase">WARUNG NUSANTARA</h1>
              <p className="text-[11px] leading-tight text-neutral-600">Jl. Malioboro No. 45, Yogyakarta</p>
              <p className="text-[11px] leading-tight text-neutral-600">Telp: 0812-3456-7890</p>
              <div className="border-t border-dashed border-neutral-400 my-3"></div>
            </div>

            {/* Metadata */}
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>No. Invoice:</span>
                <span className="font-bold">{order.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Tanggal:</span>
                <span>{new Date(order.timestamp).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span>Pelanggan:</span>
                <span className="font-bold uppercase">{order.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span>Lokasi:</span>
                <span className="font-bold text-amber-950 bg-amber-200 px-1 rounded">{order.tableNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Pembayaran:</span>
                <span className="font-bold">{order.paymentMethod} ({order.paymentStatus})</span>
              </div>
            </div>

            <div className="border-t border-dashed border-neutral-400 my-3"></div>

            {/* Items Header */}
            <div className="text-xs font-bold flex justify-between pb-1 border-b border-neutral-300">
              <span className="w-1/2">Menu</span>
              <span className="w-1/6 text-center">Qty</span>
              <span className="w-1/3 text-right">Harga</span>
            </div>

            {/* Items List */}
            <div className="text-xs py-2 divide-y divide-dashed divide-neutral-200">
              {order.items.map((item, idx) => (
                <div key={idx} className="py-2">
                  <div className="flex justify-between font-medium text-neutral-900">
                    <span className="w-2/3 leading-tight font-sans text-[13px]">{item.menuItem.name}</span>
                    <span className="w-1/12 text-center text-[13px]">{item.quantity}x</span>
                    <span className="w-1/4 text-right text-[13px]">
                      {formatRupiah(item.menuItem.price * item.quantity)}
                    </span>
                  </div>
                  
                  {/* Selected Options & Notes */}
                  {Object.entries(item.selectedOptions).length > 0 && (
                    <div className="text-[10px] text-neutral-500 pl-2 mt-0.5 leading-snug">
                      {Object.entries(item.selectedOptions).map(([key, val]) => (
                        <div key={key}>- {key}: {val}</div>
                      ))}
                    </div>
                  )}
                  {item.notes && (
                    <div className="text-[10px] text-amber-800 italic pl-2 mt-0.5">
                      Ket: &ldquo;{item.notes}&rdquo;
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-neutral-400 my-3"></div>

            {/* Totals Section */}
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatRupiah(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-neutral-600">
                <span>PB1 / Pajak (10%):</span>
                <span>{formatRupiah(order.tax)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-neutral-600">
                <span>Biaya Layanan Aplikasi:</span>
                <span>{formatRupiah(order.serviceCharge)}</span>
              </div>
              <div className="border-t border-dashed border-neutral-300 my-1.5"></div>
              <div className="flex justify-between text-sm font-bold pt-1 text-neutral-950">
                <span>TOTAL AKHIR:</span>
                <span>{formatRupiah(order.total)}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-neutral-400 my-3"></div>

            {/* Thank you and barcode mock */}
            <div className="text-center space-y-3 mt-2">
              <div className="text-[11px] leading-relaxed text-neutral-600">
                <p className="font-bold text-neutral-800">Terima Kasih Banyak atas Kunjungan Anda!</p>
                <p>Silakan kembali berkunjung, masukan & saran sangat berarti bagi kami.</p>
              </div>
              
              {/* Fake barcode */}
              <div className="flex flex-col items-center pt-2">
                <div className="h-7 w-48 bg-neutral-900 flex items-end justify-around px-2 py-0.5 rounded" style={{ letterSpacing: '2px' }}>
                  {Array.from({ length: 28 }).map((_, i) => (
                    <div 
                      key={i} 
                      className="h-full bg-amber-50" 
                      style={{ 
                        width: `${(i % 3 === 0 ? 3 : i % 2 === 0 ? 1.5 : 2.5)}px`,
                        opacity: i % 7 === 0 ? 0.1 : 1
                      }} 
                    />
                  ))}
                </div>
                <span className="text-[9px] text-neutral-500 mt-1 uppercase tracking-widest">*{order.id}*</span>
              </div>
            </div>
            
            {/* Bottom tear aesthetic */}
            <div className="absolute bottom-0 inset-x-0 h-1 bg-amber-200/50 flex overflow-hidden">
              {Array.from({ length: 40 }).map((_, i) => (
                <div key={i} className="w-2.5 h-1 bg-neutral-900 transform rotate-45 translate-y-0.5 shrink-0" />
              ))}
            </div>

          </div>
        </div>

        {/* Preparation status details on the bottom */}
        <div className="px-6 py-4 bg-neutral-950 border-t border-neutral-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400">Status Pesanan:</span>
            <div className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getStatusColor(order.status)}`}>
              {order.status}
            </div>
          </div>
          {order.status !== 'Selesai' && order.status !== 'Dibatalkan' && (
            <div className="flex items-start gap-2 bg-neutral-900 p-2.5 rounded-lg border border-neutral-800">
              <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-neutral-400 leading-normal">
                Pesanan Anda telah diteruskan ke dapur utama. Silakan tunjukkan struk ini atau sebutkan nama <strong className="text-white">({order.customerName})</strong> kepada kasir jika ingin melakukan pembayaran langsung.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
