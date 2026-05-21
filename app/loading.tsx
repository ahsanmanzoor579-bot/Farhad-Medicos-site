export default function Loading() {
  return (
    <div className="fixed inset-0 bg-slate-50/80 backdrop-blur-md flex items-center justify-center z-[100]">
      <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 border border-slate-100">
        <div className="relative w-20 h-20 mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
          <div className="absolute inset-0 rounded-full border-4 border-teal-500 border-t-transparent animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center text-teal-500 font-bold text-xl">
            FM
          </div>
        </div>
        <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Loading...</h2>
        <p className="text-slate-500 font-medium text-center text-sm">
          Please wait while we securely load Farhad Medicos data.
        </p>
      </div>
    </div>
  );
}
