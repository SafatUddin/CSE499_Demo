import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  X,
  ImagePlus,
  ImageOff
} from 'lucide-react';
import { Product } from '../types';
import DashboardHeader from './DashboardHeader';

interface ProductCatalogProps {
  products: Product[];
  onAddProduct: (product: Omit<Product, 'id'>) => Promise<Product>;
  onDeleteProduct: (id: string) => Promise<void>;
  onUploadProductImage: (id: string, file: File) => Promise<void>;
  onDeleteProductImage: (id: string) => Promise<void>;
}

export default function ProductCatalog({
  products,
  onAddProduct,
  onDeleteProduct,
  onUploadProductImage,
  onDeleteProductImage
}: ProductCatalogProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductSku, setNewProductSku] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductInventory, setNewProductInventory] = useState('');
  const [newProductImageFile, setNewProductImageFile] = useState<File | null>(null);
  const [newProductImagePreview, setNewProductImagePreview] = useState<string | null>(null);

  const [addProductError, setAddProductError] = useState('');
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  const [imageError, setImageError] = useState('');

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName || !newProductSku || !newProductPrice) return;

    setAddProductError('');
    setIsAddingProduct(true);
    try {
      const created = await onAddProduct({
        name: newProductName,
        sku: newProductSku,
        price: parseFloat(newProductPrice) || 0.0,
        inventory: parseInt(newProductInventory) || 0,
        status: 'Trained'
      });

      if (newProductImageFile) {
        try {
          await onUploadProductImage(created.id, newProductImageFile);
        } catch (err: any) {
          setImageError(err.message || 'Product was created, but the photo failed to upload.');
        }
      }

      setNewProductName('');
      setNewProductSku('');
      setNewProductPrice('');
      setNewProductInventory('');
      setNewProductImageFile(null);
      setNewProductImagePreview(null);
      setShowAddForm(false);
    } catch (err: any) {
      setAddProductError(err.message || 'Failed to add product.');
    } finally {
      setIsAddingProduct(false);
    }
  };

  const handleNewProductImageSelect = (file: File | undefined) => {
    setNewProductImageFile(file || null);
    setNewProductImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const handleDeleteClick = async (id: string) => {
    setDeleteError('');
    try {
      await onDeleteProduct(id);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete product.');
    }
  };

  const handleImageSelect = async (id: string, file: File | undefined) => {
    if (!file) return;
    setImageError('');
    setUploadingImageId(id);
    try {
      await onUploadProductImage(id, file);
    } catch (err: any) {
      setImageError(err.message || 'Failed to upload product image.');
    } finally {
      setUploadingImageId(null);
    }
  };

  const handleImageRemove = async (id: string) => {
    setImageError('');
    setUploadingImageId(id);
    try {
      await onDeleteProductImage(id);
    } catch (err: any) {
      setImageError(err.message || 'Failed to remove product image.');
    } finally {
      setUploadingImageId(null);
    }
  };

  return (
    <div className="w-full flex-grow flex flex-col text-left">
      <DashboardHeader
        searchPlaceholder="Search catalog…"
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
      />

      <div className="w-full flex-grow space-y-6 p-6 md:p-8 pb-16">
        <div className="grid grid-cols-1 gap-6 items-start">

          {/* Left column: Neural indexed products (Grey 2: 7 Cols) */}
          <div className="zone-b-grey2 p-6 space-y-5">
            <div className="flex justify-between items-center pb-4 border-b border-white/[0.07]">
              <div>
                <h3 className="font-sans font-bold text-[19px] text-white tracking-tight">Neural indexed products</h3>
                <p className="text-[13px] text-white/55 mt-0.5">
                  {filteredProducts.length} items verified inside model context
                </p>
              </div>

              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="btn-accent px-4 py-2 font-sans font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {showAddForm ? 'Cancel' : 'Add product'}
              </button>
            </div>

            {/* Add product modal panel */}
            <AnimatePresence>
              {showAddForm && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleAddProductSubmit}
                  className="zone-b-grey3 p-5 rounded-2xl space-y-4 overflow-hidden text-left"
                >
                  <h4 className="font-sans font-bold text-sm text-white flex items-center gap-2">
                    <Package className="h-4 w-4 text-[#7aa8ff]" /> Register new product SKU
                  </h4>

                  {addProductError && (
                    <div className="status-danger text-xs p-3 rounded-xl text-center font-sans">
                      {addProductError}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <label
                      className="relative w-16 h-16 rounded-xl overflow-hidden bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0 cursor-pointer group/thumb"
                      title="Add product photo"
                    >
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleNewProductImageSelect(e.target.files?.[0])}
                      />
                      {newProductImagePreview ? (
                        <img src={newProductImagePreview} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ImagePlus className="h-5 w-5 text-white/30" />
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                        <ImagePlus className="h-4 w-4 text-white" />
                      </div>
                    </label>
                    <div className="space-y-1">
                      <p className="text-[12px] text-white/60">Optional product photo</p>
                      {newProductImagePreview && (
                        <button
                          type="button"
                          onClick={() => handleNewProductImageSelect(undefined)}
                          className="text-[11px] text-white/40 hover:text-[#ff9d92] transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <ImageOff className="h-3 w-3" /> Remove photo
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] text-white/60 font-semibold block">Product name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Silk Blazer"
                        value={newProductName}
                        onChange={(e) => setNewProductName(e.target.value)}
                        className="w-full zone-b-input px-3 py-2 text-xs outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-white/60 font-semibold block">SKU number</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. SB-1002"
                        value={newProductSku}
                        onChange={(e) => setNewProductSku(e.target.value)}
                        className="w-full zone-b-input px-3 py-2 text-xs outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] text-white/60 font-semibold block">Price (USD)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="240.00"
                        value={newProductPrice}
                        onChange={(e) => setNewProductPrice(e.target.value)}
                        className="w-full zone-b-input px-3 py-2 text-xs outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-white/60 font-semibold block">Initial inventory level</label>
                      <input
                        type="number"
                        placeholder="50"
                        value={newProductInventory}
                        onChange={(e) => setNewProductInventory(e.target.value)}
                        className="w-full zone-b-input px-3 py-2 text-xs outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isAddingProduct}
                    className="w-full btn-light-primary py-2.5 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isAddingProduct ? 'Indexing…' : 'Confirm & index SKU'}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            {deleteError && (
              <div className="status-danger text-xs p-3 rounded-xl text-center font-sans">
                {deleteError}
              </div>
            )}

            {imageError && (
              <div className="status-danger text-xs p-3 rounded-xl text-center font-sans">
                {imageError}
              </div>
            )}

            {/* Table */}
            <div className="border border-white/[0.07] rounded-2xl overflow-hidden bg-black/30 w-full">
              <div className="max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 w-full">
                <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.05] border-b border-white/[0.07] text-[11px] font-sans text-white/50 tracking-[0.11em] font-bold">
                    <th className="p-4">Product</th>
                    <th className="p-4">SKU</th>
                    <th className="p-4">Price</th>
                    <th className="p-4">Inventory</th>
                    <th className="p-4">AI status</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.055] font-sans text-[14px]">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-white/40 font-sans text-xs">
                        No matching products indexed in neural context.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-white/[0.03] transition-colors group">
                        <td className="p-4 font-sans font-bold text-white">
                          <div className="flex items-center gap-3">
                            <label
                              className="relative w-9 h-9 rounded-lg overflow-hidden bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0 cursor-pointer group/thumb"
                              title={p.imageUrl ? 'Change product photo' : 'Add product photo'}
                            >
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={uploadingImageId === p.id}
                                onChange={(e) => handleImageSelect(p.id, e.target.files?.[0])}
                              />
                              {p.imageUrl ? (
                                <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <ImagePlus className="h-4 w-4 text-white/30" />
                              )}
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                                {uploadingImageId === p.id ? (
                                  <span className="text-[8px] text-white font-bold">...</span>
                                ) : (
                                  <ImagePlus className="h-3.5 w-3.5 text-white" />
                                )}
                              </div>
                            </label>
                            {p.imageUrl && (
                              <button
                                type="button"
                                onClick={() => handleImageRemove(p.id)}
                                disabled={uploadingImageId === p.id}
                                className="text-white/20 hover:text-[#ff9d92] transition-colors cursor-pointer opacity-0 group-hover:opacity-100 disabled:opacity-40"
                                title="Remove product photo"
                              >
                                <ImageOff className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <span>{p.name}</span>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-[12px] text-white/50">{p.sku}</td>
                        <td className="p-4 font-sans text-white font-bold">${p.price.toFixed(2)}</td>
                        <td className="p-4 font-sans text-white/60">{p.inventory} units</td>
                        <td className="p-4">
                          {p.status === 'Trained' ? (
                            <span className="status-success px-2.5 py-1 text-[11px] font-bold rounded-full inline-flex items-center gap-1.5">
                              <CheckCircle className="h-3 w-3" /> Trained
                            </span>
                          ) : (
                            <span className="status-warning px-2.5 py-1 text-[11px] font-bold rounded-full inline-flex items-center gap-1.5">
                              <AlertCircle className="h-3 w-3" /> Pending
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleDeleteClick(p.id)}
                            className="text-white/30 hover:text-[#ff9d92] p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                            title="Delete product"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
