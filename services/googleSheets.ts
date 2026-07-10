import { MenuItem, TopupRequest } from '../types';
import { WARUNG_MENU_ITEMS } from '../data';

// Google Drive API files search endpoint
const DRIVE_SEARCH_URL = "https://www.googleapis.com/drive/v3/files";
// Google Sheets API endpoint
const SHEETS_BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets";

export interface SyncResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  menuItems: MenuItem[];
}

/**
 * Unified error response handler to parse detailed Google API error messages.
 */
async function handleResponseError(response: Response, prefix: string): Promise<never> {
  let errorDetail = '';
  try {
    const errJson = await response.json();
    errorDetail = errJson.error?.message || JSON.stringify(errJson);
  } catch (e) {
    try {
      errorDetail = await response.text();
    } catch (_) {
      errorDetail = response.statusText || String(response.status);
    }
  }
  throw new Error(`${prefix}: ${errorDetail}`);
}

/**
 * Searches for an existing Warung Menu Sheet or creates a new one seeded with default menu items.
 */
export async function getOrCreateMenuSpreadsheet(accessToken: string): Promise<SyncResult> {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  try {
    // 1. Search for existing sheet in Google Drive
    const query = encodeURIComponent("name='Warung_Nusantara_Menu_Sheet' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
    const searchRes = await fetch(`${DRIVE_SEARCH_URL}?q=${query}`, { headers });
    
    if (!searchRes.ok) {
      await handleResponseError(searchRes, 'Drive search failed');
    }
    
    const searchData = await searchRes.json();
    let spreadsheetId = '';

    if (searchData.files && searchData.files.length > 0) {
      // Sheet already exists
      spreadsheetId = searchData.files[0].id;
      console.log('Found existing spreadsheet:', spreadsheetId);
      
      // Load current menu items from it
      const menuItems = await loadMenuItemsFromSheet(spreadsheetId, accessToken);
      return {
        spreadsheetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        menuItems
      };
    } else {
      // Sheet does not exist, create a new one
      console.log('No existing spreadsheet found. Creating a new one...');
      const createRes = await fetch(SHEETS_BASE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          properties: {
            title: "Warung_Nusantara_Menu_Sheet"
          }
        })
      });

      if (!createRes.ok) {
        await handleResponseError(createRes, 'Spreadsheet creation failed');
      }

      const createData = await createRes.json();
      spreadsheetId = createData.spreadsheetId;
      console.log('Created new spreadsheet with ID:', spreadsheetId);

      // Seed the sheet with headers and default items
      await seedSpreadsheet(spreadsheetId, accessToken);

      return {
        spreadsheetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        menuItems: WARUNG_MENU_ITEMS
      };
    }
  } catch (error) {
    console.error('Error in getOrCreateMenuSpreadsheet:', error);
    throw error;
  }
}

/**
 * Seeds a new spreadsheet with headers and default items
 */
async function seedSpreadsheet(spreadsheetId: string, accessToken: string): Promise<void> {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  const rows = [
    ["ID", "Name", "Category", "Description", "Price", "Image URL", "Tags", "Options", "Status Ketersediaan"],
    ...WARUNG_MENU_ITEMS.map(item => [
      item.id,
      item.name,
      item.category,
      item.description,
      item.price,
      item.image,
      item.tags.join(','),
      JSON.stringify(item.options || []),
      item.isAvailable !== false ? "Tersedia" : "Habis"
    ])
  ];

  const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values/Sheet1!A1:I?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      range: "Sheet1!A1:I",
      majorDimension: "ROWS",
      values: rows
    })
  });

  if (!res.ok) {
    await handleResponseError(res, 'Failed to seed spreadsheet');
  }
  console.log('Seeded spreadsheet successfully!');
}

/**
 * Loads menu items from the spreadsheet
 */
export async function loadMenuItemsFromSheet(spreadsheetId: string, accessToken: string): Promise<MenuItem[]> {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
  };

  const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values/Sheet1!A2:I?majorDimension=ROWS`;
  const res = await fetch(url, { headers });

  if (!res.ok) {
    await handleResponseError(res, 'Failed to read spreadsheet values');
  }

  const data = await res.json();
  if (!data.values || data.values.length === 0) {
    return [];
  }

  const parsedItems: MenuItem[] = data.values.map((row: any[]) => {
    // Ensure all row cells are filled or default
    const id = parseInt(row[0] || '0', 10);
    const name = row[1] || 'Menu Tanpa Nama';
    const category = (row[2] || 'makanan') as MenuItem['category'];
    const description = row[3] || '';
    const price = parseInt(row[4] || '0', 10);
    const image = row[5] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';
    const tags = row[6] ? row[6].split(',').map((t: string) => t.trim()).filter(Boolean) : [];
    
    let options = undefined;
    if (row[7]) {
      try {
        options = JSON.parse(row[7]);
      } catch (e) {
        console.warn('Gagal memproses opsi kustom untuk menu:', name, e);
      }
    }

    const isAvailable = row[8] !== 'Habis' && row[8] !== 'false';

    return {
      id,
      name,
      category,
      description,
      price,
      image,
      tags,
      isAvailable,
      options
    };
  }).filter((item: MenuItem) => item.id > 0);

  return parsedItems;
}

/**
 * Appends a new menu item to the spreadsheet
 */
export async function addMenuItemToSheet(
  spreadsheetId: string, 
  accessToken: string, 
  newItem: MenuItem
): Promise<void> {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  const row = [
    newItem.id,
    newItem.name,
    newItem.category,
    newItem.description,
    newItem.price,
    newItem.image,
    newItem.tags.join(','),
    JSON.stringify(newItem.options || []),
    newItem.isAvailable !== false ? "Tersedia" : "Habis"
  ];

  const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values/Sheet1!A:I:append?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      range: "Sheet1!A:I",
      majorDimension: "ROWS",
      values: [row]
    })
  });

  if (!res.ok) {
    await handleResponseError(res, 'Failed to add menu item to sheet');
  }
  console.log('Added item to Google Sheets successfully:', newItem.name);
}

/**
 * Overwrites the entire menu items sheet with the current state (useful for toggling availability)
 */
export async function syncMenuItemsToSheet(
  spreadsheetId: string,
  accessToken: string,
  menuItems: MenuItem[]
): Promise<void> {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  const rows = [
    ["ID", "Name", "Category", "Description", "Price", "Image URL", "Tags", "Options", "Status Ketersediaan"],
    ...menuItems.map(item => [
      item.id,
      item.name,
      item.category,
      item.description,
      item.price,
      item.image,
      item.tags.join(','),
      JSON.stringify(item.options || []),
      item.isAvailable !== false ? "Tersedia" : "Habis"
    ])
  ];

  const encodedClearRange = encodeURIComponent("Sheet1!A1:I1000");
  const clearUrl = `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodedClearRange}:clear`;
  try {
    await fetch(clearUrl, {
      method: 'POST',
      headers
    });
  } catch (err) {
    console.warn('Silent clear failed:', err);
  }

  const encodedWriteRange = encodeURIComponent("Sheet1!A1:I");
  const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodedWriteRange}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      range: "Sheet1!A1:I",
      majorDimension: "ROWS",
      values: rows
    })
  });

  if (!res.ok) {
    await handleResponseError(res, 'Failed to sync menu items to spreadsheet');
  }
  console.log('Synced all menu items to Google Sheets successfully!');
}

/**
 * Synchronizes the list of tables/seating to a dedicated sheet tab "Daftar_Meja" inside the spreadsheet.
 * Creates the tab if it doesn't exist.
 */
export async function syncTablesToSheet(
  spreadsheetId: string,
  accessToken: string,
  tables: string[]
): Promise<void> {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  try {
    // 1. Fetch spreadsheet metadata to check if "Daftar_Meja" sheet exists
    const metaRes = await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}`, { headers });
    if (!metaRes.ok) {
      await handleResponseError(metaRes, 'Failed to fetch spreadsheet metadata');
    }
    const metaData = await metaRes.json();
    const sheets = metaData.sheets || [];
    const hasDaftarMeja = sheets.some((s: any) => s.properties.title === 'Daftar_Meja');

    // 2. If it doesn't exist, create it
    if (!hasDaftarMeja) {
      console.log('Creating "Daftar_Meja" sheet tab...');
      const addSheetRes = await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'Daftar_Meja'
                }
              }
            }
          ]
        })
      });
      if (!addSheetRes.ok) {
        await handleResponseError(addSheetRes, 'Failed to create "Daftar_Meja" sheet');
      }
    }

    // 3. Prepare data rows
    const rows = [
      ["No", "Nama Meja / Tipe Layanan"],
      ...tables.map((table, index) => [index + 1, table])
    ];

    // 4. Clear previous values first to avoid leaving leftovers if the new list is shorter
    const encodedClearRange = encodeURIComponent("Daftar_Meja!A1:B");
    const clearUrl = `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodedClearRange}:clear`;
    const clearRes = await fetch(clearUrl, {
      method: 'POST',
      headers
    });
    if (!clearRes.ok) {
      await handleResponseError(clearRes, 'Failed to clear "Daftar_Meja" sheet tab');
    }

    // 5. Overwrite values in "Daftar_Meja" sheet
    const encodedWriteRange = encodeURIComponent("Daftar_Meja!A1:B");
    const writeUrl = `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodedWriteRange}?valueInputOption=USER_ENTERED`;
    const writeRes = await fetch(writeUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        range: "Daftar_Meja!A1:B",
        majorDimension: "ROWS",
        values: rows
      })
    });

    if (!writeRes.ok) {
      await handleResponseError(writeRes, 'Failed to write tables to "Daftar_Meja"');
    }
    console.log('Tables synced to Google Sheets successfully!');
  } catch (error) {
    console.error('Error in syncTablesToSheet:', error);
    throw error;
  }
}

/**
 * Loads table list from the "Daftar_Meja" sheet if it exists
 */
export async function loadTablesFromSheet(spreadsheetId: string, accessToken: string): Promise<string[] | null> {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
  };

  try {
    const metaRes = await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}`, { headers });
    if (!metaRes.ok) return null;
    const metaData = await metaRes.json();
    const sheets = metaData.sheets || [];
    const hasDaftarMeja = sheets.some((s: any) => s.properties.title === 'Daftar_Meja');
    if (!hasDaftarMeja) return null;

    const encodedRange = encodeURIComponent("Daftar_Meja!B2:B");
    const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodedRange}?majorDimension=ROWS`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.values || data.values.length === 0) {
      return null;
    }

    return data.values.map((row: any[]) => row[0]).filter(Boolean);
  } catch (e) {
    console.warn('Error loading tables from sheet:', e);
    return null;
  }
}

/**
 * Synchronizes payment and warung settings to a dedicated sheet tab "Pengaturan_Pembayaran" inside the spreadsheet.
 */
export async function syncPaymentSettingsToSheet(
  spreadsheetId: string,
  accessToken: string,
  settings: { bankName: string; bankAccount: string; bankHolder: string; warungName: string; warungTagline: string }
): Promise<void> {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  try {
    // 1. Fetch spreadsheet metadata to check if tab exists
    const metaRes = await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}`, { headers });
    if (!metaRes.ok) return;
    const metaData = await metaRes.json();
    const sheets = metaData.sheets || [];
    const hasTab = sheets.some((s: any) => s.properties.title === 'Pengaturan_Pembayaran');

    // 2. If it doesn't exist, create it
    if (!hasTab) {
      console.log('Creating "Pengaturan_Pembayaran" sheet tab...');
      await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'Pengaturan_Pembayaran'
                }
              }
            }
          ]
        })
      });
    }

    // 3. Prepare data rows
    const rows = [
      ["Kunci Pengaturan", "Nilai"],
      ["Nama Bank", settings.bankName],
      ["Nomor Rekening", settings.bankAccount],
      ["Atas Nama", settings.bankHolder],
      ["Nama Warung", settings.warungName],
      ["Slogan Warung", settings.warungTagline]
    ];

    // 4. Overwrite values in "Pengaturan_Pembayaran" sheet
    const encodedRange = encodeURIComponent("Pengaturan_Pembayaran!A1:B6");
    const writeUrl = `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`;
    await fetch(writeUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        range: "Pengaturan_Pembayaran!A1:B6",
        majorDimension: "ROWS",
        values: rows
      })
    });
    console.log('Payment & Warung settings synced successfully!');
  } catch (error) {
    console.error('Error in syncPaymentSettingsToSheet:', error);
  }
}

/**
 * Loads payment and warung settings from the "Pengaturan_Pembayaran" sheet
 */
export async function loadPaymentSettingsFromSheet(
  spreadsheetId: string,
  accessToken: string
): Promise<{ bankName: string; bankAccount: string; bankHolder: string; warungName: string; warungTagline: string } | null> {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
  };

  try {
    const metaRes = await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}`, { headers });
    if (!metaRes.ok) return null;
    const metaData = await metaRes.json();
    const sheets = metaData.sheets || [];
    const hasTab = sheets.some((s: any) => s.properties.title === 'Pengaturan_Pembayaran');
    if (!hasTab) return null;

    const encodedRange = encodeURIComponent("Pengaturan_Pembayaran!A1:B6");
    const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodedRange}?majorDimension=ROWS`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.values || data.values.length < 2) {
      return null;
    }

    const settings: any = {};
    data.values.forEach((row: any[]) => {
      if (!row || row.length < 2) return;
      if (row[0] === 'Nama Bank') settings.bankName = row[1];
      if (row[0] === 'Nomor Rekening') settings.bankAccount = row[1];
      if (row[0] === 'Atas Nama') settings.bankHolder = row[1];
      if (row[0] === 'Nama Warung') settings.warungName = row[1];
      if (row[0] === 'Slogan Warung') settings.warungTagline = row[1];
    });

    if (settings.bankName || settings.bankAccount || settings.bankHolder || settings.warungName || settings.warungTagline) {
      return {
        bankName: settings.bankName || 'Bank BCA',
        bankAccount: settings.bankAccount || '8012-3456-78',
        bankHolder: settings.bankHolder || 'Warung Kita (Slamet)',
        warungName: settings.warungName || 'Warung Nusantara',
        warungTagline: settings.warungTagline || 'Cita Rasa Tradisional'
      };
    }
    return null;
  } catch (e) {
    console.warn('Error loading settings from sheet:', e);
    return null;
  }
}

/**
 * Synchronizes top-up requests to a dedicated sheet tab "Riwayat_Topup" inside the spreadsheet.
 */
export async function syncTopupRequestsToSheet(
  spreadsheetId: string,
  accessToken: string,
  requests: TopupRequest[]
): Promise<void> {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  try {
    // 1. Fetch metadata to check if "Riwayat_Topup" sheet exists
    const metaRes = await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}`, { headers });
    if (!metaRes.ok) return;
    const metaData = await metaRes.json();
    const sheets = metaData.sheets || [];
    const hasTab = sheets.some((s: any) => s.properties.title === 'Riwayat_Topup');

    // 2. If it doesn't exist, create it
    if (!hasTab) {
      console.log('Creating "Riwayat_Topup" sheet tab...');
      await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}:batchUpdate`, {
         method: 'POST',
         headers,
         body: JSON.stringify({
           requests: [
             {
               addSheet: {
                 properties: {
                   title: 'Riwayat_Topup'
                 }
               }
             }
           ]
         })
      });
    }

    // 3. Prepare data rows
    const rows = [
      ["ID Transaksi", "Nominal", "Nama Pengirim", "Bank Pengirim", "Tanggal Pengajuan", "Status", "Bukti Transfer (Base64)"],
      ...requests.map(r => [
        r.id,
        r.amount,
        r.senderName,
        r.bankSender,
        r.date,
        r.status,
        r.buktiTransfer || ''
      ])
    ];

    // 4. Clear previous values first to prevent legacy data leftover
    const encodedClearRange = encodeURIComponent("Riwayat_Topup!A1:G1000");
    const clearUrl = `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodedClearRange}:clear`;
    await fetch(clearUrl, {
      method: 'POST',
      headers
    });

    // 5. Overwrite values in "Riwayat_Topup" sheet
    const encodedWriteRange = encodeURIComponent("Riwayat_Topup!A1:G");
    const writeUrl = `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodedWriteRange}?valueInputOption=USER_ENTERED`;
    await fetch(writeUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        range: "Riwayat_Topup!A1:G",
        majorDimension: "ROWS",
        values: rows
      })
    });
    console.log('Top-up requests synced to Google Sheets successfully!');
  } catch (error) {
    console.error('Error in syncTopupRequestsToSheet:', error);
  }
}

/**
 * Loads top-up requests from the "Riwayat_Topup" sheet if it exists
 */
export async function loadTopupRequestsFromSheet(
  spreadsheetId: string,
  accessToken: string
): Promise<TopupRequest[] | null> {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
  };

  try {
    const metaRes = await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}`, { headers });
    if (!metaRes.ok) return null;
    const metaData = await metaRes.json();
    const sheets = metaData.sheets || [];
    const hasTab = sheets.some((s: any) => s.properties.title === 'Riwayat_Topup');
    if (!hasTab) return null;

    const encodedRange = encodeURIComponent("Riwayat_Topup!A2:G1000");
    const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodedRange}?majorDimension=ROWS`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.values || data.values.length === 0) {
      return null;
    }

    return data.values.map((row: any[]) => {
      return {
        id: row[0] || '',
        amount: parseInt(row[1] || '0', 10),
        senderName: row[2] || '',
        bankSender: row[3] || '',
        date: row[4] || '',
        status: (row[5] || 'PENDING') as 'PENDING' | 'APPROVED' | 'REJECTED',
        buktiTransfer: row[6] || ''
      };
    });
  } catch (e) {
    console.warn('Error loading topup requests from sheet:', e);
    return null;
  }
}


