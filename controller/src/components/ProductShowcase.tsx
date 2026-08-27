import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

interface ProductShowcaseProps {
  onOpenSoftware: () => void;
}

function createCable(points: THREE.Vector3[], radius: number, material: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 42, radius, 10, false), material);
}

export function ProductShowcase({ onOpenSoftware }: ProductShowcaseProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 300);
    camera.position.set(48, 29, 58);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-label", "Interactive three-dimensional concept of the Complex Control reader and controller");
    renderer.domElement.style.touchAction = "none";
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.enablePan = false;
    controls.minDistance = 48;
    controls.maxDistance = 115;
    controls.target.set(0, -1, 0);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.55;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x6d5f54, 2.35));
    const keyLight = new THREE.DirectionalLight(0xffffff, 4.2);
    keyLight.position.set(36, 46, 42);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xd61f26, 1.5);
    rimLight.position.set(-38, 15, -34);
    scene.add(rimLight);

    const assembly = new THREE.Group();
    assembly.rotation.x = -0.04;
    scene.add(assembly);

    const readerMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xf1f0eb,
      roughness: 0.42,
      metalness: 0.03,
      clearcoat: 0.18,
    });
    const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xd7d5cf, roughness: 0.55 });
    const controllerMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x62676d,
      roughness: 0.42,
      metalness: 0.12,
      clearcoat: 0.08,
    });
    const controllerDoorMaterial = new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 0.5, metalness: 0.08 });
    const blackMaterial = new THREE.MeshStandardMaterial({ color: 0x09090a, roughness: 0.48 });
    const cableMaterial = new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.55 });
    const screwMaterial = new THREE.MeshStandardMaterial({ color: 0xb8babd, roughness: 0.25, metalness: 0.78 });

    // Estimated reader envelope: approximately 42 cm square and 3.2 cm deep.
    const reader = new THREE.Mesh(new RoundedBoxGeometry(42, 42, 3.2, 8, 1.8), readerMaterial);
    reader.castShadow = true;
    reader.receiveShadow = true;
    assembly.add(reader);

    const readerInset = new THREE.Mesh(new RoundedBoxGeometry(38.6, 38.6, 0.35, 6, 1.4), edgeMaterial);
    readerInset.position.z = 1.7;
    assembly.add(readerInset);

    const frontPanel = new THREE.Mesh(new RoundedBoxGeometry(37.6, 37.6, 0.28, 6, 1.15), readerMaterial);
    frontPanel.position.z = 1.92;
    assembly.add(frontPanel);

    const screwGeometry = new THREE.CylinderGeometry(0.58, 0.58, 0.32, 18);
    const screwPositions: Array<[number, number]> = [
      [-17.2, 17.2], [17.2, 17.2], [-17.2, -17.2], [17.2, -17.2],
    ];
    screwPositions.forEach(([x, y]) => {
      const screw = new THREE.Mesh(screwGeometry, screwMaterial);
      screw.rotation.x = Math.PI / 2;
      screw.position.set(x, y, 2.15);
      assembly.add(screw);
    });

    // Estimated weather-resistant rear controller pod: 22 x 26 x 11 cm.
    // Its front remains flush to the reader while the extra depth protrudes rearward.
    const controller = new THREE.Mesh(new RoundedBoxGeometry(22, 26, 11, 7, 1.55), controllerMaterial);
    controller.position.set(0, 1.2, -7.1);
    controller.castShadow = true;
    assembly.add(controller);

    const controllerDoor = new THREE.Mesh(new RoundedBoxGeometry(19.2, 22.8, 0.65, 6, 1.1), controllerDoorMaterial);
    controllerDoor.position.set(0, 1.2, -12.9);
    assembly.add(controllerDoor);

    const standoffGeometry = new THREE.CylinderGeometry(0.55, 0.55, 1.8, 18);
    const standoffPositions: Array<[number, number]> = [[-7.2, 9], [7.2, 9], [-7.2, -6.8], [7.2, -6.8]];
    standoffPositions.forEach(([x, y]) => {
      const standoff = new THREE.Mesh(standoffGeometry, screwMaterial);
      standoff.rotation.x = Math.PI / 2;
      standoff.position.set(x, y, -2.35);
      assembly.add(standoff);
    });

    const glandGeometry = new THREE.CylinderGeometry(1.05, 1.05, 2.1, 18);
    const readerGland = new THREE.Mesh(glandGeometry, blackMaterial);
    readerGland.position.set(-3.2, -21.1, -0.1);
    assembly.add(readerGland);

    const controllerGland = new THREE.Mesh(glandGeometry, blackMaterial);
    controllerGland.position.set(3.2, -12.8, -7.1);
    assembly.add(controllerGland);

    const leftCable = createCable([
      new THREE.Vector3(-3.2, -22, -0.1),
      new THREE.Vector3(-3.1, -24.5, -0.4),
      new THREE.Vector3(-2.4, -27.5, -1.2),
      new THREE.Vector3(-3.8, -32, -2.1),
    ], 0.66, cableMaterial);
    leftCable.castShadow = true;
    assembly.add(leftCable);

    const rightCable = createCable([
      new THREE.Vector3(3.2, -13.5, -7.1),
      new THREE.Vector3(3.5, -18.5, -7.3),
      new THREE.Vector3(2.8, -24.5, -6.6),
      new THREE.Vector3(4.2, -31.5, -5.5),
    ], 0.53, cableMaterial);
    rightCable.castShadow = true;
    assembly.add(rightCable);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(48, 64),
      new THREE.ShadowMaterial({ color: 0x261914, opacity: 0.16 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -32;
    floor.receiveShadow = true;
    scene.add(floor);

    const resize = () => {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    let frame = 0;
    const animate = () => {
      frame = window.requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <section className="product-shell">
      <div className="product-stage" id="assembly">
        <div className="product-canvas" ref={mountRef} />
      </div>

      <div className="product-list" aria-label="Complex Control product components">
        <article>
          <span>01</span>
          <h2>RFID reader</h2>
          <p>Detects registered tags at the timing line.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Trackside controller</h2>
          <p>Receives and records crossings locally.</p>
        </article>
        <article>
          <span>03</span>
          <h2>Race software</h2>
          <p>Handles racers, flags, laps, schedules, and results.</p>
        </article>
      </div>

      <div className="race-entry">
        <button className="primary-button" onClick={onOpenSoftware}>Race control</button>
      </div>
    </section>
  );
}
