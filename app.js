// Configuration
function getLowStockThreshold() {
  const saved = localStorage.getItem("low_stock_threshold");
  return saved && !isNaN(saved) ? parseInt(saved) : 25;
}

let LOW_STOCK_THRESHOLD = getLowStockThreshold();

document.addEventListener("DOMContentLoaded", () => {
  loadSuppliers();
  loadProducts();

  // Add Product Form Submit
  document.getElementById("product-form").addEventListener("submit", addProduct);

  // Search Input Handler
  const searchInput = document.getElementById("search");
  if (searchInput) {
    searchInput.addEventListener("input", e => {
      const query = e.target.value.toLowerCase();
      const products = getProducts();

      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(query) ||
        (product.supplier && product.supplier.toLowerCase().includes(query)) ||
        product.barcode.includes(query)
      );

      loadProducts(filtered);
    });
  }

  // Show All Products Button
  window.loadAllProducts = () => {
    loadProducts();
  };

  // Show Only Low Stock Products
  window.filterLowStock = () => {
    const products = getProducts().filter(p => p.quantity <= LOW_STOCK_THRESHOLD);
    loadProducts(products);
  };

  // Set Threshold Input Listener
  const thresholdInput = document.getElementById("stock-threshold");
  if (thresholdInput) {
    thresholdInput.value = LOW_STOCK_THRESHOLD;
    thresholdInput.addEventListener("change", setLowStockThreshold);
  }

  // Back to Top Button Logic
  const backToTopBtn = document.getElementById("backToTopBtn");
  if (backToTopBtn) {
    window.addEventListener("scroll", () => {
      backToTopBtn.style.display = window.scrollY > 300 ? "block" : "none";
    });

    backToTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
});

// =============
// SUPPLIERS
// =============

function getSuppliers() {
  return JSON.parse(localStorage.getItem("suppliers") || "[]");
}

function saveSuppliers(suppliers) {
  localStorage.setItem("suppliers", JSON.stringify(suppliers));
}

function loadSuppliers() {
  const suppliers = getSuppliers();
  const select = document.getElementById("supplier");
  select.innerHTML = "<option value=''>Select Supplier</option>";

  suppliers.forEach(supplier => {
    const option = document.createElement("option");
    option.value = supplier.name;
    option.textContent = supplier.name;
    select.appendChild(option);
  });
}

function addSupplier() {
  const name = document.getElementById("supplier-name").value.trim();

  if (!name) {
    alert("Supplier name is required.");
    return;
  }

  const suppliers = getSuppliers();

  if (suppliers.some(s => s.name === name)) {
    alert("A supplier with that name already exists.");
    return;
  }

  suppliers.push({ name });
  saveSuppliers(suppliers);
  loadSuppliers();
  document.getElementById("supplier-name").value = "";
}

// =============
// PRODUCTS
// =============

function getProducts() {
  const raw = localStorage.getItem("products");
  const products = raw ? JSON.parse(raw) : [];

  return products.map(product => ({
    ...product,
    quantity: parseInt(product.quantity),
    price: parseFloat(product.price),
    updated: product.updated ? new Date(product.updated).toISOString() : new Date().toISOString()
  }));
}

function saveProducts(products) {
  // Save current state to history
  const history = JSON.parse(localStorage.getItem("products_history") || "[]");
  history.unshift({
    timestamp: new Date().toISOString(),
    products: getProducts()
  });

  if (history.length > 5) history.pop(); // Keep only last 5 versions

  localStorage.setItem("products_history", JSON.stringify(history));
  localStorage.setItem("products", JSON.stringify(products));
}

function loadProducts(originalList = getProducts()) {
  const tbody = document.getElementById("product-list");
  tbody.innerHTML = "";

  if (originalList.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = "<td colspan='8'>No products added yet.</td>";
    tbody.appendChild(tr);
    document.getElementById("low-stock-alert").style.display = "none";
    updateGrandTotal([]);
    return;
  }

  let hasLowStock = false;

  originalList.forEach((product, index) => {
    if (product.quantity <= LOW_STOCK_THRESHOLD) hasLowStock = true;

    const tr = document.createElement("tr");

    const totalValue = (product.quantity * product.price).toFixed(2);

    tr.innerHTML = `
      <td>${product.name}</td>
      <td>${product.supplier || "-"}</td>
      <td>${product.barcode}</td>
      <td><input type="number" value="${product.quantity}" data-index="${index}" class="qty-input" /></td>
      <td><input type="number" value="${parseFloat(product.price).toFixed(2)}" data-index="${index}" class="price-input" /></td>
      <td>$${totalValue}</td>
      <td>${new Date(product.updated).toLocaleString()}</td>
      <td><button onclick="removeProduct(${index})">Delete</button></td>
    `;
    tbody.appendChild(tr);
  });

  // Quantity input events
  document.querySelectorAll(".qty-input").forEach(input => {
    input.addEventListener("change", e => {
      const index = parseInt(e.target.dataset.index);
      const newQty = parseInt(e.target.value);

      if (!isNaN(newQty) && newQty >= 0) {
        const products = getProducts();
        products[index].quantity = newQty;
        products[index].updated = new Date().toISOString();
        saveProducts(products);
        loadProducts();
      } else {
        alert("Please enter a valid quantity.");
        loadProducts(); // Reset invalid input
      }
    });
  });

  // Price input events
  document.querySelectorAll(".price-input").forEach(input => {
    input.addEventListener("change", e => {
      const index = parseInt(e.target.dataset.index);
      const newPrice = parseFloat(e.target.value);

      if (!isNaN(newPrice) && newPrice >= 0) {
        const products = getProducts();
        products[index].price = newPrice;
        products[index].updated = new Date().toISOString();
        saveProducts(products);
        loadProducts();
      } else {
        alert("Please enter a valid price.");
        loadProducts(); // Reset invalid input
      }
    });
  });

  document.getElementById("low-stock-alert").style.display =
    hasLowStock ? "block" : "none";

  document.getElementById("low-stock-alert").innerText =
    `⚠️ Some products have low stock (≤ ${LOW_STOCK_THRESHOLD}). Consider restocking.`;

  updateGrandTotal(originalList);
}

function addProduct(e) {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const barcode = document.getElementById("barcode").value.trim();
  const quantity = parseInt(document.getElementById("quantity").value);
  const price = parseFloat(document.getElementById("price").value);
  const supplier = document.getElementById("supplier").value;

  if (!name || !barcode || isNaN(quantity) || isNaN(price) || !supplier) {
    alert("Please fill all fields including supplier and price.");
    return;
  }

  const existingProducts = getProducts();

  // Check for duplicate barcode before adding
  const isDuplicate = existingProducts.some(p => p.barcode === barcode);
  if (isDuplicate) {
    alert("A product with this barcode already exists!");
    return;
  }

  const newProduct = {
    name,
    barcode,
    quantity,
    price,
    supplier,
    updated: new Date().toISOString()
  };

  const merged = [...existingProducts, newProduct];
  saveProducts(merged);
  loadProducts();
  document.getElementById("product-form").reset();
}

function removeProduct(index) {
  if (confirm("Are you sure you want to delete this product?")) {
    const products = getProducts();
    products.splice(index, 1);
    saveProducts(products);
    loadProducts();
  }
}

// =============
// CSV EXPORT
// =============
function exportToCSV() {
  const products = getProducts();
  if (products.length === 0) {
    alert("No products to export.");
    return;
  }

  // Choose simple format for export (no $, no quotes)
  let csvContent = "Name,Supplier,Barcode,Quantity,Price,Total Value,Last Updated\r\n";
  let grandTotal = 0;

  products.forEach(product => {
    const totalValue = (product.quantity * product.price).toFixed(2);
    grandTotal += parseFloat(totalValue);

    // Export without $ symbols
    const row = `${product.name},${product.supplier || ''},${product.barcode},${product.quantity},${product.price.toFixed(2)},${totalValue},${new Date(product.updated).toLocaleString()}`;
    csvContent += row + "\r\n";
  });

  // Add Grand Total at end
  csvContent += `\r\n,,,,,${grandTotal.toFixed(2)},,Grand Total`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8,' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "stock-export.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  alert("✅ Export completed successfully!");
}


// =============
// CSV IMPORT
// =============
function importFromCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const fileName = file.name.toLowerCase();
  const reader = new FileReader();

  function processRows(rows) {
    const productsToImport = [];
    const existingProducts = getProducts();

    // Find header row
    let headerIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const cols = rows[i].map(cell => cell.trim().toLowerCase());
      const isHeader = cols.some(col =>
        ["name", "product", "supplier", "barcode", "quantity", "price", "total value", "last updated"].includes(col)
      );
      if (isHeader) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      alert("No valid header row found in CSV.");
      return;
    }

    const headers = rows[headerIndex].map(h => h.trim().toLowerCase());

    const nameIndex = headers.indexOf("name");
    const supplierIndex = headers.indexOf("supplier");
    const barcodeIndex = headers.indexOf("barcode");
    const quantityIndex = headers.indexOf("quantity");
    const priceIndex = headers.indexOf("price");
    const updatedIndex = headers.indexOf("last updated");

    // Ensure required fields are present
    if (
      nameIndex === -1 ||
      barcodeIndex === -1 ||
      quantityIndex === -1 ||
      priceIndex === -1
    ) {
      alert("Missing required columns in CSV. Required: Name, Barcode, Quantity, Price");
      return;
    }

    // Process each data row
    for (let i = headerIndex + 1; i < rows.length; i++) {
      const cols = rows[i].map(cell => cell.trim());

      // Skip empty rows
      if (cols.every(cell => !cell)) continue;

      // Skip summary rows like "Grand Total"
      if (cols[0] === "" && cols.includes("Grand Total")) continue;

      const name = cols[nameIndex];
      const supplier = supplierIndex !== -1 ? cols[supplierIndex] : "";
      const barcode = cols[barcodeIndex];
      let quantityStr = cols[quantityIndex];
      let priceStr = cols[priceIndex];
      const updated = updatedIndex !== -1 ? cols[updatedIndex] : "";

      // Remove $ signs and commas from price
      priceStr = priceStr.replace(/[,$]/g, "").replace(/^\$?(\d+\.?\d*)$/, "$1");

      const quantity = parseInt(quantityStr);
      const price = parseFloat(priceStr);

      if (!isNaN(quantity) && !isNaN(price) && barcode) {
        // Skip if barcode already exists
        const isDuplicate = existingProducts.some(p => p.barcode === barcode);
        if (!isDuplicate) {
          productsToImport.push({
            name,
            supplier,
            barcode,
            quantity,
            price,
            updated: updated ? new Date(updated).toISOString() : new Date().toISOString()
          });
        }
      }
    }

    if (productsToImport.length === 0) {
      alert("No valid products found in CSV.");
      return;
    }

    const merged = [...existingProducts, ...productsToImport];
    localStorage.setItem("products_backup", JSON.stringify(existingProducts));
    saveProducts(merged);
    loadProducts();
    alert(`${productsToImport.length} product(s) imported successfully.`);
  }

  if (fileName.endsWith('.csv')) {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: function (results) {
        const parsedRows = results.data.map(row => row.map(cell => cell.trim()));
        processRows(parsedRows);
      },
      error: function (err) {
        alert("Error reading CSV file.");
        console.error("PapaParse error:", err);
      }
    });
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.ods')) {
    reader.onload = function (e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      processRows(json);
    };
    reader.readAsArrayBuffer(file);
  } else {
    alert("Unsupported file format.");
  }
}

// =============
// UNDO / REDO
// =============

function undoLastChange() {
  const history = JSON.parse(localStorage.getItem("products_history") || "[]");

  if (history.length === 0) {
    alert("No changes to undo.");
    return;
  }

  const previousVersion = history[0]?.products || [];

  if (previousVersion.length === 0) {
    alert("No previous version found.");
    return;
  }

  if (confirm("Revert to last saved version?")) {
    saveProducts(previousVersion);
    loadProducts(previousVersion);
    alert("Last change undone.");
  }
}

function undoLastImport() {
  const backup = JSON.parse(localStorage.getItem("products_backup"));

  if (!backup) {
    alert("No previous backup found.");
    return;
  }

  if (confirm("Revert to previous version?")) {
    saveProducts(backup);
    loadProducts(backup);
    alert("Successfully reverted to previous version.");
  }
}

function clearProductList() {
  if (confirm("Are you sure you want to clear all products?")) {
    const backup = getProducts(); // Save current list before clearing
    localStorage.setItem("products_backup", JSON.stringify(backup));
    saveProducts([]);
    loadProducts([]); // Force empty reload
    updateGrandTotal([]);
    alert("All products have been cleared.");
  }
}

function resetApp() {
  if (confirm("Are you sure you want to reset the app? This will remove all data.")) {
    localStorage.removeItem("products");
    localStorage.removeItem("suppliers");
    localStorage.removeItem("products_backup");
    localStorage.removeItem("products_history");
    localStorage.removeItem("low_stock_threshold");

    loadSuppliers();
    loadProducts();
    alert("All data has been reset.");
  }
}

function setLowStockThreshold() {
  const input = document.getElementById("stock-threshold");
  const newThreshold = parseInt(input.value);

  if (!isNaN(newThreshold) && newThreshold >= 0) {
    LOW_STOCK_THRESHOLD = newThreshold;
    localStorage.setItem("low_stock_threshold", newThreshold);
    loadProducts();
    alert(`Low stock threshold set to ${newThreshold}`);
  } else {
    alert("Please enter a valid number.");
    input.value = LOW_STOCK_THRESHOLD;
  }
}

// =============
// UTILITIES
// =============

function updateGrandTotal(products = getProducts()) {
  const totalValue = products.reduce((sum, p) => sum + (p.quantity * p.price), 0);
  document.getElementById("grand-total").textContent = `$${totalValue.toFixed(2)}`;
}