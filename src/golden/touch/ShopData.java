package golden.touch;

import java.io.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Golden Touch — Cosmetics & Jewellery Shop
 * Data models and persistence layer.
 */
public class ShopData {

    // ========================= MODELS =========================

    /** A product in the shop catalogue */
    public static class Product implements Serializable {
        private static final long serialVersionUID = 1L;
        public int id;
        public String name;
        public String category;      // e.g. Skincare, Makeup, Fragrance, Jewellery, Haircare
        public String brand;
        public String sku;           // barcode / stock-keeping unit
        public String description;
        public double costPrice;     // what we paid the supplier
        public double sellingPrice;  // what we charge customers
        public double wholesalePrice;   // lower price for bulk buyers
        public int    wholesaleMinQty;  // wholesale applies when qty >= this
        public int stockQty;
        public int lowStockThreshold; // alert when stock falls below this
        public boolean active;       // false = archived/discontinued
    }

    /** A single line item inside a sale */
    public static class SaleItem implements Serializable {
        private static final long serialVersionUID = 1L;
        public int productId;
        public String productName;  // snapshot at time of sale
        public int qty;
        public double unitPrice;
        public double lineTotal() { return qty * unitPrice; }
    }

    /** A completed sale transaction */
    public static class Sale implements Serializable {
        private static final long serialVersionUID = 1L;
        public int id;
        public LocalDate date;
        public String time;          // HH:mm string
        public int customerId;       // 0 = walk-in
        public String customerName;  // snapshot
        public List<SaleItem> items = new ArrayList<>();
        public double discount;
        public String paymentMethod; // Cash, MPesa, Card
        public String mpesaCode;     // transaction code if MPesa
        public String mpesaPhone;    // payer phone if MPesa
        public String notes;
        public boolean voided;

        public double subtotal() {
            double s = 0;
            for (SaleItem i : items) s += i.lineTotal();
            return s;
        }
        public double total() { return subtotal() - discount; }
    }

    /** A customer record */
    public static class Customer implements Serializable {
        private static final long serialVersionUID = 1L;
        public int id;
        public String name;
        public String phone;
        public String email;
        public String notes;
        public LocalDate joinDate;
    }

    /** A supplier we buy stock from */
    public static class Supplier implements Serializable {
        private static final long serialVersionUID = 1L;
        public int id;
        public String name;
        public String phone;
        public String email;
        public String address;
        public String notes;
    }

    /** A stock restock / purchase from a supplier */
    public static class StockReceipt implements Serializable {
        private static final long serialVersionUID = 1L;
        public int id;
        public LocalDate date;
        public int supplierId;
        public String supplierName; // snapshot
        public int productId;
        public String productName;  // snapshot
        public int qty;
        public double unitCost;
        public double totalCost() { return qty * unitCost; }
        public String invoiceRef;
        public String notes;
    }

    /** A shop running expense */
    public static class Expense implements Serializable {
        private static final long serialVersionUID = 1L;
        public int id;
        public LocalDate date;
        public String category;     // Rent, Utilities, Salary, Marketing, etc.
        public String description;
        public double amount;
        public String paidBy;       // Cash, MPesa, Bank
        public String reference;
    }

    /** An employee */
    public static class Staff implements Serializable {
        private static final long serialVersionUID = 1L;
        public int id;
        public String name;
        public String role;          // Cashier, Shop Assistant, Manager, etc.
        public String phone;
        public String idNumber;
        public double monthlySalary;
        public LocalDate hireDate;
        public boolean active;
    }

    /** Payroll authorisation record */
    public static class PayrollRun implements Serializable {
        private static final long serialVersionUID = 1L;
        public int id;
        public LocalDate date;
        public String month;         // "YYYY-MM"
        public double totalPaid;
        public String authorisedBy;
    }

    /** Root data container */
    public static class AppData implements Serializable {
        private static final long serialVersionUID = 1L;
        public List<Product>      products      = new ArrayList<>();
        public List<Sale>         sales         = new ArrayList<>();
        public List<Customer>     customers     = new ArrayList<>();
        public List<Supplier>     suppliers     = new ArrayList<>();
        public List<StockReceipt> stockReceipts = new ArrayList<>();
        public List<Expense>      expenses      = new ArrayList<>();
        public List<Staff>        staff         = new ArrayList<>();
        public List<PayrollRun>   payrollRuns   = new ArrayList<>();

        public int nextProductId      = 1;
        public int nextSaleId         = 1;
        public int nextCustomerId     = 1;
        public int nextSupplierId     = 1;
        public int nextReceiptId      = 1;
        public int nextExpenseId      = 1;
        public int nextStaffId        = 1;
        public int nextPayrollRunId   = 1;

        // Shop settings
        public String mpesaNumber     = "0723432205";
        public String shopName        = "Golden Touch";
    }

    // ========================= SINGLETON =========================

    private static final String FILENAME = "golden_touch_shop.dat";
    private static AppData data = new AppData();

    public static AppData get() { return data; }

    static File dataFile() {
        String dataDir = System.getenv("DATA_DIR");
        if (dataDir != null && !dataDir.trim().isEmpty()) {
            File dir = new File(dataDir.trim());
            dir.mkdirs();
            return new File(dir, FILENAME);
        }
        try {
            java.security.CodeSource cs =
                ShopData.class.getProtectionDomain().getCodeSource();
            if (cs != null) {
                File jar = new File(cs.getLocation().toURI());
                File dir = jar.isFile() ? jar.getParentFile() : jar;
                return new File(dir, FILENAME);
            }
        } catch (Exception ignored) {}
        return new File(FILENAME);
    }

    public static synchronized void save() {
        File f = dataFile();
        try (ObjectOutputStream out = new ObjectOutputStream(new FileOutputStream(f))) {
            out.writeObject(data);
        } catch (IOException e) {
            System.err.println("[ShopData] ERROR saving: " + e.getMessage());
        }
    }

    public static synchronized void load() {
        File f = dataFile();
        System.out.println("[ShopData] Data file: " + f.getAbsolutePath());
        if (!f.exists()) {
            System.out.println("[ShopData] No existing data — starting fresh.");
            data = new AppData();
            return;
        }
        try (ObjectInputStream in = new ObjectInputStream(new FileInputStream(f))) {
            data = (AppData) in.readObject();
            backfill();
            System.out.println("[ShopData] Loaded: "
                + data.products.size() + " products, "
                + data.sales.size()    + " sales.");
        } catch (Exception e) {
            System.err.println("[ShopData] ERROR loading: " + e.getMessage()
                + " — starting fresh.");
            File backup = new File(f.getParent(),
                FILENAME + ".corrupt_" + System.currentTimeMillis());
            f.renameTo(backup);
            data = new AppData();
        }
    }

    private static void backfill() {
        if (data.products      == null) data.products      = new ArrayList<>();
        if (data.sales         == null) data.sales         = new ArrayList<>();
        if (data.customers     == null) data.customers     = new ArrayList<>();
        if (data.suppliers     == null) data.suppliers     = new ArrayList<>();
        if (data.stockReceipts == null) data.stockReceipts = new ArrayList<>();
        if (data.expenses      == null) data.expenses      = new ArrayList<>();
        if (data.staff         == null) data.staff         = new ArrayList<>();
        if (data.payrollRuns   == null) data.payrollRuns   = new ArrayList<>();
        if (data.mpesaNumber   == null) data.mpesaNumber   = "0723432205";
        if (data.shopName      == null) data.shopName      = "Golden Touch";
        for (Product p : data.products) {
            if (p.lowStockThreshold == 0) p.lowStockThreshold = 5;
            if (p.wholesalePrice == 0) p.wholesalePrice = p.sellingPrice;
            if (p.wholesaleMinQty == 0) p.wholesaleMinQty = 1;
        }
        for (Sale s : data.sales) {
            if (s.items == null) s.items = new ArrayList<>();
        }
        for (Staff s : data.staff) {
            if (s.idNumber == null) s.idNumber = "";
        }
    }

    // ========================= LOOKUP HELPERS =========================

    public static Product findProduct(int id) {
        for (Product p : data.products) if (p.id == id) return p;
        return null;
    }
    public static Customer findCustomer(int id) {
        for (Customer c : data.customers) if (c.id == id) return c;
        return null;
    }
    public static Supplier findSupplier(int id) {
        for (Supplier s : data.suppliers) if (s.id == id) return s;
        return null;
    }
    public static Sale findSale(int id) {
        for (Sale s : data.sales) if (s.id == id) return s;
        return null;
    }
    public static Staff findStaff(int id) {
        for (Staff s : data.staff) if (s.id == id) return s;
        return null;
    }

    // ========================= CONSTANTS =========================

    public static final String[] CATEGORIES = {
        "Skincare", "Makeup", "Fragrance", "Jewellery",
        "Haircare", "Nail Care", "Body Care", "Other"
    };

    public static final String[] EXPENSE_CATEGORIES = {
        "Rent", "Utilities", "Staff Salary", "Marketing & Advertising",
        "Packaging & Bags", "Cleaning Supplies", "Transport",
        "Equipment", "Miscellaneous"
    };

    public static final String[] PAYMENT_METHODS = { "Cash", "MPesa", "Card" };
}
