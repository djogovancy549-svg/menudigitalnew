import React, { useState, useEffect } from 'react';
import { QrCode, ShieldCheck, CreditCard, Clock, CheckCircle, Copy } from 'lucide-react';

interface QrisModalProps {
  amount: number;
  orderId: string;
  onPaymentSuccess: () => void;
  onClose: () => void;
}

export const QrisModal: React.FC<QrisModalProps> = ({ amount, orderId, onPaymentSuccess, onClose }) => {
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes countdown
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSimulatePayment = () => {
    setIsPaying(true);
    setTimeout(() => {
      onPaymentSuccess();
    }, 1500);
  };

  const formatRupiah = (num: number) => {
    return 'Rp ' + num.toLocaleString('id-ID');
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-start justify-center p-4 pt-10 pb-20 overflow-y-auto">
      <div className="bg-white text-neutral-900 rounded-2xl max-w-sm w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-neutral-200 my-auto animate-in fade-in scale-in duration-200 scrollbar-thin scrollbar-thumb-neutral-300">
        
        {/* QRIS Header branding */}
        <div className="bg-amber-50 px-6 py-4 flex flex-col items-center border-b border-neutral-100">
          <div className="flex items-center gap-1.5 mb-1">
            {/* Custom stylized QRIS logo text with colors */}
            <span className="font-extrabold text-2xl tracking-tighter text-blue-900">QR</span>
            <span className="font-extrabold text-2xl tracking-tighter text-teal-500">IS</span>
            <span className="text-[9px] font-bold bg-rose-500 text-white px-1 py-0.5 rounded ml-1 tracking-wider">GPN</span>
          </div>
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono">Barcode Pembayaran Dinamis</p>
        </div>

        <div className="p-6 flex flex-col items-center">
          {/* Amount info */}
          <div className="text-center mb-4 flex flex-col items-center">
            <span className="text-xs text-neutral-500 uppercase font-medium tracking-wider">Total Tagihan</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <h2 className="text-2xl font-black text-neutral-900">{formatRupiah(amount)}</h2>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(amount.toString());
                  alert('Nominal Tagihan disalin!');
                }}
                className="p-1 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 rounded transition-colors"
                title="Salin Nominal Tagihan"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="text-xs text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1 rounded-full flex items-center gap-1.5 mt-2.5 font-medium">
              <span>ID Pesanan: {orderId}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(orderId);
                  alert('ID Pesanan disalin!');
                }}
                className="hover:bg-amber-100 p-0.5 text-amber-700 hover:text-amber-900 rounded transition-colors"
                title="Salin ID Pesanan"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* QR Code Graphic Container */}
          <div className="bg-white p-4 rounded-xl border-2 border-neutral-200 shadow-sm relative group">
            
            {/* The actual simulated QR code grid */}
            <div 
              className="w-52 h-52 bg-white relative p-1"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(21, minmax(0, 1fr))' }}
            >
              {/* Corner anchors of standard QR Code */}
              <div className="absolute top-0 left-0 w-16 h-16 border-[6px] border-neutral-900 bg-white p-1">
                <div className="w-full h-full bg-neutral-900" />
              </div>
              <div className="absolute top-0 right-0 w-16 h-16 border-[6px] border-neutral-900 bg-white p-1">
                <div className="w-full h-full bg-neutral-900" />
              </div>
              <div className="absolute bottom-0 left-0 w-16 h-16 border-[6px] border-neutral-900 bg-white p-1">
                <div className="w-full h-full bg-neutral-900" />
              </div>

              {/* Smaller alignment pattern */}
              <div className="absolute bottom-4 right-4 w-8 h-8 border-[4px] border-neutral-900 bg-white p-0.5">
                <div className="w-full h-full bg-neutral-900" />
              </div>

              {/* Central brand mark badge */}
              <div className="absolute inset-0 m-auto w-10 h-10 bg-white border border-neutral-200 rounded-lg flex items-center justify-center shadow">
                <span className="font-extrabold text-[10px] text-blue-900 tracking-tight">QRIS</span>
              </div>

              {/* Simulated QR Pixels */}
              {Array.from({ length: 441 }).map((_, i) => {
                const isCenter = Math.abs((i % 21) - 10) <= 2 && Math.abs(Math.floor(i / 21) - 10) <= 2;
                const isTopLeft = (i % 21) < 8 && Math.floor(i / 21) < 8;
                const isTopRight = (i % 21) > 12 && Math.floor(i / 21) < 8;
                const isBottomLeft = (i % 21) < 8 && Math.floor(i / 21) > 12;
                
                const isProtected = isCenter || isTopLeft || isTopRight || isBottomLeft;
                const isFilled = isProtected ? false : (Math.sin(i * 1.7) * Math.cos(i * 0.9) > -0.2);

                return (
                  <div 
                    key={i} 
                    className="w-full h-full transition-colors duration-300"
                    style={{ 
                      backgroundColor: isFilled ? '#171717' : 'transparent',
                    }} 
                  />
                );
              })}
            </div>

            {/* Overlays */}
            {isPaying && (
              <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center rounded-xl p-4 animate-in fade-in duration-300">
                <div className="w-12 h-12 rounded-full border-4 border-amber-500 border-t-transparent animate-spin mb-3" />
                <p className="text-sm font-semibold text-neutral-800">Memproses Transaksi...</p>
                <p className="text-[11px] text-neutral-500 mt-1">Menghubungi Server Bank</p>
              </div>
            )}
          </div>

          {/* Countdown & Security */}
          <div className="w-full mt-4 flex justify-between items-center px-2 text-xs">
            <div className="flex items-center gap-1 text-neutral-500">
              <Clock className="w-3.5 h-3.5" />
              <span>Sisa Waktu:</span>
              <span className="font-mono font-bold text-red-500">{formatTime(timeLeft)}</span>
            </div>
            <div className="flex items-center gap-1 text-emerald-600 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>GPN Terproteksi</span>
            </div>
          </div>

          <div className="border-t border-neutral-100 w-full my-5" />

          {/* SIMULATION CONTROLLER */}
          <button
            onClick={handleSimulatePayment}
            disabled={isPaying || timeLeft <= 0}
            className={`w-full py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-200 shadow-md active:scale-95
              ${isPaying 
                ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            id="btn-simulate-qris-pay"
          >
            <CheckCircle className="w-5 h-5" />
            <span>Simulasi Bayar Sukses</span>
          </button>

          <button
            onClick={onClose}
            disabled={isPaying}
            className="w-full mt-2 py-2 px-4 rounded-xl text-xs font-semibold text-neutral-500 hover:text-neutral-800 transition-colors"
            id="btn-cancel-qris-pay"
          >
            Batal & Pilih Metode Lain
          </button>
        </div>

        {/* Dynamic Instructional Banner */}
        <div className="bg-neutral-50 px-6 py-4 text-left border-t border-neutral-100">
          <h4 className="text-xs font-bold text-neutral-800 mb-1">Cara Pembayaran:</h4>
          <ol className="text-[11px] text-neutral-600 space-y-1 list-decimal list-inside leading-relaxed">
            <li>Buka aplikasi Mobile Banking atau Dompet Digital Anda (GoPay, OVO, Dana, ShopeePay, LinkAja, dll).</li>
            <li>Pilih opsi <strong className="text-neutral-800">Scan / Pindai QR</strong>.</li>
            <li>Arahkan kamera ke layar ini dan lakukan pembayaran.</li>
            <li>Pesanan Anda akan langsung diproses dapur begitu pembayaran kami terima.</li>
          </ol>
        </div>

      </div>
    </div>
  );
};
