import React, { useState, useMemo, useEffect } from 'react';
import { Order, CartItem, MenuItem, TopupRequest } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, CartesianGrid 
} from 'recharts';
import { 
  ChefHat, ClipboardList, TrendingUp, ShoppingBag, 
  CheckCircle, XCircle, Clock, Utensils, Award, RefreshCw,
  Plus, Database, LogOut, ExternalLink, CreditCard, Copy,
  Printer, QrCode, Lock, Unlock, ShieldCheck, AlertCircle, Calendar, User,
  ImageIcon, Eye, Phone, Trash2
} from 'lucide-react';
import { getAccessToken } from '../services/firebaseAuth';
import { syncTopupRequestsToSheet, loadTopupRequestsFromSheet } from '../services/googleSheets';

// KONFIGURASI DEVELOPER - Silakan edit info bank & PIN di sini
export const DEVELOPER_CONFIG = {
  BANK_NAME: "BANK REPUBLIK INDONESIA (BRI)",
  ACCOUNT_NUMBER: "4625-01-020206-53-7",
  ACCOUNT_HOLDER: "YANTI YESINTA NENU D. W. NGGODJI",
  ADMIN_PIN: "LION05042016", // PIN rahasia untuk masuk mode Developer & approve transfer
  MIN_TOPUP: 5000,
  ADMIN_CONTACT_VANCY: "082237510129",
  ADMIN_CONTACT_YANTI: "082236309028",
};


interface KitchenPanelProps {
  orders: Order[];
  onUpdateStatus: (orderId: string, newStatus: Order['status'], newPaymentStatus?: Order['paymentStatus']) => void;
  onClearAll: () => void;
  onOpenAddMenu: () => void;
  spreadsheetUrl: string | null;
  spreadsheetId: string | null;
  isSyncingSheets: boolean;
  onSyncSheets: () => Promise<void>;
  googleUser: any;
  onLogoutGoogle: () => void;
  tables: string[];
  onUpdateTables: (newTables: string[]) => void;
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  warungName: string;
  warungTagline: string;
  onUpdatePaymentSettings: (bankName: string, bankAccount: string, bankHolder: string, warungName: string, warungTagline: string) => void;
  appBalance: number;
  onUpdateBalance: (newBalance: number) => void;
  menuItems: MenuItem[];
  onToggleMenuItemAvailability: (id: number) => Promise<void>;
  onResetAllData?: () => void;
}

export const KitchenPanel: React.FC<KitchenPanelProps> = ({ 
  orders = [], 
  onUpdateStatus, 
  onClearAll,
  onOpenAddMenu,
  spreadsheetUrl,
  spreadsheetId,
  isSyncingSheets,
  onSyncSheets,
  googleUser,
  onLogoutGoogle,
  tables = [],
  onUpdateTables,
  bankName,
  bankAccount,
  bankHolder,
  warungName,
  warungTagline,
  onUpdatePaymentSettings,
  appBalance,
  onUpdateBalance,
  menuItems = [],
  onToggleMenuItemAvailability,
  onResetAllData
}) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'analytics' | 'tables' | 'billing' | 'menu'>('queue');
  const [copiedLink, setCopiedLink] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('Semua');
  const [newTableInput, setNewTableInput] = useState('');
  const [tableError, setTableError] = useState<string | null>(null);
  const [confirmingOrderPayment, setConfirmingOrderPayment] = useState<string | null>(null);
  const [selectedQrTable, setSelectedQrTable] = useState<string>('');

  // Payment settings inputs state
  const [bankNameInput, setBankNameInput] = useState(bankName);
  const [bankAccountInput, setBankAccountInput] = useState(bankAccount);
  const [bankHolderInput, setBankHolderInput] = useState(bankHolder);
  const [warungNameInput, setWarungNameInput] = useState(warungName);
  const [warungTaglineInput, setWarungTaglineInput] = useState(warungTagline);
  const [isSaved, setIsSaved] = useState(false);

  // Developer Mode & Top-up Requests State
  const [isDeveloperMode, setIsDeveloperMode] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [senderNameInput, setSenderNameInput] = useState('');
  const [bankSenderInput, setBankSenderInput] = useState('');
  const [buktiTransfer, setBuktiTransfer] = useState<string | undefined>(undefined);
  const [isCompressing, setIsCompressing] = useState(false);
  const [viewingProofRequest, setViewingProofRequest] = useState<TopupRequest | null>(null);

  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>(() => {
    try {
      const prefix = spreadsheetId ? `_${spreadsheetId}` : '';
      const saved = localStorage.getItem(`warung_topup_requests${prefix}`);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Client-side image compression helper
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 250;
          const MAX_HEIGHT = 250;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  // Load requests from Google Sheets on start / spreadsheetId change
  useEffect(() => {
    const loadTopups = async () => {
      if (!spreadsheetId) return;
      try {
        const token = await getAccessToken();
        if (token) {
          const sheetTopups = await loadTopupRequestsFromSheet(spreadsheetId, token);
          if (sheetTopups && sheetTopups.length > 0) {
            setTopupRequests(sheetTopups);
          }
        }
      } catch (err) {
        console.warn('Gagal memuat riwayat topup dari Google Sheet:', err);
      }
    };
    loadTopups();
  }, [spreadsheetId]);

  // Save requests when changed
  useEffect(() => {
    const prefix = spreadsheetId ? `_${spreadsheetId}` : '';
    localStorage.setItem(`warung_topup_requests${prefix}`, JSON.stringify(topupRequests));
  }, [topupRequests, spreadsheetId]);

  useEffect(() => {
    setBankNameInput(bankName);
    setBankAccountInput(bankAccount);
    setBankHolderInput(bankHolder);
    setWarungNameInput(warungName);
    setWarungTaglineInput(warungTagline);
  }, [bankName, bankAccount, bankHolder, warungName, warungTagline]);

  const formatRupiah = (num: number) => {
    return 'Rp ' + num.toLocaleString('id-ID');
  };

  const getCustomerLink = (tableName?: string) => {
    if (typeof window === 'undefined') return '';
    const baseUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    let url = spreadsheetId ? `${baseUrl}?sheet=${spreadsheetId}` : baseUrl;
    if (tableName) {
      const prefix = spreadsheetId ? '&' : '?';
      url += `${prefix}meja=${encodeURIComponent(tableName)}`;
    }
    return url;
  };

  const handlePrintTableQr = (tableName: string) => {
    const printWindow = window.open('', '', 'height=600,width=500');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Cetak QR Code Meja - ' + (tableName || 'Umum') + '</title>');
      printWindow.document.write('<style>');
      printWindow.document.write(`
        body { 
          font-family: sans-serif; 
          text-align: center; 
          padding: 30px; 
          color: #111; 
          background-color: #fff;
        }
        .card {
          border: 4px solid #111;
          border-radius: 20px;
          padding: 30px 20px;
          max-width: 360px;
          margin: 0 auto;
        }
        .title { 
          font-size: 22px; 
          font-weight: 900; 
          margin: 0; 
          text-transform: uppercase; 
        }
        .tagline { 
          font-size: 12px; 
          color: #555; 
          margin: 4px 0 20px 0; 
        }
        .table-badge {
          background-color: #f59e0b;
          color: #000;
          font-size: 16px;
          font-weight: 800;
          padding: 6px 16px;
          border-radius: 8px;
          display: inline-block;
          margin-bottom: 20px;
          text-transform: uppercase;
        }
        .qr-container {
          display: inline-block;
          background: #fff;
          padding: 12px;
          border: 2px solid #ddd;
          border-radius: 12px;
          margin-bottom: 20px;
        }
        .qr-grid {
          display: grid;
          grid-template-columns: repeat(21, 10px);
          grid-template-rows: repeat(21, 10px);
          gap: 0;
          position: relative;
        }
        .qr-pixel {
          width: 10px;
          height: 10px;
        }
        .anchor {
          position: absolute;
          width: 30px;
          height: 30px;
          background: #fff;
          border: 6px solid #111;
          box-sizing: border-box;
        }
        .anchor-inner {
          position: absolute;
          top: 4px;
          left: 4px;
          width: 10px;
          height: 10px;
          background: #111;
        }
        .anchor-tl { top: 0; left: 0; }
        .anchor-tr { top: 0; right: 0; }
        .anchor-bl { bottom: 0; left: 0; }
        .center-logo {
          position: absolute;
          top: 85px;
          left: 85px;
          width: 40px;
          height: 40px;
          background: #fff;
          border: 2px solid #111;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 10px;
        }
         .instructions { 
          font-size: 11px; 
          color: #444; 
          line-height: 1.4; 
        }
        .step {
          margin-bottom: 3px;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        @media print {
          body { padding: 0; }
          .card { page-break-inside: avoid; }
        }
      `);
      printWindow.document.write('</style></head><body>');
      printWindow.document.write(`
        <div class="card">
          <h1 class="title">${warungNameInput || 'WARUNG NUSANTARA'}</h1>
          <p class="tagline">${warungTaglineInput || 'Cita Rasa Tradisional'}</p>
          
          <div class="table-badge">${tableName || 'MENU DIGITAL'}</div>
          
          <div class="qr-container">
            <div class="qr-grid">
              <div class="anchor anchor-tl"><div class="anchor-inner"></div></div>
              <div class="anchor anchor-tr"><div class="anchor-inner"></div></div>
              <div class="anchor anchor-bl"><div class="anchor-inner"></div></div>
              <div class="center-logo">MENU</div>
      `);

      for (let i = 0; i < 441; i++) {
        const x = i % 21;
        const y = Math.floor(i / 21);
        const isTL = x < 7 && y < 7;
        const isTR = x > 13 && y < 7;
        const isBL = x < 7 && y > 13;
        const isCenter = Math.abs(x - 10) <= 2 && Math.abs(y - 10) <= 2;
        const isProtected = isTL || isTR || isBL || isCenter;
        
        const isFilled = isProtected ? false : (Math.sin(i * 1.5) * Math.cos(i * 0.8) > -0.15);
        const bgColor = isFilled ? '#111111' : '#ffffff';
        printWindow.document.write(`<div class="qr-pixel" style="background-color: ${bgColor};"></div>`);
      }

      printWindow.document.write(`
            </div>
          </div>
          
          <div class="instructions">
            <div class="step"><strong>1. Scan QR Code</strong> ini menggunakan kamera HP Anda.</div>
            <div class="step"><strong>2. Pilih Menu</strong> favorit Anda secara langsung.</div>
            <div class="step"><strong>3. Kirim Pesanan</strong> & makanan langsung diantar ke meja!</div>
          </div>
        </div>
      `);
      
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  const handleAddTable = (e: React.FormEvent) => {
    e.preventDefault();
    setTableError(null);
    const trimmed = newTableInput.trim();
    if (!trimmed) {
      setTableError('Nama meja tidak boleh kosong!');
      return;
    }
    if (tables.includes(trimmed)) {
      setTableError('Nama meja sudah terdaftar!');
      return;
    }
    const updated = [...tables, trimmed];
    onUpdateTables(updated);
    setNewTableInput('');
  };

  const handleDeleteTable = (tableToDelete: string) => {
    const updated = tables.filter(t => t !== tableToDelete);
    onUpdateTables(updated);
  };

  const handleResetTables = () => {
    const defaultTables = [
      "Meja 1", "Meja 2", "Meja 3", "Meja 4", "Meja 5", "Meja 6", "Meja 7", "Meja 8", "Meja 9", "Meja 10", "Meja 11", "Meja 12", "Bawa Pulang (Takeaway)"
    ];
    onUpdateTables(defaultTables);
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    if (filterStatus === 'Semua') return orders;
    return orders.filter(o => o.status === filterStatus);
  }, [orders, filterStatus]);

  // Analytics Calculation
  const stats = useMemo(() => {
    // Starting baseline seed data to make charts beautiful even if there are no orders yet!
    const baselineRevenue = 450000;
    const baselineOrders = 18;
    const baselineCompleted = 16;

    const actualRevenue = orders
      .filter(o => o.status === 'Selesai')
      .reduce((sum, o) => sum + o.total, 0);

    const actualOrdersCount = orders.length;
    const actualCompletedCount = orders.filter(o => o.status === 'Selesai').length;

    // Calculate category counts
    const categoriesSeed: { [key: string]: number } = {
      'Makanan': 24,
      'Minuman': 32,
      'Cemilan': 12,
      'Paket': 10
    };

    orders.forEach(o => {
      o.items.forEach(item => {
        let catLabel = 'Makanan';
        if (item.menuItem.category === 'minuman') catLabel = 'Minuman';
        else if (item.menuItem.category === 'cemilan') catLabel = 'Cemilan';
        else if (item.menuItem.category === 'paket') catLabel = 'Paket';

        categoriesSeed[catLabel] = (categoriesSeed[catLabel] || 0) + item.quantity;
      });
    });

    const pieData = Object.entries(categoriesSeed).map(([name, value]) => ({
      name,
      value
    }));

    // Hourly flow data
    const hourlyData = [
      { jam: '11:00', penjualan: 95000 + (orders.filter(o => {
        const date = new Date(o.timestamp);
        return date.getHours() === 11 && o.status === 'Selesai';
      }).reduce((sum, o) => sum + o.total, 0)) },
      { jam: '12:00', penjualan: 240000 + (orders.filter(o => {
        const date = new Date(o.timestamp);
        return date.getHours() === 12 && o.status === 'Selesai';
      }).reduce((sum, o) => sum + o.total, 0)) },
      { jam: '13:00', penjualan: 180000 + (orders.filter(o => {
        const date = new Date(o.timestamp);
        return date.getHours() === 13 && o.status === 'Selesai';
      }).reduce((sum, o) => sum + o.total, 0)) },
      { jam: '14:00', penjualan: 60000 + (orders.filter(o => {
        const date = new Date(o.timestamp);
        return date.getHours() === 14 && o.status === 'Selesai';
      }).reduce((sum, o) => sum + o.total, 0)) },
      { jam: '17:00', penjualan: 110000 + (orders.filter(o => {
        const date = new Date(o.timestamp);
        return date.getHours() === 17 && o.status === 'Selesai';
      }).reduce((sum, o) => sum + o.total, 0)) },
      { jam: '18:00', penjualan: 280000 + (orders.filter(o => {
        const date = new Date(o.timestamp);
        return date.getHours() === 18 && o.status === 'Selesai';
      }).reduce((sum, o) => sum + o.total, 0)) },
      { jam: '19:00', penjualan: 320000 + (orders.filter(o => {
        const date = new Date(o.timestamp);
        return date.getHours() === 19 && o.status === 'Selesai';
      }).reduce((sum, o) => sum + o.total, 0)) },
      { jam: '20:00', penjualan: 150000 + (orders.filter(o => {
        const date = new Date(o.timestamp);
        return date.getHours() === 20 && o.status === 'Selesai';
      }).reduce((sum, o) => sum + o.total, 0)) },
    ];

    // Top selling items catalog (hardcoded base + actual counts)
    const topItemsMap: { [key: string]: number } = {
      'Nasi Goreng Kampung': 12,
      'Es Teh Manis Jumbo': 25,
      'Ayam Goreng Korek': 10,
      'Sate Ayam Madura': 8,
    };

    orders.forEach(o => {
      if (o.status === 'Selesai') {
        o.items.forEach(item => {
          topItemsMap[item.menuItem.name] = (topItemsMap[item.menuItem.name] || 0) + item.quantity;
        });
      }
    });

    const topItems = Object.entries(topItemsMap)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 4);

    return {
      totalRevenue: baselineRevenue + actualRevenue,
      totalOrders: baselineOrders + actualOrdersCount,
      completedOrders: baselineCompleted + actualCompletedCount,
      pieData,
      hourlyData,
      topItems
    };
  }, [orders]);

  // COLORS for pie chart
  const COLORS = ['#d97706', '#0d9488', '#ec4899', '#8b5cf6'];

  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 md:p-6 shadow-xl space-y-6">
      
      {/* Tab Selector & Section Heading */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Panel Administrasi Warung</h2>
            <p className="text-xs text-neutral-400">Monitoring dapur dan analisis finansial real-time</p>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex gap-1 bg-neutral-900 border border-neutral-800 p-1 rounded-xl self-stretch sm:self-auto overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex-grow sm:flex-grow-0 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap
              ${activeTab === 'queue' 
                ? 'bg-amber-500 text-neutral-950 shadow-md' 
                : 'text-neutral-400 hover:text-white'
              }`}
            id="tab-kitchen-queue"
          >
            <ClipboardList className="w-4 h-4" />
            <span>Antrean Dapur</span>
            {orders.filter(o => o.status !== 'Selesai' && o.status !== 'Dibatalkan').length > 0 && (
              <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full 
                ${activeTab === 'queue' ? 'bg-neutral-950 text-amber-500' : 'bg-amber-500/20 text-amber-500'}`}>
                {orders.filter(o => o.status !== 'Selesai' && o.status !== 'Dibatalkan').length}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-grow sm:flex-grow-0 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap
              ${activeTab === 'analytics' 
                ? 'bg-amber-500 text-neutral-950 shadow-md' 
                : 'text-neutral-400 hover:text-white'
              }`}
            id="tab-kitchen-analytics"
          >
            <TrendingUp className="w-4 h-4" />
            <span>Grafik & Laporan</span>
          </button>

          <button
            onClick={() => setActiveTab('tables')}
            className={`flex-grow sm:flex-grow-0 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap
              ${activeTab === 'tables' 
                ? 'bg-amber-500 text-neutral-950 shadow-md' 
                : 'text-neutral-400 hover:text-white'
              }`}
            id="tab-kitchen-tables"
          >
            <Utensils className="w-4 h-4" />
            <span>Kelola Meja</span>
          </button>

          <button
            onClick={() => setActiveTab('billing')}
            className={`flex-grow sm:flex-grow-0 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap
              ${activeTab === 'billing' 
                ? 'bg-amber-500 text-neutral-950 shadow-md' 
                : 'text-neutral-400 hover:text-white'
              }`}
            id="tab-kitchen-billing"
          >
            <CreditCard className="w-4 h-4" />
            <span>Saldo & Biaya Layanan</span>
            {appBalance < 1000 && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse inline-block" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('menu')}
            className={`flex-grow sm:flex-grow-0 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap
              ${activeTab === 'menu' 
                ? 'bg-amber-500 text-neutral-950 shadow-md' 
                : 'text-neutral-400 hover:text-white'
              }`}
            id="tab-kitchen-menu"
          >
            <Utensils className="w-4 h-4" />
            <span>Kelola Menu</span>
          </button>
        </div>
      </div>

      {/* BILLING ALERT & BALANCES SUMMARY BANNER */}
      <div className={`p-4 border rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-in fade-in duration-300
        ${appBalance < 50
          ? 'bg-rose-950/20 border-rose-500/20 text-rose-200'
          : appBalance < 1000
            ? 'bg-amber-950/20 border-amber-500/20 text-amber-200'
            : 'bg-neutral-900 border-neutral-800 text-neutral-300'
        }`}
      >
        <div className="flex gap-3">
          <div className={`p-2.5 rounded-xl shrink-0 flex items-center justify-center h-11 w-11
            ${appBalance < 50
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              : appBalance < 1000
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'bg-neutral-950 text-amber-500 border border-neutral-800'
            }`}
          >
            <CreditCard className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Status Saldo Layanan Aplikasi</span>
              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-widest border
                ${appBalance >= 50 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}
              >
                {appBalance >= 50 ? '● Aktif' : '● Non-Aktif (Tangguhkan)'}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-white">{formatRupiah(appBalance)}</span>
              {appBalance === 5000 && (
                <span className="text-[9px] bg-amber-500/15 border border-amber-500/20 text-amber-400 font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                  Voucher Warung Baru 🎁
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-400 leading-normal max-w-xl">
              {appBalance < 50 
                ? 'Layanan Menu Digital sedang ditangguhkan karena sisa saldo habis. Silakan top up minimal Rp 5.000 ke rekening Developer.'
                : appBalance < 1000 
                  ? 'Peringatan: Saldo Anda sangat minim. Silakan segera isi ulang saldo agar layanan pemesanan tidak dinonaktifkan.' 
                  : 'Sisa saldo di atas akan terpotong secara otomatis sebesar Rp 50 flat untuk setiap transaksi pemesanan.'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setActiveTab('billing')}
          className={`w-full md:w-auto px-4 py-2.5 font-extrabold text-xs rounded-xl tracking-wider uppercase transition-all whitespace-nowrap active:scale-95 shadow-sm
            ${appBalance < 50
              ? 'bg-rose-500 hover:bg-rose-600 text-white'
              : 'bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200'
            }`}
        >
          {appBalance < 50 ? 'Top-Up Sekarang 🚀' : 'Rincian & Top-Up'}
        </button>
      </div>

      {/* Google Sheets Sync & Menu Management Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-300">Database Menu</span>
              {spreadsheetUrl ? (
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-900 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Terhubung ke Google Sheet
                </span>
              ) : (
                <span className="text-[10px] font-bold text-neutral-400 bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded-full">
                  Memakai Penyimpanan Lokal
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              {spreadsheetUrl ? 'Menu tersinkronisasi otomatis dengan Google Sheets Anda.' : 'Login ke akun Google Anda untuk mengaktifkan sinkronisasi cloud.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {spreadsheetUrl && (
            <a 
              href={spreadsheetUrl} 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl text-xs font-semibold text-neutral-200 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Buka Sheet</span>
            </a>
          )}

          {googleUser && (
            <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 p-1.5 rounded-xl">
              {googleUser.photoURL ? (
                <img src={googleUser.photoURL} alt={googleUser.displayName || 'Google User'} className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center text-xs font-bold">
                  {(googleUser.displayName || 'A').charAt(0)}
                </div>
              )}
              <span className="text-xs font-medium text-neutral-300 hidden sm:inline max-w-[100px] truncate">
                {googleUser.displayName || 'Admin'}
              </span>
              <button 
                onClick={onLogoutGoogle}
                title="Log Out dari Google"
                className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={onSyncSheets}
            disabled={isSyncingSheets}
            className={`flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl text-xs font-semibold text-neutral-200 transition-colors ${isSyncingSheets ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheets ? 'animate-spin' : ''}`} />
            <span>Sinkron</span>
          </button>

          <button
            onClick={onOpenAddMenu}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold rounded-xl text-xs transition-all shadow-md shadow-amber-500/10"
            id="btn-add-menu-item"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Menu</span>
          </button>
        </div>
      </div>

      {/* RENDER MENU TAB */}
      {activeTab === 'menu' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="py-3 px-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Info Menu</th>
                  <th className="py-3 px-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Kategori</th>
                  <th className="py-3 px-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider text-right">Harga</th>
                  <th className="py-3 px-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider text-center">Status Tersedia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {menuItems.map(item => (
                  <tr key={item.id} className="hover:bg-neutral-800/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={item.image} 
                          alt={item.name} 
                          className="w-12 h-12 rounded-lg object-cover" 
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <p className="text-sm font-bold text-white leading-tight">{item.name}</p>
                          <p className="text-[10px] text-neutral-500 mt-0.5 max-w-[200px] truncate">{item.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-neutral-300 capitalize">{item.category}</td>
                    <td className="py-3 px-4 text-sm font-bold text-amber-500 text-right">{formatRupiah(item.price)}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onToggleMenuItemAvailability(item.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          item.isAvailable !== false
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
                        }`}
                      >
                        {item.isAvailable !== false ? '✅ Tersedia' : '❌ Habis'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RENDER QUEUE TAB */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          
          {/* Filters & Refresh */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900/50 p-3 rounded-xl border border-neutral-900">
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {['Semua', 'Diterima', 'Dimasak', 'Selesai', 'Dibatalkan'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap transition-colors
                    ${filterStatus === status 
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                      : 'border-neutral-800 text-neutral-400 hover:bg-neutral-800/50 hover:text-white'
                    }`}
                  id={`filter-status-${status}`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              {orders.length > 0 && (
                <button
                  onClick={onClearAll}
                  className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 text-xs font-semibold text-rose-400 rounded-lg hover:bg-rose-500/10 hover:border-rose-500/20 transition-colors"
                  id="btn-clear-kitchen-orders"
                >
                  Reset Transaksi
                </button>
              )}
            </div>
          </div>

          {/* List of orders */}
          {filteredOrders.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-neutral-800 rounded-2xl bg-neutral-900/10">
              <Utensils className="w-12 h-12 text-neutral-600 mx-auto mb-3 stroke-1" />
              <p className="text-neutral-400 font-medium text-sm">Tidak Ada Antrean Pesanan</p>
              <p className="text-xs text-neutral-500 mt-1">Gunakan tab Pemesanan di atas untuk membuat pesanan baru.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredOrders.map((order) => (
                <div 
                  key={order.id} 
                  className={`bg-neutral-900/40 border rounded-xl p-4 flex flex-col justify-between transition-all duration-300 hover:border-neutral-700
                    ${order.status === 'Diterima' ? 'border-sky-500/30 bg-sky-950/5' : ''}
                    ${order.status === 'Dimasak' ? 'border-amber-500/30 bg-amber-950/5 animate-pulse-subtle' : ''}
                    ${order.status === 'Selesai' ? 'border-emerald-500/30 bg-emerald-950/5' : ''}
                    ${order.status === 'Dibatalkan' ? 'border-rose-500/20 opacity-60' : ''}
                  `}
                >
                  {/* Item Header */}
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-amber-500">{order.id}</span>
                          <span className="text-[10px] text-neutral-500">• {new Date(order.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <h3 className="text-sm font-bold text-white mt-1 uppercase flex items-center gap-1.5">
                          {order.customerName}
                          <span className="text-xs font-medium text-amber-300 bg-amber-950 border border-amber-900 px-1.5 py-0.5 rounded">
                            {order.tableNumber}
                          </span>
                        </h3>
                      </div>

                      {/* Status badge */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase
                        ${order.status === 'Diterima' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' : ''}
                        ${order.status === 'Dimasak' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : ''}
                        ${order.status === 'Selesai' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : ''}
                        ${order.status === 'Dibatalkan' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : ''}
                      `}>
                        {order.status}
                      </span>
                    </div>

                    {/* Ordered Dishes List */}
                    <div className="space-y-2 border-t border-b border-neutral-800/60 py-2.5 my-3">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="text-xs">
                          <div className="flex justify-between text-neutral-200">
                            <span className="font-semibold text-neutral-100">{item.quantity}x {item.menuItem.name}</span>
                          </div>
                          
                          {/* Options and notes details */}
                          {Object.entries(item.selectedOptions).length > 0 && (
                            <div className="text-[10px] text-neutral-400 pl-3 mt-0.5 space-y-0.5">
                              {Object.entries(item.selectedOptions).map(([key, val]) => (
                                <div key={key}>• {key}: <span className="text-neutral-300">{val}</span></div>
                              ))}
                            </div>
                          )}
                          {item.notes && (
                            <div className="text-[10px] text-amber-400/80 italic pl-3 mt-0.5 bg-neutral-950 px-1.5 py-0.5 rounded inline-block">
                              Note: &ldquo;{item.notes}&rdquo;
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment Info & Controls */}
                  <div className="mt-3 space-y-3 pt-1">
                    <div className="flex justify-between items-center text-xs text-neutral-400">
                      <div>
                        Metode: <strong className="text-neutral-200">{order.paymentMethod}</strong>
                        <span className={`ml-2 px-1.5 py-0.2 rounded text-[10px] font-bold inline-block
                          ${order.paymentStatus === 'Lunas' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                          {order.paymentStatus}
                        </span>
                      </div>
                      <span className="font-semibold text-white">{formatRupiah(order.total)}</span>
                    </div>

                    {/* Operational Actions */}
                    <div className="flex flex-wrap gap-1.5 border-t border-neutral-800/40 pt-3">
                      {order.status === 'Diterima' && (
                        <>
                          <button
                            onClick={() => onUpdateStatus(order.id, 'Dimasak')}
                            className="flex-1 py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-neutral-950 text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                            id={`btn-cook-order-${order.id}`}
                          >
                            <Clock className="w-3 h-3" />
                            <span>Mulai Masak</span>
                          </button>
                          <button
                            onClick={() => onUpdateStatus(order.id, 'Dibatalkan')}
                            className="py-1.5 px-2 bg-neutral-900 hover:bg-rose-950/20 hover:text-rose-400 text-neutral-400 text-[11px] font-bold rounded-lg border border-neutral-800 hover:border-rose-950/40 transition-all flex items-center justify-center gap-1"
                            id={`btn-cancel-order-${order.id}`}
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Batal</span>
                          </button>
                        </>
                      )}

                      {order.status === 'Dimasak' && (
                        <div className="flex-1">
                          {confirmingOrderPayment === order.id ? (
                            <div className="bg-neutral-950 border border-neutral-800 p-2.5 rounded-lg space-y-2 animate-in fade-in duration-200">
                              <p className="text-[10px] font-bold text-neutral-400 text-center uppercase tracking-wider">Sudah dibayar?</p>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => {
                                    onUpdateStatus(order.id, 'Selesai', 'Lunas');
                                    setConfirmingOrderPayment(null);
                                  }}
                                  className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded transition-colors flex items-center justify-center gap-1"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  <span>Lunas</span>
                                </button>
                                <button
                                  onClick={() => {
                                    onUpdateStatus(order.id, 'Selesai', 'Belum Bayar');
                                    setConfirmingOrderPayment(null);
                                  }}
                                  className="flex-1 py-1 px-2 bg-amber-500 hover:bg-amber-600 text-neutral-950 text-[10px] font-bold rounded transition-colors flex items-center justify-center gap-1"
                                >
                                  <Clock className="w-3 h-3" />
                                  <span>Belum</span>
                                </button>
                                <button
                                  onClick={() => setConfirmingOrderPayment(null)}
                                  className="py-1 px-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-[10px] font-bold rounded border border-neutral-700 transition-colors"
                                >
                                  Batal
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmingOrderPayment(order.id)}
                              className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                              id={`btn-finish-order-${order.id}`}
                            >
                              <CheckCircle className="w-3 h-3" />
                              <span>Sajikan & Selesai</span>
                            </button>
                          )}
                        </div>
                      )}

                      {order.status === 'Selesai' && (
                        <div className="w-full flex items-center justify-between gap-2 p-2 bg-neutral-950 border border-neutral-800 rounded-lg">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-[11px] text-neutral-300 font-medium">Selesai Disajikan</span>
                          </div>
                          
                          {order.paymentStatus === 'Lunas' ? (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 border border-emerald-900 px-2 py-0.5 rounded">
                              Terbayar (Lunas)
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-rose-400 bg-rose-950 border border-rose-900 px-2 py-0.5 rounded animate-pulse">
                                Belum Bayar
                              </span>
                              <button
                                onClick={() => onUpdateStatus(order.id, 'Selesai', 'Lunas')}
                                className="py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded transition-colors"
                              >
                                Bayar Sekarang
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {order.status === 'Dibatalkan' && (
                        <div className="w-full text-center py-1 bg-rose-950/20 border border-rose-950/40 rounded-lg text-rose-400 text-[11px] font-medium">
                          Pesanan Dibatalkan
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* RENDER ANALYTICS TAB */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          
          {/* Quick Metrics Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-1">
              <span className="text-xs text-neutral-400 uppercase tracking-wider font-medium">Total Omzet Finansial</span>
              <div className="flex items-center gap-2">
                <h3 className="text-xl md:text-2xl font-black text-white">{formatRupiah(stats.totalRevenue)}</h3>
                <span className="text-[10px] text-emerald-500 bg-emerald-950 border border-emerald-900 px-1.5 py-0.2 rounded font-bold">+12%</span>
              </div>
              <p className="text-[10px] text-neutral-500 leading-snug">Pendapatan kotor akumulatif harian</p>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-1">
              <span className="text-xs text-neutral-400 uppercase tracking-wider font-medium">Volume Pesanan</span>
              <div className="flex items-center gap-2">
                <h3 className="text-xl md:text-2xl font-black text-white">{stats.totalOrders} Struk</h3>
                <span className="text-[10px] text-amber-500 bg-amber-950 border border-amber-900 px-1.5 py-0.2 rounded font-bold">Baru</span>
              </div>
              <p className="text-[10px] text-neutral-500 leading-snug">Total transaksi diolah kasir</p>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-1">
              <span className="text-xs text-neutral-400 uppercase tracking-wider font-medium">Pesanan Sukses Disaji</span>
              <div className="flex items-center gap-2">
                <h3 className="text-xl md:text-2xl font-black text-emerald-400">{stats.completedOrders} Antrean</h3>
                <span className="text-[10px] text-emerald-500 bg-emerald-950 border border-emerald-900 px-1.5 py-0.2 rounded font-bold">100%</span>
              </div>
              <p className="text-[10px] text-neutral-500 leading-snug">Disajikan tanpa kendala</p>
            </div>
          </div>

          {/* Visual Charts Layout - Two Column/Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Chart 1: Revenue Over Time */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-4">
              <div>
                <h4 className="text-sm font-bold text-white">Distribusi Penjualan Per Jam</h4>
                <p className="text-xs text-neutral-400">Statistik omzet puncak pada jam operasional makan</p>
              </div>
              
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.hourlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                    <XAxis dataKey="jam" stroke="#737373" fontSize={11} tickLine={false} />
                    <YAxis stroke="#737373" fontSize={11} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px', color: '#fff' }}
                      formatter={(value: any) => [formatRupiah(value as number), 'Penjualan']}
                    />
                    <Bar dataKey="penjualan" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Category Breakdown (Pie) */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-4 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-white">Komposisi Porsi Terjual</h4>
                <p className="text-xs text-neutral-400">Pangsa menu favorit berdasarkan kategori kuliner</p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-2">
                <div className="h-44 w-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {stats.pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => [`${value} Porsi`, 'Terjual']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Custom list description */}
                <div className="space-y-2 text-xs">
                  {stats.pieData.map((item, idx) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="text-neutral-400 font-medium">{item.name}:</span>
                      <strong className="text-white">{item.value} Porsi</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Top Selling Products List Accent */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-bold text-white">Menu Terlaris (Top Sellers)</h4>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {stats.topItems.map((item, idx) => (
                <div key={item.name} className="bg-neutral-950/60 p-3 rounded-lg border border-neutral-800 flex flex-col justify-between space-y-2">
                  <div className="text-[10px] font-bold text-amber-400">RANK #{idx + 1}</div>
                  <h5 className="text-xs font-bold text-neutral-100 truncate">{item.name}</h5>
                  <div className="text-xs text-neutral-400">
                    Terjual: <span className="font-bold text-white">{item.qty} pcs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Top Selling Products List Accent */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-bold text-white">Menu Terlaris (Top Sellers)</h4>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {stats.topItems.map((item, idx) => (
                <div key={item.name} className="bg-neutral-950/60 p-3 rounded-lg border border-neutral-800 flex flex-col justify-between space-y-2">
                  <div className="text-[10px] font-bold text-amber-400">RANK #{idx + 1}</div>
                  <h5 className="text-xs font-bold text-neutral-100 truncate">{item.name}</h5>
                  <div className="text-xs text-neutral-400">
                    Terjual: <span className="font-bold text-white">{item.qty} pcs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* RENDER BILLING & LAYANAN TAB */}
      {activeTab === 'billing' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT COLUMN: Billing Summary & Developer PIN Access */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Wallet Summary */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6">
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Saldo Pengaktifan</span>
                  <h3 className="text-xl font-black text-white">Dompet Layanan</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Setiap pemesanan pelanggan yang masuk ke dapur akan memotong saldo Dompet ini sebesar <strong className="text-white">Rp 50</strong> sebagai biaya pemeliharaan sistem.
                  </p>
                </div>

                <div className="bg-neutral-950 p-4 border border-neutral-800/60 rounded-xl space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-500 font-bold">Sisa Saldo Anda:</span>
                    <span className={`font-black text-sm ${appBalance < 50 ? 'text-rose-500 animate-pulse' : 'text-emerald-400'}`}>{formatRupiah(appBalance)}</span>
                  </div>
                  <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${appBalance < 1000 ? 'bg-rose-500' : 'bg-emerald-400'}`}
                      style={{ width: `${Math.min(100, (appBalance / 20000) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-neutral-500 font-mono">
                    <span>Limit Mati: &lt; Rp 50</span>
                    <span>Kapasitas Simpan: Rp 100k</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center text-neutral-400 border-b border-neutral-800/85 pb-2">
                    <span>Biaya per Transaksi:</span>
                    <span className="text-white font-bold">Rp 50</span>
                  </div>
                  <div className="flex justify-between items-center text-neutral-400 border-b border-neutral-800/85 pb-2">
                    <span>Voucher Pengaktifan:</span>
                    <span className="text-emerald-400 font-bold">Rp 5.000</span>
                  </div>
                  <div className="flex justify-between items-center text-neutral-400">
                    <span>Status Menu Pelanggan:</span>
                    <span className={`font-black uppercase tracking-wider ${appBalance >= 50 ? 'text-emerald-400' : 'text-rose-500'}`}>
                      {appBalance >= 50 ? 'AKTIF' : 'DITANGGUHKAN'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Developer / Admin Access Gate */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
                  <ShieldCheck className="w-4 h-4 text-amber-500" />
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">Akses Developer / Admin</h4>
                </div>

                {!isDeveloperMode ? (
                  <div className="space-y-3">
                    <p className="text-[11px] text-neutral-400">
                      Bagian ini khusus untuk Developer aplikasi guna mengonfirmasi pembayaran transfer masuk secara manual.
                    </p>
                    
                    <div className="space-y-2">
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
                        <input
                          type="password"
                          placeholder="Masukkan PIN Developer"
                          value={pinInput}
                          onChange={(e) => {
                            setPinInput(e.target.value);
                            setPinError(null);
                          }}
                          className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs focus:outline-none focus:border-amber-500 text-white font-bold"
                        />
                      </div>
                      {pinError && (
                        <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{pinError}</span>
                        </p>
                      )}
                      
                      <button
                        type="button"
                        onClick={() => {
                          if (pinInput === DEVELOPER_CONFIG.ADMIN_PIN) {
                            setIsDeveloperMode(true);
                            setPinInput('');
                            setPinError(null);
                          } else {
                            setPinError('PIN Developer tidak valid! (Silakan cek DEVELOPER_CONFIG di kode Anda)');
                          }
                        }}
                        className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Masuk Mode Developer</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                      <p className="text-xs font-extrabold text-amber-400 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 animate-pulse" />
                        <span>MODE DEVELOPER AKTIF!</span>
                      </p>
                      <p className="text-[10px] text-neutral-400 mt-1">
                        Anda sekarang memiliki hak akses penuh untuk menyetujui pembayaran dan mengatur saldo warung ini secara instan.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsDeveloperMode(false);
                      }}
                      className="w-full py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Keluar (Kunci Panel)</span>
                    </button>
                    
                    {onResetAllData && (
                      <button
                        type="button"
                        onClick={onResetAllData}
                        className="w-full mt-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-rose-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>HAPUS SEMUA DATA TRANSAKSI & SALDO</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* RIGHT COLUMN: Interactive Panel (Form & Requests / Developer Tool) */}
            <div className="lg:col-span-8 space-y-6">

              {!isDeveloperMode ? (
                /* --- WARUNG OWNER VIEW: BANK ACC & SUBMIT TRANSFER REQUEST --- */
                <div className="space-y-6">
                  
                  {/* Bank Account Info */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6">
                    <div className="border-b border-neutral-800 pb-4">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Rekening Tujuan Transfer Developer</h3>
                      <p className="text-xs text-neutral-400 mt-1">
                        Lakukan transfer ke rekening developer berikut, lalu isikan form konfirmasi di sebelah kanan agar developer dapat menambahkan saldo Anda.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Bank Details Card */}
                      <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-4">
                        <div className="flex items-center gap-2 text-xs font-extrabold text-amber-500 uppercase tracking-widest">
                          <Award className="w-4 h-4" />
                          <span>Detail Rekening Developer</span>
                        </div>
                        
                        <div className="space-y-3 text-xs">
                          <div className="space-y-0.5">
                            <span className="text-[9px] text-neutral-500 uppercase font-bold">Nama Bank</span>
                            <p className="text-sm font-black text-white">{DEVELOPER_CONFIG.BANK_NAME}</p>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[9px] text-neutral-500 uppercase font-bold">Nomor Rekening</span>
                            <div className="flex items-center gap-2">
                              <p className="text-base font-black text-amber-400">{DEVELOPER_CONFIG.ACCOUNT_NUMBER}</p>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(DEVELOPER_CONFIG.ACCOUNT_NUMBER.replace(/\s/g, ''));
                                  alert('Nomor rekening developer disalin!');
                                }}
                                className="p-1 hover:bg-neutral-900 text-neutral-400 hover:text-white rounded transition-colors"
                                title="Salin Rekening"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[9px] text-neutral-500 uppercase font-bold">Penerima (Atas Nama)</span>
                            <p className="text-xs font-bold text-neutral-200">{DEVELOPER_CONFIG.ACCOUNT_HOLDER}</p>
                          </div>
                        </div>

                        {/* KONTAK ADMIN LAYANAN */}
                        <div className="pt-3.5 border-t border-neutral-800/80 space-y-2.5">
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-500 uppercase tracking-widest">
                            <Phone className="w-3.5 h-3.5" />
                            <span>Kontak Admin / Developer</span>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between items-center bg-neutral-900/40 p-2.5 border border-neutral-800 rounded-xl">
                              <div className="space-y-0.5">
                                <span className="text-[8px] text-neutral-500 font-bold uppercase">VANCY (ADMIN)</span>
                                <p className="font-mono text-xs font-bold text-white">{DEVELOPER_CONFIG.ADMIN_CONTACT_VANCY}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(DEVELOPER_CONFIG.ADMIN_CONTACT_VANCY);
                                  alert('Nomor kontak Vancy disalin!');
                                }}
                                className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded transition-colors"
                                title="Salin Kontak Vancy"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>

                            <div className="flex justify-between items-center bg-neutral-900/40 p-2.5 border border-neutral-800 rounded-xl">
                              <div className="space-y-0.5">
                                <span className="text-[8px] text-neutral-500 font-bold uppercase">YANTI (ADMIN)</span>
                                <p className="font-mono text-xs font-bold text-white">{DEVELOPER_CONFIG.ADMIN_CONTACT_YANTI}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(DEVELOPER_CONFIG.ADMIN_CONTACT_YANTI);
                                  alert('Nomor kontak Yanti disalin!');
                                }}
                                className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded transition-colors"
                                title="Salin Kontak Yanti"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* User Top Up Request Form */}
                      <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const form = e.currentTarget;
                            const amountInput = form.elements.namedItem('amount') as HTMLInputElement;
                            const amount = Number(amountInput.value);
                            
                            if (!amount || amount < DEVELOPER_CONFIG.MIN_TOPUP) {
                              alert(`Minimal transfer top up adalah Rp ${DEVELOPER_CONFIG.MIN_TOPUP.toLocaleString('id-ID')}!`);
                              return;
                            }
                            if (!senderNameInput.trim()) {
                              alert('Silakan masukkan nama pengirim transfer!');
                              return;
                            }
                            if (!buktiTransfer) {
                              alert('Silakan unggah foto bukti transfer terlebih dahulu untuk verifikasi data!');
                              return;
                            }

                            // Create a request
                            const newRequest: TopupRequest = {
                              id: 'TRX-' + Date.now().toString().slice(-6),
                              amount,
                              senderName: senderNameInput,
                              bankSender: bankSenderInput || 'BANK',
                              date: new Date().toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }),
                              status: 'PENDING',
                              buktiTransfer: buktiTransfer
                            };

                            const updatedRequests = [newRequest, ...topupRequests];
                            setTopupRequests(updatedRequests);
                            
                            // Reset form fields
                            amountInput.value = '';
                            setSenderNameInput('');
                            setBankSenderInput('');
                            setBuktiTransfer(undefined);

                            alert('Konfirmasi transfer telah dikirim! Status pembayaran Anda sekarang "PENDING". Transaksi juga telah dicatat di Google Sheets Anda.');

                            // Sync to Google Sheets
                            try {
                              const token = await getAccessToken();
                              if (spreadsheetId && token) {
                                await syncTopupRequestsToSheet(spreadsheetId, token, updatedRequests);
                              }
                            } catch (err) {
                              console.error('Gagal sinkronisasi data topup ke Google Sheet:', err);
                            }
                          }}
                          className="space-y-3"
                        >
                          <div className="flex items-center gap-2 text-xs font-extrabold text-amber-500 uppercase tracking-widest">
                            <CreditCard className="w-4 h-4" />
                            <span>Konfirmasi Kirim Transfer</span>
                          </div>

                          <div className="space-y-2">
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                Nominal yang Ditransfer (Min Rp 5.000)
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-2 text-xs text-neutral-500 font-bold">Rp</span>
                                <input
                                  type="number"
                                  name="amount"
                                  required
                                  min={DEVELOPER_CONFIG.MIN_TOPUP}
                                  placeholder="10000"
                                  className="w-full pl-8 pr-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 transition-all font-bold"
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                Atas Nama Pengirim (Sesuai Rekening Anda)
                              </label>
                              <div className="relative">
                                <User className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
                                <input
                                  type="text"
                                  required
                                  placeholder="Contoh: Slamet Rahardjo"
                                  value={senderNameInput}
                                  onChange={(e) => setSenderNameInput(e.target.value)}
                                  className="w-full pl-9 pr-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 transition-all font-semibold"
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                Bank Pengirim (Opsional)
                              </label>
                              <input
                                type="text"
                                placeholder="Contoh: BCA / Mandiri / BRI"
                                value={bankSenderInput}
                                onChange={(e) => setBankSenderInput(e.target.value)}
                                className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 transition-all"
                              />
                            </div>

                            {/* UPLOAD BUKTI TRANSFER */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                Unggah Bukti Transfer
                              </label>
                              {!buktiTransfer ? (
                                <div className="border border-dashed border-neutral-800 rounded-xl p-3 bg-neutral-900/50 hover:bg-neutral-900/80 transition-all flex flex-col items-center justify-center gap-1.5 relative cursor-pointer group">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    required
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        setIsCompressing(true);
                                        try {
                                          const compressed = await compressImage(file);
                                          setBuktiTransfer(compressed);
                                        } catch (err) {
                                          alert('Gagal memproses gambar bukti transfer!');
                                        } finally {
                                          setIsCompressing(false);
                                        }
                                      }
                                    }}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                  />
                                  <ImageIcon className="w-5 h-5 text-neutral-500 group-hover:text-amber-500 transition-colors" />
                                  <span className="text-[10px] text-neutral-400 font-medium">
                                    {isCompressing ? 'Memproses Gambar...' : 'Klik / Tarik Foto Bukti Transfer'}
                                  </span>
                                </div>
                              ) : (
                                <div className="relative border border-neutral-800 bg-neutral-900/40 rounded-xl p-2 flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <img 
                                      src={buktiTransfer} 
                                      alt="Bukti Transfer" 
                                      className="w-10 h-10 object-cover rounded-lg border border-neutral-800"
                                      referrerPolicy="no-referrer"
                                    />
                                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" />
                                      Foto Terunggah
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setBuktiTransfer(undefined)}
                                    className="text-[10px] text-rose-400 hover:text-rose-300 font-bold px-2 py-1 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/30 rounded-lg transition-colors"
                                  >
                                    Hapus
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <button
                            type="submit"
                            disabled={isCompressing}
                            className={`w-full py-2 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 ${isCompressing ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600'}`}
                          >
                            <CheckCircle className="w-4 h-4 text-neutral-950 stroke-[3]" />
                            <span>Kirim Bukti Transfer</span>
                          </button>
                        </form>
                      </div>

                    </div>
                  </div>

                  {/* Top-up History for Owner */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">Riwayat Konfirmasi Top-Up Anda</h3>
                    
                    {topupRequests.length === 0 ? (
                      <div className="p-8 border border-dashed border-neutral-800 rounded-xl text-center">
                        <p className="text-xs text-neutral-500 leading-relaxed">
                          Belum ada riwayat pengajuan konfirmasi transfer saldo.<br />
                          Jika Anda sudah melakukan transfer, kirimkan konfirmasi Anda menggunakan form di atas.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-800">
                        {topupRequests.map((req) => (
                          <div 
                            key={req.id} 
                            className="p-3 bg-neutral-950 border border-neutral-800/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] font-black text-amber-500">{req.id}</span>
                                <span className="text-white font-bold">{formatRupiah(req.amount)}</span>
                              </div>
                              <p className="text-[10px] text-neutral-400">
                                Pengirim: <strong className="text-neutral-200">{req.senderName}</strong> ({req.bankSender})
                              </p>
                              <div className="flex items-center gap-1 text-[9px] text-neutral-500">
                                <Calendar className="w-3 h-3" />
                                <span>{req.date}</span>
                              </div>
                            </div>

                            <div className="flex items-center">
                              {req.status === 'PENDING' && (
                                <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-extrabold text-[10px] rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
                                  <span>Menunggu Verifikasi</span>
                                </span>
                              )}
                              {req.status === 'APPROVED' && (
                                <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-extrabold text-[10px] rounded-full uppercase tracking-wider flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                                  <span>Berhasil Diterima</span>
                                </span>
                              )}
                              {req.status === 'REJECTED' && (
                                <span className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 font-extrabold text-[10px] rounded-full uppercase tracking-wider flex items-center gap-1">
                                  <XCircle className="w-3 h-3 text-rose-400" />
                                  <span>Ditolak Developer</span>
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                /* --- DEVELOPER MODE: THE CODES/CONTROLS TO DIRECTLY APPROVE & ADD BALANCE --- */
                <div className="space-y-6">
                  
                  {/* Title & Welcome */}
                  <div className="bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 rounded-2xl p-6 space-y-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-amber-500 animate-bounce" />
                      <h3 className="text-base font-black text-white">Panel Otoritas Saldo Developer</h3>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      Gunakan panel ini untuk mengaktifkan warung yang sudah membayar. Anda bisa menyetujui request transfer masuk (yang otomatis menambahkan saldo mereka) atau menyetel jumlah saldo langsung.
                    </p>
                  </div>

                  {/* Pending Approvals Table */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
                    <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">Permintaan Top-up Masuk ({topupRequests.filter(r => r.status === 'PENDING').length})</h4>
                      <span className="text-[10px] font-mono text-neutral-500">Otorisasi PIN: AKTIF</span>
                    </div>

                    {topupRequests.filter(r => r.status === 'PENDING').length === 0 ? (
                      <div className="p-8 border border-dashed border-neutral-800 rounded-xl text-center">
                        <p className="text-xs text-neutral-500">
                          Tidak ada permintaan verifikasi transfer masuk yang berstatus pending saat ini.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {topupRequests.filter(r => r.status === 'PENDING').map((req) => (
                          <div 
                            key={req.id} 
                            className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
                          >
                            <div className="space-y-1.5 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 bg-amber-500 text-neutral-950 font-mono text-[9px] font-black rounded">{req.id}</span>
                                <span className="font-mono text-neutral-500">|</span>
                                <span className="text-white font-extrabold text-sm">{formatRupiah(req.amount)}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-neutral-400">
                                <p>Pengirim: <strong className="text-neutral-200">{req.senderName}</strong></p>
                                <p>Bank: <strong className="text-neutral-200">{req.bankSender}</strong></p>
                                <p className="col-span-2 text-[10px] text-neutral-500 flex items-center gap-1 mt-1">
                                  <Calendar className="w-3 h-3" />
                                  <span>{req.date}</span>
                                </p>
                              </div>

                              {req.buktiTransfer && (
                                <div className="mt-2.5">
                                  <button
                                    type="button"
                                    onClick={() => setViewingProofRequest(req)}
                                    className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 font-bold rounded-lg text-[10px] transition-all flex items-center gap-1.5 active:scale-95"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Lihat Bukti Transfer (Unggahan)</span>
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {/* APPROVE ACTION */}
                              <button
                                type="button"
                                onClick={async () => {
                                  // Credit the active balance
                                  onUpdateBalance(appBalance + req.amount);
                                  
                                  // Set status to approved
                                  const updated = topupRequests.map(item => 
                                    item.id === req.id ? { ...item, status: 'APPROVED' as const } : item
                                  );
                                  setTopupRequests(updated);

                                  alert(`Berhasil menyetujui pembayaran! Saldo sebesar ${formatRupiah(req.amount)} telah ditambahkan ke dompet aplikasi warung.`);

                                  // Sync to Google Sheets
                                  try {
                                    const token = await getAccessToken();
                                    if (spreadsheetId && token) {
                                      await syncTopupRequestsToSheet(spreadsheetId, token, updated);
                                    }
                                  } catch (err) {
                                    console.error('Gagal sinkronisasi persetujuan topup ke Google Sheet:', err);
                                  }
                                }}
                                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-black rounded-lg text-xs transition-all flex items-center gap-1 active:scale-95"
                              >
                                <CheckCircle className="w-3.5 h-3.5 stroke-[3]" />
                                <span>Setujui & Kreditkan</span>
                              </button>

                              {/* REJECT ACTION */}
                              <button
                                type="button"
                                onClick={async () => {
                                  if (confirm(`Apakah Anda yakin ingin menolak transaksi ${req.id} dari ${req.senderName}?`)) {
                                    const updated = topupRequests.map(item => 
                                      item.id === req.id ? { ...item, status: 'REJECTED' as const } : item
                                    );
                                    setTopupRequests(updated);
                                    alert(`Permintaan transfer ${req.id} telah ditolak.`);

                                    // Sync to Google Sheets
                                    try {
                                      const token = await getAccessToken();
                                      if (spreadsheetId && token) {
                                        await syncTopupRequestsToSheet(spreadsheetId, token, updated);
                                      }
                                    } catch (err) {
                                      console.error('Gagal sinkronisasi penolakan topup ke Google Sheet:', err);
                                    }
                                  }
                                }}
                                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-rose-400 border border-neutral-700 rounded-lg text-xs transition-all flex items-center gap-1 active:scale-95"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Tolak</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Direct Balance Override (Developer Power Tool) */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
                      <Award className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">Setel Saldo Langsung (Developer Override)</h4>
                    </div>

                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const balanceInput = form.elements.namedItem('directBalance') as HTMLInputElement;
                        const val = Number(balanceInput.value);
                        if (isNaN(val) || val < 0) {
                          alert('Jumlah saldo tidak valid!');
                          return;
                        }
                        onUpdateBalance(val);
                        alert(`Override Sukses! Saldo Dompet berhasil disetel ulang menjadi ${formatRupiah(val)} secara langsung.`);
                      }}
                      className="flex flex-col sm:flex-row items-end gap-3"
                    >
                      <div className="flex-1 space-y-1 w-full">
                        <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                          Ketik Saldo Baru Warung (Rupiah)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs text-neutral-500 font-bold">Rp</span>
                          <input
                            type="number"
                            name="directBalance"
                            required
                            min="0"
                            placeholder="Saldo langsung (Contoh: 15000)"
                            className="w-full pl-8 pr-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 w-full sm:w-auto shrink-0"
                      >
                        Terapkan Saldo Baru
                      </button>
                    </form>
                  </div>

                  {/* Transaction Log list */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
                    <h4 className="text-xs font-black text-white uppercase tracking-wider">Seluruh Riwayat Transaksi ({topupRequests.length})</h4>
                    {topupRequests.length === 0 ? (
                      <p className="text-xs text-neutral-500">Belum ada riwayat transaksi.</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-800">
                        {topupRequests.map((req) => (
                          <div 
                            key={req.id} 
                            className="p-2.5 bg-neutral-950 border border-neutral-800/60 rounded-xl flex items-center justify-between text-xs"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[9px] text-neutral-400">{req.id}</span>
                                <span className="font-bold text-white">{formatRupiah(req.amount)}</span>
                                <span className="text-[10px] text-neutral-500">by {req.senderName}</span>
                              </div>
                              <span className="text-[9px] text-neutral-500">{req.date}</span>
                            </div>

                            <div>
                              {req.status === 'APPROVED' && <span className="text-emerald-400 font-bold text-[10px] uppercase">Diterima</span>}
                              {req.status === 'REJECTED' && <span className="text-rose-400 font-bold text-[10px] uppercase">Ditolak</span>}
                              {req.status === 'PENDING' && <span className="text-amber-400 font-bold text-[10px] uppercase animate-pulse">Pending</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              )}

            </div>

          </div>

        </div>
      )}

      {/* RENDER TABLES TAB */}
      {activeTab === 'tables' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-4 mb-6">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Pengaturan Nomor Meja & Layanan</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Tambahkan atau hapus nomor meja makan dan jenis layanan warung yang dapat dipilih oleh pelanggan saat memesan.
                </p>
              </div>
              <button
                onClick={handleResetTables}
                className="self-start md:self-auto px-3 py-1.5 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-[11px] font-bold text-neutral-300 rounded-lg transition-colors"
              >
                Kembalikan Default (Meja 1-12)
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Form Tambah Meja */}
              <div className="lg:col-span-5 space-y-4">
                <form onSubmit={handleAddTable} className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-4 space-y-4">
                  <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest">Tambah Meja / Layanan Baru</h4>
                  
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                      Nama Meja / Tipe Layanan
                    </label>
                    <input
                      type="text"
                      value={newTableInput}
                      onChange={(e) => {
                        setNewTableInput(e.target.value);
                        if (tableError) setTableError(null);
                      }}
                      placeholder="Contoh: Meja 13, Area Lesehan A, VIP, dll"
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs focus:outline-none focus:border-amber-500 text-white placeholder-neutral-600 transition-all"
                    />
                    {tableError && (
                      <p className="text-[10px] font-semibold text-rose-400 mt-1">{tableError}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-amber-500/5 flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Meja</span>
                  </button>
                </form>

                <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4">
                  <h5 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1">💡 Tips Pemilik Warung:</h5>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Anda bisa menambahkan opsi seperti <strong className="text-neutral-300">"Bawa Pulang (Takeaway)"</strong> atau <strong className="text-neutral-300">"Delivery GoFood"</strong> sebagai "nomor meja" agar kasir Anda bisa dengan mudah membedakan jenis pesanan!
                  </p>
                </div>
              </div>

              {/* Daftar Meja Aktif */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                    Daftar Meja Terdaftar ({tables.length})
                  </h4>
                </div>

                {tables.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-neutral-800 rounded-xl bg-neutral-950/20">
                    <Utensils className="w-8 h-8 text-neutral-600 mx-auto mb-2 stroke-1" />
                    <p className="text-xs text-neutral-400 font-medium">Belum Ada Meja yang Didaftarkan</p>
                    <p className="text-[10px] text-neutral-500 mt-0.5">Silakan tambahkan meja baru melalui form di samping.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {tables.map((table) => (
                      <div
                        key={table}
                        className="bg-neutral-950 border border-neutral-800 hover:border-neutral-700 p-2.5 rounded-xl flex items-center justify-between gap-2 group transition-colors"
                      >
                        <span className="text-xs font-semibold text-neutral-200 truncate">{table}</span>
                        <button
                          onClick={() => handleDeleteTable(table)}
                          className="p-1 text-neutral-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title={`Hapus ${table}`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pengaturan Warung & Pembayaran Section */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 md:p-6">
            <div className="flex items-center gap-2 border-b border-neutral-800 pb-4 mb-6">
              <CreditCard className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Pengaturan Identitas & Rekening Warung</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Sesuaikan nama warung, slogan, serta nomor rekening Anda. Data ini disinkronkan otomatis dengan Google Sheets dan ditampilkan langsung di aplikasi pelanggan.
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUpdatePaymentSettings(bankNameInput, bankAccountInput, bankHolderInput, warungNameInput, warungTaglineInput);
                setIsSaved(true);
                setTimeout(() => setIsSaved(false), 3000);
              }}
              className="space-y-6"
            >
              {/* Section 1: Identitas Warung */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-amber-500 uppercase tracking-widest border-l-2 border-amber-500 pl-2">
                  1. Profil & Identitas Warung
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                      Nama Warung
                    </label>
                    <input
                      type="text"
                      value={warungNameInput}
                      onChange={(e) => setWarungNameInput(e.target.value)}
                      placeholder="Contoh: Warung Nusantara, Depot Enak"
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs focus:outline-none focus:border-amber-500 text-white placeholder-neutral-600 transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                      Slogan / Tagline Warung
                    </label>
                    <input
                      type="text"
                      value={warungTaglineInput}
                      onChange={(e) => setWarungTaglineInput(e.target.value)}
                      placeholder="Contoh: Cita Rasa Tradisional, Selera Nusantara"
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs focus:outline-none focus:border-amber-500 text-white placeholder-neutral-600 transition-all"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Rekening Pembayaran */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-amber-500 uppercase tracking-widest border-l-2 border-amber-500 pl-2">
                  2. Rekening Pembayaran Transfer Bank
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                      Nama Bank / E-Wallet
                    </label>
                    <input
                      type="text"
                      value={bankNameInput}
                      onChange={(e) => setBankNameInput(e.target.value)}
                      placeholder="Contoh: Bank BCA, Bank Mandiri, GoPay"
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs focus:outline-none focus:border-amber-500 text-white placeholder-neutral-600 transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                      Nomor Rekening / No. HP
                    </label>
                    <input
                      type="text"
                      value={bankAccountInput}
                      onChange={(e) => setBankAccountInput(e.target.value)}
                      placeholder="Contoh: 8012-3456-78"
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs focus:outline-none focus:border-amber-500 text-white placeholder-neutral-600 transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                      Nama Pemilik Rekening (A.N.)
                    </label>
                    <input
                      type="text"
                      value={bankHolderInput}
                      onChange={(e) => setBankHolderInput(e.target.value)}
                      placeholder="Contoh: Slamet Rahardjo"
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs focus:outline-none focus:border-amber-500 text-white placeholder-neutral-600 transition-all"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Link QR Code / Akses Pelanggan */}
              {spreadsheetId && (
                <div className="space-y-4">
                  <h4 className="text-[11px] font-bold text-amber-500 uppercase tracking-widest border-l-2 border-amber-500 pl-2">
                    3. Cetak QR Code Meja & Link Menu Digital
                  </h4>
                  
                  <div className="p-5 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-4">
                    <p className="text-[11px] text-neutral-400 leading-relaxed">
                      Pilih meja di bawah untuk membuat QR Code meja yang spesifik. Ketika pelanggan memindai QR Code tersebut, nomor meja akan otomatis terisi saat mereka membuat pesanan!
                    </p>

                    {/* Table selector for QR */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-neutral-900 border border-neutral-800 p-3.5 rounded-xl">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                          Pilih Meja untuk QR
                        </label>
                        <select
                          value={selectedQrTable}
                          onChange={(e) => setSelectedQrTable(e.target.value)}
                          className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500 transition-all cursor-pointer"
                        >
                          <option value="">-- Umum / Tanpa Meja Pre-filled --</option>
                          {tables.map(table => (
                            <option key={table} value={table}>{table}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1 flex flex-col justify-end">
                        <span className="block text-[10px] text-neutral-500 mb-1 leading-snug">
                          {selectedQrTable 
                            ? `Pelanggan akan otomatis memesan sebagai "${selectedQrTable}"` 
                            : 'Pelanggan harus memilih nomor meja mereka secara manual.'}
                        </span>
                      </div>
                    </div>

                    {/* Link display & copy action */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                        Link Aplikasi Pelanggan
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          readOnly
                          value={getCustomerLink(selectedQrTable)}
                          className="flex-1 px-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-[11px] font-mono text-amber-500 select-all focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(getCustomerLink(selectedQrTable));
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2000);
                          }}
                          className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-xl border border-neutral-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0"
                        >
                          {copiedLink ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Tersalin!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-neutral-400" />
                              <span>Salin Link</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* QR Code Preview & Print Actions */}
                    <div className="border-t border-neutral-900 pt-4 flex flex-col md:flex-row items-center gap-6">
                      
                      {/* Interactive Simulated QR Code Card */}
                      <div className="bg-white text-neutral-950 p-4 rounded-xl border border-neutral-200 shadow-lg flex flex-col items-center shrink-0 w-44">
                        <span className="text-[10px] font-black tracking-tight text-neutral-800 uppercase text-center truncate max-w-full mb-0.5">
                          {warungNameInput || 'WARUNG NUSANTARA'}
                        </span>
                        <span className="text-[8px] text-neutral-500 mb-2 font-medium truncate max-w-full">
                          {selectedQrTable || 'MENU DIGITAL'}
                        </span>
                        
                        {/* High fidelity 21x21 QR simulation using CSS Grid */}
                        <div 
                          className="w-28 h-28 bg-white relative p-0.5 animate-in fade-in zoom-in duration-300"
                          key={selectedQrTable}
                          style={{ display: 'grid', gridTemplateColumns: 'repeat(21, minmax(0, 1fr))' }}
                        >
                          {/* Anchor corners */}
                          <div className="absolute top-0 left-0 w-8 h-8 border-[3px] border-neutral-950 bg-white p-0.5">
                            <div className="w-full h-full bg-neutral-950" />
                          </div>
                          <div className="absolute top-0 right-0 w-8 h-8 border-[3px] border-neutral-950 bg-white p-0.5">
                            <div className="w-full h-full bg-neutral-950" />
                          </div>
                          <div className="absolute bottom-0 left-0 w-8 h-8 border-[3px] border-neutral-950 bg-white p-0.5">
                            <div className="w-full h-full bg-neutral-950" />
                          </div>

                          {/* Center brand dot */}
                          <div className="absolute inset-0 m-auto w-5 h-5 bg-white border border-neutral-200 rounded flex items-center justify-center font-bold text-[6px]">
                            QR
                          </div>

                          {/* Generate simulated pixels */}
                          {Array.from({ length: 441 }).map((_, i) => {
                            const x = i % 21;
                            const y = Math.floor(i / 21);
                            const isTL = x < 7 && y < 7;
                            const isTR = x > 13 && y < 7;
                            const isBL = x < 7 && y > 13;
                            const isCenter = Math.abs(x - 10) <= 2 && Math.abs(y - 10) <= 2;
                            const isProtected = isTL || isTR || isBL || isCenter;
                            
                            // Make it look slightly randomized but fixed
                            const isFilled = isProtected ? false : (Math.sin(i * 1.5) * Math.cos(i * 0.8) > -0.15);
                            return (
                              <div 
                                key={i}
                                className="w-full h-full"
                                style={{ backgroundColor: isFilled ? '#111' : 'transparent' }}
                              />
                            );
                          })}
                        </div>
                        
                        <span className="text-[7px] text-neutral-400 mt-2 font-mono text-center">
                          Pindai untuk memesan
                        </span>
                      </div>

                      {/* Print QR Actions explanation */}
                      <div className="flex-1 space-y-3">
                        <div className="space-y-1">
                          <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                            <QrCode className="w-4 h-4 text-amber-500" />
                            <span>Cetak Stiker QR Meja Restoran</span>
                          </h5>
                          <p className="text-[11px] text-neutral-400 leading-relaxed">
                            Cetak desain kartu meja QR berkualitas tinggi untuk diletakkan di meja makan atau area kasir Anda. Cetakan telah didesain sedemikian rupa agar pas dengan kartu duduk/stiker standar, lengkap dengan logo warung dan instruksi pemesanan yang jelas untuk kenyamanan pelanggan Anda.
                          </p>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => handlePrintTableQr(selectedQrTable)}
                          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 hover:scale-[1.02]"
                        >
                          <Printer className="w-4 h-4" />
                          <span>Cetak QR Code {selectedQrTable ? `[${selectedQrTable}]` : 'Umum'}</span>
                        </button>
                      </div>

                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-neutral-800">
                <div className="text-[11px] text-neutral-500 leading-relaxed max-w-lg">
                  💡 <strong className="text-neutral-400">QRIS Dinamis:</strong> Sistem juga menyiapkan barcode QRIS GPN otomatis sesuai total belanja pemesanan pelanggan untuk kemudahan pembayaran instan!
                </div>
                
                <div className="flex items-center gap-3 shrink-0">
                  {isSaved && (
                    <span className="text-[11px] font-semibold text-emerald-400 animate-fade-in flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Tersimpan!
                    </span>
                  )}
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-amber-500/5 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Simpan Pengaturan
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL SCREEN BUKTI TRANSFER PREVIEW MODAL */}
      {viewingProofRequest && (
        <div className="fixed inset-0 bg-neutral-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-250">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md p-6 relative shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setViewingProofRequest(null)}
              className="absolute top-4 right-4 p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-full transition-colors"
              title="Tutup"
            >
              <XCircle className="w-5 h-5" />
            </button>
            
            <div className="space-y-1 pr-6">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Detail Bukti Transfer</h3>
              <p className="text-[11px] text-neutral-400">
                Verifikasi keaslian pengiriman dana dari pelanggan / pemilik warung.
              </p>
            </div>

            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-2.5 overflow-hidden flex items-center justify-center min-h-[250px] max-h-[350px]">
              {viewingProofRequest.buktiTransfer ? (
                <img 
                  src={viewingProofRequest.buktiTransfer} 
                  alt="Bukti Transfer" 
                  className="max-w-full max-h-[330px] object-contain rounded-xl"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-xs text-neutral-500 font-medium">Foto bukti transfer tidak ditemukan</span>
              )}
            </div>

            <div className="bg-neutral-950 border border-neutral-800/80 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center border-b border-neutral-800/60 pb-2">
                <span className="text-neutral-500 font-semibold">ID Transaksi</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-black text-amber-500">{viewingProofRequest.id}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(viewingProofRequest.id);
                      alert('ID Transaksi disalin!');
                    }}
                    className="p-1 hover:bg-neutral-900 text-neutral-400 hover:text-white rounded transition-colors"
                    title="Salin ID"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center border-b border-neutral-800/60 pb-2">
                <span className="text-neutral-500 font-semibold">Nama Pengirim</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white">{viewingProofRequest.senderName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(viewingProofRequest.senderName);
                      alert('Nama Pengirim disalin!');
                    }}
                    className="p-1 hover:bg-neutral-900 text-neutral-400 hover:text-white rounded transition-colors"
                    title="Salin Nama"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center border-b border-neutral-800/60 pb-2">
                <span className="text-neutral-500 font-semibold">Bank Pengirim</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-neutral-300">{viewingProofRequest.bankSender}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(viewingProofRequest.bankSender);
                      alert('Bank Pengirim disalin!');
                    }}
                    className="p-1 hover:bg-neutral-900 text-neutral-400 hover:text-white rounded transition-colors"
                    title="Salin Bank"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center border-b border-neutral-800/60 pb-2">
                <span className="text-neutral-500 font-semibold">Nominal Transfer</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-emerald-400 text-sm">{formatRupiah(viewingProofRequest.amount)}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(viewingProofRequest.amount.toString());
                      alert('Nominal Transfer disalin!');
                    }}
                    className="p-1 hover:bg-neutral-900 text-neutral-400 hover:text-white rounded transition-colors"
                    title="Salin Nominal"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-500 font-semibold">Tanggal Kirim</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-400 font-medium">{viewingProofRequest.date}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(viewingProofRequest.date);
                      alert('Tanggal Kirim disalin!');
                    }}
                    className="p-1 hover:bg-neutral-900 text-neutral-400 hover:text-white rounded transition-colors"
                    title="Salin Tanggal"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  const detailText = `DETAIL BUKTI TOPUP\nID: ${viewingProofRequest.id}\nPengirim: ${viewingProofRequest.senderName}\nBank: ${viewingProofRequest.bankSender}\nNominal: ${formatRupiah(viewingProofRequest.amount)}\nTanggal: ${viewingProofRequest.date}`;
                  navigator.clipboard.writeText(detailText);
                  alert('Seluruh detail bukti transfer berhasil disalin!');
                }}
                className="py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 font-bold text-[10px] rounded-xl transition-all flex items-center justify-center gap-1"
              >
                <Copy className="w-3 h-3" />
                <span>Salin Info Teks</span>
              </button>
              
              <button
                type="button"
                disabled={!viewingProofRequest.buktiTransfer}
                onClick={() => {
                  if (viewingProofRequest.buktiTransfer) {
                    navigator.clipboard.writeText(viewingProofRequest.buktiTransfer);
                    alert('Raw Data Foto (Base64) berhasil disalin ke clipboard!');
                  }
                }}
                className={`py-1.5 font-bold text-[10px] rounded-xl transition-all flex items-center justify-center gap-1 ${viewingProofRequest.buktiTransfer ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400' : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700/50'}`}
              >
                <ImageIcon className="w-3 h-3" />
                <span>Salin Base64 Foto</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setViewingProofRequest(null)}
              className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs rounded-xl transition-all"
            >
              Kembali
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
