import Dashboard from '@/components/dashboard/Dashboard';
import { getDashboardData, getInventoryData, getCategories, getTodaySalesDetails } from './actions';
import { Database, AlertTriangle, Terminal, HelpCircle } from 'lucide-react';

// Disable page static cache caching to always get real-time MongoDB data on reload
export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function Home() {
  try {
    
    const [stats, inventory, categories, todaySales] = await Promise.all([
      getDashboardData(),
      getInventoryData(),
      getCategories(),
      getTodaySalesDetails()
    ]);

    return (
      <main>
        <Dashboard 
          stats={stats} 
          inventory={inventory} 
          categories={categories}
          todaySales={todaySales}
        />
      </main>
    );
  } catch (error) {
    console.warn('MongoDB connection failed, showing database setup assistant:', error);
    
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white flex items-center justify-center p-6">
        <div className="max-w-3xl w-full bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
          {/* Decorative glowing blobs */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl"></div>

          {/* Header */}
          <div className="flex items-center space-x-4 mb-8">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
              <Database className="w-8 h-8 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Farhad Medicos</h1>
              <p className="text-slate-400 text-sm mt-0.5">Database Configuration Assistant</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-emerald-400" />
                MongoDB Atlas Setup is Required
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                We have successfully migrated the application backend to MongoDB Atlas! To get started, you need to add your free MongoDB Atlas database connection string to your <code className="px-1.5 py-0.5 bg-slate-800 rounded text-emerald-300 text-xs">.env</code> file.
              </p>
            </div>

            {/* Steps list */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                Easy Step-by-Step Instructions
              </h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-none w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400">1</div>
                  <div>
                    <h4 className="font-semibold text-slate-200 text-sm">Create Free MongoDB Atlas Account</h4>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Go to <a href="https://mongodb.com/atlas" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline hover:text-emerald-300">mongodb.com/atlas</a> and register a free account.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-none w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400">2</div>
                  <div>
                    <h4 className="font-semibold text-slate-200 text-sm">Deploy an "M0 Free" Cluster</h4>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Create a new database deployment, select the <b>M0 Free</b> tier (100% free forever, no credit card required), and click <b>Create Deployment</b>.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-none w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400">3</div>
                  <div>
                    <h4 className="font-semibold text-slate-200 text-sm">Configure Security Credentials</h4>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Create a database username (e.g. <code className="bg-slate-800 px-1 py-0.2 rounded text-emerald-400">admin</code>) and password. Under Network Access, click <b>Add IP Address</b> and choose <b>Allow Access From Anywhere</b> (IP: <code className="bg-slate-800 px-1 py-0.2 rounded text-emerald-400">0.0.0.0/0</code>).
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-none w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400">4</div>
                  <div>
                    <h4 className="font-semibold text-slate-200 text-sm">Get Connection String & Add to .env</h4>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Click <b>Connect</b>, select <b>Drivers</b>, and copy the Node.js connection string. Open the <code className="px-1.5 py-0.5 bg-slate-800 rounded text-emerald-300 text-xs">.env</code> file in your project folder, and add it like this:
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Code Snippet Box */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 relative">
              <div className="absolute top-3 right-4 flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500/60"></span>
                <span className="w-3 h-3 rounded-full bg-amber-500/60"></span>
                <span className="w-3 h-3 rounded-full bg-emerald-500/60"></span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 uppercase flex items-center gap-1.5 mb-3">
                <Terminal className="w-3.5 h-3.5 text-slate-400" />
                Configure .env File
              </span>
              <pre className="font-mono text-xs text-slate-300 overflow-x-auto select-all">
{`# Replace <password> with your actual database password!
MONGODB_URI="mongodb+srv://admin:<password>@cluster0.xxxxxx.mongodb.net/farhad-medicos?retryWrites=true&w=majority&appName=Cluster0"`}
              </pre>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t border-slate-800/80 text-xs text-slate-400">
              <p>
                💡 <b>Tip:</b> After saving your <code className="px-1 bg-slate-800 rounded text-slate-300">.env</code> file, restart the development server using <code className="px-1 bg-slate-800 rounded text-slate-300">npm run dev</code> for changes to take effect!
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }
}
