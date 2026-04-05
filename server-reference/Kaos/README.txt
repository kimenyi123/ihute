Seller registration + temporary password email live in the Kaos backend repo:

  C:\Angelique Uwibambe\kaos\src\java\Api\InsertSuppliers.java   (ihute default: /Api/InsertSuppliers)
  C:\Angelique Uwibambe\kaos\src\java\Kaos\InsertSupplier.java     (alternate: /InsertSupplier)
  C:\Angelique Uwibambe\kaos\src\java\Kaos\EmailService.java       (generateTemporaryPassword, sendSellerTemporaryPasswordEmail)

Gmail SMTP is hardcoded in EmailService (GMAIL_SMTP_USER, GMAIL_SMTP_APP_PASSWORD). Optional: ISHYIGA_LOGIN_URL env for temp-password email link.
