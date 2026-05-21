'use client';

import { useState } from 'react';
import { X, Upload, FileText, Database, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { importPakistaniMedicines, importCustomMedicines } from '@/app/actions';
import { useRouter } from 'next/navigation';

export default function ImportDbModal({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'default' | 'custom'>('default');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [parsedCount, setParsedCount] = useState<number | null>(null);
  const [pendingData, setPendingData] = useState<any[] | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const router = useRouter();

  if (!isOpen) return null;

  const handleImportDefaults = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await importPakistaniMedicines();
      router.refresh();
      setSuccess('Default Pakistani catalog imported successfully! All base medicines and standard initial batches have been loaded.');
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to import default database catalog.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    setError(null);
    setSuccess(null);
    setParsedCount(null);
    setPendingData(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        let data: any[] = [];

        if (file.name.endsWith('.json')) {
          data = JSON.parse(text);
          if (!Array.isArray(data)) {
            throw new Error('JSON file must contain an array of medicine objects.');
          }
        } else if (file.name.endsWith('.csv')) {
          data = parseCSV(text);
        } else {
          throw new Error('Unsupported file format. Please upload a .csv or .json file.');
        }

        if (data.length === 0) {
          throw new Error('The uploaded file contains no data.');
        }

        // Validate basic structure of the first item
        const first = data[0];
        if (!first.name || !first.genericFormula || !first.categoryName) {
          throw new Error('Invalid file structure. Make sure each record has "name", "genericFormula", and "categoryName" columns.');
        }

        setPendingData(data);
        setParsedCount(data.length);
      } catch (err: any) {
        setError(err.message || 'Failed to parse the uploaded file. Check formatting.');
        setFileName('');
      }
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];

    // Clean headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const results: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Handle simple CSV cell splits while respecting quotes containing commas
      const values: string[] = [];
      let insideQuote = false;
      let currentVal = '';

      for (let charIndex = 0; charIndex < line.length; charIndex++) {
        const char = line[charIndex];
        if (char === '"' || char === "'") {
          insideQuote = !insideQuote;
        } else if (char === ',' && !insideQuote) {
          values.push(currentVal.trim().replace(/^["']|["']$/g, ''));
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
      values.push(currentVal.trim().replace(/^["']|["']$/g, ''));

      const row: Record<string, any> = {};
      headers.forEach((header, index) => {
        let val: any = values[index] !== undefined ? values[index] : '';

        // Numeric fields conversion
        if (['minStockLevel', 'stripsPerBox', 'purchasePrice', 'retailPrice', 'quantity'].includes(header)) {
          val = val !== '' ? Number(val) : undefined;
        }
        // Force uppercase for Units
        if (header === 'defaultSellingUnit' || header === 'unit') {
          val = val.toUpperCase();
        }
        row[header] = val;
      });

      results.push(row);
    }
    return results;
  };

  const handleImportCustom = async () => {
    if (!pendingData) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await importCustomMedicines(pendingData);
      router.refresh();
      setSuccess(`Success! Successfully imported ${pendingData.length} medicine records and stock into the database.`);
      setPendingData(null);
      setFileName('');
      setParsedCount(null);
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to import custom file data into the database.');
    } finally {
      setLoading(false);
    }
  };

  // Premium inline generator for download templates
  const downloadTemplate = (format: 'csv' | 'json') => {
    let content = '';
    let mimeType = '';
    let filename = '';

    if (format === 'csv') {
      content = 'name,genericFormula,categoryName,minStockLevel,rackLocation,stripsPerBox,defaultSellingUnit,barcode,batchNumber,expiryDate,purchasePrice,retailPrice,quantity,unit\n' +
                'Panadol 500mg,Paracetamol,Painkillers,10,Rack A-1,10,STRIP,8961122000001,B-9981,2027-12-31,180,220,50,BOX\n' +
                'Voltral 50mg,Diclofenac Sodium,Painkillers,15,Rack A-2,20,STRIP,8961122000002,B-9982,2027-10-15,300,380,20,BOX';
      mimeType = 'text/csv;charset=utf-8;';
      filename = 'medicine_import_template.csv';
    } else {
      const template = [
        {
          name: "Panadol 500mg",
          genericFormula: "Paracetamol",
          categoryName: "Painkillers",
          minStockLevel: 10,
          rackLocation: "Rack A-1",
          stripsPerBox: 10,
          defaultSellingUnit: "STRIP",
          barcode: "8961122000001",
          batchNumber: "B-9981",
          expiryDate: "2027-12-31",
          purchasePrice: 180,
          retailPrice: 220,
          quantity: 50,
          unit: "BOX"
        }
      ];
      content = JSON.stringify(template, null, 2);
      mimeType = 'application/json;charset=utf-8;';
      filename = 'medicine_import_template.json';
    }

    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-gradient-to-r from-teal-500/10 to-blue-500/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-teal-500 to-blue-600 rounded-xl text-white shadow-md">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Import Database</h2>
              <p className="text-xs text-slate-500 mt-0.5">Load inventory records in bulk</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-100 p-2 gap-2 bg-slate-50 flex-shrink-0">
          <button
            onClick={() => { setActiveTab('default'); setError(null); setSuccess(null); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'default' ? 'bg-white text-teal-800 shadow-sm border border-teal-100/50' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Default Catalog
          </button>
          <button
            onClick={() => { setActiveTab('custom'); setError(null); setSuccess(null); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'custom' ? 'bg-white text-teal-800 shadow-sm border border-teal-100/50' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Upload Custom File
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl flex items-start gap-3 text-sm animate-in slide-in-from-top-2 duration-200">
              <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Import Error</p>
                <p className="text-xs text-rose-600/90 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-2xl flex items-start gap-3 text-sm animate-in slide-in-from-top-2 duration-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Success!</p>
                <p className="text-xs text-emerald-600/90 mt-0.5">{success}</p>
              </div>
            </div>
          )}

          {activeTab === 'default' ? (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 text-center">
                <Database className="w-12 h-12 text-teal-500 mx-auto mb-3 opacity-80" />
                <h3 className="font-bold text-slate-800 text-base">Standard Pakistani catalog</h3>
                <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto leading-relaxed">
                  Import a pre-configured database catalog containing top Pakistani brands (Ponstan, Voltral, Caflam, Augmentin, Flagyl, Risek, Surbex Z, Rigix etc.) along with category setups and initialized batches.
                </p>
              </div>

              <div className="border-t border-slate-100 pt-4 flex justify-end">
                <button
                  onClick={handleImportDefaults}
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white rounded-2xl font-bold text-sm shadow-md transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                >
                  {loading ? 'Importing database...' : 'Load Default Catalog'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* File Uploader Drop Area */}
              <div className="relative group border-2 border-dashed border-slate-200 hover:border-teal-500 rounded-3xl p-6 text-center transition-all bg-slate-50/50 hover:bg-teal-50/10">
                <input
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <Upload className="w-10 h-10 text-slate-400 group-hover:text-teal-500 mx-auto mb-3 transition-colors" />
                
                {fileName ? (
                  <div>
                    <p className="font-bold text-teal-700 text-sm flex items-center justify-center gap-1.5">
                      <FileText className="w-4 h-4 text-teal-500" /> {fileName}
                    </p>
                    {parsedCount !== null && (
                      <p className="text-xs text-slate-500 mt-1 font-semibold">Parsed {parsedCount} records successfully!</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="font-bold text-slate-700 text-sm">Drag & drop your inventory file</p>
                    <p className="text-xs text-slate-400 mt-1">Accepts CSV or JSON formats</p>
                  </div>
                )}
              </div>

              {/* Template Section */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-slate-800 text-xs">Need an import template?</h4>
                  <p className="text-slate-400 text-[10px] mt-0.5">Use the exact format expected by the system</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => downloadTemplate('csv')}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:text-teal-600 hover:border-teal-100 text-xs font-bold rounded-xl flex items-center gap-1 shadow-sm transition-all active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV Template
                  </button>
                  <button
                    onClick={() => downloadTemplate('json')}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:text-teal-600 hover:border-teal-100 text-xs font-bold rounded-xl flex items-center gap-1 shadow-sm transition-all active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" /> JSON Template
                  </button>
                </div>
              </div>

              {/* Import Trigger */}
              <div className="border-t border-slate-100 pt-4 flex justify-end">
                <button
                  onClick={handleImportCustom}
                  disabled={loading || !pendingData}
                  className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white rounded-2xl font-bold text-sm shadow-md transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Importing file...' : pendingData ? `Import ${parsedCount} Parsed Records` : 'Upload File to Start'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
