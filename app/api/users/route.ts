import { NextResponse } from 'next/server';

// TODO: Replace this mock function with your actual database connection
async function queryDB(sql: string): Promise<any[]> {
  console.log('SQL Query:', sql);
  // TODO: Implement actual database query here
  // Example: return await pool.query(sql);
  return Promise.resolve([]);
}  

export async function GET() {
  try {
    const sql = `
      SELECT 
        ID as id,
        FIRSTNAME as firstName,
        LASTNAME as lastName,
        EMAIL as email,
        PWD as pwd,
        TEL as tel,
        HQ_LOCATION as hqLocation,
        TIN as tin,
        OWNER as owner,
        ISHYIGA_ACCOUNT as ishyigaAccount,
        TYPE as type,
        LANGUAGE as language,
        PREFEREDCATEGORIES as preferredCategories,
        STATUS as status,
        DEPARTMENT as department,
        CLIENT_ID as clientId,
        DESCRIPTION as description,
        CERTIFICATE as certificate,
        PHOTO as photo,
        USEISHYIGA as useIshyiga,
        currency,
        country,
        preferred_currency as preferredCurrency,
        quick_entry_id as quickEntryId,
        user_token as userToken,
        momo,
        rating_star as ratingStar,
        discount,
        prefered_pay as preferredPay,
        otp,
        loc_province as locProvince,
        loc_district as locDistrict,
        loc_cell as locCell,
        prefered_seller_nickname as preferredSellerNickname,
        nickname,
        \`Assigned by\` as assignedBy,
        publishedBy,
        supplier_latitude as supplierLatitude,
        supplier_longitude as supplierLongitude,
        gps_accuracy as gpsAccuracy,
        gps_last_updated as gpsLastUpdated,
        -- Calculate completion percentage based on filled fields
        ROUND(
          (
            (CASE WHEN FIRSTNAME IS NOT NULL AND FIRSTNAME != '' THEN 1 ELSE 0 END) +
            (CASE WHEN LASTNAME IS NOT NULL AND LASTNAME != '' THEN 1 ELSE 0 END) +
            (CASE WHEN EMAIL IS NOT NULL AND EMAIL != '' THEN 1 ELSE 0 END) +
            (CASE WHEN TEL IS NOT NULL AND TEL != '' THEN 1 ELSE 0 END) +
            (CASE WHEN HQ_LOCATION IS NOT NULL AND HQ_LOCATION != '' THEN 1 ELSE 0 END) +
            (CASE WHEN TIN IS NOT NULL AND TIN != '' THEN 1 ELSE 0 END)
          ) * 100.0 / 6, 2
        ) as completionPercentage
      FROM account_signup
      ORDER BY ID DESC
    `;

    const users = await queryDB(sql);
    return NextResponse.json(users);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users from database' },
      { status: 500 }
    );
  }
}