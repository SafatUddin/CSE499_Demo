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
  X
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
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductSku, setNewProductSku] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductInventory, setNewProductInventory] = useState('');

  const [personaTone, setPersonaTone] = useState(persona.tone);
  const [personaStyle, setPersonaStyle] = useState<'bullets' | 'narrative'>(persona.style);
  const [personaInstructions, setPersonaInstructions] = useState(persona.customInstructions);
  const [autoFinalizeOrdersAlways, setAutoFinalizeOrdersAlways] = useState(!!persona.autoFinalizeOrdersAlways);

  const [isSavingPersona, setIsSavingPersona] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [addProductError, setAddProductError] = useState('');
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [personaError, setPersonaError] = useState('');
  const [deleteError, setDeleteError] = useState('');

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
        customInstructions: personaInstructions,
        autoFinalizeOrdersAlways
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
      <DashboardHeader 
        searchPlaceholder="Search catalog…" 
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
      />

      <div className="w-full flex-grow space-y-6 p-6 md:p-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left column: Neural indexed products (Grey 2: 7 Cols) */}
          <div className="lg:col-span-7 zone-b-grey2 p-6 space-y-5">
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
                        <td className="p-4 font-sans font-bold text-white">{p.name}</td>
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

          {/* Right column: AI Agent Persona (Grey 3: 5 Cols / ~420px) */}
          <div className="lg:col-span-5 zone-b-grey3 p-6 space-y-5">
            <div className="pb-4 border-b border-white/[0.07]">
              <h3 className="font-sans font-bold text-[19px] text-white flex items-center gap-2 tracking-tight">
                <Sparkles className="text-[#7aa8ff] h-5 w-5" />
                AI agent persona
              </h3>
              <p className="text-[13px] text-white/55 mt-0.5">
                Parameters guiding real-time automated merchant responses
              </p>
            </div>

            {/* Tone of voice */}
            <div className="space-y-2 text-left">
              <label className="text-[11px] text-white/60 font-bold tracking-[0.10em] block">
                Tone-of-voice guidelines
              </label>
              <textarea
                rows={3}
                value={personaTone}
                onChange={(e) => setPersonaTone(e.target.value)}
                className="w-full zone-b-input p-3 font-sans text-xs outline-none resize-none"
                placeholder="e.g. Professional, high-end, elegant"
              />
            </div>

            {/* Response layout style (§5.8 Segmented Control) */}
            <div className="space-y-2 text-left">
              <label className="text-[11px] text-white/60 font-bold tracking-[0.10em] block">
                Response layout style
              </label>
              <div className="grid grid-cols-2 bg-black/45 border border-white/10 p-1 rounded-[13px]">
                <button
                  type="button"
                  onClick={() => setPersonaStyle('bullets')}
                  className={`py-2 rounded-lg font-sans text-[12px] font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    personaStyle === 'bullets'
                      ? 'bg-gradient-to-b from-white/20 to-white/[0.07] border border-white/20 text-white shadow-md'
                      : 'text-white/55 hover:text-white'
                  }`}
                >
                  <List className="h-4 w-4" />
                  Bullet points
                </button>
                <button
                  type="button"
                  onClick={() => setPersonaStyle('narrative')}
                  className={`py-2 rounded-lg font-sans text-[12px] font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    personaStyle === 'narrative'
                      ? 'bg-gradient-to-b from-white/20 to-white/[0.07] border border-white/20 text-white shadow-md'
                      : 'text-white/55 hover:text-white'
                  }`}
                >
                  <MessageCircle className="h-4 w-4" />
                  Conversational
                </button>
              </div>
            </div>

            {/* Custom sales rules */}
            <div className="space-y-2 text-left">
              <label className="text-[11px] text-white/60 font-bold tracking-[0.10em] block">
                Direct sales rules & guardrails
              </label>
              <textarea
                rows={4}
                value={personaInstructions}
                onChange={(e) => setPersonaInstructions(e.target.value)}
                className="w-full zone-b-input p-3 font-sans text-xs outline-none resize-none"
                placeholder="e.g. Free shipping on orders over $150. Suggest adding complementary accessories."
              />
            </div>

            {/* Order auto-finalization segmented control */}
            <div className="space-y-2 text-left">
              <label className="text-[11px] text-white/60 font-bold tracking-[0.10em] block">
                Order auto-finalization
              </label>
              <p className="text-[12px] text-white/50 leading-relaxed">
                When a customer explicitly confirms their order details, should the AI place the order automatically?
              </p>
              <div className="grid grid-cols-2 bg-black/45 border border-white/10 p-1 rounded-[13px]">
                <button
                  type="button"
                  onClick={() => setAutoFinalizeOrdersAlways(false)}
                  className={`py-2 rounded-lg font-sans text-[12px] font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    !autoFinalizeOrdersAlways
                      ? 'bg-gradient-to-b from-white/20 to-white/[0.07] border border-white/20 text-white shadow-md'
                      : 'text-white/55 hover:text-white'
                  }`}
                >
                  AI managed only
                </button>
                <button
                  type="button"
                  onClick={() => setAutoFinalizeOrdersAlways(true)}
                  className={`py-2 rounded-lg font-sans text-[12px] font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    autoFinalizeOrdersAlways
                      ? 'bg-gradient-to-b from-white/20 to-white/[0.07] border border-white/20 text-white shadow-md'
                      : 'text-white/55 hover:text-white'
                  }`}
                >
                  Always
                </button>
              </div>
              <p className="text-[11px] status-warning p-2.5 rounded-xl leading-relaxed mt-2">
                {autoFinalizeOrdersAlways
                  ? 'The AI can finalize a confirmed order even when Copilot is set to Manual.'
                  : 'The AI auto-finalizes orders only when Copilot is set to AI managed.'}
              </p>
            </div>

            {/* Model redeployment button */}
            <div className="pt-4 border-t border-white/[0.07] space-y-3">
              <button
                onClick={handleSavePersonaClick}
                disabled={isSavingPersona}
                className="w-full btn-light-primary py-3 rounded-xl font-sans font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {isSavingPersona ? 'Redeploying model…' : 'Redeploy persona model'}
              </button>

              <AnimatePresence>
                {personaError && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="status-danger p-3 rounded-xl text-center font-sans text-xs flex items-center justify-center gap-2"
                  >
                    <AlertCircle className="h-4 w-4" /> {personaError}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showSaveSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="status-success p-3 rounded-xl text-center font-sans text-xs flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" /> Model redeployed successfully!
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
