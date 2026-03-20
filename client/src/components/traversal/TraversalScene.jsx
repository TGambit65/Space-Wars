import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import { VoxelEngine } from '../../engine/VoxelEngine';
import { FirstPersonTraversalController } from '../../engine/PlayerController';
import { findActiveTraversalInteraction } from '../../engine/traversalInteractions';
import { getTraversalProfile } from '../../engine/traversalProfiles';
import VoxelHUD from '../colonies/VoxelHUD';
import TraversalInteractionOverlay from './TraversalInteractionOverlay';
import { useNotifications } from '../../contexts/NotificationContext';

function projectSceneMarkers(engine, markers = []) {
  const camera = engine.getCamera();
  const renderer = engine.getRenderer();
  if (!camera || !renderer) return [];

  const viewportWidth = renderer.domElement.clientWidth || 1;
  const viewportHeight = renderer.domElement.clientHeight || 1;
  const safeBottom = viewportHeight - 96;
  const safeTop = 34;

  return markers
    .map((marker) => {
      const projected = new THREE.Vector3(marker.x, marker.y, marker.z).project(camera);
      return {
        ...marker,
        x: Math.min(Math.max(((projected.x + 1) / 2) * viewportWidth, 28), viewportWidth - 28),
        y: Math.min(Math.max(((1 - projected.y) / 2) * viewportHeight, safeTop), safeBottom),
        visible: projected.z > -1 && projected.z < 1,
        offscreen:
          projected.x < -1 || projected.x > 1 || projected.y < -1 || projected.y > 1,
      };
    })
    .filter((marker) => marker.visible);
}

function TraversalScene({ scene }) {
  const navigate = useNavigate();
  const notify = useNotifications();
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const controllerRef = useRef(null);
  const frameRef = useRef(null);
  const recentActionRef = useRef(null);
  const navigationTimeoutRef = useRef(null);

  const profile = useMemo(() => getTraversalProfile(scene?.profileId), [scene?.profileId]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playerPos, setPlayerPos] = useState(null);
  const [flyMode, setFlyMode] = useState(false);
  const [inputState, setInputState] = useState({
    gamepadActive: false,
    gamepadLookEnabled: false,
    pointerLock: false,
    allowFly: profile.controls.allowFly,
    allowJump: profile.controls.allowJump,
    profileId: profile.id,
    profileLabel: profile.label,
  });
  const [previewMarkers, setPreviewMarkers] = useState([]);
  const [activeInteraction, setActiveInteraction] = useState(null);
  const [recentAction, setRecentAction] = useState(null);

  useEffect(() => {
    recentActionRef.current = recentAction;
  }, [recentAction]);

  useEffect(() => {
    let cancelled = false;
    window.render_game_to_text = () => JSON.stringify({
      mode: scene?.id || 'traversal_scene',
      loading: true,
      error: null,
    });

    const initScene = async () => {
      if (!scene || !containerRef.current) return;

      try {
        const engine = new VoxelEngine();
        engine.init(containerRef.current, scene.engine);
        engineRef.current = engine;

        const controller = new FirstPersonTraversalController(
          engine.getCamera(),
          engine.getChunkManager(),
          engine.getRenderer().domElement,
          { profileId: scene.profileId }
        );
        controller.init();
        controller.setPosition(scene.spawn.x, scene.spawn.y, scene.spawn.z);
        controller.yaw = scene.spawn.yaw || 0;
        controller.pitch = scene.spawn.pitch || 0;
        controller.update(0);
        controllerRef.current = controller;

        const clock = new THREE.Clock();
        const tick = () => {
          if (cancelled) return;

          const dt = Math.min(clock.getDelta(), 0.05);
          controller.update(dt);
          const engineInstance = engineRef.current;
          if (!engineInstance) return;

          engineInstance.setPlayerPosition(controller.position.x, controller.position.y, controller.position.z);

          const hasControl = controller.hasControl();
          const camera = engineInstance.getCamera();
          const currentPlayer = controller.getPosition();

          if (!hasControl) {
            if (camera.fov !== 28) {
              camera.fov = 28;
              camera.updateProjectionMatrix();
            }
            camera.position.set(scene.preview.position.x, scene.preview.position.y, scene.preview.position.z);
            camera.lookAt(scene.preview.target.x, scene.preview.target.y, scene.preview.target.z);
            setPreviewMarkers(projectSceneMarkers(engineInstance, scene.markers));
          } else {
            if (camera.fov !== 70) {
              camera.fov = 70;
              camera.updateProjectionMatrix();
            }
            setPreviewMarkers([]);
          }

          const interaction = hasControl
            ? findActiveTraversalInteraction({
              camera,
              playerPosition: currentPlayer,
              interactions: scene.interactions,
            })
            : null;

          if (interaction && controller.consumeInteraction()) {
            const result = interaction.result;
            setRecentAction(result);
            notify.info(result);
            if (interaction.id === 'aft-airlock' || interaction.id === 'breach-exit') {
              if (navigationTimeoutRef.current) {
                clearTimeout(navigationTimeoutRef.current);
              }
              navigationTimeoutRef.current = setTimeout(() => navigate('/ships'), 250);
            }
          }

          setActiveInteraction(interaction);
          setPlayerPos(currentPlayer);
          setFlyMode(controller.flyMode);
          setInputState(controller.getInputState());

          window.render_game_to_text = () => JSON.stringify({
            mode: scene.id,
            title: scene.title,
            subtitle: scene.subtitle,
            loading: false,
            error: null,
            previewMode: !hasControl,
            player: currentPlayer,
            camera: {
              x: camera.position.x,
              y: camera.position.y,
              z: camera.position.z,
              pitch: camera.rotation.x,
              yaw: camera.rotation.y,
            },
            traversalProfile: controller.getProfile(),
            input: controller.getInputState(),
            movement: controller.getMovementState(),
            activeInteraction: interaction ? {
              id: interaction.id,
              label: interaction.label,
              prompt: interaction.prompt,
              distance: Number(interaction.distance.toFixed(2)),
            } : null,
            markers: scene.markers,
            recentAction: recentActionRef.current,
          });

          frameRef.current = requestAnimationFrame(tick);
        };

        frameRef.current = requestAnimationFrame(tick);
        setLoading(false);
      } catch (err) {
        console.error('Failed to initialize traversal scene:', err);
        if (!cancelled) {
          setError(err.message || 'Failed to initialize traversal scene');
          setLoading(false);
        }
      }
    };

    initScene();

    return () => {
      cancelled = true;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (navigationTimeoutRef.current) clearTimeout(navigationTimeoutRef.current);
      if (controllerRef.current) controllerRef.current.dispose();
      if (engineRef.current) engineRef.current.dispose();
      delete window.render_game_to_text;
    };
  }, [notify, navigate, scene]);

  useEffect(() => {
    if (!recentAction) return undefined;
    const timer = setTimeout(() => setRecentAction(null), 2600);
    return () => clearTimeout(timer);
  }, [recentAction]);

  if (!scene) {
    return <div className="p-8 text-center text-red-400">Traversal scene unavailable.</div>;
  }

  return (
    <div className="relative w-full h-[calc(100vh-3rem)] overflow-hidden rounded-xl border border-space-700 bg-black">
      <div ref={containerRef} className="absolute inset-0" />

      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/95">
          <div className="text-center">
            <div className="text-cyan-300 text-lg uppercase tracking-[0.28em]">{scene.title}</div>
            <div className="mt-2 text-sm text-white/60">Preparing traversal scene</div>
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full border border-cyan-400/30 bg-slate-950/70 px-4 py-2 text-center backdrop-blur-sm">
            <div className="text-[10px] uppercase tracking-[0.28em] text-cyan-200/80">{scene.title}</div>
            <div className="mt-0.5 text-[11px] text-white/55">{scene.subtitle}</div>
          </div>
          {!controllerRef.current?.hasControl() && (
            <div className="absolute right-4 top-4 z-10">
              <button
                onClick={() => controllerRef.current?.engageTraversalControl()}
                className="rounded-full border border-cyan-400/30 bg-slate-950/75 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-cyan-100/85 backdrop-blur-sm transition-colors hover:border-cyan-300/50 hover:bg-slate-900/90"
              >
                Deploy Team
              </button>
            </div>
          )}
          <VoxelHUD
            playerPos={playerPos}
            targetBlock={null}
            flyMode={flyMode}
            profile={profile}
            previewMode={!controllerRef.current?.hasControl()}
            previewMarkers={previewMarkers}
            inputState={inputState}
            showHotbar={false}
          />
          <TraversalInteractionOverlay
            activeInteraction={activeInteraction}
            recentAction={recentAction}
            previewMode={!controllerRef.current?.hasControl()}
          />
        </>
      )}

      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/95">
          <div className="text-center">
            <div className="text-red-400 text-lg mb-2">Traversal scene failed</div>
            <div className="text-sm text-white/60">{error}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TraversalScene;
