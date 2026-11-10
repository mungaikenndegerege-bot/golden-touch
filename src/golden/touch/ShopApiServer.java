package golden.touch;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.javalin.Javalin;
import io.javalin.http.staticfiles.Location;
import io.javalin.plugin.json.JavalinJackson;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

import golden.touch.ShopData.*;

/**
 * Golden Touch — Cosmetics & Jewellery Shop
 * REST API + static file server.
 *
 * Run: java -cp "dist/GoldenTouch.jar;lib/*" golden.touch.ShopApiServer
 * Then open: http://localhost:7071
 */
public class ShopApiServer {

    static final ObjectMapper JSON = new ObjectMapper()
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .findAndRegisterModules();

    public static void main(String[] args) {
        ShopData.load();

        int port = 7071;
        String envPort = System.getenv("PORT");
        if (envPort != null && !envPort.isEmpty()) {
            try { port = Integer.parseInt(envPort.trim()); } catch (NumberFormatException ignored) {}
        }
        final int serverPort = port;

        Javalin app = Javalin.create(config -> {
            config.addStaticFiles("/web", Location.CLASSPATH);
            config.enableCorsForAllOrigins();
            config.jsonMapper(new JavalinJackson(JSON));
        }).start(serverPort);

        // ===================================================================
        //  PRODUCTS
        // ===================================================================

        app.get("/api/products", ctx -> {
            ArrayNode arr = JSON.createArrayNode();
            for (Product p : ShopData.get().products) {
                arr.add(productNode(p));
            }
            ctx.json(arr.toString());
        });

        app.post("/api/products", ctx -> {
            ObjectNode body = ctx.bodyAsClass(ObjectNode.class);
            Product p = new Product();
            p.id = ShopData.get().nextProductId++;
            p.name          = body.get("name").asText().trim();
            p.category      = body.get("category").asText("Other").trim();
            p.brand         = body.has("brand")       ? body.get("brand").asText("").trim()       : "";
            p.sku           = body.has("sku")         ? body.get("sku").asText("").trim()         : "";
            p.description   = body.has("description") ? body.get("description").asText("").trim() : "";
            p.costPrice     = body.get("costPrice").asDouble(0);
            p.sellingPrice  = body.get("sellingPrice").asDouble(0);
            p.wholesalePrice  = body.has("wholesalePrice")  ? body.get("wholesalePrice").asDouble(p.sellingPrice)  : p.sellingPrice;
            p.wholesaleMinQty = body.has("wholesaleMinQty") ? body.get("wholesaleMinQty").asInt(1) : 1;
            p.stockQty      = body.get("stockQty").asInt(0);
            p.lowStockThreshold = body.has("lowStockThreshold") ? body.get("lowStockThreshold").asInt(5) : 5;
            p.active        = true;
            ShopData.get().products.add(p);
            ShopData.save();
            ctx.status(201).result("" + p.id);
        });

        app.put("/api/products/{id}", ctx -> {
            int id = Integer.parseInt(ctx.pathParam("id"));
            Product p = ShopData.findProduct(id);
            if (p == null) { ctx.status(404).result("Not found"); return; }
            ObjectNode body = ctx.bodyAsClass(ObjectNode.class);
            if (body.has("name"))              p.name          = body.get("name").asText().trim();
            if (body.has("category"))          p.category      = body.get("category").asText().trim();
            if (body.has("brand"))             p.brand         = body.get("brand").asText("").trim();
            if (body.has("sku"))               p.sku           = body.get("sku").asText("").trim();
            if (body.has("description"))       p.description   = body.get("description").asText("").trim();
            if (body.has("costPrice"))         p.costPrice     = body.get("costPrice").asDouble(0);
            if (body.has("sellingPrice"))      p.sellingPrice  = body.get("sellingPrice").asDouble(0);
            if (body.has("wholesalePrice"))  p.wholesalePrice  = body.get("wholesalePrice").asDouble(0);
            if (body.has("wholesaleMinQty")) p.wholesaleMinQty = body.get("wholesaleMinQty").asInt(1);
            if (body.has("stockQty"))          p.stockQty      = body.get("stockQty").asInt(0);
            if (body.has("lowStockThreshold")) p.lowStockThreshold = body.get("lowStockThreshold").asInt(5);
            if (body.has("active"))            p.active        = body.get("active").asBoolean(true);
            ShopData.save();
            ctx.result("Updated");
        });

        app.delete("/api/products/{id}", ctx -> {
            int id = Integer.parseInt(ctx.pathParam("id"));
            boolean removed = ShopData.get().products.removeIf(p -> p.id == id);
            if (!removed) { ctx.status(404).result("Not found"); return; }
            ShopData.save();
            ctx.result("Deleted");
        });

        // ===================================================================
        //  SALES
        // ===================================================================

        app.get("/api/sales", ctx -> {
            ArrayNode arr = JSON.createArrayNode();
            for (Sale s : ShopData.get().sales) arr.add(saleNode(s));
            ctx.json(arr.toString());
        });

        app.post("/api/sales", ctx -> {
            ObjectNode body = ctx.bodyAsClass(ObjectNode.class);
            AppData d = ShopData.get();

            Sale sale = new Sale();
            sale.id            = d.nextSaleId++;
            sale.date          = LocalDate.parse(body.get("date").asText());
            sale.time          = body.has("time") ? body.get("time").asText("") : "";
            sale.customerId    = body.has("customerId") ? body.get("customerId").asInt(0) : 0;
            sale.customerName  = body.has("customerName") ? body.get("customerName").asText("Walk-in").trim() : "Walk-in";
            sale.discount      = body.has("discount") ? body.get("discount").asDouble(0) : 0;
            sale.paymentMethod = body.get("paymentMethod").asText("Cash").trim();
            sale.mpesaCode     = body.has("mpesaCode")  ? body.get("mpesaCode").asText("").trim()  : "";
            sale.mpesaPhone    = body.has("mpesaPhone") ? body.get("mpesaPhone").asText("").trim() : "";
            sale.notes         = body.has("notes")      ? body.get("notes").asText("").trim()      : "";
            sale.voided        = false;

            // Parse items and deduct stock
            if (!body.has("items") || !body.get("items").isArray()) {
                ctx.status(400).result("items array required"); return;
            }
            for (com.fasterxml.jackson.databind.JsonNode itemNode : body.get("items")) {
                SaleItem si = new SaleItem();
                si.productId   = itemNode.get("productId").asInt();
                si.qty         = itemNode.get("qty").asInt(1);
                si.unitPrice   = itemNode.get("unitPrice").asDouble(0);
                Product prod   = ShopData.findProduct(si.productId);
                if (prod != null) {
                    si.productName = prod.name;
                    prod.stockQty  = Math.max(0, prod.stockQty - si.qty);
                } else {
                    si.productName = itemNode.has("productName") ? itemNode.get("productName").asText("Unknown") : "Unknown";
                }
                sale.items.add(si);
            }

            d.sales.add(sale);
            ShopData.save();
            ctx.status(201).result("" + sale.id);
        });

        // Void a sale (restores stock)
        app.put("/api/sales/{id}/void", ctx -> {
            int id = Integer.parseInt(ctx.pathParam("id"));
            Sale sale = ShopData.findSale(id);
            if (sale == null) { ctx.status(404).result("Not found"); return; }
            if (sale.voided) { ctx.status(400).result("Already voided"); return; }
            sale.voided = true;
            // Restore stock
            for (SaleItem si : sale.items) {
                Product p = ShopData.findProduct(si.productId);
                if (p != null) p.stockQty += si.qty;
            }
            ShopData.save();
            ctx.result("Voided");
        });

        app.delete("/api/sales/{id}", ctx -> {
            int id = Integer.parseInt(ctx.pathParam("id"));
            Sale sale = ShopData.findSale(id);
            if (sale == null) { ctx.status(404).result("Not found"); return; }
            // Restore stock if not already voided
            if (!sale.voided) {
                for (SaleItem si : sale.items) {
                    Product p = ShopData.findProduct(si.productId);
                    if (p != null) p.stockQty += si.qty;
                }
            }
            ShopData.get().sales.removeIf(s -> s.id == id);
            ShopData.save();
            ctx.result("Deleted");
        });

        // ===================================================================
        //  CUSTOMERS
        // ===================================================================

        app.get("/api/customers", ctx -> {
            ArrayNode arr = JSON.createArrayNode();
            for (Customer c : ShopData.get().customers) arr.add(customerNode(c));
            ctx.json(arr.toString());
        });

        app.post("/api/customers", ctx -> {
            ObjectNode body = ctx.bodyAsClass(ObjectNode.class);
            Customer c = new Customer();
            c.id       = ShopData.get().nextCustomerId++;
            c.name     = body.get("name").asText().trim();
            c.phone    = body.has("phone") ? body.get("phone").asText("").trim() : "";
            c.email    = body.has("email") ? body.get("email").asText("").trim() : "";
            c.notes    = body.has("notes") ? body.get("notes").asText("").trim() : "";
            c.joinDate = LocalDate.now();
            ShopData.get().customers.add(c);
            ShopData.save();
            ctx.status(201).result("" + c.id);
        });

        app.put("/api/customers/{id}", ctx -> {
            int id = Integer.parseInt(ctx.pathParam("id"));
            Customer c = ShopData.findCustomer(id);
            if (c == null) { ctx.status(404).result("Not found"); return; }
            ObjectNode body = ctx.bodyAsClass(ObjectNode.class);
            if (body.has("name"))  c.name  = body.get("name").asText().trim();
            if (body.has("phone")) c.phone = body.get("phone").asText("").trim();
            if (body.has("email")) c.email = body.get("email").asText("").trim();
            if (body.has("notes")) c.notes = body.get("notes").asText("").trim();
            ShopData.save();
            ctx.result("Updated");
        });

        app.delete("/api/customers/{id}", ctx -> {
            int id = Integer.parseInt(ctx.pathParam("id"));
            boolean removed = ShopData.get().customers.removeIf(c -> c.id == id);
            if (!removed) { ctx.status(404).result("Not found"); return; }
            ShopData.save();
            ctx.result("Deleted");
        });

        // ===================================================================
        //  SUPPLIERS
        // ===================================================================

        app.get("/api/suppliers", ctx -> {
            ArrayNode arr = JSON.createArrayNode();
            for (Supplier s : ShopData.get().suppliers) arr.add(supplierNode(s));
            ctx.json(arr.toString());
        });

        app.post("/api/suppliers", ctx -> {
            ObjectNode body = ctx.bodyAsClass(ObjectNode.class);
            Supplier s = new Supplier();
            s.id      = ShopData.get().nextSupplierId++;
            s.name    = body.get("name").asText().trim();
            s.phone   = body.has("phone")   ? body.get("phone").asText("").trim()   : "";
            s.email   = body.has("email")   ? body.get("email").asText("").trim()   : "";
            s.address = body.has("address") ? body.get("address").asText("").trim() : "";
            s.notes   = body.has("notes")   ? body.get("notes").asText("").trim()   : "";
            ShopData.get().suppliers.add(s);
            ShopData.save();
            ctx.status(201).result("" + s.id);
        });

        app.put("/api/suppliers/{id}", ctx -> {
            int id = Integer.parseInt(ctx.pathParam("id"));
            Supplier s = ShopData.findSupplier(id);
            if (s == null) { ctx.status(404).result("Not found"); return; }
            ObjectNode body = ctx.bodyAsClass(ObjectNode.class);
            if (body.has("name"))    s.name    = body.get("name").asText().trim();
            if (body.has("phone"))   s.phone   = body.get("phone").asText("").trim();
            if (body.has("email"))   s.email   = body.get("email").asText("").trim();
            if (body.has("address")) s.address = body.get("address").asText("").trim();
            if (body.has("notes"))   s.notes   = body.get("notes").asText("").trim();
            ShopData.save();
            ctx.result("Updated");
        });

        app.delete("/api/suppliers/{id}", ctx -> {
            int id = Integer.parseInt(ctx.pathParam("id"));
            boolean removed = ShopData.get().suppliers.removeIf(s -> s.id == id);
            if (!removed) { ctx.status(404).result("Not found"); return; }
            ShopData.save();
            ctx.result("Deleted");
        });

        // ===================================================================
        //  STOCK RECEIPTS (restocking)
        // ===================================================================

        app.get("/api/stock", ctx -> {
            ArrayNode arr = JSON.createArrayNode();
            for (StockReceipt r : ShopData.get().stockReceipts) arr.add(receiptNode(r));
            ctx.json(arr.toString());
        });

        app.post("/api/stock", ctx -> {
            ObjectNode body = ctx.bodyAsClass(ObjectNode.class);
            AppData d = ShopData.get();
            StockReceipt r = new StockReceipt();
            r.id           = d.nextReceiptId++;
            r.date         = LocalDate.parse(body.get("date").asText());
            r.supplierId   = body.has("supplierId") ? body.get("supplierId").asInt(0) : 0;
            r.supplierName = body.has("supplierName") ? body.get("supplierName").asText("").trim() : "";
            r.productId    = body.get("productId").asInt();
            r.qty          = body.get("qty").asInt(1);
            r.unitCost     = body.get("unitCost").asDouble(0);
            r.invoiceRef   = body.has("invoiceRef") ? body.get("invoiceRef").asText("").trim() : "";
            r.notes        = body.has("notes") ? body.get("notes").asText("").trim() : "";

            // Update product name snapshot and add to stock
            Product p = ShopData.findProduct(r.productId);
            if (p != null) {
                r.productName = p.name;
                p.stockQty   += r.qty;
                // Optionally update cost price to latest
                if (r.unitCost > 0) p.costPrice = r.unitCost;
            } else {
                r.productName = "Unknown";
            }
            // Resolve supplier name
            if (r.supplierId > 0 && (r.supplierName == null || r.supplierName.isEmpty())) {
                Supplier s = ShopData.findSupplier(r.supplierId);
                if (s != null) r.supplierName = s.name;
            }

            d.stockReceipts.add(r);
            ShopData.save();
            ctx.status(201).result("" + r.id);
        });

        app.delete("/api/stock/{id}", ctx -> {
            int id = Integer.parseInt(ctx.pathParam("id"));
            // Find and reverse stock
            StockReceipt found = null;
            for (StockReceipt r : ShopData.get().stockReceipts) if (r.id == id) { found = r; break; }
            if (found == null) { ctx.status(404).result("Not found"); return; }
            Product p = ShopData.findProduct(found.productId);
            if (p != null) p.stockQty = Math.max(0, p.stockQty - found.qty);
            ShopData.get().stockReceipts.removeIf(r -> r.id == id);
            ShopData.save();
            ctx.result("Deleted");
        });

        // ===================================================================
        //  EXPENSES
        // ===================================================================

        app.get("/api/expenses", ctx -> {
            ArrayNode arr = JSON.createArrayNode();
            for (Expense e : ShopData.get().expenses) arr.add(expenseNode(e));
            ctx.json(arr.toString());
        });

        app.post("/api/expenses", ctx -> {
            ObjectNode body = ctx.bodyAsClass(ObjectNode.class);
            Expense e = new Expense();
            e.id          = ShopData.get().nextExpenseId++;
            e.date        = LocalDate.parse(body.get("date").asText());
            e.category    = body.get("category").asText("Miscellaneous").trim();
            e.description = body.has("description") ? body.get("description").asText("").trim() : "";
            e.amount      = body.get("amount").asDouble(0);
            e.paidBy      = body.has("paidBy")    ? body.get("paidBy").asText("Cash").trim()    : "Cash";
            e.reference   = body.has("reference") ? body.get("reference").asText("").trim()     : "";
            ShopData.get().expenses.add(e);
            ShopData.save();
            ctx.status(201).result("" + e.id);
        });

        app.delete("/api/expenses/{id}", ctx -> {
            int id = Integer.parseInt(ctx.pathParam("id"));
            boolean removed = ShopData.get().expenses.removeIf(e -> e.id == id);
            if (!removed) { ctx.status(404).result("Not found"); return; }
            ShopData.save();
            ctx.result("Deleted");
        });

        // ===================================================================
        //  STAFF
        // ===================================================================

        app.get("/api/staff", ctx -> {
            ArrayNode arr = JSON.createArrayNode();
            for (Staff s : ShopData.get().staff) arr.add(staffNode(s));
            ctx.json(arr.toString());
        });

        app.post("/api/staff", ctx -> {
            ObjectNode body = ctx.bodyAsClass(ObjectNode.class);
            Staff s = new Staff();
            s.id            = ShopData.get().nextStaffId++;
            s.name          = body.get("name").asText().trim();
            s.role          = body.has("role")    ? body.get("role").asText("").trim()    : "";
            s.phone         = body.has("phone")   ? body.get("phone").asText("").trim()   : "";
            s.idNumber      = body.has("idNumber") ? body.get("idNumber").asText("").trim() : "";
            s.monthlySalary = body.get("monthlySalary").asDouble(0);
            s.hireDate      = LocalDate.now();
            s.active        = true;
            ShopData.get().staff.add(s);
            ShopData.save();
            ctx.status(201).result("" + s.id);
        });

        app.put("/api/staff/{id}", ctx -> {
            int id = Integer.parseInt(ctx.pathParam("id"));
            Staff s = ShopData.findStaff(id);
            if (s == null) { ctx.status(404).result("Not found"); return; }
            ObjectNode body = ctx.bodyAsClass(ObjectNode.class);
            if (body.has("name"))           s.name          = body.get("name").asText().trim();
            if (body.has("role"))           s.role          = body.get("role").asText("").trim();
            if (body.has("phone"))          s.phone         = body.get("phone").asText("").trim();
            if (body.has("idNumber"))       s.idNumber      = body.get("idNumber").asText("").trim();
            if (body.has("monthlySalary"))  s.monthlySalary = body.get("monthlySalary").asDouble(0);
            if (body.has("active"))         s.active        = body.get("active").asBoolean(true);
            ShopData.save();
            ctx.result("Updated");
        });

        app.delete("/api/staff/{id}", ctx -> {
            int id = Integer.parseInt(ctx.pathParam("id"));
            boolean removed = ShopData.get().staff.removeIf(s -> s.id == id);
            if (!removed) { ctx.status(404).result("Not found"); return; }
            ShopData.save();
            ctx.result("Deleted");
        });

        // ===================================================================
        //  PAYROLL RUNS
        // ===================================================================

        app.get("/api/payroll/runs", ctx -> {
            ArrayNode arr = JSON.createArrayNode();
            for (PayrollRun pr : ShopData.get().payrollRuns) {
                ObjectNode n = JSON.createObjectNode();
                n.put("id", pr.id); n.put("date", pr.date.toString());
                n.put("month", pr.month); n.put("totalPaid", pr.totalPaid);
                n.put("authorisedBy", pr.authorisedBy == null ? "" : pr.authorisedBy);
                arr.add(n);
            }
            ctx.json(arr.toString());
        });

        app.post("/api/payroll/run", ctx -> {
            ObjectNode body = ctx.bodyAsClass(ObjectNode.class);
            AppData d = ShopData.get();
            String month = body.has("month") ? body.get("month").asText().trim() : YearMonth.now().toString();
            String auth  = body.has("authorisedBy") ? body.get("authorisedBy").asText("").trim() : "";
            double total = 0;
            for (Staff s : d.staff) if (s.active) total += s.monthlySalary;
            PayrollRun pr = new PayrollRun();
            pr.id = d.nextPayrollRunId++;
            pr.date = LocalDate.now();
            pr.month = month;
            pr.totalPaid = total;
            pr.authorisedBy = auth;
            d.payrollRuns.add(pr);
            ShopData.save();
            ctx.status(201).result("" + pr.id);
        });

        app.delete("/api/payroll/runs/{id}", ctx -> {
            int id = Integer.parseInt(ctx.pathParam("id"));
            boolean removed = ShopData.get().payrollRuns.removeIf(r -> r.id == id);
            if (!removed) { ctx.status(404).result("Not found"); return; }
            ShopData.save();
            ctx.result("Deleted");
        });

        // ===================================================================
        //  SETTINGS
        // ===================================================================

        app.get("/api/settings", ctx -> {
            ObjectNode n = JSON.createObjectNode();
            n.put("mpesaNumber", ShopData.get().mpesaNumber);
            n.put("shopName",    ShopData.get().shopName);
            ctx.json(n.toString());
        });

        app.put("/api/settings", ctx -> {
            ObjectNode body = ctx.bodyAsClass(ObjectNode.class);
            if (body.has("mpesaNumber")) ShopData.get().mpesaNumber = body.get("mpesaNumber").asText().trim();
            if (body.has("shopName"))    ShopData.get().shopName    = body.get("shopName").asText().trim();
            ShopData.save();
            ctx.result("Updated");
        });

        // ===================================================================
        //  DASHBOARD
        // ===================================================================

        app.get("/api/dashboard", ctx -> {
            YearMonth now = YearMonth.now();
            LocalDate today = LocalDate.now();
            AppData d = ShopData.get();

            double todayRevenue = 0, monthRevenue = 0, monthCogs = 0, monthExpenses = 0;
            int todaySales = 0, monthSalesCount = 0;

            for (Sale s : d.sales) {
                if (s.voided) continue;
                if (s.date.equals(today)) { todayRevenue += s.total(); todaySales++; }
                if (inMonth(s.date, now)) { monthRevenue += s.total(); monthSalesCount++; }
                // Cost of goods sold
                if (inMonth(s.date, now)) {
                    for (SaleItem si : s.items) {
                        Product p = ShopData.findProduct(si.productId);
                        if (p != null) monthCogs += p.costPrice * si.qty;
                    }
                }
            }
            for (Expense e : d.expenses) if (inMonth(e.date, now)) monthExpenses += e.amount;

            // Payroll this month
            double authorisedPayroll = 0;
            String nowKey = now.toString();
            for (PayrollRun pr : d.payrollRuns) if (nowKey.equals(pr.month)) authorisedPayroll += pr.totalPaid;
            double pendingPayroll = 0;
            for (Staff s : d.staff) if (s.active) pendingPayroll += s.monthlySalary;
            pendingPayroll = Math.max(0, pendingPayroll - authorisedPayroll);

            // Low stock alerts
            ArrayNode lowStock = JSON.createArrayNode();
            for (Product p : d.products) {
                if (p.active && p.stockQty <= p.lowStockThreshold) {
                    ObjectNode a = JSON.createObjectNode();
                    a.put("id", p.id); a.put("name", p.name);
                    a.put("category", p.category); a.put("stockQty", p.stockQty);
                    a.put("lowStockThreshold", p.lowStockThreshold);
                    lowStock.add(a);
                }
            }

            // Top 5 products by revenue this month
            java.util.Map<Integer, double[]> topMap = new java.util.LinkedHashMap<>();
            for (Sale s : d.sales) {
                if (s.voided || !inMonth(s.date, now)) continue;
                for (SaleItem si : s.items) {
                    double[] arr2 = topMap.getOrDefault(si.productId, new double[]{0, 0});
                    arr2[0] += si.lineTotal(); arr2[1] += si.qty;
                    topMap.put(si.productId, arr2);
                }
            }
            List<int[]> sorted = new ArrayList<>();
            for (int pid : topMap.keySet()) sorted.add(new int[]{pid});
            sorted.sort((a2, b2) -> Double.compare(topMap.get(b2[0])[0], topMap.get(a2[0])[0]));
            ArrayNode topProducts = JSON.createArrayNode();
            for (int i = 0; i < Math.min(5, sorted.size()); i++) {
                int pid = sorted.get(i)[0];
                Product p = ShopData.findProduct(pid);
                double[] vals = topMap.get(pid);
                ObjectNode n = JSON.createObjectNode();
                n.put("id", pid);
                n.put("name", p != null ? p.name : "Unknown");
                n.put("revenue", vals[0]);
                n.put("qtySold", (int) vals[1]);
                topProducts.add(n);
            }

            double grossProfit = monthRevenue - monthCogs;

            ObjectNode result = JSON.createObjectNode();
            result.put("todayRevenue",       todayRevenue);
            result.put("todaySales",         todaySales);
            result.put("monthRevenue",       monthRevenue);
            result.put("monthSalesCount",    monthSalesCount);
            result.put("monthCogs",          monthCogs);
            result.put("monthGrossProfit",   grossProfit);
            result.put("monthExpenses",      monthExpenses);
            result.put("monthPayroll",       authorisedPayroll);
            result.put("monthPendingPayroll",pendingPayroll);
            result.put("monthNet",           grossProfit - monthExpenses - authorisedPayroll);
            result.put("totalProducts",      d.products.size());
            result.put("totalCustomers",     d.customers.size());
            result.put("currentMonth",       now.toString());
            result.set("lowStock",           lowStock);
            result.set("topProducts",        topProducts);
            ctx.json(result.toString());
        });

        // ===================================================================
        //  REPORTS
        // ===================================================================

        app.get("/api/report", ctx -> {
            String yp = ctx.queryParam("year");
            String mp = ctx.queryParam("month");
            int year  = (yp != null && !yp.isEmpty()) ? Integer.parseInt(yp) : LocalDate.now().getYear();
            int month = (mp != null && !mp.isEmpty()) ? Integer.parseInt(mp) : LocalDate.now().getMonthValue();
            YearMonth ym = YearMonth.of(year, month);
            AppData d = ShopData.get();

            double revenue = 0, cogs = 0, expenses = 0, payroll = 0;
            int salesCount = 0;

            ArrayNode salesArr = JSON.createArrayNode();
            for (Sale s : d.sales) {
                if (!inMonth(s.date, ym)) continue;
                ObjectNode n = saleNode(s);
                salesArr.add(n);
                if (!s.voided) { revenue += s.total(); salesCount++; }
                if (!s.voided) {
                    for (SaleItem si : s.items) {
                        Product p = ShopData.findProduct(si.productId);
                        if (p != null) cogs += p.costPrice * si.qty;
                    }
                }
            }
            for (Expense e : d.expenses) if (inMonth(e.date, ym)) expenses += e.amount;
            String ymKey = ym.toString();
            for (PayrollRun pr : d.payrollRuns) if (ymKey.equals(pr.month)) payroll += pr.totalPaid;

            ArrayNode expArr = JSON.createArrayNode();
            for (Expense e : d.expenses) if (inMonth(e.date, ym)) expArr.add(expenseNode(e));

            // Stock receipts
            ArrayNode stockArr = JSON.createArrayNode();
            double stockCost = 0;
            for (StockReceipt r : d.stockReceipts) {
                if (!inMonth(r.date, ym)) continue;
                stockArr.add(receiptNode(r));
                stockCost += r.totalCost();
            }

            ObjectNode result = JSON.createObjectNode();
            result.put("year", year); result.put("month", month);
            result.put("revenue",    revenue);
            result.put("cogs",       cogs);
            result.put("grossProfit", revenue - cogs);
            result.put("expenses",   expenses);
            result.put("payroll",    payroll);
            result.put("stockCost",  stockCost);
            result.put("net",        revenue - cogs - expenses - payroll);
            result.put("salesCount", salesCount);
            result.set("sales",      salesArr);
            result.set("expenses",   expArr);
            result.set("stockReceipts", stockArr);
            ctx.json(result.toString());
        });

        // ===================================================================
        //  CONSTANTS (for dropdowns)
        // ===================================================================

        app.get("/api/constants", ctx -> {
            ObjectNode result = JSON.createObjectNode();
            ArrayNode cats = JSON.createArrayNode();
            for (String c : ShopData.CATEGORIES) cats.add(c);
            ArrayNode expCats = JSON.createArrayNode();
            for (String c : ShopData.EXPENSE_CATEGORIES) expCats.add(c);
            ArrayNode payments = JSON.createArrayNode();
            for (String p : ShopData.PAYMENT_METHODS) payments.add(p);
            result.set("categories",        cats);
            result.set("expenseCategories", expCats);
            result.set("paymentMethods",    payments);
            ctx.json(result.toString());
        });

        System.out.println("===========================================");
        System.out.println("  Golden Touch Shop running on:           ");
        System.out.println("  http://localhost:" + serverPort + "          ");
        System.out.println("===========================================");
    }

    // ===================================================================
    //  HELPERS — build JSON nodes
    // ===================================================================

    static boolean inMonth(LocalDate d, YearMonth ym) {
        return YearMonth.from(d).equals(ym);
    }

    static ObjectNode productNode(Product p) {
        ObjectNode n = JSON.createObjectNode();
        n.put("id", p.id); n.put("name", p.name);
        n.put("category", p.category); n.put("brand", p.brand == null ? "" : p.brand);
        n.put("sku", p.sku == null ? "" : p.sku);
        n.put("description", p.description == null ? "" : p.description);
        n.put("costPrice", p.costPrice); n.put("sellingPrice", p.sellingPrice);
        n.put("wholesalePrice",  p.wholesalePrice);
        n.put("wholesaleMinQty", p.wholesaleMinQty);
        n.put("stockQty", p.stockQty); n.put("lowStockThreshold", p.lowStockThreshold);
        n.put("active", p.active);
        return n;
    }

    static ObjectNode saleNode(Sale s) {
        ObjectNode n = JSON.createObjectNode();
        n.put("id", s.id); n.put("date", s.date.toString());
        n.put("time", s.time == null ? "" : s.time);
        n.put("customerId", s.customerId);
        n.put("customerName", s.customerName == null ? "Walk-in" : s.customerName);
        n.put("discount", s.discount);
        n.put("paymentMethod", s.paymentMethod == null ? "Cash" : s.paymentMethod);
        n.put("mpesaCode", s.mpesaCode == null ? "" : s.mpesaCode);
        n.put("mpesaPhone", s.mpesaPhone == null ? "" : s.mpesaPhone);
        n.put("notes", s.notes == null ? "" : s.notes);
        n.put("voided", s.voided);
        n.put("subtotal", s.subtotal());
        n.put("total", s.total());
        ArrayNode items = JSON.createArrayNode();
        for (SaleItem si : s.items) {
            ObjectNode in = JSON.createObjectNode();
            in.put("productId", si.productId);
            in.put("productName", si.productName == null ? "" : si.productName);
            in.put("qty", si.qty); in.put("unitPrice", si.unitPrice);
            in.put("lineTotal", si.lineTotal());
            items.add(in);
        }
        n.set("items", items);
        return n;
    }

    static ObjectNode customerNode(Customer c) {
        ObjectNode n = JSON.createObjectNode();
        n.put("id", c.id); n.put("name", c.name);
        n.put("phone", c.phone == null ? "" : c.phone);
        n.put("email", c.email == null ? "" : c.email);
        n.put("notes", c.notes == null ? "" : c.notes);
        n.put("joinDate", c.joinDate == null ? "" : c.joinDate.toString());
        return n;
    }

    static ObjectNode supplierNode(Supplier s) {
        ObjectNode n = JSON.createObjectNode();
        n.put("id", s.id); n.put("name", s.name);
        n.put("phone", s.phone == null ? "" : s.phone);
        n.put("email", s.email == null ? "" : s.email);
        n.put("address", s.address == null ? "" : s.address);
        n.put("notes", s.notes == null ? "" : s.notes);
        return n;
    }

    static ObjectNode receiptNode(StockReceipt r) {
        ObjectNode n = JSON.createObjectNode();
        n.put("id", r.id); n.put("date", r.date.toString());
        n.put("supplierId", r.supplierId);
        n.put("supplierName", r.supplierName == null ? "" : r.supplierName);
        n.put("productId", r.productId);
        n.put("productName", r.productName == null ? "" : r.productName);
        n.put("qty", r.qty); n.put("unitCost", r.unitCost);
        n.put("totalCost", r.totalCost());
        n.put("invoiceRef", r.invoiceRef == null ? "" : r.invoiceRef);
        n.put("notes", r.notes == null ? "" : r.notes);
        return n;
    }

    static ObjectNode expenseNode(Expense e) {
        ObjectNode n = JSON.createObjectNode();
        n.put("id", e.id); n.put("date", e.date.toString());
        n.put("category", e.category); n.put("description", e.description == null ? "" : e.description);
        n.put("amount", e.amount);
        n.put("paidBy", e.paidBy == null ? "Cash" : e.paidBy);
        n.put("reference", e.reference == null ? "" : e.reference);
        return n;
    }

    static ObjectNode staffNode(Staff s) {
        ObjectNode n = JSON.createObjectNode();
        n.put("id", s.id); n.put("name", s.name);
        n.put("role", s.role == null ? "" : s.role);
        n.put("phone", s.phone == null ? "" : s.phone);
        n.put("idNumber", s.idNumber == null ? "" : s.idNumber);
        n.put("monthlySalary", s.monthlySalary);
        n.put("hireDate", s.hireDate == null ? "" : s.hireDate.toString());
        n.put("active", s.active);
        return n;
    }
}
