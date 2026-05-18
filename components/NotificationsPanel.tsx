import { AlertCircle, AlertTriangle } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';

type BatchAlert = {
  id: string;
  medicineName: string;
  batchNumber: string;
  expiryDate: Date;
};

type LowStockAlert = {
  id: string;
  medicineName: string;
  quantity: number;
};

export default function NotificationsPanel({ batches, lowStockAlerts = [] }: { batches: BatchAlert[], lowStockAlerts?: LowStockAlert[] }) {
  const now = new Date();
  
  const alerts = batches.map(batch => {
    const daysRemaining = differenceInDays(batch.expiryDate, now);
    return { ...batch, daysRemaining };
  }).filter(b => b.daysRemaining <= 180)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  if (alerts.length === 0 && lowStockAlerts.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {alerts.map(alert => {
        const isExpired = alert.daysRemaining <= 0;
        
        return (
          <div
            key={alert.id}
            className={`flex items-start p-4 rounded-xl border ${
              isExpired 
                ? 'bg-red-50 border-red-200 text-red-800' 
                : 'bg-yellow-50 border-yellow-200 text-yellow-800'
            }`}
          >
            {isExpired ? (
              <AlertCircle className="w-5 h-5 mt-0.5 mr-3 shrink-0 text-red-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 mt-0.5 mr-3 shrink-0 text-yellow-600" />
            )}
            
            <div>
              <h4 className="font-semibold">
                {isExpired ? 'EXPIRED BATCH ALERT' : 'SHORT EXPIRY ALERT'}
              </h4>
              <p className="text-sm mt-1">
                <span className="font-medium">{alert.medicineName}</span> (Batch: {alert.batchNumber}) 
                {isExpired 
                  ? ` expired on ${format(alert.expiryDate, 'MMM dd, yyyy')}.`
                  : ` expires in ${alert.daysRemaining} days (${format(alert.expiryDate, 'MMM dd, yyyy')}).`}
              </p>
            </div>
          </div>
        );
      })}
      
      {lowStockAlerts.map(alert => (
        <div
          key={alert.id}
          className="flex items-start p-4 rounded-xl border bg-orange-50 border-orange-200 text-orange-800"
        >
          <AlertCircle className="w-5 h-5 mt-0.5 mr-3 shrink-0 text-orange-600" />
          <div>
            <h4 className="font-semibold">CRITICAL LOW STOCK</h4>
            <p className="text-sm mt-1">
              <span className="font-medium">{alert.medicineName}</span> has only {alert.quantity} unit{alert.quantity === 1 ? '' : 's'} remaining across all batches! Please reorder immediately.
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
