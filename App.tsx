import React, { useState, useEffect, useMemo } from 'react';
import { MenuItem, CartItem, Order } from './types';
import { WARUNG_MENU_ITEMS, TABLES_LIST } from './data';
import { OrderReceipt } from './components/OrderReceipt';
import { QrisModal } from './components/QrisModal';
import { KitchenPanel } from './components/KitchenPanel';
import { AddMenuItemModal } from './components/AddMenuItemModal';

import { initAuth, googleSignIn, getAccessToken, logout } from './services/firebaseAuth';
import { getOrCreateMenuSpreadsheet, loadMenuItemsFromSheet, addMenuItemToSheet, syncTablesToSheet, loadTablesFromSheet, syncPaymentSettingsToSheet, loadPaymentSettingsFromSheet } from './services/googleSheets';

import { 
  ShoppingBag, Search, Utensils, Tag, Trash2, 
  Plus, Minus, ArrowRight, User, Hash, AlertCircle, 
  Sparkles, Coffee, Pizza, Cookie, Star, LayoutGrid, CheckCircle2,
  Lock, ShieldAlert, Delete, RefreshCw, X, Clock, Flame, Check, ChevronRight, Receipt, Copy
} from 'lucide-react';

// Import banner image generated earlier
import bannerImage from './src/assets/images/warung_banner_1783565594622.jpg';

export default function App() {
  // Helper to determine initial spreadsheet ID from URL or localStorage
  const initialSpreadsheetId = (() => {
    if (typeof window === 'undefined') return null;
    const urlParams = new URLSearchParams(window.location.search);
    const urlSheetId = urlParams.get('sheet') || urlParams.get('sheetId') || urlParams.get('s');
    if (urlSheetId) {
      localStorage.setItem('warung_spreadsheet_id', urlSheetId);
      return urlSheetId;
    }
    return localStorage.getItem('warung_spreadsheet_id');
  })();

  const getInitialStorageValue = (key: string, fallback: any) => {
    const prefix = initialSpreadsheetId ? `_${initialSpreadsheetId}` : '';
    const saved = localStorage.getItem(`${key}${prefix}`);
    if (saved === null || saved === undefined || saved === '') return fallback;
    try {
      const parsed = JSON.parse(saved);
      if (parsed === null) return fallback;
      if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
      return parsed;
    } catch (_) {
      return fallback;
    }
  };

  // Dynamic Menu state
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => 
    getInitialStorageValue('warung_menu_items', WARUNG_MENU_ITEMS)
  );

  // Admin PIN Protection states
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Google Sheets integration states
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(initialSpreadsheetId);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(() => {
    const prefix = initialSpreadsheetId ? `_${initialSpreadsheetId}` : '';
    return localStorage.getItem(`warung_spreadsheet_url${prefix}`) || 
           (initialSpreadsheetId ? `https://docs.google.com/spreadsheets/d/${initialSpreadsheetId}/edit` : null);
  });
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [syncNotification, setSyncNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Session States
  const [orders, setOrders] = useState<Order[]>(() => 
    getInitialStorageValue('warung_orders', [])
  );

  // Dynamic Tables state
  const [tables, setTables] = useState<string[]>(() => 
    getInitialStorageValue('warung_tables_list', TABLES_LIST)
  );

  // Dynamic Owner Payment details (Bank Transfer & QRIS metadata)
  const [bankName, setBankName] = useState<string>(() => 
    getInitialStorageValue('warung_bank_name', 'Bank BCA')
  );
  const [bankAccount, setBankAccount] = useState<string>(() => 
    getInitialStorageValue('warung_bank_account', '8012-3456-78')
  );
  const [bankHolder, setBankHolder] = useState<string>(() => 
    getInitialStorageValue('warung_bank_holder', 'Warung Kita (Slamet)')
  );

  // Dynamic Warung profile details
  const [warungName, setWarungName] = useState<string>(() => 
    getInitialStorageValue('warung_name', 'Warung Nusantara')
  );
  const [warungTagline, setWarungTagline] = useState<string>(() => 
    getInitialStorageValue('warung_tagline', 'Cita Rasa Tradisional')
  );

  // Disable Right-Click, selectstart, and Ctrl+C / Ctrl+A (anti-copy)
  useEffect(() => {
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const preventSelectStart = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
    };

    const preventKeyDown = (e: KeyboardEvent) => {
      // Prevent Ctrl+C (Copy), Ctrl+A (Select All), Ctrl+U (View Source), Ctrl+S (Save), F12 (DevTools)
      if (
        (e.ctrlKey && (e.key === 'c' || e.key === 'C' || e.key === 'a' || e.key === 'A' || e.key === 'u' || e.key === 'U' || e.key === 's' || e.key === 'S')) ||
        e.key === 'F12'
      ) {
        e.preventDefault();
      }
    };

    const preventCopy = (e: ClipboardEvent) => {
      // Prevent copy event unless it is programmatic
      e.preventDefault();
    };

    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('selectstart', preventSelectStart);
    document.addEventListener('keydown', preventKeyDown);
    document.addEventListener('copy', preventCopy);

    return () => {
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('selectstart', preventSelectStart);
      document.removeEventListener('keydown', preventKeyDown);
      document.removeEventListener('copy', preventCopy);
    };
  }, []);

  // Save orders to localStorage on change
  useEffect(() => {
    const prefix = spreadsheetId ? `_${spreadsheetId}` : '';
    localStorage.setItem(`warung_orders${prefix}`, JSON.stringify(orders));
  }, [orders, spreadsheetId]);

  const [customerTab, setCustomerTab] = useState<'menu' | 'track'>('menu');
  const [myOrderIds, setMyOrderIds] = useState<string[]>(() => 
    getInitialStorageValue('warung_my_order_ids', [])
  );
  const [trackSearchInput, setTrackSearchInput] = useState('');

  const myRecentOrders = useMemo(() => {
    return orders.filter(o => myOrderIds.includes(o.id));
  }, [orders, myOrderIds]);

  const myActiveOrders = useMemo(() => {
    return myRecentOrders.filter(o => o.status !== 'Selesai' && o.status !== 'Dibatalkan');
  }, [myRecentOrders]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentView, setCurrentView] = useState<'customer' | 'merchant'>('customer');
  
  // Customer info states
  const [customerName, setCustomerName] = useState('');
  const [tableNumber, setTableNumber] = useState(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return params.get('meja') || params.get('table') || params.get('t') || '';
  });
  
  // Navigation & Filtering
  const [activeCategory, setActiveCategory] = useState<string>('semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Modal states
  const [selectedCustomizeItem, setSelectedCustomizeItem] = useState<MenuItem | null>(null);
  const [customOptions, setCustomOptions] = useState<{ [key: string]: string }>({});
  const [customNotes, setCustomNotes] = useState('');
  const [customQty, setCustomQty] = useState(1);

  // Active Checkout/Payment states
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'TRANSFER'>('CASH');
  const [showQrisModal, setShowQrisModal] = useState(false);
  const [pendingQrisOrder, setPendingQrisOrder] = useState<Order | null>(null);
  const [activeReceiptOrder, setActiveReceiptOrder] = useState<Order | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Developer Wallet Balance System (Voucher starts at 5000)
  const [appBalance, setAppBalance] = useState<number>(() => {
    const prefix = initialSpreadsheetId ? `_${initialSpreadsheetId}` : '';
    const saved = localStorage.getItem(`warung_app_balance${prefix}`);
    return saved !== null ? Number(saved) : 5000;
  });

  const isAppActive = appBalance >= 50;

  useEffect(() => {
    const prefix = spreadsheetId ? `_${spreadsheetId}` : '';
    localStorage.setItem(`warung_app_balance${prefix}`, appBalance.toString());
  }, [appBalance, spreadsheetId]);

  // Currency utility
  const formatRupiah = (num: number) => {
    return 'Rp ' + num.toLocaleString('id-ID');
  };

  // Initialize Firebase Auth listener and Auto-dismiss notification
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        // Reload menu and tables from Sheet if connected
        const savedId = localStorage.getItem('warung_spreadsheet_id');
        if (savedId) {
          setIsSyncingSheets(true);
          Promise.all([
            loadMenuItemsFromSheet(savedId, token),
            loadTablesFromSheet(savedId, token),
            loadPaymentSettingsFromSheet(savedId, token)
          ])
            .then(([items, sheetTables, paymentSettings]) => {
              const prefix = savedId ? `_${savedId}` : '';
              if (items && items.length > 0) {
                setMenuItems(items);
                localStorage.setItem(`warung_menu_items${prefix}`, JSON.stringify(items));
              }
              if (sheetTables && sheetTables.length > 0) {
                setTables(sheetTables);
                localStorage.setItem(`warung_tables_list${prefix}`, JSON.stringify(sheetTables));
              }
              if (paymentSettings) {
                setBankName(paymentSettings.bankName);
                setBankAccount(paymentSettings.bankAccount);
                setBankHolder(paymentSettings.bankHolder);
                setWarungName(paymentSettings.warungName);
                setWarungTagline(paymentSettings.warungTagline);
                localStorage.setItem(`warung_bank_name${prefix}`, paymentSettings.bankName);
                localStorage.setItem(`warung_bank_account${prefix}`, paymentSettings.bankAccount);
                localStorage.setItem(`warung_bank_holder${prefix}`, paymentSettings.bankHolder);
                localStorage.setItem(`warung_name${prefix}`, paymentSettings.warungName);
                localStorage.setItem(`warung_tagline${prefix}`, paymentSettings.warungTagline);
              }
            })
            .catch(err => console.warn('Silent auto-sync info:', err))
            .finally(() => setIsSyncingSheets(false));
        }
      },
      () => {
        setGoogleUser(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Dismiss notification toast after 4s
  useEffect(() => {
    if (syncNotification) {
      const timer = setTimeout(() => {
        setSyncNotification(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [syncNotification]);

  // Google Sheets sync trigger
  const handleSyncSheets = async () => {
    setIsSyncingSheets(true);
    setSyncNotification({ type: 'info', message: 'Menghubungkan ke Google Sheets...' });
    try {
      let token = await getAccessToken();
      let currentUser = googleUser;

      if (!token) {
        // Sign-in pop up
        const result = await googleSignIn();
        if (!result) {
          throw new Error('Gagal login ke akun Google.');
        }
        token = result.accessToken;
        currentUser = result.user;
        setGoogleUser(currentUser);
      }

      const result = await getOrCreateMenuSpreadsheet(token);
      setSpreadsheetId(result.spreadsheetId);
      setSpreadsheetUrl(result.spreadsheetUrl);
      
      const prefix = result.spreadsheetId ? `_${result.spreadsheetId}` : '';
      if (result.menuItems.length > 0) {
        setMenuItems(result.menuItems);
        localStorage.setItem(`warung_menu_items${prefix}`, JSON.stringify(result.menuItems));
      }

      // Check if tables exist in sheet, if so load them, else write local tables to it!
      const sheetTables = await loadTablesFromSheet(result.spreadsheetId, token);
      if (sheetTables && sheetTables.length > 0) {
        setTables(sheetTables);
        localStorage.setItem(`warung_tables_list${prefix}`, JSON.stringify(sheetTables));
      } else {
        await syncTablesToSheet(result.spreadsheetId, token, tables);
      }

      // Check if payment & warung settings exist in sheet, if so load them, else write local settings to it!
      const sheetPayments = await loadPaymentSettingsFromSheet(result.spreadsheetId, token);
      if (sheetPayments) {
        setBankName(sheetPayments.bankName);
        setBankAccount(sheetPayments.bankAccount);
        setBankHolder(sheetPayments.bankHolder);
        setWarungName(sheetPayments.warungName);
        setWarungTagline(sheetPayments.warungTagline);
        localStorage.setItem(`warung_bank_name${prefix}`, sheetPayments.bankName);
        localStorage.setItem(`warung_bank_account${prefix}`, sheetPayments.bankAccount);
        localStorage.setItem(`warung_bank_holder${prefix}`, sheetPayments.bankHolder);
        localStorage.setItem(`warung_name${prefix}`, sheetPayments.warungName);
        localStorage.setItem(`warung_tagline${prefix}`, sheetPayments.warungTagline);
      } else {
        await syncPaymentSettingsToSheet(result.spreadsheetId, token, { bankName, bankAccount, bankHolder, warungName, warungTagline });
      }

      localStorage.setItem('warung_spreadsheet_id', result.spreadsheetId);
      localStorage.setItem(`warung_spreadsheet_url${prefix}`, result.spreadsheetUrl);

      setSyncNotification({ 
        type: 'success', 
        message: 'Koneksi & sinkronisasi Google Sheets berhasil (Menu, Meja, & Rekening)!' 
      });
    } catch (error: any) {
      console.error('Koneksi Google Sheets gagal:', error);
      setSyncNotification({ 
        type: 'error', 
        message: `Koneksi Google Sheets gagal: ${error.message || error}` 
      });
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handleLogoutGoogle = async () => {
    try {
      await logout();
      const oldSpreadsheetId = spreadsheetId;
      setGoogleUser(null);
      setSpreadsheetId(null);
      setSpreadsheetUrl(null);
      localStorage.removeItem('warung_spreadsheet_id');
      if (oldSpreadsheetId) {
        localStorage.removeItem(`warung_spreadsheet_url_${oldSpreadsheetId}`);
      }

      // Clean up URL search query parameter
      if (typeof window !== 'undefined' && window.history && window.history.pushState) {
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.pushState({ path: newUrl }, '', newUrl);
      }

      setSyncNotification({ type: 'info', message: 'Berhasil keluar dari akun Google.' });
    } catch (error: any) {
      console.error('Logout gagal:', error);
    }
  };

  const handleAddMenuItem = async (newItemData: Omit<MenuItem, 'id'>) => {
    const nextId = menuItems.length > 0 ? Math.max(...menuItems.map(m => m.id)) + 1 : 1;
    const newItem: MenuItem = {
      ...newItemData,
      id: nextId
    };

    const savedId = localStorage.getItem('warung_spreadsheet_id');
    const token = await getAccessToken();

    if (savedId && token) {
      await addMenuItemToSheet(savedId, token, newItem);
    }

    const updatedMenu = [...menuItems, newItem];
    setMenuItems(updatedMenu);
    
    const prefix = savedId ? `_${savedId}` : '';
    localStorage.setItem(`warung_menu_items${prefix}`, JSON.stringify(updatedMenu));

    setSyncNotification({
      type: 'success',
      message: `Menu "${newItem.name}" berhasil ditambahkan${savedId ? ' dan tersimpan di Google Sheet' : ''}!`
    });
  };

  // Password Submit Function
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === "dapurku") {
      setIsAdminAuthenticated(true);
      setPinInput('');
      setPinError(null);
    } else {
      setPinError('Kata sandi tidak valid. Silakan coba lagi!');
      setPinInput('');
    }
  };

  // Filter Menu Items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesCategory = activeCategory === 'semua' || item.category === activeCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = !activeTag || item.tags.includes(activeTag);
      return matchesCategory && matchesSearch && matchesTag;
    });
  }, [activeCategory, searchQuery, activeTag]);

  // Handle opening Customizer Modal
  const handleOpenCustomizer = (item: MenuItem) => {
    setSelectedCustomizeItem(item);
    setCustomQty(1);
    setCustomNotes('');
    
    // Set default choices for options
    const defaults: { [key: string]: string } = {};
    if (item.options) {
      item.options.forEach(opt => {
        defaults[opt.name] = opt.choices[0];
      });
    }
    setCustomOptions(defaults);
  };

  // Add Item to cart with options
  const handleAddToCart = () => {
    if (!selectedCustomizeItem) return;

    // Generate unique ID based on item ID and stringified options
    const optionsKey = Object.entries(customOptions)
      .map(([k, v]) => `${k}:${v}`)
      .join('|');
    const cartItemId = `${selectedCustomizeItem.id}-${optionsKey}`;

    // Adjust price if option selections add to costs (e.g. +Rp 5.000)
    let addedPrice = 0;
    Object.values(customOptions).forEach(choice => {
      const match = choice.match(/\(\+Rp\s*([\d.]+)\)/i);
      if (match) {
        addedPrice += parseInt(match[1].replace(/\./g, ''), 10);
      }
    });

    const finalMenuItem = {
      ...selectedCustomizeItem,
      price: selectedCustomizeItem.price + addedPrice
    };

    setCart(prev => {
      const existing = prev.find(item => item.id === cartItemId);
      if (existing) {
        return prev.map(item => 
          item.id === cartItemId 
            ? { ...item, quantity: item.quantity + customQty, notes: customNotes || item.notes }
            : item
        );
      } else {
        return [...prev, {
          id: cartItemId,
          menuItem: finalMenuItem,
          quantity: customQty,
          selectedOptions: customOptions,
          notes: customNotes
        }];
      }
    });

    setSelectedCustomizeItem(null);
  };

  // Fast direct add for items with no complex config
  const handleFastAdd = (item: MenuItem) => {
    const cartItemId = `${item.id}-default`;
    setCart(prev => {
      const existing = prev.find(i => i.id === cartItemId);
      if (existing) {
        return prev.map(i => i.id === cartItemId ? { ...i, quantity: i.quantity + 1 } : i);
      } else {
        return [...prev, {
          id: cartItemId,
          menuItem: item,
          quantity: 1,
          selectedOptions: {},
          notes: ''
        }];
      }
    });
  };

  const updateCartQty = (id: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  // Totals calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0);
  }, [cart]);

  const cartTax = useMemo(() => Math.round(cartSubtotal * 0.10), [cartSubtotal]); // 10% PB1 pajak warung
  const serviceCharge = cart.length > 0 ? 50 : 0; // Rp 50 flat application service fee
  const cartTotal = cartSubtotal + cartTax + serviceCharge;

  // Handle Checkout submission
  const handleCheckout = () => {
    // Validations
    if (!customerName.trim()) {
      setFormError("Nama Pelanggan harus diisi!");
      return;
    }
    if (!tableNumber) {
      setFormError("Nomor Meja atau Takeaway harus dipilih!");
      return;
    }
    if (cart.length === 0) {
      setFormError("Keranjang belanja Anda masih kosong!");
      return;
    }

    setFormError(null);

    // Create unique Order ID
    const orderIndex = String(orders.length + 1).padStart(3, '0');
    const orderId = `WRG-${new Date().toISOString().slice(2,10).replace(/-/g,'')}-${orderIndex}`;

    const newOrder: Order = {
      id: orderId,
      timestamp: Date.now(),
      items: [...cart],
      customerName: customerName,
      tableNumber: tableNumber,
      subtotal: cartSubtotal,
      tax: cartTax,
      serviceCharge: serviceCharge,
      total: cartTotal,
      paymentMethod: paymentMethod,
      paymentStatus: paymentMethod === 'QRIS' ? 'Belum Bayar' : 'Belum Bayar',
      status: 'Diterima'
    };

    if (paymentMethod === 'QRIS') {
      // Prompt simulated QRIS screen
      setPendingQrisOrder(newOrder);
      setShowQrisModal(true);
    } else {
      // Immediately finalize order
      setOrders(prev => [newOrder, ...prev]);
      setAppBalance(prev => Math.max(0, prev - 50)); // Deduct service fee from owner's app balance
      setActiveReceiptOrder(newOrder);
      setMyOrderIds(prev => {
        const updated = [newOrder.id, ...prev];
        const prefix = spreadsheetId ? `_${spreadsheetId}` : '';
        localStorage.setItem(`warung_my_order_ids${prefix}`, JSON.stringify(updated));
        return updated;
      });
      setCart([]); // Clear cart
      setCustomerTab('track'); // Switch to tracking tab automatically!
    }
  };

  // Handle QRIS Payment simulation success
  const handleQrisPaymentSuccess = () => {
    if (pendingQrisOrder) {
      const paidOrder: Order = {
        ...pendingQrisOrder,
        paymentStatus: 'Lunas',
        status: 'Dimasak' // QRIS is pre-paid, so it moves immediately to cooking!
      };
      setOrders(prev => [paidOrder, ...prev]);
      setAppBalance(prev => Math.max(0, prev - 50)); // Deduct service fee from owner's app balance
      setShowQrisModal(false);
      setPendingQrisOrder(null);
      setActiveReceiptOrder(paidOrder);
      setMyOrderIds(prev => {
        const updated = [paidOrder.id, ...prev];
        const prefix = spreadsheetId ? `_${spreadsheetId}` : '';
        localStorage.setItem(`warung_my_order_ids${prefix}`, JSON.stringify(updated));
        return updated;
      });
      setCart([]); // Clear cart
      setCustomerTab('track'); // Switch to tracking tab automatically!
    }
  };

  const handleToggleMenuItemAvailability = async (id: number) => {
    setMenuItems(prev => {
      const updated = prev.map(item => {
        if (item.id === id) {
          const currentAvail = item.isAvailable !== false;
          return { ...item, isAvailable: !currentAvail };
        }
        return item;
      });
      
      const savedId = localStorage.getItem('warung_spreadsheet_id');
      const prefix = savedId ? `_${savedId}` : '';
      localStorage.setItem(`warung_menu_items${prefix}`, JSON.stringify(updated));
      return updated;
    });
  };

  // Kitchen operations status updates
  const handleKitchenUpdateStatus = (
    orderId: string, 
    newStatus: Order['status'], 
    newPaymentStatus?: Order['paymentStatus']
  ) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          status: newStatus,
          paymentStatus: newPaymentStatus ? newPaymentStatus : o.paymentStatus
        };
      }
      return o;
    }));

    // Live update the active open receipt if the user has it open
    if (activeReceiptOrder?.id === orderId) {
      setActiveReceiptOrder(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: newStatus,
          paymentStatus: newPaymentStatus ? newPaymentStatus : prev.paymentStatus
        };
      });
    }
  };

  // Reset all transactions (for demo simulation purposing)
  const handleClearKitchenOrders = () => {
    setOrders([]);
    setActiveReceiptOrder(null);
  };

  // Reset ALL Data (Orders & Balance) for a fresh start
  const handleResetAllData = () => {
    if (window.confirm("PERINGATAN SEBELUM MENGHAPUS!\n\nApakah Anda yakin ingin MENGHAPUS SELURUH DATA TRANSAKSI (Grafik & Riwayat) dan MERESET SALDO APLIKASI menjadi Rp 0?\n\nTindakan ini tidak bisa dibatalkan!")) {
      setOrders([]);
      setActiveReceiptOrder(null);
      setAppBalance(0);
      
      const prefix = spreadsheetId ? `_${spreadsheetId}` : '';
      localStorage.removeItem(`warung_orders${prefix}`);
      localStorage.setItem(`warung_app_balance${prefix}`, '0');
      alert("Seluruh data transaksi dan saldo berhasil direset!");
    }
  };


  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 flex flex-col font-sans selection:bg-amber-500 selection:text-neutral-950">
      
      {/* GLOBAL BANNER MODE TOGGLEER */}
      <header className="sticky top-0 z-40 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-neutral-950 shadow-lg shadow-amber-500/10">
              <Utensils className="w-5 h-5 font-bold" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-white leading-none">{warungName.toUpperCase()}</h1>
              <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest mt-0.5">{warungTagline}</p>
            </div>
          </div>

          {/* VIEW SWITCHER */}
          <div className="flex bg-neutral-900 border border-neutral-800 p-1 rounded-xl">
            <button
              onClick={() => setCurrentView('customer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all
                ${currentView === 'customer' 
                  ? 'bg-amber-500 text-neutral-950 font-bold shadow-md shadow-amber-500/5' 
                  : 'text-neutral-400 hover:text-white'
                }`}
              id="switch-view-customer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Menu Pemesanan</span>
            </button>
            <button
              onClick={() => setCurrentView('merchant')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all
                ${currentView === 'merchant' 
                  ? 'bg-amber-500 text-neutral-950 font-bold shadow-md shadow-amber-500/5' 
                  : 'text-neutral-400 hover:text-white'
                }`}
              id="switch-view-merchant"
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Dapur & Kasir</span>
              {orders.filter(o => o.status !== 'Selesai' && o.status !== 'Dibatalkan').length > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
              )}
            </button>
          </div>

        </div>
      </header>

      {/* CORE WRAPPER */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full">
        
        {/* CUSTOMER MENU VIEW */}
        {currentView === 'customer' && (
          !isAppActive ? (
            <div className="max-w-md mx-auto text-center py-16 px-6 bg-neutral-950 border border-neutral-800 rounded-3xl shadow-2xl space-y-6 my-12 animate-in fade-in duration-300">
              <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <ShieldAlert className="w-10 h-10 animate-bounce" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-black text-white">Layanan Menu Ditangguhkan</h2>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Mohon maaf, sistem menu digital di <strong className="text-white">{warungName}</strong> saat ini sedang ditangguhkan sementara karena sisa saldo layanan aplikasi telah habis.
                </p>
              </div>
              
              <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl text-[11px] text-neutral-400 text-left space-y-2 leading-relaxed">
                <span className="font-bold text-neutral-300 block mb-1">📢 Pengumuman Pemilik Warung:</span>
                <p>Setiap transaksi memotong saldo layanan aplikasi flat sebesar <strong className="text-white">Rp 50</strong>. Saldo Anda saat ini adalah <strong className="text-rose-400 font-bold">{formatRupiah(appBalance)}</strong>.</p>
                <p>Silakan masuk ke panel admin <strong className="text-white">Dapur & Kasir</strong> untuk melakukan isi ulang (Top Up) minimal <strong className="text-amber-500 font-bold">Rp 5.000</strong> ke rekening Developer agar menu digital aktif kembali secara real-time.</p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => setCurrentView('merchant')}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-extrabold text-xs rounded-xl tracking-wider uppercase transition-all shadow-md active:scale-95 hover:scale-[1.02]"
                >
                  Masuk Panel Kasir / Top-Up
                </button>
                <p className="text-[10px] text-neutral-500">Hanya untuk pengelola atau pemilik warung.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
            
            {/* Customer Sub-tabs Bar */}
            <div className="flex border-b border-neutral-800">
              <button
                onClick={() => setCustomerTab('menu')}
                className={`py-3 px-6 text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2
                  ${customerTab === 'menu'
                    ? 'border-amber-500 text-amber-500 bg-amber-500/5'
                    : 'border-transparent text-neutral-400 hover:text-white hover:bg-neutral-900/40'
                  }`}
                id="tab-customer-menu"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Pesan Menu Makanan</span>
              </button>
              <button
                onClick={() => setCustomerTab('track')}
                className={`py-3 px-6 text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 relative
                  ${customerTab === 'track'
                    ? 'border-amber-500 text-amber-500 bg-amber-500/5'
                    : 'border-transparent text-neutral-400 hover:text-white hover:bg-neutral-900/40'
                  }`}
                id="tab-customer-track"
              >
                <RefreshCw className={`w-4 h-4 ${myActiveOrders.length > 0 ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
                <span>Lacak Status Pesanan ({myRecentOrders.length})</span>
                {myActiveOrders.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                )}
              </button>
            </div>

            {customerTab === 'menu' ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
                
                {/* Left Column: Menu Selector (Span 2) */}
                <div className="lg:col-span-2 space-y-6">
              
              {/* STYLISH GRAPHICAL HERO BANNER WITH OUR GENERATED IMAGE */}
              <div className="relative h-48 md:h-64 rounded-2xl overflow-hidden border border-neutral-800 shadow-xl group">
                <img 
                  src={bannerImage} 
                  alt="Traditional Indonesian Food spread containing chicken satay, fried rice, and fresh iced drinks" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                {/* Visual vignette and dark overlay for text contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/45 to-transparent flex items-end p-6" />
                
                <div className="absolute bottom-6 left-6 right-6 space-y-2">
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-neutral-950 text-[10px] font-extrabold uppercase tracking-widest leading-none">
                    <Sparkles className="w-3 h-3 fill-current" />
                    <span>Promo Hari Ini</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-none">
                    Makan Kenyang, Nikmat Senang!
                  </h2>
                  <p className="text-xs md:text-sm text-neutral-300 max-w-md font-medium leading-relaxed">
                    Sajikan resep kuliner legendaris Indonesia dengan rempah pilihan terbaik langsung ke mejamu.
                  </p>
                </div>
              </div>

              {/* SEARCH & FILTERS CONTROLLER */}
              <div className="space-y-4">
                
                {/* Search input */}
                <div className="relative flex items-center">
                  <Search className="w-5 h-5 text-neutral-500 absolute left-4 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari hidangan favoritmu... (cth: Nasi Goreng, Es Teh, Sate...)"
                    className="w-full pl-12 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white placeholder-neutral-500 transition-all"
                    id="input-search-menu"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-4 text-xs text-neutral-400 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Category selectors scrolling */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-neutral-800">
                  {[
                    { id: 'semua', label: 'Semua Menu', icon: LayoutGrid },
                    { id: 'makanan', label: 'Makanan', icon: Pizza },
                    { id: 'minuman', label: 'Minuman', icon: Coffee },
                    { id: 'cemilan', label: 'Cemilan', icon: Cookie },
                    { id: 'paket', label: 'Paket Hemat', icon: Star },
                  ].map((cat) => {
                    const IconComp = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setActiveCategory(cat.id);
                          setActiveTag(null); // Clear tag filter on category change
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap
                          ${activeCategory === cat.id 
                            ? 'bg-amber-500 border-amber-500 text-neutral-950 font-black shadow-md' 
                            : 'bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-white'
                          }`}
                        id={`btn-category-${cat.id}`}
                      >
                        <IconComp className="w-4 h-4" />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Preference Tag Toggles (Pedas, Favorit, Rekomendasi) */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-400 pt-1">
                  <span className="mr-1.5 text-neutral-500 flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    <span>Filter Cepat:</span>
                  </span>
                  
                  {['Favorit', 'Best Seller', 'Rekomendasi', 'Pedas', 'Cemilan', 'Kopi', 'Segar'].map(tag => (
                    <button
                      key={tag}
                      onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] transition-colors
                        ${activeTag === tag 
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                          : 'border-neutral-800 text-neutral-400 hover:border-neutral-700'
                        }`}
                      id={`tag-filter-${tag}`}
                    >
                      {tag}
                    </button>
                  ))}
                  {activeTag && (
                    <button 
                      onClick={() => setActiveTag(null)}
                      className="text-neutral-500 hover:text-white text-[11px] underline pl-1"
                    >
                      Reset Filter
                    </button>
                  )}
                </div>

              </div>

              {/* RENDER DYNAMIC GRID */}
              {filteredMenuItems.length === 0 ? (
                <div className="text-center py-20 bg-neutral-900/40 border border-neutral-800 rounded-2xl">
                  <AlertCircle className="w-10 h-10 text-neutral-600 mx-auto mb-2" />
                  <p className="text-neutral-400 font-semibold text-sm">Hidangan tidak ditemukan</p>
                  <p className="text-xs text-neutral-500 mt-1">Coba gunakan kata kunci pencarian yang lain.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {filteredMenuItems.map((item) => (
                    <div 
                      key={item.id} 
                      className="bg-neutral-950 border border-neutral-800/80 hover:border-neutral-700/80 rounded-2xl overflow-hidden flex flex-col justify-between group transition-all duration-300 hover:-translate-y-0.5 shadow-lg"
                    >
                      {/* Item Visual & Tags */}
                      <div className="relative h-44 w-full bg-neutral-900 overflow-hidden">
                        <img 
                          src={item.image} 
                          alt={item.name} 
                          className={`w-full h-full object-cover transition-transform duration-500 ${item.isAvailable !== false ? 'group-hover:scale-105' : 'grayscale opacity-40'}`}
                          referrerPolicy="no-referrer"
                        />
                        {/* Tags list overlaid */}
                        <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                          {item.tags.map(tag => (
                            <span 
                              key={tag} 
                              className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full text-white shadow-sm
                                ${tag === 'Best Seller' ? 'bg-amber-500 text-neutral-950 font-black' : ''}
                                ${tag === 'Pedas' ? 'bg-rose-600' : ''}
                                ${tag === 'Rekomendasi' ? 'bg-teal-600' : ''}
                                ${tag === 'Favorit' ? 'bg-blue-600' : ''}
                                ${tag !== 'Best Seller' && tag !== 'Pedas' && tag !== 'Rekomendasi' && tag !== 'Favorit' ? 'bg-neutral-700' : ''}
                              `}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        {/* Sold Out Overlay */}
                        {item.isAvailable === false && (
                          <div className="absolute inset-0 bg-neutral-950/60 flex items-center justify-center">
                            <span className="bg-rose-600 text-white text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-rose-500 shadow-md animate-pulse">
                              Habis / Kosong
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Item Details */}
                      <div className={`p-4 flex-1 flex flex-col justify-between ${item.isAvailable === false ? 'opacity-50' : ''}`}>
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-start gap-2">
                            <h3 className="font-bold text-white leading-snug group-hover:text-amber-400 transition-colors">
                              {item.name}
                            </h3>
                            <span className="font-black text-amber-500 text-sm shrink-0">
                              {formatRupiah(item.price)}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-400 leading-relaxed line-clamp-3">
                            {item.description}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="pt-4 border-t border-neutral-800/40 mt-4 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-neutral-500 uppercase font-medium tracking-wider">
                            Kategori: {item.category}
                          </span>
                          
                          {item.isAvailable === false ? (
                            <button
                              disabled
                              className="px-3.5 py-1.5 bg-neutral-900 text-neutral-600 text-xs font-bold rounded-lg border border-neutral-800 cursor-not-allowed"
                              id={`btn-unavailable-item-${item.id}`}
                            >
                              <span>Habis</span>
                            </button>
                          ) : item.options ? (
                            <button
                              onClick={() => handleOpenCustomizer(item)}
                              className="px-3.5 py-1.5 bg-neutral-900 hover:bg-amber-500 hover:text-neutral-950 text-neutral-300 text-xs font-bold rounded-lg border border-neutral-800 transition-all flex items-center gap-1"
                              id={`btn-customize-item-${item.id}`}
                            >
                              <span>Sesuaikan</span>
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleFastAdd(item)}
                              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-neutral-950 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                              id={`btn-fast-add-${item.id}`}
                            >
                              <span>Tambah</span>
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}

            </div>

            {/* Right Column: Checkout Form & Cart Drawer (Span 1) */}
            <div className="space-y-6">
              
              {/* Form Data Pelanggan */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 md:p-5 shadow-lg space-y-4">
                <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
                  <User className="w-4 h-4 text-amber-500" />
                  <h3 className="font-bold text-white text-sm">Informasi Pelanggan</h3>
                </div>

                {formError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-start gap-2 animate-shake">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="leading-normal">{formError}</p>
                  </div>
                )}

                <div className="space-y-3">
                  {/* Customer name input */}
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                      Nama Pemesan <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        if(formError) setFormError(null);
                      }}
                      placeholder="Masukkan nama Anda..."
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs focus:outline-none focus:border-amber-500 text-white placeholder-neutral-600 transition-all"
                      id="input-customer-name"
                    />
                  </div>

                  {/* Seat/Table select */}
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                      Nomor Meja / Layanan <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={tableNumber}
                      onChange={(e) => {
                        setTableNumber(e.target.value);
                        if(formError) setFormError(null);
                      }}
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs focus:outline-none focus:border-amber-500 text-white transition-all"
                      id="select-table-number"
                    >
                      <option value="">-- Pilih Nomor Meja --</option>
                      {tables.map((table) => (
                        <option key={table} value={table}>{table}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Shopping Cart Drawer */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 md:p-5 shadow-lg flex flex-col justify-between min-h-[400px]">
                
                <div>
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-amber-500" />
                      <h3 className="font-bold text-white text-sm">Keranjang Pesanan</h3>
                    </div>
                    {cart.length > 0 && (
                      <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded">
                        {cart.reduce((sum, i) => sum + i.quantity, 0)} Item
                      </span>
                    )}
                  </div>

                  {/* Cart Item rows */}
                  {cart.length === 0 ? (
                    <div className="text-center py-16 text-neutral-500 space-y-2">
                      <ShoppingBag className="w-10 h-10 mx-auto stroke-1" />
                      <p className="text-xs font-semibold">Keranjang Anda masih kosong</p>
                      <p className="text-[11px] text-neutral-600 max-w-[180px] mx-auto">Silakan pilih makanan/minuman lezat di menu sebelah kiri.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-800">
                      {cart.map((item) => (
                        <div key={item.id} className="flex gap-3 justify-between items-start pb-4 border-b border-neutral-900">
                          
                          {/* Item info */}
                          <div className="space-y-1 flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-neutral-200 truncate leading-snug">
                              {item.menuItem.name}
                            </h4>
                            <p className="text-[10px] font-bold text-amber-500">
                              {formatRupiah(item.menuItem.price)}
                            </p>
                            
                            {/* Selected Options List */}
                            {Object.entries(item.selectedOptions).length > 0 && (
                              <div className="text-[9px] text-neutral-500 leading-snug space-y-0.2 pl-1.5 border-l border-neutral-800">
                                {Object.entries(item.selectedOptions).map(([k, v]) => (
                                  <div key={k}>{k}: <span className="text-neutral-400">{v}</span></div>
                                ))}
                              </div>
                            )}

                            {/* Cooking notes */}
                            {item.notes && (
                              <p className="text-[9px] text-amber-400/80 italic truncate">
                                Catatan: &ldquo;{item.notes}&rdquo;
                              </p>
                            )}
                          </div>

                          {/* Control Quantities */}
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className="text-xs font-black text-white">
                              {formatRupiah(item.menuItem.price * item.quantity)}
                            </span>
                            
                            <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 p-0.5 rounded-lg">
                              <button
                                onClick={() => updateCartQty(item.id, -1)}
                                className="w-5 h-5 rounded hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-bold text-white px-1 font-mono">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateCartQty(item.id, 1)}
                                className="w-5 h-5 rounded hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                              
                              <div className="w-[1px] h-3 bg-neutral-800 mx-0.5" />
                              
                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="w-5 h-5 rounded hover:bg-rose-950/20 text-neutral-500 hover:text-rose-400 flex items-center justify-center transition-all"
                                title="Hapus Item"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Subtotals & Payment Details */}
                {cart.length > 0 && (
                  <div className="pt-4 border-t border-neutral-900 mt-4 space-y-4">
                    
                     {/* Bill breakdown */}
                    <div className="space-y-1.5 text-xs text-neutral-400">
                      <div className="flex justify-between">
                        <span>Subtotal Makanan:</span>
                        <span className="text-neutral-200">{formatRupiah(cartSubtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>PB1 / Pajak (10%):</span>
                        <span className="text-neutral-200">{formatRupiah(cartTax)}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span>Biaya Layanan Aplikasi:</span>
                        <span className="text-neutral-200">{formatRupiah(serviceCharge)}</span>
                      </div>
                      <div className="border-t border-neutral-900 my-1 pt-1 flex justify-between text-sm font-bold text-white">
                        <span>Grand Total:</span>
                        <span className="text-amber-500">{formatRupiah(cartTotal)}</span>
                      </div>
                    </div>

                    {/* Service fee notice card */}
                    <div className="p-2.5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-500">
                        <span>ℹ️</span>
                        <span className="uppercase tracking-wider">Informasi Biaya Layanan</span>
                      </div>
                      <p className="text-[10px] text-neutral-400 leading-relaxed">
                        Biaya layanan aplikasi flat <strong className="text-white">Rp 50</strong> dibebankan per transaksi. Jika terjadi penyesuaian atau perubahan biaya layanan di masa mendatang, informasi tarif terbaru akan langsung diperbarui di halaman ini secara real-time.
                      </p>
                    </div>

                    {/* Choose Payment Method Toggle */}
                    <div className="space-y-2">
                      <span className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                        Metode Pembayaran
                      </span>
                      <div className="grid grid-cols-3 gap-1 bg-neutral-900 border border-neutral-800 p-1 rounded-xl">
                        {[
                          { id: 'CASH', label: 'Tunai' },
                          { id: 'QRIS', label: 'QRIS' },
                          { id: 'TRANSFER', label: 'Transfer' },
                        ].map(method => (
                          <button
                            key={method.id}
                            onClick={() => setPaymentMethod(method.id as any)}
                            className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-all
                              ${paymentMethod === method.id 
                                ? 'bg-amber-500 text-neutral-950 shadow' 
                                : 'text-neutral-400 hover:text-white'
                              }`}
                            id={`payment-method-${method.id}`}
                          >
                            {method.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Inline Payment details instruction */}
                    {paymentMethod === 'TRANSFER' && (
                      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-3.5 space-y-2 animate-in fade-in duration-200">
                        <span className="block text-[10px] font-bold text-amber-500 uppercase tracking-wider">Detail Rekening Pemilik Warung:</span>
                        <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 text-xs text-neutral-300 space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-neutral-500">Bank:</span>
                            <span className="font-bold text-white">{bankName}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-neutral-500">No. Rekening:</span>
                            <span className="font-mono font-bold text-amber-500 text-sm">{bankAccount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-500">Atas Nama (A.N.):</span>
                            <span className="font-bold text-neutral-200">{bankHolder}</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-neutral-400 italic leading-relaxed">
                          *Silakan transfer sesuai dengan total nominal belanja Anda. Harap tunjukkan bukti transfer kepada pelayan atau kasir setelah pesanan Anda disajikan.
                        </p>
                      </div>
                    )}

                    {paymentMethod === 'QRIS' && (
                      <div className="bg-neutral-900/60 border border-teal-950 rounded-xl p-3.5 space-y-2 animate-in fade-in duration-200">
                        <span className="block text-[10px] font-bold text-teal-400 uppercase tracking-wider">Pembayaran Instan QRIS GPN:</span>
                        <p className="text-[11px] text-neutral-300 leading-relaxed">
                          Barcode pembayaran QRIS dinamis akan langsung ditampilkan secara otomatis setelah Anda menekan tombol <strong className="text-amber-500">"Kirim Pesanan"</strong> di bawah. Anda dapat memindainya langsung dari ponsel Anda.
                        </p>
                      </div>
                    )}

                    {/* Final Action Checkout Button */}
                    <button
                      onClick={handleCheckout}
                      className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/5 active:scale-95"
                      id="btn-process-checkout"
                    >
                      <span>Kirim Pesanan</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                  </div>
                )}

              </div>

            </div>

          </div>
          ) : (
            /* CUSTOMER TRACK VIEW */
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
              {/* Header Lacak */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" />
                    <span>Pantau Status Pesanan Anda</span>
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Pesanan Anda diproses langsung di dapur warung. Halaman ini memperbarui status secara real-time.
                  </p>
                </div>

                {/* Search Order ID */}
                <div className="relative w-full md:w-72">
                  <input
                    type="text"
                    placeholder="Masukkan Kode Pesanan (e.g. WRG-...)"
                    value={trackSearchInput}
                    onChange={(e) => setTrackSearchInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 transition-all placeholder-neutral-600"
                  />
                  <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* List of orders */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Left col: Order items list (Span 5) */}
                <div className="md:col-span-5 space-y-3">
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider px-1">Riwayat Pesanan Saya</h4>
                  
                  {(() => {
                    const filteredList = orders.filter(o => {
                      // Show if in myOrderIds OR matches the search query
                      const matchesSearch = trackSearchInput.trim() ? o.id.toLowerCase().includes(trackSearchInput.toLowerCase().trim()) : false;
                      return myOrderIds.includes(o.id) || matchesSearch;
                    });

                    if (filteredList.length === 0) {
                      return (
                        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-8 text-center space-y-3">
                          <Receipt className="w-8 h-8 text-neutral-600 mx-auto animate-bounce" />
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-white">Belum Ada Pesanan</p>
                            <p className="text-[10px] text-neutral-500 leading-relaxed">Anda belum memesan makanan apapun sesi ini, atau silakan cari dengan kode pesanan Anda di kolom atas.</p>
                          </div>
                        </div>
                      );
                    }

                    return filteredList.map(order => {
                      const isSelected = activeReceiptOrder?.id === order.id;
                      return (
                        <button
                          key={order.id}
                          onClick={() => setActiveReceiptOrder(order)}
                          className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between gap-3
                            ${isSelected
                              ? 'bg-amber-500/10 border-amber-500/30'
                              : 'bg-neutral-950 hover:bg-neutral-900/60 border-neutral-800'
                            }`}
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono font-bold text-white truncate">{order.id}</span>
                              <span className="text-[10px] text-neutral-500">•</span>
                              <span className="text-[10px] text-amber-500 font-bold">{order.tableNumber}</span>
                            </div>
                            <p className="text-xs font-semibold text-neutral-200 truncate">
                              {order.items.map(i => `${i.quantity}x ${i.menuItem.name}`).join(', ')}
                            </p>
                            <div className="text-[10px] text-neutral-400 flex items-center gap-2">
                              <span>{new Date(order.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
                              <span>•</span>
                              <span className="font-bold text-neutral-300">{formatRupiah(order.total)}</span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider
                              ${order.status === 'Antrian' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : ''}
                              ${order.status === 'Dimasak' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 animate-pulse' : ''}
                              ${order.status === 'Selesai' ? (order.paymentStatus === 'Lunas' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20') : ''}
                              ${order.status === 'Dibatalkan' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : ''}
                            `}>
                              {order.status === 'Selesai' ? (order.paymentStatus === 'Lunas' ? 'Selesai & Lunas' : 'Selamat Menikmati') : order.status}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded
                              ${order.paymentStatus === 'Lunas' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}
                            `}>
                              {order.paymentStatus}
                            </span>
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>

                {/* Right col: Selected order details & stepper (Span 7) */}
                <div className="md:col-span-7 space-y-4">
                  {activeReceiptOrder ? (
                    <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 md:p-6 space-y-6 animate-in slide-in-from-right-4 duration-300">
                      
                      {/* Stepper progress */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
                          <div>
                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Detail Status Pesanan</span>
                            <h4 className="text-sm font-bold text-white font-mono mt-0.5">{activeReceiptOrder.id}</h4>
                          </div>
                          <span className={`text-xs font-bold px-3 py-1 rounded-xl uppercase tracking-wider
                            ${activeReceiptOrder.status === 'Antrian' ? 'bg-amber-500 text-neutral-950 font-black shadow-md shadow-amber-500/10' : ''}
                            ${activeReceiptOrder.status === 'Dimasak' ? 'bg-orange-500 text-neutral-950 font-black shadow-md shadow-orange-500/10' : ''}
                            ${activeReceiptOrder.status === 'Selesai' ? (activeReceiptOrder.paymentStatus === 'Lunas' ? 'bg-emerald-500 text-neutral-950 font-black shadow-md shadow-emerald-500/10' : 'bg-amber-500 text-neutral-950 font-black shadow-md shadow-amber-500/10') : ''}
                            ${activeReceiptOrder.status === 'Dibatalkan' ? 'bg-rose-500 text-white font-black shadow-md shadow-rose-500/10' : ''}
                          `}>
                            {activeReceiptOrder.status === 'Antrian' && 'Dalam Antrian'}
                            {activeReceiptOrder.status === 'Dimasak' && 'Sedang Dimasak'}
                            {activeReceiptOrder.status === 'Selesai' && (activeReceiptOrder.paymentStatus === 'Lunas' ? 'Selesai & Lunas' : 'Selamat Menikmati (Menunggu Pembayaran)')}
                            {activeReceiptOrder.status === 'Dibatalkan' && 'Dibatalkan'}
                          </span>
                        </div>

                        {/* Animated/visual stepper */}
                        {activeReceiptOrder.status !== 'Dibatalkan' && (
                          <div className="grid grid-cols-3 gap-2 pt-2 relative">
                            {/* Connector Line */}
                            <div className="absolute top-4 left-[16.66%] right-[16.66%] h-0.5 bg-neutral-900 z-0" />
                            <div className="absolute top-4 left-[16.66%] h-0.5 bg-amber-500 z-0 transition-all duration-500" style={{
                              width: activeReceiptOrder.status === 'Antrian' ? '0%' : activeReceiptOrder.status === 'Dimasak' ? '50%' : '100%'
                            }} />

                            {/* Step 1: Queue */}
                            <div className="flex flex-col items-center text-center z-10 space-y-1.5">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 font-bold text-xs transition-all
                                ${activeReceiptOrder.status === 'Antrian' || activeReceiptOrder.status === 'Dimasak' || activeReceiptOrder.status === 'Selesai'
                                  ? 'bg-amber-500 border-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                                  : 'bg-neutral-950 border-neutral-800 text-neutral-500'
                                }`}>
                                {activeReceiptOrder.status === 'Dimasak' || activeReceiptOrder.status === 'Selesai' ? <Check className="w-4 h-4 stroke-[3]" /> : '1'}
                              </div>
                              <span className="text-[10px] font-bold text-neutral-200">Pesanan Diterima</span>
                            </div>

                            {/* Step 2: Cooking */}
                            <div className="flex flex-col items-center text-center z-10 space-y-1.5">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 font-bold text-xs transition-all
                                ${activeReceiptOrder.status === 'Dimasak' || activeReceiptOrder.status === 'Selesai'
                                  ? 'bg-amber-500 border-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                                  : 'bg-neutral-950 border-neutral-800 text-neutral-500'
                                }
                                ${activeReceiptOrder.status === 'Dimasak' ? 'animate-pulse' : ''}
                                `}>
                                {activeReceiptOrder.status === 'Selesai' ? <Check className="w-4 h-4 stroke-[3]" /> : <Flame className="w-4 h-4" />}
                              </div>
                              <span className="text-[10px] font-bold text-neutral-200">Sedang Dimasak</span>
                            </div>

                            {/* Step 3: Finished */}
                            <div className="flex flex-col items-center text-center z-10 space-y-1.5">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 font-bold text-xs transition-all
                                ${activeReceiptOrder.status === 'Selesai'
                                  ? 'bg-amber-500 border-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                                  : 'bg-neutral-950 border-neutral-800 text-neutral-500'
                                }`}>
                                {activeReceiptOrder.status === 'Selesai' ? <CheckCircle2 className="w-4 h-4" /> : '3'}
                              </div>
                              <span className="text-[10px] font-bold text-neutral-200">Selesai Disajikan</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Order Details list */}
                      <div className="space-y-4 pt-4 border-t border-neutral-900">
                        <div className="flex items-center justify-between text-xs text-neutral-400">
                          <span>Pemesan: <strong className="text-white">{activeReceiptOrder.customerName}</strong></span>
                          <span>Meja: <strong className="text-amber-500 font-bold">{activeReceiptOrder.tableNumber}</strong></span>
                        </div>

                        <div className="space-y-3 bg-neutral-900/40 p-4 rounded-xl border border-neutral-900">
                          {activeReceiptOrder.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-start gap-4 text-xs">
                              <div className="space-y-0.5">
                                <p className="font-bold text-neutral-200">
                                  {item.menuItem.name} <span className="text-amber-500 font-mono text-[11px]">x{item.quantity}</span>
                                </p>
                                {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                                  <p className="text-[10px] text-neutral-400">
                                    {Object.entries(item.selectedOptions).map(([k, v]) => `${k}: ${v}`).join(', ')}
                                  </p>
                                )}
                                {item.notes && (
                                  <p className="text-[10px] text-amber-500/80 italic font-medium">Catatan: "{item.notes}"</p>
                                )}
                              </div>
                              <span className="font-mono text-neutral-300 shrink-0">
                                {formatRupiah(item.menuItem.price * item.quantity)}
                              </span>
                            </div>
                          ))}

                          <div className="border-t border-neutral-800/60 my-2 pt-2 space-y-1.5 text-[11px] text-neutral-400">
                            <div className="flex justify-between">
                              <span>Subtotal:</span>
                              <span>{formatRupiah(activeReceiptOrder.subtotal)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Pajak (10%):</span>
                              <span>{formatRupiah(activeReceiptOrder.tax)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Biaya Layanan Meja:</span>
                              <span>{formatRupiah(activeReceiptOrder.serviceCharge)}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold text-white pt-1 border-t border-neutral-800/40">
                              <span>Total Pembayaran ({activeReceiptOrder.paymentMethod}):</span>
                              <span className="text-amber-500">{formatRupiah(activeReceiptOrder.total)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Friendly instruction */}
                        <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl text-center">
                          <p className="text-[11px] text-neutral-400 leading-relaxed">
                            {activeReceiptOrder.status === 'Antrian' && 'Silakan bersantai sejenak, tim kami sedang mempersiapkan pesanan Anda.'}
                            {activeReceiptOrder.status === 'Dimasak' && 'Koki kami sedang memasak pesanan Anda dengan bahan berkualitas terbaik!'}
                            {activeReceiptOrder.status === 'Selesai' && (
                              activeReceiptOrder.paymentStatus === 'Lunas'
                                ? 'Pesanan Anda telah disajikan! Selamat menikmati hidangan Anda.'
                                : 'Selamat menikmati! Menunggu pembayaran.'
                            )}
                            {activeReceiptOrder.status === 'Dibatalkan' && 'Pesanan ini telah dibatalkan. Silakan hubungi kasir atau pelayan jika ada kendala.'}
                          </p>
                        </div>

                        {/* Interactive Payment Details (If not paid) */}
                        {activeReceiptOrder.paymentStatus === 'Belum Bayar' && activeReceiptOrder.status !== 'Dibatalkan' && (
                          <div className="space-y-3.5 pt-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {activeReceiptOrder.paymentMethod === 'TRANSFER' && (
                              <div className="bg-neutral-900 border border-amber-500/20 rounded-xl p-4 text-left space-y-2.5">
                                <span className="block text-[10px] font-bold text-amber-500 uppercase tracking-wider">Silakan Transfer ke Rekening Pemilik Warung:</span>
                                <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 text-xs text-neutral-300 space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-neutral-500">Nama Bank / E-Wallet:</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-white">{bankName}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard.writeText(bankName);
                                          alert('Nama Bank disalin!');
                                        }}
                                        className="p-1 hover:bg-neutral-900 text-neutral-400 hover:text-white rounded transition-colors"
                                        title="Salin Nama Bank"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-neutral-500">Nomor Rekening / HP:</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-bold text-amber-500 text-sm tracking-wider">{bankAccount}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard.writeText(bankAccount.replace(/\s/g, ''));
                                          alert('Nomor Rekening/HP disalin!');
                                        }}
                                        className="p-1 hover:bg-neutral-900 text-neutral-400 hover:text-white rounded transition-colors"
                                        title="Salin Nomor Rekening"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-neutral-500">Atas Nama (A.N.):</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-neutral-200">{bankHolder}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard.writeText(bankHolder);
                                          alert('Atas Nama Penerima disalin!');
                                        }}
                                        className="p-1 hover:bg-neutral-900 text-neutral-400 hover:text-white rounded transition-colors"
                                        title="Salin Atas Nama"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex justify-between items-center pt-1.5 border-t border-neutral-900">
                                    <span className="text-neutral-400 font-semibold">Total Transfer:</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-bold text-amber-500">{formatRupiah(activeReceiptOrder.total)}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard.writeText(activeReceiptOrder.total.toString());
                                          alert('Nominal Transfer disalin!');
                                        }}
                                        className="p-1 hover:bg-neutral-900 text-neutral-400 hover:text-white rounded transition-colors"
                                        title="Salin Nominal Transfer"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const text = `INFO TRANSFER WARUNG\nBank: ${bankName}\nNo Rekening: ${bankAccount}\nAtas Nama: ${bankHolder}\nNominal: ${formatRupiah(activeReceiptOrder.total)}`;
                                      navigator.clipboard.writeText(text);
                                      alert('Seluruh rincian info transfer berhasil disalin!');
                                    }}
                                    className="w-full mt-2 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg text-[10px] font-bold text-amber-400 transition-colors flex items-center justify-center gap-1"
                                  >
                                    <Copy className="w-3 h-3" />
                                    <span>Salin Semua Info Rekening</span>
                                  </button>
                                </div>
                                <div className="p-2.5 bg-amber-500/5 rounded-lg border border-amber-500/10 text-[10px] text-neutral-400 leading-relaxed">
                                  📌 <strong className="text-neutral-300">Konfirmasi Pembayaran:</strong> Setelah melakukan transfer, harap berikan bukti transfer kepada pelayan kasir Anda agar status pesanan dapat diperbarui menjadi <strong>Lunas</strong> di sistem.
                                </div>
                              </div>
                            )}

                            {activeReceiptOrder.paymentMethod === 'QRIS' && (
                              <div className="bg-neutral-900 border border-teal-500/20 rounded-xl p-4 text-left space-y-3">
                                <span className="block text-[10px] font-bold text-teal-400 uppercase tracking-wider">Bayar Instan Lewat QRIS GPN:</span>
                                <p className="text-[11px] text-neutral-300 leading-relaxed">
                                  Silakan klik tombol di bawah untuk menampilkan kode QRIS dinamis warung kami senilai <strong className="text-amber-500">{formatRupiah(activeReceiptOrder.total)}</strong>.
                                </p>
                                <button
                                  onClick={() => {
                                    setPendingQrisOrder(activeReceiptOrder);
                                    setShowQrisModal(true);
                                  }}
                                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
                                >
                                  <span>Buka Barcode QRIS</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                      </div>

                    </div>
                  ) : (
                    <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-12 text-center space-y-4">
                      <Utensils className="w-12 h-12 text-neutral-700 mx-auto stroke-1" />
                      <div className="space-y-1.5">
                        <h4 className="text-sm font-bold text-white">Lihat Detail Status Pesanan</h4>
                        <p className="text-xs text-neutral-400 max-w-xs mx-auto leading-relaxed">
                          Pilih salah satu pesanan di daftar riwayat Anda untuk melihat detail proses pembuatan makanan dan rincian transaksi secara lengkap.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

            </div>
          )
        )}

        {/* MERCHANT / KITCHEN QUEUE MODE */}
        {currentView === 'merchant' && (
          <div className="animate-in fade-in duration-300">
            {!isAdminAuthenticated ? (
              <div className="max-w-md mx-auto bg-neutral-950 border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 flex flex-col items-center">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl">
                  <Lock className="w-8 h-8" />
                </div>
                
                <div className="text-center space-y-2 w-full">
                  <h2 className="text-xl font-bold text-white tracking-tight">Kata Sandi Admin</h2>
                  <p className="text-xs text-neutral-400">Masuk ke panel administrasi dapur dan kasir.</p>
                </div>

                {pinError && (
                  <div className="w-full p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center rounded-xl font-medium">
                    {pinError}
                  </div>
                )}

                <form onSubmit={handlePinSubmit} className="w-full space-y-4">
                  <input
                    type="password"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="Masukkan kata sandi..."
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-amber-500 rounded-xl px-4 py-3 text-white placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all text-center tracking-widest font-medium"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold rounded-xl transition-colors shadow-lg shadow-amber-500/20"
                  >
                    Buka Panel Admin
                  </button>
                </form>

                <button
                  onClick={() => setCurrentView('customer')}
                  className="text-xs text-neutral-500 hover:text-amber-500 font-medium pt-3 transition-colors"
                >
                  Kembali ke Menu Pemesanan
                </button>
              </div>
            ) : (
              <KitchenPanel 
                menuItems={menuItems}
                onToggleMenuItemAvailability={handleToggleMenuItemAvailability}
                orders={orders} 
                onUpdateStatus={handleKitchenUpdateStatus} 
                onClearAll={handleClearKitchenOrders}
                onOpenAddMenu={() => setIsAddMenuOpen(true)}
                spreadsheetUrl={spreadsheetUrl}
                spreadsheetId={spreadsheetId}
                isSyncingSheets={isSyncingSheets}
                onSyncSheets={handleSyncSheets}
                googleUser={googleUser}
                onLogoutGoogle={handleLogoutGoogle}
                tables={tables}
                onUpdateTables={async (newTables) => {
                  setTables(newTables);
                  const savedId = localStorage.getItem('warung_spreadsheet_id');
                  const prefix = savedId ? `_${savedId}` : '';
                  localStorage.setItem(`warung_tables_list${prefix}`, JSON.stringify(newTables));
                  
                  const token = await getAccessToken();
                  if (savedId && token) {
                    try {
                      await syncTablesToSheet(savedId, token, newTables);
                      setSyncNotification({
                        type: 'success',
                        message: 'Daftar meja berhasil disinkronkan ke Google Sheets!'
                      });
                    } catch (err) {
                      console.error('Gagal sinkronisasi data meja ke Google Sheets:', err);
                    }
                  }
                }}
                bankName={bankName}
                bankAccount={bankAccount}
                bankHolder={bankHolder}
                warungName={warungName}
                warungTagline={warungTagline}
                onUpdatePaymentSettings={async (newBankName, newBankAccount, newBankHolder, newWarungName, newWarungTagline) => {
                  setBankName(newBankName);
                  setBankAccount(newBankAccount);
                  setBankHolder(newBankHolder);
                  setWarungName(newWarungName);
                  setWarungTagline(newWarungTagline);
                  
                  const savedId = localStorage.getItem('warung_spreadsheet_id');
                  const prefix = savedId ? `_${savedId}` : '';
                  localStorage.setItem(`warung_bank_name${prefix}`, newBankName);
                  localStorage.setItem(`warung_bank_account${prefix}`, newBankAccount);
                  localStorage.setItem(`warung_bank_holder${prefix}`, newBankHolder);
                  localStorage.setItem(`warung_name${prefix}`, newWarungName);
                  localStorage.setItem(`warung_tagline${prefix}`, newWarungTagline);

                  const token = await getAccessToken();
                  if (savedId && token) {
                    try {
                      await syncPaymentSettingsToSheet(savedId, token, {
                        bankName: newBankName,
                        bankAccount: newBankAccount,
                        bankHolder: newBankHolder,
                        warungName: newWarungName,
                        warungTagline: newWarungTagline
                      });
                      setSyncNotification({
                        type: 'success',
                        message: 'Data identitas warung & rekening berhasil disinkronkan ke Google Sheets!'
                      });
                    } catch (err) {
                      console.error('Gagal sinkronisasi data identitas & rekening ke Google Sheets:', err);
                    }
                  }
                }}
                appBalance={appBalance}
                onUpdateBalance={(newVal) => setAppBalance(newVal)}
                onResetAllData={handleResetAllData}
              />
            )}
          </div>
        )}

        {/* Floating Mobile Cart Banner */}
        {currentView === 'customer' && customerTab === 'menu' && cart.length > 0 && (
          <div className="lg:hidden fixed bottom-6 left-4 right-4 z-40 animate-in slide-in-from-bottom duration-300">
            <button
              onClick={() => {
                document.getElementById('input-customer-name')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl shadow-2xl flex items-center justify-between border border-amber-400/20 active:scale-95 transition-all"
            >
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-neutral-950 fill-current" />
                <span className="font-extrabold">{cart.reduce((sum, i) => sum + i.quantity, 0)} Item</span>
                <span className="opacity-45">|</span>
                <span className="font-black">{formatRupiah(cartTotal)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>Pesan Sekarang</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </div>
            </button>
          </div>
        )}

      </main>

      {/* FOOTER BRANDS */}
      <footer className="bg-neutral-950 border-t border-neutral-800/80 py-8 text-center text-xs text-neutral-500 mt-12">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="font-semibold text-neutral-400">Warung Rasa Nusantara &copy; 2026. Semua Hak Dilindungi.</p>
          <p className="text-[11px] text-neutral-600">
            Sistem Menu Mandiri (Self-Service) dioptimalkan untuk Cloudflare Pages, Netlify, atau Vercel.
          </p>
        </div>
      </footer>

      {/* --- MODAL 1: ITEM CUSTOMIZER OPTIONS DIALOG --- */}
      {selectedCustomizeItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl max-w-md w-full max-h-[92vh] overflow-y-auto shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-200 scrollbar-thin scrollbar-thumb-neutral-800">
            
            {/* Modal Heading Banner */}
            <div className="relative h-44 bg-neutral-900">
              <img 
                src={selectedCustomizeItem.image} 
                alt={selectedCustomizeItem.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 to-transparent" />
              <button 
                onClick={() => setSelectedCustomizeItem(null)}
                className="absolute top-4 right-4 w-7 h-7 bg-neutral-950/80 hover:bg-neutral-900 border border-neutral-800 rounded-full flex items-center justify-center text-white text-xs transition-colors"
                id="btn-close-customizer"
              >
                ✕
              </button>
            </div>

            {/* Modal Content body */}
            <div className="p-6 space-y-5">
              
              <div>
                <h3 className="text-lg font-bold text-white">{selectedCustomizeItem.name}</h3>
                <p className="text-xs text-neutral-400 mt-1">{selectedCustomizeItem.description}</p>
                <span className="inline-block font-black text-amber-500 text-lg mt-2">
                  {formatRupiah(selectedCustomizeItem.price)}
                </span>
              </div>

              {/* Dynamic Option Inputs */}
              {selectedCustomizeItem.options && (
                <div className="space-y-4 pt-1">
                  {selectedCustomizeItem.options.map((option) => (
                    <div key={option.name} className="space-y-2">
                      <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                        {option.name} {option.required && <span className="text-rose-500">*</span>}
                      </label>
                      <div className="flex flex-col gap-1.5">
                        {option.choices.map((choice) => {
                          const isSelected = customOptions[option.name] === choice;
                          return (
                            <label
                              key={choice}
                              className={`px-3 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer flex items-center justify-between transition-all
                                ${isSelected 
                                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' 
                                  : 'bg-neutral-900/50 border-neutral-900 text-neutral-400 hover:border-neutral-800 hover:text-white'
                                }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`opt-${option.name}`}
                                  value={choice}
                                  checked={isSelected}
                                  onChange={() => setCustomOptions(prev => ({ ...prev, [option.name]: choice }))}
                                  className="accent-amber-500"
                                />
                                <span>{choice}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Special chef notes */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Catatan Khusus Koki (Opsional)
                </label>
                <input
                  type="text"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Contoh: pedas sedang, tanpa sayur kol, pisah sambal, dll."
                  className="w-full px-3 py-2.5 bg-neutral-900 border border-neutral-900 rounded-xl text-xs focus:outline-none focus:border-amber-500 text-white placeholder-neutral-600"
                />
              </div>

              {/* Counter quantity and submit */}
              <div className="pt-4 border-t border-neutral-900 flex items-center justify-between gap-4">
                <div className="flex items-center bg-neutral-900 border border-neutral-800 p-1 rounded-xl">
                  <button
                    onClick={() => setCustomQty(prev => Math.max(1, prev - 1))}
                    className="w-8 h-8 rounded-lg hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center text-sm font-black text-white font-mono">{customQty}</span>
                  <button
                    onClick={() => setCustomQty(prev => prev + 1)}
                    className="w-8 h-8 rounded-lg hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all"
                  id="btn-confirm-add-to-cart"
                >
                  Tambah Ke Keranjang
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* --- MODAL 2: DYNAMIC QRIS SIMULATOR MODAL --- */}
      {showQrisModal && pendingQrisOrder && (
        <QrisModal 
          amount={pendingQrisOrder.total} 
          orderId={pendingQrisOrder.id} 
          onPaymentSuccess={handleQrisPaymentSuccess}
          onClose={() => {
            setShowQrisModal(false);
            setPendingQrisOrder(null);
          }}
        />
      )}

      {/* --- MODAL 3: FINALIZE ORDER RECEIPT PRINT VIEW --- */}
      {activeReceiptOrder && (
        <OrderReceipt 
          order={activeReceiptOrder} 
          onClose={() => setActiveReceiptOrder(null)} 
        />
      )}

      {/* --- MODAL 4: ADD MENU ITEM DIALOG --- */}
      <AddMenuItemModal 
        isOpen={isAddMenuOpen}
        onClose={() => setIsAddMenuOpen(false)}
        onAdd={handleAddMenuItem}
      />

      {/* --- TOAST NOTIFICATION --- */}
      {syncNotification && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom duration-300">
          <div className={`px-4 py-3 rounded-xl border flex items-center gap-2.5 shadow-2xl text-xs font-semibold
            ${syncNotification.type === 'success' ? 'bg-emerald-950 border-emerald-900 text-emerald-400' : ''}
            ${syncNotification.type === 'error' ? 'bg-rose-950 border-rose-900 text-rose-400' : ''}
            ${syncNotification.type === 'info' ? 'bg-neutral-900 border-neutral-800 text-amber-400' : ''}
          `}>
            {syncNotification.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {syncNotification.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
            {syncNotification.type === 'info' && <RefreshCw className="w-4 h-4 animate-spin shrink-0" />}
            <span>{syncNotification.message}</span>
            <button 
              onClick={() => setSyncNotification(null)} 
              className="ml-1.5 p-0.5 hover:text-white hover:bg-neutral-800/50 rounded transition-all shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
