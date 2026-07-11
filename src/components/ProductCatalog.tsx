import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, 
  Sparkles, 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle, 
  AlertCircle,
  List,
  MessageCircle,
  X,
  FileText
} from 'lucide-react';
import { Product, AIPersona } from '../types';
import DashboardHeader from './DashboardHeader';

interface ProductCatalogProps {
  products: Product[];
  persona: AIPersona;
  onAddProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onSavePersona: (newPersona: AIPersona) => Promise<void>;
}

export default function ProductCatalog({ 
  products, 
  persona, 
  onAddProduct, 
  onDeleteProduct, 
  onSavePersona 
}: ProductCatalogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Product add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductSku, setNewProductSku] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductInventory, setNewProductInventory] = useState('');

  // AI Settings state
  const [personaTone, setPersonaTone] = useState(persona.tone);
  const [personaStyle, setPersonaStyle] = useState<'bullets' | 'narrative'>(persona.style);
  const [personaInstructions, setPersonaInstructions] = useState(persona.customInstructions);
  
  const [isSavingPersona, setIsSavingPersona] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [addProductError, setAddProductError] = useState('');
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [personaError, setPersonaError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Filter products based on search term
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
      await onAddProduct({
        name: newProductName,
        sku: newProductSku,
        price: parseFloat(newProductPrice) || 0.0,
        inventory: parseInt(newProductInventory) || 0,
        status: 'Trained'
      });

      // Reset Form
      setNewProductName('');
      setNewProductSku('');
      setNewProductPrice('');
      setNewProductInventory('');
      setShowAddForm(false);
    } catch (err: any) {
      setAddProductError(err.message || 'Failed to add product.');
    } finally {
      setIsAddingProduct(false);
    }
  };

  const handleDeleteClick = async (id: string) => {
    setDeleteError('');
    try {
      await onDeleteProduct(id);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete product.');
    }
  };

  const handleSavePersonaClick = async () => {
    setPersonaError('');
    setIsSavingPersona(true);
    try {
      await onSavePersona({
        tone: personaTone,
        style: personaStyle,
        customInstructions: personaInstructions
      });
      setShowSaveSuccess(true);
      setTimeout(() => {
        setShowSaveSuccess(false);
      }, 3000);
    } catch (err: any) {
      setPersonaError(err.message || 'Failed to save persona.');
    } finally {
      setIsSavingPersona(false);
    }
  };

  return (
    <div className="w-full flex-grow flex flex-col text-left">
      {/* Page header with search functionality linked */}
      <DashboardHeader 
        title="SHOPMATE MERCHANT" 
        searchPlaceholder="Search catalog..." 
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
      />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-4 sm:py-6 md:py-8 lg:py-10 w-full flex-grow space-y-6 pb-16">

      {/* Main split grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left column: Product Table (7 Columns) */}
        <div className="lg:col-span-7 bg-[#0c0c0e]/80 border border-white/[0.06] rounded-xl p-5 space-y-5">
          
          <div className="flex justify-between items-center pb-3 border-b border-white/[0.04]">
            <div>
              <h3 className="font-sans font-bold text-base text-white tracking-tight">Neural Indexed Products</h3>
              <p className="text-[11px] text-white/45 mt-0.5">
                {filteredProducts.length} items verified inside model weight context
              </p>
            </div>

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-white hover:bg-white/90 text-black font-sans font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all active:scale-[0.98] text-[10px] uppercase tracking-wider"
            >
              {showAddForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              {showAddForm ? 'Cancel' : 'Add Product'}
            </button>
          </div>

          {/* Add Product inline modal panel */}
          <AnimatePresence>
            {showAddForm && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleAddProductSubmit}
                className="bg-[#121215] border border-white/[0.06] p-4 rounded-xl space-y-4 overflow-hidden text-left"
              >
                <h4 className="font-sans font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" /> Register New Product SKU
                </h4>

                {addProductError && (
                  <div className="bg-[#ea4335]/10 border border-[#ea4335]/20 text-[#ea4335] text-[11px] p-2.5 rounded text-center font-sans">
                    {addProductError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[9px] text-white/40 uppercase tracking-widest block font-bold">Product Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Silk Blazer"
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      className="w-full bg-[#0a0a0c] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-white/20 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-white/40 uppercase tracking-widest block font-bold">SKU Number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SB-1002"
                      value={newProductSku}
                      onChange={(e) => setNewProductSku(e.target.value)}
                      className="w-full bg-[#0a0a0c] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-white/20 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[9px] text-white/40 uppercase tracking-widest block font-bold">Price (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="240.00"
                      value={newProductPrice}
                      onChange={(e) => setNewProductPrice(e.target.value)}
                      className="w-full bg-[#0a0a0c] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-white/20 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-white/40 uppercase tracking-widest block font-bold">Initial Stock Level</label>
                    <input
                      type="number"
                      placeholder="50"
                      value={newProductInventory}
                      onChange={(e) => setNewProductInventory(e.target.value)}
                      className="w-full bg-[#0a0a0c] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-white/20 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isAddingProduct}
                  className="w-full bg-white hover:bg-white/90 text-black font-sans font-bold py-2.5 rounded-lg text-[10px] uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
                >
                  {isAddingProduct ? 'Indexing...' : 'Confirm & Index SKU'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {deleteError && (
            <div className="bg-[#ea4335]/10 border border-[#ea4335]/20 text-[#ea4335] text-[11px] p-2.5 rounded text-center font-sans">
              {deleteError}
            </div>
          )}

          {/* Product Table Wrapper to retain rounded borders with scrolling inside */}
          <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-[#0c0c0e]/30 w-full">
            <div className="max-h-[480px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 w-full">
              <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#121215] border-b border-white/[0.04] text-[9px] font-sans text-white/40 uppercase tracking-widest font-bold">
                  <th className="p-4">Product</th>
                  <th className="p-4">SKU</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Inventory</th>
                  <th className="p-4">AI Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03] font-sans text-xs">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-white/30 font-sans text-xs">
                      No matching products indexed in weights.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-white/[0.01] transition-colors group">
                      <td className="p-4 font-sans font-bold text-white">{p.name}</td>
                      <td className="p-4 font-mono text-xs text-white/30">{p.sku}</td>
                      <td className="p-4 font-sans text-white font-bold">${p.price.toFixed(2)}</td>
                      <td className="p-4 font-sans text-white/50">{p.inventory} units</td>
                      <td className="p-4">
                        {p.status === 'Trained' ? (
                          <span className="inline-flex items-center gap-1 text-[8px] font-sans font-bold text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-2 py-0.5 rounded uppercase tracking-wider">
                            <CheckCircle className="h-2.5 w-2.5" /> Trained
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[8px] font-sans font-bold text-amber-500 bg-amber-500/5 border border-amber-500/10 px-2 py-0.5 rounded uppercase tracking-wider">
                            <AlertCircle className="h-2.5 w-2.5" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeleteClick(p.id)}
                          className="text-white/20 hover:text-red-400 p-1 rounded transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

        {/* Right column: AI Persona Configuration (5 Columns) */}
        <div className="lg:col-span-5 bg-[#0c0c0e]/80 border border-white/[0.06] rounded-xl p-5 space-y-5">
          <div className="pb-3 border-b border-white/[0.04]">
            <h3 className="font-sans font-bold text-base text-white flex items-center gap-2 tracking-tight">
              <Sparkles className="text-white/60 h-4 w-4" />
              AI Agent Persona
            </h3>
            <p className="text-[11px] text-white/45 mt-0.5">
              Parameters guiding real-time automated conversations
            </p>
          </div>

          {/* Tone configuration */}
          <div className="space-y-1.5 text-left">
            <label className="text-[9px] text-white/40 uppercase tracking-widest block font-bold">
              Tone of Voice Guidelines
            </label>
            <textarea
              rows={3}
              value={personaTone}
              onChange={(e) => setPersonaTone(e.target.value)}
              className="w-full bg-[#121215] border border-white/[0.06] rounded-lg p-3 font-sans text-xs text-white placeholder-white/20 outline-none focus:border-white/20 transition-all resize-none"
              placeholder="e.g. Professional, high-end, elegant"
            />
          </div>

          {/* Response Style config */}
          <div className="space-y-1.5 text-left">
            <label className="text-[9px] text-white/40 uppercase tracking-widest block font-bold">
              Response Layout Style
            </label>
            <div className="grid grid-cols-2 bg-[#121215] border border-white/[0.06] p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setPersonaStyle('bullets')}
                className={`py-1.5 rounded-md font-sans text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  personaStyle === 'bullets'
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/45 hover:text-white'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                Bullet Points
              </button>
              <button
                type="button"
                onClick={() => setPersonaStyle('narrative')}
                className={`py-1.5 rounded-md font-sans text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  personaStyle === 'narrative'
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/45 hover:text-white'
                }`}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Conversational
              </button>
            </div>
          </div>

          {/* Custom store instructions */}
          <div className="space-y-1.5 text-left">
            <label className="text-[9px] text-white/40 uppercase tracking-widest block font-bold">
              Direct Sales Rules & Guardrails
            </label>
            <textarea
              rows={4}
              value={personaInstructions}
              onChange={(e) => setPersonaInstructions(e.target.value)}
              className="w-full bg-[#121215] border border-white/[0.06] rounded-lg p-3 font-sans text-xs text-white placeholder-white/20 outline-none focus:border-white/20 transition-all resize-none"
              placeholder="e.g. Free shipping on orders over $150. Suggest adding Void Audio One."
            />
          </div>

          {/* Model redeployment trigger */}
          <div className="pt-4 border-t border-white/[0.04] space-y-3">
            <button
              onClick={handleSavePersonaClick}
              disabled={isSavingPersona}
              className="w-full bg-white hover:bg-white/95 text-black py-2.5 rounded-lg font-sans font-bold text-[10px] uppercase tracking-wider transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {isSavingPersona ? 'REDEPLOYING MODEL...' : 'REDEPLOY PERSONA MODEL'}
            </button>

            {/* Model redeployment error notification */}
            <AnimatePresence>
              {personaError && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="bg-red-500/5 border border-red-500/10 p-2.5 rounded-lg text-center text-red-400 font-sans text-[9px] tracking-wider uppercase flex items-center justify-center gap-1.5"
                >
                  <AlertCircle className="h-3.5 w-3.5" /> {personaError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Model redeployment success status notifications */}
            <AnimatePresence>
              {showSaveSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded-lg text-center text-emerald-400 font-sans text-[9px] tracking-wider uppercase flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="h-3.5 w-3.5" /> Model redeployed successfully!
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
