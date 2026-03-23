import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ships } from '../../services/api';
import { createShipInteriorScene } from '../../engine/interiorBlueprints';
import TraversalScene from './TraversalScene';
import Breadcrumb from '../common/Breadcrumb';
import LoadingScreen from '../common/LoadingScreen';

function ShipInteriorView({ user }) {
  const { shipId } = useParams();
  const [scene, setScene] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        const response = await ships.getById(shipId);
        if (cancelled) return;
        const ship = response.data?.data?.ship;
        setScene(createShipInteriorScene(ship, user));
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || err.message || 'Failed to load ship interior');
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [shipId, user]);

  if (error) {
    return <div className="p-8 text-center text-red-400">{error}</div>;
  }

  if (!scene) return <LoadingScreen variant="ship" />;

  return (
    <div className="relative w-full h-screen">
      <div className="absolute top-4 left-4 z-20 pointer-events-auto">
        <Breadcrumb items={[{ label: 'Ships', path: '/ships' }, { label: 'Interior' }]} />
      </div>
      <TraversalScene scene={scene} />
    </div>
  );
}

export default ShipInteriorView;
