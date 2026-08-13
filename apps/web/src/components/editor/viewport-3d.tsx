"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import {
  computeSceneBounds,
  environmentPreset,
  fitPose,
  findWallAt,
  poseForView,
  snapPoint,
  type CameraPose,
} from "@archvision/three-engine";
import { Object3D, Vector2 as ThreeVector2 } from "three";
import type { Floor, SceneDocument, Vector2 } from "@archvision/types";
import { useEditorStore, type ToolId } from "@/lib/editor/store";
import {
  ColumnObject,
  FurnitureObject,
  RoofObject,
  SlabObject,
  StairObject,
  WallObject,
} from "./scene-objects";

/**
 * Visor 3D.
 *
 * El lienzo solo dibuja: toda interaccion se traduce en comandos que van al
 * store. El plano de trabajo del nivel activo hace de superficie de trabajo
 * para dibujar paredes, colocar vanos y situar mobiliario.
 */

/**
 * Contrato minimo de los controles de orbita.
 * Se declara de forma estructural para no depender de los tipos internos de
 * los addons de Three.js.
 */
interface OrbitControlsLike {
  target: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void };
  update: () => void;
}

function CameraRig({ bounds }: { bounds: ReturnType<typeof computeSceneBounds> }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as OrbitControlsLike | null;
  const pendingView = useEditorStore((state) => state.pendingView);
  const requestView = useEditorStore((state) => state.requestView);

  // La escena llega despues del primer render (el documento se carga en un
  // efecto del contenedor, y los efectos de los hijos corren antes que los del
  // padre). Por eso se encuadra al montar y otra vez en cuanto aparece la
  // primera geometria: de lo contrario la camara quedaria apuntando al plano
  // de trabajo vacio.
  const hasGeometry = useEditorStore(
    (state) =>
      state.scene.walls.length +
        state.scene.slabs.length +
        state.scene.roofs.length >
      0,
  );

  const framed = useRef(false);

  // El encuadre inicial se aplica dentro del bucle de render: es el unico
  // punto donde la camara activa y los controles existen con seguridad,
  // independientemente del orden en que monten los componentes.
  useFrame(({ camera: activeCamera, controls: activeControls }) => {
    if (framed.current || !hasGeometry) return;
    framed.current = true;

    const pose = poseForView("perspective", bounds);
    activeCamera.position.set(pose.position.x, pose.position.y, pose.position.z);
    activeCamera.lookAt(pose.target.x, pose.target.y, pose.target.z);

    const orbit = activeControls as OrbitControlsLike | null;
    if (orbit) {
      orbit.target.set(pose.target.x, pose.target.y, pose.target.z);
      orbit.update();
    }
  });

  useEffect(() => {
    if (!pendingView) return;

    const current: CameraPose = {
      position: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      },
      target: controls
        ? { x: controls.target.x, y: controls.target.y, z: controls.target.z }
        : bounds.center,
      orthographic: false,
    };

    const pose =
      pendingView === "fit" ? fitPose(bounds, current) : poseForView(pendingView, bounds);

    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.lookAt(pose.target.x, pose.target.y, pose.target.z);

    if (controls) {
      controls.target.set(pose.target.x, pose.target.y, pose.target.z);
      controls.update();
    }

    requestView(null);
  }, [pendingView, camera, controls, bounds, requestView]);

  return null;
}

/**
 * Resuelve el material soltado sobre el visor.
 *
 * El arrastre nativo del navegador no pasa por el sistema de eventos de React
 * Three Fiber, asi que el punto de caida llega por el estado y aqui se lanza
 * un rayo para averiguar sobre que entidad cayo.
 */
function MaterialDropTarget() {
  const { camera, gl, raycaster, scene: threeScene } = useThree();
  const pendingDrop = useEditorStore((state) => state.pendingDrop);
  const requestDrop = useEditorStore((state) => state.requestDrop);

  useEffect(() => {
    if (!pendingDrop) return;

    const rect = gl.domElement.getBoundingClientRect();
    const pointer = new ThreeVector2(
      ((pendingDrop.clientX - rect.left) / rect.width) * 2 - 1,
      -((pendingDrop.clientY - rect.top) / rect.height) * 2 + 1,
    );

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(threeScene.children, true);

    // El primer impacto puede ser una arista de seleccion o el plano de
    // trabajo; se busca el primero que pertenezca a una entidad real.
    let entityId: string | undefined;
    for (const hit of hits) {
      let node: Object3D | null = hit.object;
      while (node && !entityId) {
        const candidate = node.userData?.entityId;
        if (typeof candidate === "string") entityId = candidate;
        node = node.parent;
      }
      if (entityId) break;
    }

    const store = useEditorStore.getState();
    if (entityId) {
      store.dispatch({
        type: "ASSIGN_MATERIAL",
        targetIds: [entityId],
        materialId: pendingDrop.materialId,
      });
    } else {
      store.setMessage({
        kind: "error",
        text: "Suelta el material sobre una superficie del modelo",
      });
    }

    requestDrop(null);
  }, [pendingDrop, camera, gl, raycaster, threeScene, requestDrop]);

  return null;
}

function SceneLights({ scene }: { scene: SceneDocument }) {
  const preset = environmentPreset(scene.environment);
  const [dx, dy, dz] = preset.sunDirection;
  const distance = 40;

  return (
    <>
      <hemisphereLight
        args={[preset.skyColor, preset.groundColor, preset.ambientIntensity]}
      />
      <directionalLight
        position={[dx * distance, dy * distance, dz * distance]}
        intensity={preset.sunIntensity}
        color={preset.sunColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-camera-far={160}
      />
      <color attach="background" args={[preset.skyColor]} />
    </>
  );
}

interface WorkPlaneProps {
  elevation: number;
  tool: ToolId;
  onPoint: (point: Vector2, event: ThreeEvent<PointerEvent>) => void;
  onMove: (point: Vector2) => void;
  onClearSelection: () => void;
}

/** Plano de trabajo invisible: convierte el puntero en coordenadas de planta. */
function WorkPlane({
  elevation,
  tool,
  onPoint,
  onMove,
  onClearSelection,
}: WorkPlaneProps) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, elevation, 0]}
      receiveShadow
      onPointerMove={(event) => {
        onMove({ x: event.point.x, y: event.point.z });
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        // El pincel sobre el vacio no hace nada: pintar el plano de trabajo no
        // significa nada y borrar la seleccion sorprenderia.
        if (tool === "select" || tool === "paint") {
          if (tool === "select") onClearSelection();
          return;
        }
        onPoint({ x: event.point.x, y: event.point.z }, event);
      }}
    >
      <planeGeometry args={[400, 400]} />
      <meshStandardMaterial color="#20242c" roughness={1} metalness={0} />
    </mesh>
  );
}

function FloorContent({
  floor,
  scene,
  selection,
  hoveredId,
  handlers,
}: {
  floor: Floor;
  scene: SceneDocument;
  selection: Set<string>;
  hoveredId: string | null;
  handlers: { onPick: (id: string, additive: boolean) => void; onHover: (id: string | null) => void };
}) {
  if (!floor.visible) return null;

  return (
    <group>
      {scene.slabs
        .filter((slab) => slab.floorId === floor.id)
        .map((slab) => (
          <SlabObject
            key={slab.id}
            slab={slab}
            scene={scene}
            elevation={floor.elevation}
            selection={selection}
            hoveredId={hoveredId}
            handlers={handlers}
          />
        ))}

      {scene.walls
        .filter((wall) => wall.floorId === floor.id)
        .map((wall) => (
          <WallObject
            key={wall.id}
            wall={wall}
            scene={scene}
            elevation={floor.elevation}
            selection={selection}
            hoveredId={hoveredId}
            handlers={handlers}
          />
        ))}

      {scene.columns
        .filter((column) => column.floorId === floor.id)
        .map((column) => (
          <ColumnObject
            key={column.id}
            column={column}
            scene={scene}
            elevation={floor.elevation}
            selection={selection}
            hoveredId={hoveredId}
            handlers={handlers}
          />
        ))}

      {scene.stairs
        .filter((stair) => stair.floorId === floor.id)
        .map((stair) => (
          <StairObject
            key={stair.id}
            stair={stair}
            scene={scene}
            elevation={floor.elevation}
            selection={selection}
            hoveredId={hoveredId}
            handlers={handlers}
          />
        ))}

      {scene.roofs
        .filter((roof) => roof.floorId === floor.id)
        .map((roof) => (
          <RoofObject
            key={roof.id}
            roof={roof}
            scene={scene}
            elevation={floor.elevation}
            selection={selection}
            hoveredId={hoveredId}
            handlers={handlers}
          />
        ))}

      {scene.furniture
        .filter((item) => item.floorId === floor.id)
        .map((item) => (
          <FurnitureObject
            key={item.id}
            item={item}
            elevation={floor.elevation}
            selection={selection}
            hoveredId={hoveredId}
            handlers={handlers}
          />
        ))}
    </group>
  );
}

/** Pared en construccion: previsualizacion translucida entre dos puntos. */
function WallPreview({
  start,
  end,
  height,
  thickness,
  elevation,
}: {
  start: Vector2;
  end: Vector2;
  height: number;
  thickness: number;
  elevation: number;
}) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.01) return null;

  return (
    <mesh
      position={[
        start.x + dx / 2,
        elevation + height / 2,
        start.y + dy / 2,
      ]}
      rotation={[0, -Math.atan2(dy, dx), 0]}
    >
      <boxGeometry args={[length, height, thickness]} />
      <meshStandardMaterial color="#22d3ee" transparent opacity={0.35} />
    </mesh>
  );
}

function SceneContent() {
  const scene = useEditorStore((state) => state.scene);
  const selectionList = useEditorStore((state) => state.selection);
  const hoveredId = useEditorStore((state) => state.hoveredId);
  const tool = useEditorStore((state) => state.tool);
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const gridStep = useEditorStore((state) => state.gridStep);
  const showGrid = useEditorStore((state) => state.showGrid);
  const activeFloorId = useEditorStore((state) => state.activeFloorId);
  const furnitureCatalogId = useEditorStore((state) => state.furnitureCatalogId);
  const dispatch = useEditorStore((state) => state.dispatch);
  const select = useEditorStore((state) => state.select);
  const setHovered = useEditorStore((state) => state.setHovered);
  const clearSelection = useEditorStore((state) => state.clearSelection);

  const [drawStart, setDrawStart] = useState<Vector2 | null>(null);
  const [cursor, setCursor] = useState<Vector2 | null>(null);

  const selection = useMemo(() => new Set(selectionList), [selectionList]);
  const bounds = useMemo(() => computeSceneBounds(scene), [scene]);

  const activeFloor =
    scene.floors.find((floor) => floor.id === activeFloorId) ?? scene.floors[0] ?? null;
  const elevation = activeFloor?.elevation ?? 0;

  const floorWalls = useMemo(
    () => scene.walls.filter((wall) => wall.floorId === activeFloor?.id),
    [scene.walls, activeFloor?.id],
  );

  const applySnap = useCallback(
    (point: Vector2): Vector2 => {
      if (!snapEnabled) return point;
      return snapPoint(point, {
        walls: floorWalls,
        gridStep,
        threshold: 0.25,
        reference: drawStart,
      }).point;
    },
    [snapEnabled, floorWalls, gridStep, drawStart],
  );

  const handlers = useMemo(
    () => ({
      onPick: (id: string, additive: boolean) => {
        // Con el pincel activo, hacer clic pinta en vez de seleccionar: es la
        // misma accion que el usuario espera de un bote de pintura.
        if (tool === "paint") {
          useEditorStore.getState().paintMaterial(id);
          return;
        }
        select([id], additive);
      },
      onHover: (id: string | null) => setHovered(id),
    }),
    [select, setHovered, tool],
  );

  const handlePoint = useCallback(
    (raw: Vector2) => {
      if (!activeFloor) return;
      const point = applySnap(raw);

      switch (tool) {
        case "wall": {
          if (!drawStart) {
            setDrawStart(point);
            return;
          }
          const created = dispatch({
            type: "CREATE_WALL",
            floorId: activeFloor.id,
            start: drawStart,
            end: point,
          });
          // Encadena tramos: el final de una pared es el inicio de la siguiente.
          setDrawStart(created ? point : null);
          return;
        }
        case "door":
        case "window": {
          const hit = findWallAt(raw, floorWalls, 0.6);
          if (!hit) {
            useEditorStore
              .getState()
              .setMessage({ kind: "error", text: "Acerca el puntero a una pared" });
            return;
          }
          dispatch(
            tool === "door"
              ? { type: "CREATE_DOOR", wallId: hit.wall.id, offset: hit.offset }
              : { type: "CREATE_WINDOW", wallId: hit.wall.id, offset: hit.offset },
          );
          return;
        }
        case "column": {
          dispatch({
            type: "CREATE_COLUMN",
            floorId: activeFloor.id,
            position: point,
          });
          return;
        }
        case "stair": {
          dispatch({
            type: "CREATE_STAIR",
            floorId: activeFloor.id,
            kind: "straight",
            position: point,
          });
          return;
        }
        case "furniture": {
          dispatch({
            type: "ADD_FURNITURE",
            floorId: activeFloor.id,
            catalogId: furnitureCatalogId,
            position: { x: point.x, y: 0, z: point.y },
          });
          return;
        }
        case "measure": {
          const measure = useEditorStore.getState().measure;
          if (!measure.start || measure.end) {
            useEditorStore.getState().setMeasure({ start: point, end: null });
          } else {
            useEditorStore.getState().setMeasure({ start: measure.start, end: point });
          }
          return;
        }
        default:
          return;
      }
    },
    [activeFloor, applySnap, dispatch, drawStart, floorWalls, furnitureCatalogId, tool],
  );

  // Al cambiar de herramienta se abandona el trazado en curso.
  useEffect(() => {
    setDrawStart(null);
  }, [tool, activeFloorId]);

  return (
    <>
      <SceneLights scene={scene} />
      <CameraRig bounds={bounds} />
      <MaterialDropTarget />

      {showGrid ? (
        <Grid
          position={[0, elevation + 0.002, 0]}
          args={[200, 200]}
          cellSize={1}
          cellThickness={0.6}
          cellColor="#2b3440"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#3d4a5a"
          fadeDistance={90}
          fadeStrength={1}
          infiniteGrid
          followCamera={false}
        />
      ) : null}

      <WorkPlane
        elevation={elevation - 0.01}
        tool={tool}
        onPoint={handlePoint}
        onMove={(point) => setCursor(applySnap(point))}
        onClearSelection={clearSelection}
      />

      {scene.floors.map((floor) => (
        <FloorContent
          key={floor.id}
          floor={floor}
          scene={scene}
          selection={selection}
          hoveredId={hoveredId}
          handlers={handlers}
        />
      ))}

      {tool === "wall" && drawStart && cursor ? (
        <WallPreview
          start={drawStart}
          end={cursor}
          height={activeFloor?.height ?? 2.6}
          thickness={0.15}
          elevation={elevation}
        />
      ) : null}
    </>
  );
}

export function Viewport3D() {
  const [contextLost, setContextLost] = useState(false);
  // Cambiar esta clave reconstruye el lienzo desde cero cuando el usuario pide
  // reintentar tras una perdida de contexto.
  const [canvasKey, setCanvasKey] = useState(0);

  return (
    <>
      {contextLost ? (
        <div className="absolute inset-0 z-10 grid place-items-center bg-[#0d1117]/95 px-6 text-center">
          <div>
            <p className="text-sm text-ink">Se perdio el contexto de WebGL</p>
            <p className="mx-auto mt-1 max-w-xs text-xs text-ink-muted">
              El navegador libero la memoria de la GPU. Tus cambios estan
              guardados; reintenta para reconstruir el visor.
            </p>
            <button
              type="button"
              onClick={() => {
                setContextLost(false);
                setCanvasKey((key) => key + 1);
              }}
              className="mt-4 rounded-md border border-line-strong px-3 py-1.5 text-xs text-ink hover:bg-surface-2"
            >
              Reintentar
            </button>
          </div>
        </div>
      ) : null}

    <div
      className="absolute inset-0"
      onDragOver={(event) => {
        // Sin `preventDefault` el navegador rechaza la caida y nunca llega el
        // evento `drop`.
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(event) => {
        event.preventDefault();
        const materialId =
          event.dataTransfer.getData("application/x-archvision-material") ||
          useEditorStore.getState().activeMaterialId;
        if (!materialId) return;
        useEditorStore.getState().requestDrop({
          clientX: event.clientX,
          clientY: event.clientY,
          materialId,
        });
      }}
    >
    <Canvas
      key={canvasKey}
      shadows
      dpr={[1, 2]}
      // Camara unica gestionada por R3F. Montar camaras adicionales con
      // `makeDefault` deja momentos en los que `state.camera` apunta a una
      // camara que ya no es la activa, y los encuadres se aplican a la
      // equivocada. Las vistas ortogonales exactas se resuelven en el plano 2D.
      camera={{ position: [14, 12, -16], fov: 50, near: 0.05, far: 2000 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        // La perdida de contexto ocurre cuando el navegador recupera memoria de
        // GPU (muchas pestanas abiertas, recargas en caliente, portatiles con
        // grafica integrada). Se avisa y se permite reconstruir el lienzo en
        // lugar de dejar un visor negro sin explicacion.
        const canvas = gl.domElement;
        canvas.addEventListener("webglcontextlost", (event) => {
          event.preventDefault();
          setContextLost(true);
        });
        canvas.addEventListener("webglcontextrestored", () => {
          setContextLost(false);
        });
      }}
      // `absolute inset-0` fija el lienzo al contenedor recortado: sin esto el
      // canvas puede arrastrar el tamano de su padre en cada redimension.
      className="absolute inset-0"
      style={{ position: "absolute", inset: 0 }}
    >
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.12}
        maxPolarAngle={Math.PI / 2.02}
        minDistance={1}
        maxDistance={400}
      />
      <SceneContent />
    </Canvas>
    </div>
    </>
  );
}
