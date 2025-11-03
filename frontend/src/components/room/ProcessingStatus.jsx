import { Loader2, CheckCircle2 } from 'lucide-react';

function ProcessingStatus({ isProcessing, isComplete }) {
  return (
    <div className="card text-center">
      {isProcessing && (
        <div className="space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <div>
            <h3 className="text-xl font-semibold text-dark-text mb-2">
              Processing your recording...
            </h3>
            <p className="text-dark-text-muted">
              This may take a few moments. Please don't close this page.
            </p>
          </div>
        </div>
      )}

      {isComplete && (
        <div className="space-y-4">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
          <div>
            <h3 className="text-xl font-semibold text-dark-text mb-2">
              Recording is ready!
            </h3>
            <p className="text-dark-text-muted">
              Redirecting to dashboard...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProcessingStatus;
