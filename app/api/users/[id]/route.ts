import { NextRequest, NextResponse } from 'next/server';

// Mock database query function - replace with your actual database implementation
async function queryDB(sql: string, sqlParams: any[]): Promise<any> {
  // TODO: Implement actual database query
  console.log('SQL:', sql);
  console.log('Params:', sqlParams);
  return Promise.resolve();
}

type RouteCtx = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: RouteCtx) {
  try {
    const userData = await request.json();
    const { id: userId } = await params;

    const sql = `
      UPDATE account_signup SET
        FIRSTNAME = ?,
        LASTNAME = ?,
        EMAIL = ?,
        TEL = ?,
        HQ_LOCATION = ?,
        TIN = ?,
        OWNER = ?,
        ISHYIGA_ACCOUNT = ?,
        TYPE = ?,
        LANGUAGE = ?,
        PREFEREDCATEGORIES = ?,
        STATUS = ?,
        DEPARTMENT = ?,
        DESCRIPTION = ?,
        CERTIFICATE = ?,
        PHOTO = ?,
        USEISHYIGA = ?,
        currency = ?,
        country = ?,
        preferred_currency = ?,
        quick_entry_id = ?,
        user_token = ?,
        momo = ?,
        rating_star = ?,
        discount = ?,
        prefered_pay = ?,
        otp = ?,
        loc_province = ?,
        loc_district = ?,
        loc_cell = ?,
        nickname = ?,
        \`Assigned by\` = ?,
        publishedBy = ?
      WHERE CLIENT_ID = ?
    `;

    const sqlParams = [
      userData.firstName,
      userData.lastName,
      userData.email,
      userData.tel,
      userData.hqLocation,
      userData.tin,
      userData.owner,
      userData.ishyigaAccount,
      userData.type,
      userData.language,
      userData.preferredCategories,
      userData.status,
      userData.department,
      userData.description,
      userData.certificate,
      userData.photo,
      userData.useIshyiga,
      userData.currency,
      userData.country,
      userData.preferredCurrency,
      userData.quickEntryId,
      userData.userToken,
      userData.momo,
      userData.ratingStar,
      userData.discount,
      userData.preferredPay,
      userData.otp,
      userData.locProvince,
      userData.locDistrict,
      userData.locCell,
      userData.nickname,
      userData.assignedBy,
      userData.publishedBy,
      userId
    ];

    await queryDB(sql, sqlParams);

    return NextResponse.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  try {
    const { id: userId } = await params;
    const sql = 'DELETE FROM account_signup WHERE CLIENT_ID = ?';
    await queryDB(sql, [userId]);

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}