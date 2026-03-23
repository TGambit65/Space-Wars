import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { sectors, ships } from '../../services/api';
import { createDerelictBoardingScene } from '../../engine/interiorBlueprints';
import TraversalScene from './TraversalScene';
import Breadcrumb from '../common/Breadcrumb';
import LoadingScreen from '../common/LoadingScreen';

function DerelictBoardingView() {
  const { shipId } = useParams();
  const [scene, setScene] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        const shipResponse = await ships.getById(shipId);
        const ship = shipResponse.data?.data?.ship;
        const sectorId = ship?.currentSector?.sector_id || ship?.current_sector?.sector_id || ship?.current_sector_id;

        let sector = ship?.currentSector || ship?.current_sector || null;
        if (sectorId) {
          const sectorResponse = await sectors.getById(sectorId);
          sector = sectorResponse.data?.data?.sector || sector;
        }

        if (cancelled) return;
        setScene(createDerelictBoardingScene({ ship, sector }));
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || err.message || 'Failed to load derelict scene');
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [shipId]);

  if (error) {
    return <div className="p-8 text-center text-red-400">{error}</div>;
  }

  if (!scene) return <LoadingScreen variant="navigation" />;

  return (
    <div className="relative w-full h-screen">
      <div className="absolute top-4 left-4 z-20 pointer-events-auto">
        <Breadcrumb items={[{ label: 'Ships', path: '/ships' }, { label: 'Derelict Boarding' }]} />
      </div>
      <TraversalScene scene={scene} />
    </div>
  );
}

export default DerelictBoardingView;
