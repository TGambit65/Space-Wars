import { Navigation, AlertTriangle } from 'lucide-react';

const MovementConfirmDialog = ({ target, moving, error, onConfirm, onCancel }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
      <div className="bg-space-900 border border-space-600 rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <Navigation className="w-6 h-6 text-accent-cyan" />
          <h3 className="text-lg font-bold text-white">Confirm Travel</h3>
        </div>

        <div className="mb-4">
          <p className="text-gray-300 text-sm">
            Set course for <span className="text-accent-cyan font-bold">{target.name}</span>?
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-space-800 rounded p-2">
              <span className="text-gray-500">System Type</span>
              <div className="text-gray-300">{target.type}</div>
            </div>
            <div className="bg-space-800 rounded p-2">
              <span className="text-gray-500">Star Class</span>
              <div className="text-gray-300">{target.star_class}</div>
            </div>
            <div className="bg-space-800 rounded p-2">
              <span className="text-gray-500">Hazard Level</span>
              <div className={target.hazard_level > 5 ? 'text-accent-red' : 'text-gray-300'}>
                {target.hazard_level}/10
              </div>
            </div>
            <div className="bg-space-800 rounded p-2">
              <span className="text-gray-500">Port</span>
              <div className="text-gray-300">{target.has_port ? 'Yes' : 'None'}</div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-accent-red/10 border border-accent-red/30 rounded p-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-accent-red flex-shrink-0" />
            <span className="text-xs text-accent-red">{error}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            data-dismiss
            className="btn btn-secondary flex-1"
            disabled={moving}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="btn btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={moving}
          >
            {moving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Traveling...
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4" />
                Engage
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MovementConfirmDialog;
