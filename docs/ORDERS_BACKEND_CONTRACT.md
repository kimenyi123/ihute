# Orders backend contract (OrdersServlet)

When creating an order, **do not validate that each item “exists”** (e.g. lookup by `itemCode` in a catalog).

**Reason:** In this e‑commerce flow, users can only add to cart items that already exist (items with quantity). So every item in the order payload has already been validated on the frontend. The backend should accept the order using the provided `items` (name, itemCode, qty, unitPrice, unit) without an extra “item exists” check.

If the backend currently returns errors like `Item not found: <itemCode>`, remove or skip that validation for order creation so checkout succeeds for cart items.

## Bouncy Castle / `ClassNotFoundException` on `createOrder`

If Tomcat logs show:

`java.lang.ClassNotFoundException: org.bouncycastle.jce.provider.BouncyCastleProvider`  
at `Kaos.OrdersServlet.createOrder(...)`, the **Trading/Kaos WAR is missing the Bouncy Castle provider JAR**.

**Fix (Java project that builds `OrdersServlet`) — Ant (no Maven):**

1. **Get the JAR** (Java 17+ → `jdk18on`). Direct URL (version 1.78.1):

   `https://repo1.maven.org/maven2/org/bouncycastle/bcprov-jdk18on/1.78.1/bcprov-jdk18on-1.78.1.jar`

2. **Put it on the webapp classpath** so it ends up in **`WEB-INF/lib`** inside the WAR:

   - **Option A — copy by hand:** save the file as `bcprov-jdk18on-1.78.1.jar` into your webapp’s **`WEB-INF/lib`** folder (the same tree your Ant `war` task packs), then rebuild the WAR and redeploy.

   - **Option B — Ant `get` + `copy`:** download once into a `lib` folder your build already merges into the WAR, for example:

   ```xml
   <property name="bc.version" value="1.78.1"/>
   <property name="bc.jar" value="bcprov-jdk18on-${bc.version}.jar"/>
   <mkdir dir="lib"/>
   <get src="https://repo1.maven.org/maven2/org/bouncycastle/bcprov-jdk18on/${bc.version}/${bc.jar}"
        dest="lib/${bc.jar}" skipexisting="true"/>
   ```

   Then ensure your **`war`** task includes that JAR (e.g. `webinf` / `lib` nested fileset, or `copy` into `build/webapp/WEB-INF/lib` before `war`). The important part is: **`WEB-INF/lib/bcprov-jdk18on-*.jar`** inside the deployed WAR.

3. **Redeploy** to Tomcat and retry checkout.

**Alternatively (Maven / Gradle):** add artifact `org.bouncycastle:bcprov-jdk18on:1.78.1` so it is packaged into `WEB-INF/lib`.

If you also use Bouncy Castle PKIX/CMS APIs, you may need **`bcpkix-jdk18on`** in addition to **`bcprov-jdk18on`**; start with **`bcprov`** since that is what the missing class belongs to.
