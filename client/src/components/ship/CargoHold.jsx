import { useState, useEffect } from 'react';
import { trade } from '../../services/api';
import { Package, Box, AlertCircle } from 'lucide-react';

const CargoHold = ({ shipId, capacity, used }) => {
    const [cargo, setCargo] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (shipId) fetchCargo();
    }, [shipId]);

    const fetchCargo = async () => {
        try {
            setLoading(true);
            const res = await trade.getCargo(shipId);
            setCargo(res.data.data?.items || []);
        } catch (err) {
            console.error("Failed to fetch cargo manifest", err);
            setError("Manifest unavailable");
        } finally {
            setLoading(false);
        }
    };

    const usedFilter = used !== undefined ? used : (cargo.reduce((acc, item) => acc + (item.volume || item.quantity * (item.volume_per_unit || item.commodity?.volume || 1)), 0));
    const capacityFilter = capacity || 'Unknown';
    const percentFull = capacity ? Math.min(100, (usedFilter / capacity) * 100) : 0;

    if (loading) return <div className="p-4 text-center text-gray-500 animate-pulse">Loading manifest...</div>;
    if (error) return <div className="p-4 text-center text-accent-red flex items-center justify-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>;

    return (
        <div className="card p-6 border-space-700/50">
            <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                <Box className="w-5 h-5 text-accent-orange" />
                Cargo Manifest
            </h3>

            {/* Capacity Bar */}
            <div className="mb-6 space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Hold Capacity</span>
                    <span className={`${percentFull > 90 ? 'text-accent-red' : 'text-accent-cyan'}`}>
                        {usedFilter} / {capacityFilter} m³
                    </span>
                </div>
                <div className="w-full bg-space-900 h-2 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ${percentFull > 90 ? 'bg-accent-red' : 'bg-accent-orange'}`}
                        style={{ width: `${percentFull}%` }}
                    ></div>
                </div>
            </div>

            {/* Cargo List */}
            {cargo.length === 0 ? (
                <div className="text-center py-8 text-gray-600 border border-dashed border-space-800 rounded">
                    Cargo hold is empty.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-space-800 text-gray-400 uppercase text-xs">
                            <tr>
                                <th className="p-3">Commodity</th>
                                <th className="p-3 text-right">Vol/Unit</th>
                                <th className="p-3 text-right">Qty</th>
                                <th className="p-3 text-right">Total Vol</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-space-800">
                            {cargo.map((item, idx) => (
                                <tr key={idx} className="hover:bg-space-800/50">
                                    <td className="p-3 font-medium text-white">
                                        {item.name || item.commodity?.name || 'Unknown Item'}
                                    </td>
                                    <td className="p-3 text-right text-gray-400">
                                        {item.volume_per_unit || item.commodity?.volume || 1}
                                    </td>
                                    <td className="p-3 text-right text-accent-cyan font-mono">
                                        {item.quantity}
                                    </td>
                                    <td className="p-3 text-right text-gray-300 font-mono">
                                        {(item.quantity * (item.volume_per_unit || item.commodity?.volume || 1)).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-space-800/30 font-bold border-t border-space-700 text-gray-300">
                            <tr>
                                <td colSpan="3" className="p-3 text-right">Total Volume</td>
                                <td className="p-3 text-right text-accent-orange">{usedFilter.toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
};

export default CargoHold;
