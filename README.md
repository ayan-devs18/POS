# Counter POS

A simple point-of-sale (billing) system for a restaurant counter. It runs in the browser, works offline, and prints 80 mm thermal receipts. No server, no database, no monthly fees.

## What it does

- **Billing**: tap menu items (or search and press Enter), set order type and table, add a discount, and save. Bills are numbered automatically.
- **Payments**: Cash (with change calculation), Card / Bank (with optional reference), or Credit to a named customer.
- **Receipts**: printed on any 80 mm thermal printer installed in Windows. Reprint any old bill.
- **Void bills** with a required reason. Voided bills stay visible but are excluded from totals.
- **Credit customers**: balance per customer, full ledger, and "Receive payment" in cash or bank.
- **Sales report** for any date range: total sales, cash in drawer, card/bank, receivables outstanding, item-wise sales, and a summary journal (Dr Cash / Bank / Receivable, Cr Sales / Sales tax payable).
- **Day-end slip** printed on the receipt printer; **CSV export** for Excel.
- **Menu editor**: categories, items, prices, hide/show items. Old bills keep the price they were sold at.
- **Sales tax** (optional): separate rates for cash and card bills.
- **Backup / restore** as a JSON file.

Inventory is intentionally not included (out of scope for this version).

## Running it at the restaurant

1. Open the Vercel link in **Chrome** or **Edge** on the counter PC.
2. Click the install icon in the address bar ("Install Counter POS") so it opens like a desktop app.
3. Settings → enter the restaurant name, address, phone, tax rates. Settings → **Remove sample data**.
4. Menu → replace the sample menu with the real one.
5. Set the thermal printer as the **default printer** in Windows. In the first print dialog choose the printer, paper size 80 mm, margins *None*, and untick *Headers and footers*. Chrome remembers this.
   - For printing with no dialog at all, start Chrome with `--kiosk-printing` (add it to the desktop shortcut target).

### Important: where data lives

Bills are saved in the browser on that PC (browser storage). That means:

- Data stays on that computer only. It does not sync to other PCs.
- **Do not clear browsing data** for this site.
- Take **Settings → Download backup** at the end of each day (e.g. to a USB or Google Drive).

## Development

Plain HTML/CSS/JS in a single `index.html`. No build step.

```bash
npx serve .        # or: python3 -m http.server 8080
```

`build-preview.py` creates `preview.html`, a copy without the `<head>`/`<body>` wrappers, used for the Claude artifact preview.

## Deploy

Import the GitHub repo at https://vercel.com/new and click **Deploy**. No framework, build command or output directory is needed. Every push to `main` redeploys automatically.
