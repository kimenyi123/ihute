'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ImagePlus, Upload, X } from 'lucide-react';
import { useLanguageStore, type Language } from '@/lib/language-store';

const PRODUCT_MODAL_UI: Record<Language, {
  alertImageType: string;
  alertImageSize: (mb: number) => string;
  errNameRequired: string;
  errCodeRequired: string;
  errQuantity: string;
  errPrice: string;
  errCost: string;
  editProduct: string;
  addNewProduct: string;
  productImage: string;
  imageHint: string;
  tapToDrop: string;
  upTo: string;
  browseFiles: string;
  removeImage: string;
  productName: string;
  enterProductName: string;
  productCode: string;
  enterProductCode: string;
  quantity: string;
  unit: string;
  pieces: string;
  kilograms: string;
  liters: string;
  meters: string;
  boxes: string;
  packs: string;
  salePrice: string;
  costPrice: string;
  description: string;
  optionalDescription: string;
  cancel: string;
  saving: string;
  updateProduct: string;
  addProduct: string;
}> = {
  en: {
    alertImageType: "Please choose an image file (JPEG, PNG, WebP, …).",
    alertImageSize: (mb) => `Image is too large (max ${mb} MB).`,
    errNameRequired: "Product name is required",
    errCodeRequired: "Product code is required",
    errQuantity: "Quantity must be 0 or greater",
    errPrice: "Price must be greater than 0",
    errCost: "Cost must be 0 or greater",
    editProduct: "Edit Product",
    addNewProduct: "Add New Product",
    productImage: "Product image",
    imageHint: "Optional — JPEG or PNG recommended. Uploaded after the product is saved (same flow as bulk overrides).",
    tapToDrop: "Tap to choose or drag & drop an image here",
    upTo: "Up to 8 MB",
    browseFiles: "Browse files",
    removeImage: "Remove image",
    productName: "Product Name *",
    enterProductName: "Enter product name",
    productCode: "Product Code/SKU *",
    enterProductCode: "Enter unique product code",
    quantity: "Quantity *",
    unit: "Unit",
    pieces: "Pieces",
    kilograms: "Kilograms",
    liters: "Liters",
    meters: "Meters",
    boxes: "Boxes",
    packs: "Packs",
    salePrice: "Sale Price (RWF) *",
    costPrice: "Cost Price (RWF)",
    description: "Description",
    optionalDescription: "Optional product description",
    cancel: "Cancel",
    saving: "Saving...",
    updateProduct: "Update Product",
    addProduct: "Add Product",
  },
  rw: {
    alertImageType: "Hitamo dosiye y'ishusho (JPEG, PNG, WebP, …).",
    alertImageSize: (mb) => `Ishusho ni nini cyane (ntarengwa ${mb} MB).`,
    errNameRequired: "Izina ry'igicuruzwa rirakenewe",
    errCodeRequired: "Kode y'igicuruzwa irakenewe",
    errQuantity: "Ingano igomba kuba 0 cyangwa irenga",
    errPrice: "Igiciro kigomba kurenza 0",
    errCost: "Igiciro cy'igurisha kigomba kuba 0 cyangwa kirenga",
    editProduct: "Hindura Igicuruzwa",
    addNewProduct: "Ongeraho Igicuruzwa Gishya",
    productImage: "Ishusho y'igicuruzwa",
    imageHint: "Ntibisabwa — JPEG cyangwa PNG birasabwa. Byoherezwa nyuma yo kubika igicuruzwa.",
    tapToDrop: "Kanda kugira ngo uhitemo cyangwa ukurure ishusho hano",
    upTo: "Kugeza 8 MB",
    browseFiles: "Shakisha dosiye",
    removeImage: "Kuraho ishusho",
    productName: "Izina ry'igicuruzwa *",
    enterProductName: "Andika izina ry'igicuruzwa",
    productCode: "Kode/SKU y'igicuruzwa *",
    enterProductCode: "Andika kode y'igicuruzwa yihariye",
    quantity: "Ingano *",
    unit: "Igipimo",
    pieces: "Ibice",
    kilograms: "Kilo",
    liters: "Litiro",
    meters: "Metero",
    boxes: "Amasanduku",
    packs: "Amapaki",
    salePrice: "Igiciro cyo kugurisha (RWF) *",
    costPrice: "Igiciro cy'igurisha (RWF)",
    description: "Ibisobanuro",
    optionalDescription: "Ibisobanuro by'igicuruzwa (ntibisabwa)",
    cancel: "Hagarika",
    saving: "Birimo kubikwa...",
    updateProduct: "Vugurura Igicuruzwa",
    addProduct: "Ongeraho Igicuruzwa",
  },
  fr: {
    alertImageType: "Veuillez choisir un fichier image (JPEG, PNG, WebP, …).",
    alertImageSize: (mb) => `L'image est trop volumineuse (max ${mb} Mo).`,
    errNameRequired: "Le nom du produit est requis",
    errCodeRequired: "Le code produit est requis",
    errQuantity: "La quantité doit être 0 ou supérieure",
    errPrice: "Le prix doit être supérieur à 0",
    errCost: "Le coût doit être 0 ou supérieur",
    editProduct: "Modifier le produit",
    addNewProduct: "Ajouter un nouveau produit",
    productImage: "Image du produit",
    imageHint: "Facultatif — JPEG ou PNG recommandé. Téléversée après l'enregistrement du produit.",
    tapToDrop: "Appuyez pour choisir ou glissez-déposez une image ici",
    upTo: "Jusqu'à 8 Mo",
    browseFiles: "Parcourir les fichiers",
    removeImage: "Supprimer l'image",
    productName: "Nom du produit *",
    enterProductName: "Entrez le nom du produit",
    productCode: "Code produit/SKU *",
    enterProductCode: "Entrez un code produit unique",
    quantity: "Quantité *",
    unit: "Unité",
    pieces: "Pièces",
    kilograms: "Kilogrammes",
    liters: "Litres",
    meters: "Mètres",
    boxes: "Boîtes",
    packs: "Paquets",
    salePrice: "Prix de vente (RWF) *",
    costPrice: "Prix de revient (RWF)",
    description: "Description",
    optionalDescription: "Description du produit (facultatif)",
    cancel: "Annuler",
    saving: "Enregistrement...",
    updateProduct: "Mettre à jour le produit",
    addProduct: "Ajouter le produit",
  },
};

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: ProductFormData) => void;
  editingProduct?: ProductFormData | null;
  existingCodes?: string[];
}

export interface ProductFormData {
  itemName: string;
  itemCode: string;
  quantity: number;
  price: number;
  cost?: number;
  description?: string;
  unit?: string;
  /** Set when user picks a new image; uploaded after product save via `/api/images/overrides`. */
  imageFile?: File;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPT_IMAGES = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif';

export default function AddProductModal({ 
  isOpen, 
  onClose, 
  onSave, 
  editingProduct, 
  existingCodes = [],
}: AddProductModalProps) {
  const language = useLanguageStore((s) => s.language);
  const ui = PRODUCT_MODAL_UI[language] ?? PRODUCT_MODAL_UI.en;
  const [formData, setFormData] = useState<ProductFormData>({
    itemName: '',
    itemCode: '',
    quantity: 0,
    price: 0,
    cost: 0,
    description: '',
    unit: 'PCS'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [priceWarning, setPriceWarning] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearImage = useCallback(() => {
    setImageFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  useEffect(() => {
    if (editingProduct) {
      setFormData({
        itemName: editingProduct.itemName || '',
        itemCode: editingProduct.itemCode || '',
        quantity: editingProduct.quantity || 0,
        price: editingProduct.price || 0,
        cost: editingProduct.cost || 0,
        description: editingProduct.description || '',
        unit: editingProduct.unit || 'PCS',
      });
    } else {
      setFormData({
        itemName: '',
        itemCode: '',
        quantity: 0,
        price: 0,
        cost: 0,
        description: '',
        unit: 'PCS',
      });
    }
    clearImage();
    setErrors({});
    setPriceWarning(null);
  }, [editingProduct, isOpen, clearImage]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const applyImageFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, image: ui.alertImageType }));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErrors((prev) => ({
        ...prev,
        image: ui.alertImageSize(Math.round(MAX_IMAGE_BYTES / (1024 * 1024))),
      }));
      return;
    }
    setErrors((prev) => {
      const next = { ...prev };
      delete next.image;
      return next;
    });
    setImageFile(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    setPriceWarning(null);

    if (!formData.itemName.trim()) {
      newErrors.itemName = ui.errNameRequired;
    }

    if (!formData.itemCode.trim()) {
      newErrors.itemCode = ui.errCodeRequired;
    } else {
      // Prevent duplicate product codes 
      const codeToCheck = formData.itemCode.trim().toUpperCase();
      const isEditingSameCode =
        editingProduct &&
        editingProduct.itemCode.toUpperCase() === codeToCheck;
      if (
        !isEditingSameCode &&
        existingCodes.some(c => c.toUpperCase() === codeToCheck)
      ) {
        newErrors.itemCode =
          "This product code already exists. Please enter a unique code.";
      }
    }

    if (formData.quantity < 0) {
      newErrors.quantity = ui.errQuantity;
    }

    if (formData.price <= 0) {
      newErrors.price = ui.errPrice;
    }

    if (formData.cost && formData.cost < 0) {
      newErrors.cost = ui.errCost;
    }

    // Warn when selling price is below cost price 
    if (
      formData.price > 0 &&
      formData.cost &&
      formData.cost > 0 &&
      formData.price < formData.cost
    ) {
      const loss = (formData.cost - formData.price).toFixed(0);
      setPriceWarning(
        `⚠️ Sale price is ${loss} RWF below cost price — you will sell at a loss.`
      );
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      const payload: ProductFormData = { ...formData };
      if (imageFile) payload.imageFile = imageFile;
      await onSave(payload);
      onClose();
    } catch (error) {
      console.error('Error saving product:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (
    field: Exclude<keyof ProductFormData, 'imageFile'>,
    value: string | number,
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  /** Digits only, strip leading zeros; empty → 0 (field shows blank when stock is 0). */
  const parseQuantityInput = (raw: string): number => {
    const digits = raw.replace(/\D/g, "")
    const noLeading = digits.replace(/^0+/, "")
    if (noLeading === "") return 0
    const n = Number.parseInt(noLeading, 10)
    return Number.isFinite(n) ? n : 0
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {editingProduct ? ui.editProduct : ui.addNewProduct}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            disabled={saving}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Product image (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{ui.productImage}</label>
            <p className="mb-2 text-xs text-gray-500">
              {ui.imageHint}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_IMAGES}
              className="sr-only"
              disabled={saving}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f) applyImageFile(f);
              }}
            />
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onClick={() => !saving && fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const f = e.dataTransfer.files?.[0];
                if (f) applyImageFile(f);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 transition ${
                errors.image ? 'border-red-400 bg-red-50/50' : 'border-gray-300 bg-gray-50/80 hover:border-blue-400 hover:bg-blue-50/40'
              } ${saving ? 'pointer-events-none opacity-60' : ''}`}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Selected product preview"
                  className="max-h-40 w-auto max-w-full rounded-lg object-contain shadow-sm"
                />
              ) : (
                <>
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                    <ImagePlus className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="text-center text-sm font-medium text-gray-800">
                    {ui.tapToDrop}
                  </span>
                  <span className="text-center text-xs text-gray-500">{ui.upTo}</span>
                </>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => !saving && fileInputRef.current?.click()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
              >
                <Upload className="h-4 w-4" aria-hidden />
                {ui.browseFiles}
              </button>
              {(imageFile || previewUrl) && (
                <button
                  type="button"
                  onClick={clearImage}
                  disabled={saving}
                  className="text-sm font-medium text-red-600 hover:underline"
                >
                  {ui.removeImage}
                </button>
              )}
            </div>
            {errors.image && <p className="text-red-500 text-xs mt-1">{errors.image}</p>}
          </div>

          {/* Product Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {ui.productName}
            </label>
            <input
              type="text"
              required
              value={formData.itemName}
              onChange={(e) => handleInputChange('itemName', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.itemName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder={ui.enterProductName}
              disabled={saving}
            />
            {errors.itemName && (
              <p className="text-red-500 text-xs mt-1">{errors.itemName}</p>
            )}
          </div>

          {/* Product Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {ui.productCode}
            </label>
            <input
              type="text"
              required
              value={formData.itemCode}
              onChange={(e) => handleInputChange('itemCode', e.target.value.toUpperCase())}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.itemCode ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder={ui.enterProductCode}
              disabled={saving}
            />
            {errors.itemCode && (
              <p className="text-red-500 text-xs mt-1">{errors.itemCode}</p>
            )}
          </div>

          {/* Quantity and Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {ui.quantity}
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={formData.quantity === 0 ? "" : String(formData.quantity)}
                onChange={(e) => handleInputChange("quantity", parseQuantityInput(e.target.value))}
                className={`w-full min-h-[52px] px-4 py-3 text-center text-xl font-semibold tabular-nums tracking-wide border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.quantity ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="—"
                disabled={saving}
                aria-label="Quantity in stock"
              />
              {errors.quantity && (
                <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {ui.unit}
              </label>
              <select
                value={formData.unit}
                onChange={(e) => handleInputChange('unit', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              >
                <option value="PCS">{ui.pieces}</option>
                <option value="KG">{ui.kilograms}</option>
                <option value="L">{ui.liters}</option>
                <option value="M">{ui.meters}</option>
                <option value="BOX">{ui.boxes}</option>
                <option value="PACK">{ui.packs}</option>
              </select>
            </div>
          </div>

          {/* Price and Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {ui.salePrice}
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.price ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="0.00"
                disabled={saving}
              />
              {errors.price && (
                <p className="text-red-500 text-xs mt-1">{errors.price}</p>
              )}
              {priceWarning && (
                <p className="text-orange-500 text-xs mt-1 font-medium">
                  {priceWarning}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {ui.costPrice}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.cost}
                onChange={(e) => handleInputChange('cost', parseFloat(e.target.value) || 0)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.cost ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="0.00"
                disabled={saving}
              />
              {errors.cost && (
                <p className="text-red-500 text-xs mt-1">{errors.cost}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {ui.description}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={ui.optionalDescription}
              rows={3}
              disabled={saving}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              disabled={saving}
            >
              {ui.cancel}
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition"
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="inline-block animate-spin mr-2">⏳</span>
                  {ui.saving}
                </>
              ) : (
                editingProduct ? ui.updateProduct : ui.addProduct
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}