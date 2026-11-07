import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { apiClient } from '../../api/client';
import { AnatomicalMeshResponseDTO } from '../../types/api';
import { resolveStructureColor } from '../../utils/segmentationColors';
import { Box, Eye, RefreshCw, RotateCcw } from 'lucide-react';

interface AnatomicalViewer3DProps {
  resultId: string | null;
  visibleLabels: Record<number, boolean>;
  overlayOpacity: number;
  resetSignal?: number;
}

export const AnatomicalViewer3D: React.FC<AnatomicalViewer3DProps> = ({
  resultId,
  visibleLabels,
  overlayOpacity,
  resetSignal = 0,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [meshData, setMeshData] = useState<AnatomicalMeshResponseDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const meshMapRef = useRef<Record<number, THREE.Mesh>>({});
  const sphericalRef = useRef<{ radius: number; theta: number; phi: number }>({
    radius: 335,
    theta: 0.22,
    phi: 1.44,
  });
  const targetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const autoRotateRef = useRef<boolean>(false);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  // Fetch 3D surface mesh when resultId changes
  useEffect(() => {
    if (!resultId) {
      setMeshData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiClient
      .fetchAnatomicalMesh3D(resultId)
      .then((res) => {
        if (!cancelled) setMeshData(res);
      })
      .catch(() => {
        if (!cancelled) setMeshData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resultId]);

  const syncCamera = () => {
    const camera = cameraRef.current;
    if (!camera) return;
    const { radius, theta, phi } = sphericalRef.current;
    const t = targetRef.current;
    camera.position.x = t.x + radius * Math.sin(phi) * Math.sin(theta);
    camera.position.y = t.y + radius * Math.cos(phi);
    camera.position.z = t.z + radius * Math.sin(phi) * Math.cos(theta);
    camera.lookAt(t);
  };

  // Respond to external Reset View signal
  useEffect(() => {
    if (resetSignal > 0) {
      targetRef.current.set(0, 0, 0);
      sphericalRef.current = { radius: 335, theta: 0.22, phi: 1.44 };
      syncCamera();
    }
  }, [resetSignal]);

  // Initialize Three.js WebGL scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = Math.max(200, container.clientWidth);
    const height = Math.max(200, container.clientHeight);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#04070B');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 1, 2500);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Clinical studio lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(200, 300, 250);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.75);
    rimLight.position.set(-200, -100, -200);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0x14b8a6, 0.55);
    fillLight.position.set(0, -200, 200);
    scene.add(fillLight);

    // Subtle reference thoracic grid
    const grid = new THREE.GridHelper(360, 18, 0x263445, 0x111722);
    grid.position.y = -112;
    scene.add(grid);

    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;

    syncCamera();

    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (autoRotateRef.current) {
        sphericalRef.current.theta += 0.0075;
        syncCamera();
      }
      renderer.render(scene, camera);
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
      if (!container || !renderer || !camera) return;
      const w = Math.max(100, container.clientWidth);
      const h = Math.max(100, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, []);

  // Populate or update 3D structure geometries when meshData arrives
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Mesh;
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
      group.remove(child);
    }
    meshMapRef.current = {};

    if (!meshData || !meshData.structures || meshData.structures.length === 0) return;

    meshData.structures.forEach((struct) => {
      const geom = new THREE.BufferGeometry();
      const positions = new Float32Array(struct.vertices_flat);
      const normals = new Float32Array(struct.normals_flat);
      const indices = new Uint32Array(struct.faces_flat);

      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geom.setIndex(new THREE.BufferAttribute(indices, 1));
      geom.computeVertexNormals();
      geom.computeBoundingSphere();

      const canonicalHex = resolveStructureColor(struct.structure_key, struct.color_hex);

      const mat = new THREE.MeshPhongMaterial({
        color: new THREE.Color(canonicalHex),
        specular: new THREE.Color(0x38bdf8),
        shininess: 36,
        transparent: true,
        opacity: Math.max(0.50, Math.min(1.0, overlayOpacity + 0.10)),
        side: THREE.DoubleSide,
        depthWrite: true,
        wireframe,
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.visible = visibleLabels[struct.label_id] !== false;
      group.add(mesh);
      meshMapRef.current[struct.label_id] = mesh;
    });

    // Auto-center and frame camera to bounding box
    const box = new THREE.Box3().setFromObject(group);
    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 80);
      targetRef.current.copy(center);
      sphericalRef.current = {
        radius: maxDim * 1.95,
        theta: 0.28,
        phi: 1.38,
      };
      syncCamera();
    }
  }, [meshData]);

  // Synchronize visibility, opacity, and wireframe mode without rebuilding buffers
  useEffect(() => {
    Object.entries(meshMapRef.current).forEach(([lblStr, mesh]) => {
      const lbl = parseInt(lblStr, 10);
      mesh.visible = visibleLabels[lbl] !== false;
      const mat = mesh.material as THREE.MeshPhongMaterial;
      if (mat) {
        mat.opacity = Math.max(0.45, Math.min(1.0, overlayOpacity + 0.10));
        mat.wireframe = wireframe;
        mat.needsUpdate = true;
      }
    });
  }, [visibleLabels, overlayOpacity, wireframe]);

  // Mouse orbital interaction
  const dragRef = useRef<{ active: boolean; mode: 'orbit' | 'pan'; x: number; y: number }>({
    active: false,
    mode: 'orbit',
    x: 0,
    y: 0,
  });

  const setCameraPreset = (preset: 'anterior' | 'posterior' | 'right' | 'left' | 'superior') => {
    const curRad = Math.max(100, sphericalRef.current.radius);
    if (preset === 'anterior') {
      sphericalRef.current = { radius: curRad, theta: 0.0, phi: Math.PI / 2 };
    } else if (preset === 'posterior') {
      sphericalRef.current = { radius: curRad, theta: Math.PI, phi: Math.PI / 2 };
    } else if (preset === 'right') {
      sphericalRef.current = { radius: curRad, theta: -Math.PI / 2, phi: Math.PI / 2 };
    } else if (preset === 'left') {
      sphericalRef.current = { radius: curRad, theta: Math.PI / 2, phi: Math.PI / 2 };
    } else if (preset === 'superior') {
      sphericalRef.current = { radius: curRad, theta: 0.0, phi: 0.12 };
    }
    syncCamera();
  };

  const totalFaces = meshData
    ? meshData.structures.reduce((acc, s) => acc + s.face_count, 0)
    : 0;

  return (
    <div
      className="relative flex flex-col bg-[#000000] border border-[#263445] rounded-lg overflow-hidden select-none h-full"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Top 3D Viewport Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#111722] border-b border-[#263445] text-xs z-10">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded border font-mono font-semibold text-[10px] tracking-wider bg-[#0D9488]/15 text-[#14B8A6] border-[#0D9488]/40 flex items-center gap-1">
            <Box className="w-3 h-3" /> 3D RECONSTRUCTION
          </span>
          {meshData && (
            <span className="font-mono text-[#94A3B8] text-[11px]">
              {totalFaces.toLocaleString()} tris
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCameraPreset('anterior')}
            className="px-1.5 py-0.5 text-[10px] font-mono bg-[#18212D] text-[#E5EDF5] hover:bg-[#0D9488]/25 hover:text-[#38BDF8] border border-[#263445] rounded transition"
            title="Anterior View"
          >
            ANT
          </button>
          <button
            type="button"
            onClick={() => setCameraPreset('posterior')}
            className="px-1.5 py-0.5 text-[10px] font-mono bg-[#18212D] text-[#E5EDF5] hover:bg-[#0D9488]/25 hover:text-[#38BDF8] border border-[#263445] rounded transition"
            title="Posterior View"
          >
            POST
          </button>
          <button
            type="button"
            onClick={() => setCameraPreset('right')}
            className="px-1.5 py-0.5 text-[10px] font-mono bg-[#18212D] text-[#E5EDF5] hover:bg-[#0D9488]/25 hover:text-[#38BDF8] border border-[#263445] rounded transition"
            title="Right Lateral View"
          >
            R-LAT
          </button>
          <button
            type="button"
            onClick={() => setCameraPreset('left')}
            className="px-1.5 py-0.5 text-[10px] font-mono bg-[#18212D] text-[#E5EDF5] hover:bg-[#0D9488]/25 hover:text-[#38BDF8] border border-[#263445] rounded transition"
            title="Left Lateral View"
          >
            L-LAT
          </button>
          <button
            type="button"
            onClick={() => setCameraPreset('superior')}
            className="px-1.5 py-0.5 text-[10px] font-mono bg-[#18212D] text-[#E5EDF5] hover:bg-[#0D9488]/25 hover:text-[#38BDF8] border border-[#263445] rounded transition"
            title="Superior Apical View"
          >
            SUP
          </button>
          <button
            type="button"
            onClick={() => setWireframe((w) => !w)}
            className={`px-1.5 py-0.5 text-[10px] font-mono rounded border transition ${
              wireframe
                ? 'bg-[#0D9488] text-white border-[#0D9488] font-semibold'
                : 'bg-[#18212D] text-[#94A3B8] border-[#263445] hover:text-[#E5EDF5]'
            }`}
            title="Toggle Wireframe Mesh"
          >
            WIRE
          </button>
          <button
            type="button"
            onClick={() => setAutoRotate((r) => !r)}
            className={`p-1 rounded border transition ${
              autoRotate
                ? 'bg-[#38BDF8]/20 text-[#38BDF8] border-[#38BDF8]/50'
                : 'bg-[#18212D] text-[#94A3B8] border-[#263445] hover:text-[#E5EDF5]'
            }`}
            title="Toggle Turntable Auto-Rotation"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => setCameraPreset('anterior')}
            className="p-1 text-[#94A3B8] hover:text-[#E5EDF5] bg-[#18212D] border border-[#263445] rounded transition"
            title="Reset 3D Camera"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* WebGL Stage */}
      <div
        className="relative flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => {
          dragRef.current = {
            active: true,
            mode: e.button === 2 || e.shiftKey ? 'pan' : 'orbit',
            x: e.clientX,
            y: e.clientY,
          };
        }}
        onMouseMove={(e) => {
          if (!dragRef.current.active) return;
          const dx = e.clientX - dragRef.current.x;
          const dy = e.clientY - dragRef.current.y;
          dragRef.current.x = e.clientX;
          dragRef.current.y = e.clientY;

          if (dragRef.current.mode === 'orbit') {
            sphericalRef.current.theta -= dx * 0.008;
            sphericalRef.current.phi = Math.max(
              0.08,
              Math.min(Math.PI - 0.08, sphericalRef.current.phi - dy * 0.008)
            );
          } else {
            targetRef.current.x -= dx * 0.4;
            targetRef.current.y += dy * 0.4;
          }
          syncCamera();
        }}
        onMouseUp={() => {
          dragRef.current.active = false;
        }}
        onMouseLeave={() => {
          dragRef.current.active = false;
        }}
        onWheel={(e) => {
          e.preventDefault();
          const factor = e.deltaY > 0 ? 1.08 : 0.92;
          sphericalRef.current.radius = Math.max(
            90,
            Math.min(900, sphericalRef.current.radius * factor)
          );
          syncCamera();
        }}
      >
        <div ref={mountRef} className="w-full h-full" />

        {!resultId && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#04070B]/88 text-center p-4">
            <Eye className="w-7 h-7 text-[#94A3B8] mb-2 opacity-60" />
            <p className="text-xs font-medium text-[#E5EDF5]">No 3D Segmentation Mesh Active</p>
            <p className="text-[11px] text-[#94A3B8] mt-1 max-w-xs">
              Execute bilateral or 5-lobe lung segmentation in the right panel to reconstruct the 3D anatomical surface.
            </p>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#04070B]/80">
            <div className="text-xs font-mono text-[#38BDF8] animate-pulse">
              Reconstructing 3D Marching Cubes Surface...
            </div>
          </div>
        )}

        {/* Structure Legend Overlay */}
        {meshData && meshData.structures.length > 0 && (
          <div className="absolute bottom-2 left-2.5 bg-[#080B10]/90 border border-[#263445] rounded-md px-2.5 py-1.5 text-[11px] space-y-1 pointer-events-none">
            {meshData.structures.map((st) => {
              const colorHex = resolveStructureColor(st.structure_key, st.color_hex);
              const isVis = visibleLabels[st.label_id] !== false;
              return (
                <div
                  key={st.label_id}
                  className={`flex items-center gap-2 ${isVis ? 'opacity-100' : 'opacity-40'}`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block border border-white/20"
                    style={{ backgroundColor: colorHex }}
                  />
                  <span className="text-[#E5EDF5] font-medium text-[11px]">{st.display_name}</span>
                  <span className="text-[#94A3B8] font-mono text-[10px]">
                    {st.vertex_count.toLocaleString()}v
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom-right interaction hint */}
        <div className="absolute bottom-1.5 right-2 pointer-events-none font-mono text-[10px] text-[#94A3B8]/80 bg-[#080B10]/80 px-1.5 py-0.5 rounded border border-[#263445]/60">
          Drag: Orbit · Shift+Drag: Pan · Wheel: Zoom
        </div>
      </div>
    </div>
  );
};
