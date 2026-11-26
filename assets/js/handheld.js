// The hero clip on the screen of a handheld drawn with three.js. The flat <video> stays as the fallback.
const figure = document.querySelector(".handheld");
const video = figure && figure.querySelector("video");

function webgl() {
  try {
    const probe = document.createElement("canvas");
    return !!(probe.getContext("webgl2") || probe.getContext("webgl"));
  } catch {
    return false;
  }
}

if (figure && video && webgl()) {
  build().catch((error) => {
    figure.classList.remove("is-3d");
    console.warn("handheld model unavailable", error);
  });
}

async function build() {
  const THREE = await import("../vendor/three/three.module.min.js");
  const { RoomEnvironment } = await import("../vendor/three/RoomEnvironment.js");
  const { RoundedBoxGeometry } = await import("../vendor/three/RoundedBoxGeometry.js");
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.createElement("canvas");
  canvas.className = "handheld-canvas";
  canvas.setAttribute("aria-hidden", "true");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-20, 30, 40);
  const rim = new THREE.DirectionalLight(0x1a9fff, 2.2);
  rim.position.set(30, -10, -20);
  scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.15));

  const device = new THREE.Group();
  scene.add(device);

  const shell = new THREE.MeshPhysicalMaterial({ color: 0x15181f, roughness: 0.55, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.45 });
  const trim = new THREE.MeshPhysicalMaterial({ color: 0x0d1016, roughness: 0.35, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x111319, roughness: 0.9 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x030405, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03 });

  // Body: a wide slab whose ends drop into grips.
  const outline = new THREE.Shape();
  outline.moveTo(-11.6, 6.2);
  outline.lineTo(11.6, 6.2);
  outline.bezierCurveTo(13.6, 6.2, 14.6, 5.2, 14.7, 3.2);
  outline.bezierCurveTo(14.9, -0.6, 14.6, -4.8, 13.6, -6.9);
  outline.bezierCurveTo(12.8, -8.5, 10.2, -8.9, 8.9, -7.4);
  outline.bezierCurveTo(8.2, -6.6, 7.6, -6.2, 6.4, -6.2);
  outline.lineTo(-6.4, -6.2);
  outline.bezierCurveTo(-7.6, -6.2, -8.2, -6.6, -8.9, -7.4);
  outline.bezierCurveTo(-10.2, -8.9, -12.8, -8.5, -13.6, -6.9);
  outline.bezierCurveTo(-14.6, -4.8, -14.9, -0.6, -14.7, 3.2);
  outline.bezierCurveTo(-14.6, 5.2, -13.6, 6.2, -11.6, 6.2);
  const depth = 1.6;
  const bevel = 0.7;
  const body = new THREE.ExtrudeGeometry(outline, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: 0.6, bevelSegments: 10, curveSegments: 48 });
  body.translate(0, 0, -depth / 2);
  body.scale(1.14, 1.13, 1);
  device.add(new THREE.Mesh(body, shell));
  const front = depth / 2 + bevel;

  function rounded(w, h, r) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2);
    s.lineTo(w / 2 - r, -h / 2);
    s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r);
    s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    s.lineTo(-w / 2 + r, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    s.lineTo(-w / 2, -h / 2 + r);
    s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return s;
  }

  const screenY = 0.45;
  const bezelPlate = new THREE.ExtrudeGeometry(rounded(19.6, 11.6, 0.9), { depth: 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3, curveSegments: 16 });
  const bezelMesh = new THREE.Mesh(bezelPlate, glass);
  bezelMesh.position.set(0, screenY, front - 0.06);
  device.add(bezelMesh);

  const panel = new THREE.ShapeGeometry(rounded(18.4, 10.35, 0.25), 12);
  const uv = panel.attributes.uv;
  const pos = panel.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 18.4 + 0.5, pos.getY(i) / 10.35 + 0.5);
  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(panel, new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  screen.position.set(0, screenY, front + 0.07);
  device.add(screen);

  // A faint reflection across the glass.
  const sheen = new THREE.Mesh(new THREE.ShapeGeometry(rounded(19.6, 11.6, 0.9), 12), new THREE.MeshPhysicalMaterial({
    color: 0xffffff, transparent: true, opacity: 0.025, roughness: 0, transmission: 0, depthWrite: false,
  }));
  sheen.position.set(0, screenY, front + 0.09);
  device.add(sheen);

  function stick(x, y) {
    const group = new THREE.Group();
    const well = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.16, 16, 48), trim);
    well.position.z = front;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.2, 48), rubber);
    base.rotation.x = Math.PI / 2;
    base.position.z = front;
    const profile = [
      new THREE.Vector2(0, 0.62), new THREE.Vector2(0.55, 0.56), new THREE.Vector2(0.92, 0.66), new THREE.Vector2(1.02, 0.6),
      new THREE.Vector2(1.04, 0.36), new THREE.Vector2(0.62, 0.2), new THREE.Vector2(0.5, 0),
    ];
    const cap = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), rubber);
    cap.rotation.x = Math.PI / 2;
    cap.position.z = front + 0.08;
    group.add(well, base, cap);
    group.position.set(x, y, 0);
    device.add(group);
  }

  function dpad(x, y) {
    const group = new THREE.Group();
    for (const turn of [0, Math.PI / 2]) {
      const arm = new THREE.Mesh(new RoundedBoxGeometry(2.3, 0.74, 0.34, 3, 0.12), trim);
      arm.rotation.z = turn;
      group.add(arm);
    }
    group.position.set(x, y, front + 0.12);
    device.add(group);
  }

  function face(x, y) {
    const spread = 0.95;
    for (const [dx, dy] of [[0, spread], [spread, 0], [0, -spread], [-spread, 0]]) {
      const button = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.34, 32), trim);
      button.rotation.x = Math.PI / 2;
      button.position.set(x + dx, y + dy, front + 0.12);
      device.add(button);
    }
  }

  function pill(x, y) {
    const button = new THREE.Mesh(new RoundedBoxGeometry(0.75, 0.38, 0.2, 3, 0.18), trim);
    button.position.set(x, y, front + 0.06);
    device.add(button);
  }

  stick(-13.2, 2.4);
  dpad(-13.2, -2.6);
  face(13.2, 2.4);
  stick(13.2, -2.6);
  pill(-11.6, 5.7);
  pill(11.6, 5.7);

  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new RoundedBoxGeometry(5.2, 0.7, 1.6, 4, 0.3), trim);
    shoulder.position.set(side * 11.9, 7.05, -0.1);
    device.add(shoulder);
  }

  const led = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), new THREE.MeshBasicMaterial({ color: 0x1a9fff, toneMapped: false }));
  led.position.set(11.2, -6.0, front + 0.01);
  device.add(led);

  // Soft shadow under the device, drawn into the transparent canvas.
  const shade = document.createElement("canvas");
  shade.width = shade.height = 128;
  const g = shade.getContext("2d");
  const fade = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  fade.addColorStop(0, "rgba(0,0,0,0.55)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = fade;
  g.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(42, 9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shade), transparent: true, depthWrite: false }));
  shadow.position.set(0, -10.6, -3);
  scene.add(shadow);

  const camera = new THREE.PerspectiveCamera(20, 2, 1, 400);
  function fit() {
    const w = figure.clientWidth;
    const h = canvas.clientHeight || w / 2;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const half = THREE.MathUtils.degToRad(camera.fov / 2);
    const byHeight = 10.6 / Math.tan(half);
    const byWidth = 18.2 / (Math.tan(half) * camera.aspect);
    camera.position.set(0, 0, Math.max(byHeight, byWidth));
    camera.lookAt(0, -1, 0);
    camera.updateProjectionMatrix();
  }

  figure.prepend(canvas);
  figure.classList.add("is-3d");
  fit();
  new ResizeObserver(fit).observe(figure);

  const aim = { x: 0, y: 0 };
  const now = { x: 0, y: 0 };
  if (!calm) {
    addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse") return;
      aim.x = (event.clientX / innerWidth - 0.5) * 2;
      aim.y = (event.clientY / innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  let shown = false;
  new IntersectionObserver((entries) => {
    shown = entries.some((entry) => entry.isIntersecting);
  }).observe(figure);

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    if (!shown) return;
    const t = clock.getElapsedTime();
    now.x += (aim.x - now.x) * 0.05;
    now.y += (aim.y - now.y) * 0.05;
    const drift = calm ? 0 : 1;
    device.rotation.y = drift * (Math.sin(t * 0.35) * 0.1 + now.x * 0.18);
    device.rotation.x = -0.12 + drift * (Math.sin(t * 0.27) * 0.03 + now.y * 0.08);
    device.position.y = drift * Math.sin(t * 0.6) * 0.15;
    renderer.render(scene, camera);
  });
}
