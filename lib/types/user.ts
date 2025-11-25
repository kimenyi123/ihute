export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  pwd: string;
  tel: string;
  phone: string; // Alternative field for phone number
  hqLocation: string;
  tin: string;
  owner: string;
  ishyigaAccount: string;
  type: 'BUYER' | 'SELLER' | 'ADMIN';
  userType: 'BUYER' | 'SELLER' | 'ADMIN'; // Alternative field for type
  language: 'KIN' | 'SWA' | 'ENG' | 'FRA' | 'POR';
  preferredCategories: string;
  status: 'LIVE' | 'SLEEPING' | 'PENDING';
  department: string;
  clientId: string;
  description: string;
  certificate: string;
  photo: string;
  useIshyiga: string;
  currency: string;
  country: string;
  preferredCurrency: string;
  quickEntryId: string;
  userToken: string;
  momo: string;
  ratingStar: number;
  discount: number;
  preferredPay: string;
  otp: string;
  locProvince: string;
  locDistrict: string;
  locCell: string;
  preferredSellerNickname: string;
  nickname: string;
  nickName: string; // Alternative field for nickname
  Lname: string; // Alternative field for last name
  assignedBy: string;
  publishedBy: string;
  supplierLatitude: number;
  supplierLongitude: number;
  gpsAccuracy: number;
  gpsLastUpdated: string;
  completionPercentage: number;
}