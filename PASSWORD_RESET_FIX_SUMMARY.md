# Ikiguzi cy'Icyegeranyo: Password Reset Fix

**Itariki:** 29 Gicurasi 2026  
**Ikibazo:** Password reset yimikoranire kuki `account_signup.PWD` column ni `char(100)` ariko bcrypt hashes ni 60+ characters.

---

## Icyambika Ikibazo

### 1. **Igihe mwayambikaga**
Umukiriya akoresha "forgot password" cyangwa "set new password" ariko password ntacyahinduwa.

### 2. **Impamvu Iriwo**

Ikibazo kiri mu database schema:

```sql
-- KIBAZO: char(100) - MySQL igatuma hash
CREATE TABLE `account_signup` (
  `PWD` char(100) DEFAULT 'NA'  -- ❌ Too short for bcrypt!
)
```

**Ikiranga:**
- Bcrypt hashes ni ~60 character (e.g., `$2b$10$VXQ...` + 50+ more)
- Niba ushyiramo hash iri mu `char(100)`, MySQL igatuma cyangwa kunyura
- Hash ikoreshwako ihinduka, ariko login iteration ifashya `bcrypt.compare()` — ikadukunanya

### 3. **Ahari ikibazo**

**Frontend code** — Nzira ✅
- `app/forgot-password/page.tsx` — UI nzira
- `app/api/auth/forgot-password/route.ts` — API endpoint nzira
- `lib/forgot-password-mysql.ts` — bcrypt logic nzira

**Backend URL** — Nzira ✅
- `.env.local` ifite `JAVA_AUTH_URL=http://localhost:8082/Trading/Kaos/user-auth`

**Database Schema** — ❌ KIBAZO!
- `account_signup.PWD` = `char(100)` → truncates bcrypt

---

## Igihuguro: Schema Migration

### Umwanyuro wa Ikibazo

Extend `account_signup.PWD` kwi `varchar(255)` kugira ngo rwange bcrypt hashes.

### Igihe Wakoze

1. **Created migration file:**
   ```
   sql/fix_account_signup_pwd_length.sql
   ```

2. **Created Node.js runner (no manual MySQL needed):**
   ```
   scripts/migrate-pwd-column.mjs
   ```

### Ikibazo cyikubiranyije: MySQL Credentials

Node.js script igerageza:
- `localhost:3306` / `127.0.0.1:3306`
- Users: `root` (no password, `password`, `root`)

**Ariko** → Nta MySQL connection ibabonetse (password yitagaragaye).

---

## Inzira Yo Gukora Fix Nawe

### **Option A: Guhindura `.env.local` (Subira kuri credentials)**

Shyiramo muri `.env.local`:

```env
# MySQL password reset fallback (optional)
FORGOT_PASSWORD_MYSQL_HOST=localhost
FORGOT_PASSWORD_MYSQL_USER=root
FORGOT_PASSWORD_MYSQL_PASSWORD=YOUR_ROOT_PASSWORD_HERE
FORGOT_PASSWORD_MYSQL_DATABASE=chaos_theta
```

Nyuma yuko:

```powershell
cd "c:\Algo project\ihute-frontend"
node scripts\migrate-pwd-column.mjs
```

---

### **Option B: Gukora manual SQL** (Kwishyura direki mu MySQL)

```bash
mysql -h localhost -u root -pYOUR_PASSWORD chaos_theta < sql\fix_account_signup_pwd_length.sql
```

**Cyangwa** — MySQL client kuri GUI:

```sql
ALTER TABLE `account_signup` MODIFY COLUMN `PWD` varchar(255) NOT NULL DEFAULT 'NA';
```

---

### **Option C: SQL verification neza**

Reba ko migration yagwaga neza:

```sql
SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'account_signup' AND COLUMN_NAME = 'PWD';
```

**Bivuzwe kubona:**
```
COLUMN_NAME: PWD
COLUMN_TYPE: varchar(255)  ✅
COLUMN_DEFAULT: 'NA'
```

---

## Ibirebire Nyuma yo Guteka

1. ✅ **Apply migration** (Option A, B, or C)
2. ✅ **Restart Next.js server** — `npm run dev`
3. ✅ **Test password reset** — Gera `/forgot-password`, shyiramo phone + street + new password
4. ✅ **Login** — Gukoreshwa new password kuri `/login`

---

## Ifatiro

| Icyambika | Impamvu | Igihuguro |
|-----------|---------|----------|
| Password reset yimikoranire | `account_signup.PWD` ni `char(100)` → bcrypt truncated | Extend to `varchar(255)` |
| Frontend code | Nzira neza | N/A |
| Backend URLs | Configured | N/A |
| MySQL credentials | Nta password visible | Shyiramo muri `.env.local` cyangwa gukora manual SQL |

---

## Amakuru Atari Wacu

**Files Twakore:**
- ✅ `sql/fix_account_signup_pwd_length.sql` — SQL migration
- ✅ `scripts/migrate-pwd-column.mjs` — Node.js runner
- ✅ `app/api/auth/forgot-password/route.ts` — Fixed (now doesn't fail if JAVA_AUTH_URL missing)

**Files Ntwe Nyini (not modified):**
- ✅ `app/forgot-password/page.tsx` — No changes
- ✅ `lib/forgot-password-mysql.ts` — No changes
- ✅ `.env.local` — No changes (just reference)

---

## Icyambika Kintu Mugisho

**Niba hash iritubajigijwe mu `char(100)` kandi igatuma:**
- Old: `$2b$10$VXQ...` → truncated → login fails
- New: `$2b$10$VXQ...` (full 60+ chars) → login works ✅

---

**EKIBAZO:** Niba umuntu ashaka gukoreshwa MySQL fallback kugira ngo password reset ikore mu dev (without Java Tomcat), ugomba:

1. `.env.local` ifite `FORGOT_PASSWORD_MYSQL_*`
2. Database schema migration (this doc)
3. Next.js server restart

**ICYASANZWE:** Niba ukoresha Java auth servlet, MySQL fallback nti ifite ingano — backend yimikoranire solo.

