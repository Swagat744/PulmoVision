import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CANONICAL_STRUCTURE_COLORS } from '../../utils/segmentationColors';

interface CinematicLungSceneProps {
  scrollProgress: number; // 0.0 to 1.0
  className?: string;
  interactive?: boolean;
}

export const CinematicLungScene: React.FC<CinematicLungSceneProps> = ({
  scrollProgress,
  className = '',
  interactive = true,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>('loading');

  // References for animation loop
  const scrollRef = useRef<number>(scrollProgress);
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const reducedMotionRef = useRef<boolean>(false);

  useEffect(() => {
    scrollRef.current = scrollProgress;
  }, [scrollProgress]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check WebGL availability
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) {
        setLoadState('error');
        return;
      }
    } catch {
      setLoadState('error');
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = null;

    // Camera
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0.6, 0.15, 3.4);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Carefully Controlled Atmospheric Lighting (soft, not blown out)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    // Key Light (cool soft white)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(3, 4, 3);
    scene.add(keyLight);

    // Rim Light (subtle cyan silhouette edge)
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.3);
    rimLight.position.set(-3.5, -1, -3);
    scene.add(rimLight);

    // Subtle Teal Ambient Glow
    const tealFill = new THREE.PointLight(0x0d9488, 1.0, 8);
    tealFill.position.set(0, -2, 2);
    scene.add(tealFill);

    // Main Model Group
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    // References to anatomical submeshes
    const anatomicalMeshes: Record<string, THREE.Mesh> = {};
    const defaultMaterials: Record<string, THREE.Material> = {};
    const lobarMaterials: Record<string, THREE.MeshPhysicalMaterial> = {};

    // Ethereal translucent pulmonary material (soft, atmospheric, does not overpower text)
    const baseLungMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#38BDF8'),
      roughness: 0.4,
      metalness: 0.08,
      transmission: 0.32,
      thickness: 0.6,
      transparent: true,
      opacity: 0.82,
      clearcoat: 0.35,
      clearcoatRoughness: 0.25,
      side: THREE.DoubleSide,
    });

    // Trachea & Bronchi cartilage material
    const cartilageMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#94A3B8'),
      roughness: 0.45,
      metalness: 0.05,
      transparent: true,
      opacity: 0.88,
      clearcoat: 0.25,
      side: THREE.DoubleSide,
    });

    // Canonical 5-Lobe materials
    const makeLobeMaterial = (colorHex: string) =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(colorHex),
        roughness: 0.35,
        metalness: 0.1,
        transparent: true,
        opacity: 0.85,
        clearcoat: 0.4,
        transmission: 0.20,
        side: THREE.DoubleSide,
      });

    lobarMaterials['rul'] = makeLobeMaterial(CANONICAL_STRUCTURE_COLORS.right_upper_lobe);
    lobarMaterials['rml'] = makeLobeMaterial(CANONICAL_STRUCTURE_COLORS.right_middle_lobe);
    lobarMaterials['rll'] = makeLobeMaterial(CANONICAL_STRUCTURE_COLORS.right_lower_lobe);
    lobarMaterials['lul'] = makeLobeMaterial(CANONICAL_STRUCTURE_COLORS.left_upper_lobe);
    lobarMaterials['lll'] = makeLobeMaterial(CANONICAL_STRUCTURE_COLORS.left_lower_lobe);

    // Load GLTF / GLB Model
    const loader = new GLTFLoader();
    loader.load(
      '/models/lungs.glb',
      (gltf) => {
        const root = gltf.scene;

        const bbox = new THREE.Box3().setFromObject(root);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.9 / (maxDim || 1);

        root.position.sub(center);
        modelGroup.scale.set(scale, scale, scale);
        modelGroup.add(root);

        root.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            const name = mesh.name.toLowerCase();

            anatomicalMeshes[mesh.name] = mesh;
            defaultMaterials[mesh.name] = mesh.material as THREE.Material;

            if (name.includes('trachea') || name.includes('cartilage') || name.includes('bronch')) {
              mesh.material = cartilageMaterial;
            } else if (name.includes('left') || name.includes('right') || name.includes('lobe')) {
              mesh.material = baseLungMaterial.clone();
            }
          }
        });

        setLoadState('loaded');
      },
      undefined,
      (err) => {
        console.warn('GLB load notice:', err);
        setLoadState('error');
      }
    );

    // Mouse Interaction
    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseRef.current = { x: nx * 0.14, y: ny * 0.1 };
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animId = 0;
    const clock = new THREE.Clock();

    const currentRot = new THREE.Euler(0, 0, 0);
    const currentPos = new THREE.Vector3(0.5, 0, 0);
    let currentCamDist = 3.3;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();
      const s = Math.max(0, Math.min(1, scrollRef.current));
      const isMobile = window.innerWidth < 768;

      let targetRotY = 0.38;
      let targetRotX = 0.04;
      let targetRotZ = 0.0;
      let targetPosX = isMobile ? 0.0 : 0.58;
      let targetPosY = isMobile ? -0.08 : 0.04;
      let targetCamDist = isMobile ? 3.9 : 3.3;

      if (s < 0.22) {
        const t = s / 0.22;
        targetRotY = THREE.MathUtils.lerp(0.38, 0.06, t);
        targetRotX = THREE.MathUtils.lerp(0.04, 0.02, t);
        targetPosX = isMobile ? 0.0 : THREE.MathUtils.lerp(0.58, 0.45, t);
        targetCamDist = isMobile ? 3.9 : THREE.MathUtils.lerp(3.3, 3.15, t);
      } else if (s < 0.48) {
        const t = (s - 0.22) / 0.26;
        targetRotY = THREE.MathUtils.lerp(0.06, -0.4, t);
        targetRotX = THREE.MathUtils.lerp(0.02, 0.06, t);
        targetPosX = isMobile ? 0.0 : THREE.MathUtils.lerp(0.45, -0.45, t);
        targetCamDist = isMobile ? 3.8 : THREE.MathUtils.lerp(3.15, 3.0, t);
      } else if (s < 0.72) {
        const t = (s - 0.48) / 0.24;
        targetRotY = THREE.MathUtils.lerp(-0.4, 2.7, t);
        targetRotX = THREE.MathUtils.lerp(0.06, -0.04, t);
        targetPosX = isMobile ? 0.0 : THREE.MathUtils.lerp(-0.45, 0.48, t);
        targetCamDist = isMobile ? 3.7 : THREE.MathUtils.lerp(3.0, 2.8, t);
      } else if (s < 0.88) {
        const t = (s - 0.72) / 0.16;
        targetRotY = THREE.MathUtils.lerp(2.7, 3.15, t);
        targetRotX = THREE.MathUtils.lerp(-0.04, 0.1, t);
        targetPosX = isMobile ? 0.0 : THREE.MathUtils.lerp(0.48, 0.0, t);
        targetCamDist = isMobile ? 3.5 : THREE.MathUtils.lerp(2.8, 2.5, t);
      } else {
        const t = (s - 0.88) / 0.12;
        targetRotY = THREE.MathUtils.lerp(3.15, 0.2, t);
        targetRotX = THREE.MathUtils.lerp(0.1, 0.04, t);
        targetPosX = 0.0;
        targetCamDist = isMobile ? 3.9 : THREE.MathUtils.lerp(2.5, 3.3, t);
      }

      if (!reducedMotionRef.current && interactive && !isMobile) {
        targetRotY += mouseRef.current.x * 0.3;
        targetRotX += mouseRef.current.y * 0.2;
      }

      currentRot.y = THREE.MathUtils.lerp(currentRot.y, targetRotY, 0.055);
      currentRot.x = THREE.MathUtils.lerp(currentRot.x, targetRotX, 0.055);
      currentRot.z = THREE.MathUtils.lerp(currentRot.z, targetRotZ, 0.055);
      modelGroup.rotation.copy(currentRot);

      currentPos.x = THREE.MathUtils.lerp(currentPos.x, targetPosX, 0.05);
      currentPos.y = THREE.MathUtils.lerp(currentPos.y, targetPosY, 0.05);
      modelGroup.position.copy(currentPos);

      currentCamDist = THREE.MathUtils.lerp(currentCamDist, targetCamDist, 0.055);
      camera.position.z = currentCamDist;

      if (!reducedMotionRef.current && !isMobile) {
        const breath = 1.0 + Math.sin(elapsedTime * 1.2) * 0.009;
        modelGroup.scale.y = modelGroup.scale.x * breath;
      }

      // Material highlighting during lobar section
      const isLobeSection = s >= 0.45 && s <= 0.78;
      Object.entries(anatomicalMeshes).forEach(([meshName, mesh]) => {
        const lower = meshName.toLowerCase();
        if (isLobeSection) {
          if (lower.includes('right lung superior') || lower.includes('right upper')) {
            mesh.material = lobarMaterials['rul'];
          } else if (lower.includes('right lung middle') || lower.includes('right middle')) {
            mesh.material = lobarMaterials['rml'];
          } else if (lower.includes('right lung inferior') || lower.includes('right lower')) {
            mesh.material = lobarMaterials['rll'];
          } else if (lower.includes('left lung superior') || lower.includes('left upper')) {
            mesh.material = lobarMaterials['lul'];
          } else if (lower.includes('left lung inferior') || lower.includes('left lower')) {
            mesh.material = lobarMaterials['lll'];
          }
        } else {
          if (lower.includes('trachea') || lower.includes('cartilage') || lower.includes('bronch')) {
            mesh.material = cartilageMaterial;
          } else {
            mesh.material = baseLungMaterial;
          }
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      baseLungMaterial.dispose();
      cartilageMaterial.dispose();
      Object.values(lobarMaterials).forEach((m) => m.dispose());
    };
  }, [interactive]);

  return (
    <div className={`relative w-full h-full select-none ${className}`}>
      <div ref={mountRef} className="w-full h-full" />
    </div>
  );
};
