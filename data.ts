import { MenuItem } from './types';

export const WARUNG_MENU_ITEMS: MenuItem[] = [
  {
    id: 1,
    name: "Nasi Goreng Kampung Premium",
    description: "Nasi goreng kecap gurih wangi dengan rempah ketumbar terasi tradisional khas warung, dilengkapi dengan telur dadar/mata sapi, suwiran daging ayam, acar mentimun wortel, kerupuk udang, dan sambal korek.",
    price: 26000,
    category: "makanan",
    image: "https://images.unsplash.com/photo-1601050690597-df056fb49785?w=600&auto=format&fit=crop&q=80",
    tags: ["Favorit", "Best Seller"],
    options: [
      {
        name: "Level Pedas",
        choices: ["Tidak Pedas", "Sedang (Pedas Santai)", "Sangat Pedas (Pedas Gila)"],
        required: true
      },
      {
        name: "Tipe Telur",
        choices: ["Telur Mata Sapi", "Telur Dadar", "Telur Orak-Arik (Campur)"],
        required: true
      }
    ]
  },
  {
    id: 2,
    name: "Ayam Goreng Sambal Korek",
    description: "Ayam goreng bumbu ungkep kuning tradisional Jawa yang garing krispi di luar namun tetap lembut dan juicy di dalam. Disajikan hangat bersama lalapan segar dan sambal korek bawang yang segar.",
    price: 24000,
    category: "makanan",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=600&auto=format&fit=crop&q=80",
    tags: ["Pedas", "Rekomendasi"],
    options: [
      {
        name: "Nasi Putih",
        choices: ["Tanpa Nasi", "Dengan Nasi Putih (+Rp 5.000)"],
        required: true
      },
      {
        name: "Bagian Ayam",
        choices: ["Paha Bawah / Atas", "Dada Mentok"],
        required: true
      }
    ]
  },
  {
    id: 3,
    name: "Sate Ayam Madura (10 Tusuk)",
    description: "Daging ayam segar pilihan yang dipotong dadu, dibakar wangi di atas arang batok kelapa, disiram saus kacang yang gurih legit nan kental, irisan bawang merah mentah, cabai rawit, serta kucuran jeruk limau wangi.",
    price: 28000,
    category: "makanan",
    image: "https://images.unsplash.com/photo-1529042410759-befb1204b468?w=600&auto=format&fit=crop&q=80",
    tags: ["Best Seller"],
    options: [
      {
        name: "Karbohidrat",
        choices: ["Sate Saja", "Dengan Lontong Daun (+Rp 4.000)", "Dengan Nasi Putih (+Rp 5.000)"],
        required: true
      }
    ]
  },
  {
    id: 4,
    name: "Mie Goreng Jawa Nyemek",
    description: "Mie kuning basah tebal dimasak dengan kuah sedikit yang kental (nyemek), gurih wangi bawang putih dan kemiri, diorak-arik dengan kol, sawi hijau, bakso sapi iris, telur dadar iris, serta suwiran ayam.",
    price: 19000,
    category: "makanan",
    image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&auto=format&fit=crop&q=80",
    tags: ["Favorit"],
    options: [
      {
        name: "Level Pedas",
        choices: ["Tidak Pedas", "Sedang", "Sangat Pedas"],
        required: true
      }
    ]
  },
  {
    id: 5,
    name: "Soto Ayam Lamongan Koya",
    description: "Soto ayam berkuah kuning bening gurih kaya rempah, berisikan suwiran ayam, telur rebus setengah butir, soun, tauge, kol, taburan bawang goreng seledri, dan koya kerupuk udang yang gurih nan kental.",
    price: 20000,
    category: "makanan",
    image: "https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=600&auto=format&fit=crop&q=80",
    tags: ["Rekomendasi"],
    options: [
      {
        name: "Nasi Soto",
        choices: ["Nasi Dicampur", "Nasi Dipisah (+Rp 1.000)", "Soto Saja (Tanpa Nasi)"],
        required: true
      },
      {
        name: "Porsi Koya",
        choices: ["Koya Standar", "Ekstra Koya Melimpah (+Rp 2.000)"],
        required: true
      }
    ]
  },
  {
    id: 6,
    name: "Bakso Sapi Urat Jumbo",
    description: "Satu buah bakso urat sapi asli ukuran besar yang gurih berserat dipadu dengan 3 bakso halus kenyal, tahu goreng bakso, mie kuning, bihun, tauge, dan kuah kaldu sapi pekat wangi bawang goreng seledri.",
    price: 22000,
    category: "makanan",
    image: "https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=600&auto=format&fit=crop&q=80",
    tags: ["Best Seller"],
    options: [
      {
        name: "Mie & Sayur",
        choices: ["Mie Kuning + Bihun + Sayur", "Bihun & Sayur Saja", "Hanya Bakso (Tanpa Karbo)"],
        required: true
      }
    ]
  },
  {
    id: 7,
    name: "Es Teh Manis Jumbo (Solo Style)",
    description: "Minuman sejuta umat! Seduhan daun teh wangi melati pilihan khas Solo yang terkenal pekat (kenthel), wangi melati alami, manis legit, disajikan dalam gelas kaca jumbo dengan es batu melimpah.",
    price: 5000,
    category: "minuman",
    image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop&q=80",
    tags: ["Favorit", "Segar"],
    options: [
      {
        name: "Tingkat Manis",
        choices: ["Manis Normal", "Kurang Manis", "Tawar (Tanpa Gula)"],
        required: true
      },
      {
        name: "Wadah",
        choices: ["Gelas Kaca Tradisional", "Cup Plastik Takeaway"],
        required: true
      }
    ]
  },
  {
    id: 8,
    name: "Es Jeruk Peras Murni",
    description: "Jeruk peras lokal segar berkualitas diperas langsung tanpa pemanis buatan, disajikan dengan air gula tebu asli dan es batu kristal higienis. Kaya vitamin C alami yang menyegarkan dahaga.",
    price: 9000,
    category: "minuman",
    image: "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600&auto=format&fit=crop&q=80",
    tags: ["Segar"],
    options: [
      {
        name: "Suhu",
        choices: ["Dingin dengan Es", "Hangat"],
        required: true
      }
    ]
  },
  {
    id: 9,
    name: "Kopi Susu Gula Aren Kampung",
    description: "Kopi robusta racikan khas warung dengan aroma kuat berpadu gurihnya susu evaporasi dan legit manisnya sirup gula aren asli pilihan. Sempurna sebagai teman makan siang.",
    price: 13000,
    category: "minuman",
    image: "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600&auto=format&fit=crop&q=80",
    tags: ["Kopi"],
    options: [
      {
        name: "Suhu & Es",
        choices: ["Iced (Dingin)", "Hot (Hangat Pas)"],
        required: true
      }
    ]
  },
  {
    id: 10,
    name: "Aneka Gorengan Hangat (Porsi isi 4)",
    description: "Piring gorengan legendaris yang selalu disajikan hangat: berisi kombinasi tempe mendoan gurih ketumbar dan bakwan sayur renyah garing, dilengkapi dengan cabai rawit hijau dan kecap manis pedas.",
    price: 10000,
    category: "cemilan",
    image: "https://images.unsplash.com/photo-1569562211093-4ed0d0758f12?w=600&auto=format&fit=crop&q=80",
    tags: ["Cemilan", "Favorit"],
    options: [
      {
        name: "Kombinasi Gorengan",
        choices: ["Kombinasi Campur (2 Tempe + 2 Bakwan)", "Tempe Mendoan Semua", "Bakwan Sayur Semua"],
        required: true
      }
    ]
  },
  {
    id: 11,
    name: "Pisang Goreng Keju Cokelat",
    description: "Pisang kepok tua matang manis digoreng tepung renyah, disajikan hangat dengan limpahan keju cheddar gurih diparut halus, taburan cokelat meises, dan siraman kental manis putih.",
    price: 12000,
    category: "cemilan",
    image: "https://images.unsplash.com/photo-1569562211093-4ed0d0758f12?w=600&auto=format&fit=crop&q=80",
    tags: ["Cemilan", "Manis"],
    options: [
      {
        name: "Topping Tambahan",
        choices: ["Keju & Cokelat Standar", "Ekstra Keju Parut (+Rp 2.000)", "Polos (Hanya Pisang Goreng)"],
        required: true
      }
    ]
  },
  {
    id: 12,
    name: "Paket Nasi Ayam Bakar + Es Teh",
    description: "Paket makan hemat kenyang maksimal! Berisi nasi putih pulen hangat, sepotong ayam bakar bumbu rujak kecap manis gurih, lalapan komplit daun singkong timun, sambal bajak pedas nikmat, dan segelas es teh manis jumbo.",
    price: 29000,
    category: "paket",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=600&auto=format&fit=crop&q=80",
    tags: ["Hemat Komplit", "Rekomendasi"],
    options: [
      {
        name: "Potongan Ayam",
        choices: ["Paha Gurih Lembut", "Dada Tebal Padat"],
        required: true
      }
    ]
  }
];

export const TABLES_LIST = [
  "Meja 1", "Meja 2", "Meja 3", "Meja 4", "Meja 5", "Meja 6", "Meja 7", "Meja 8", "Meja 9", "Meja 10", "Meja 11", "Meja 12", "Bawa Pulang (Takeaway)"
];
