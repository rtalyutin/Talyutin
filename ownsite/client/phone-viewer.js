import {
  Scene, PerspectiveCamera, WebGLRenderer, Group, HemisphereLight,
  DirectionalLight, PMREMGenerator, MathUtils, Quaternion, Euler, SRGBColorSpace,
  ACESFilmicToneMapping
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS3DObject, CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// The GLB and the existing HTML iframe share one camera and one pose.
// No canvas screenshot of a website: screen controls remain native DOM controls.
export async function mountPhone({ device, space, getPose }) {
  const renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 1, 10000);
  camera.position.z = 2200;
  const pmrem = new PMREMGenerator(renderer);
  const environmentScene = new RoomEnvironment();
  const environment = pmrem.fromScene(environmentScene, .04);
  scene.environment = environment.texture;
  environmentScene.dispose();
  pmrem.dispose();
  scene.add(new HemisphereLight(0xe5efff, 0x323335, 2));
  const key = new DirectionalLight(0xffffff, 3);
  key.position.set(-400, 700, 900); scene.add(key);
  const fill = new DirectionalLight(0xbfdcff, 1.5);
  fill.position.set(500, -200, 600); scene.add(fill);

  let gltf;
  try {
    gltf = await new GLTFLoader().loadAsync('/assets/rt-phone.glb');
  } catch (error) {
    environment.dispose(); renderer.dispose();
    throw error;
  }
  const model = gltf.scene.getObjectByName('RT_Phone');
  const metrics = model?.userData;
  if (!metrics || metrics.width !== 3.6 || metrics.height !== 7.5 || !model.getObjectByName('Screen')) {
    environment.dispose(); renderer.dispose();
    throw new Error('Phone asset does not match the screen contract');
  }
  if (device.querySelector('iframe')) {
    // Avoid reparenting an iframe that was opened while the GLB was loading.
    environment.dispose(); renderer.dispose();
    gltf.scene.traverse(object => {
      object.geometry?.dispose();
      if (object.material) for (const mat of Array.isArray(object.material) ? object.material : [object.material]) mat.dispose();
    });
    device.dataset.modelStatus = 'fallback';
    return;
  }
  model.getObjectByName('Screen').visible = false;
  const body = new Group(); body.add(gltf.scene); scene.add(body);
  const cssScene = new Scene();
  const cssRenderer = new CSS3DRenderer();
  const screenObject = new CSS3DObject(device);
  cssScene.add(screenObject);
  const canvas = renderer.domElement;
  canvas.className = 'phone-gl-layer';
  canvas.setAttribute('aria-hidden', 'true');
  cssRenderer.domElement.className = 'phone-dom-layer';
  space.append(canvas, cssRenderer.domElement);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const target = new Quaternion();
  let frame = 0, active = true, webglAvailable = true, inView = true, pixelsPerUnit = 1, userScale = 1;
  let previousTime = 0;

  function readPose() {
    const pose = getPose();
    const style = getComputedStyle(device);
    const rz = parseFloat(style.getPropertyValue('--rz')) || 0;
    userScale = parseFloat(style.getPropertyValue('--scale')) || 1;
    // CSS is Y-down, Three is Y-up.
    target.setFromEuler(new Euler(
      -MathUtils.degToRad(pose.rx), -MathUtils.degToRad(pose.ry), -MathUtils.degToRad(rz), 'XYZ'
    ));
  }

  function resize() {
    if (!active) return;
    const width = device.offsetWidth;
    pixelsPerUnit = width / metrics.width;
    const height = width * metrics.height / metrics.width;
    device.style.setProperty('--dh', height + 'px');
    device.style.setProperty('--depth', (metrics.screenZ * 2 * pixelsPerUnit) + 'px');
    // Extra render area allows landscape geometry beyond the portrait layout box.
    const padding = Math.ceil(width);
    const w = Math.round(space.clientWidth + padding * 2);
    const h = Math.round(space.clientHeight + padding * 2);
    if (webglAvailable) renderer.setSize(w, h);
    cssRenderer.setSize(w, h);
    for (const layer of [canvas, cssRenderer.domElement]) {
      layer.style.left = -padding + 'px'; layer.style.top = -padding + 'px';
    }
    camera.aspect = w / h;
    camera.fov = MathUtils.radToDeg(2 * Math.atan(h / (2 * camera.position.z)));
    camera.updateProjectionMatrix();
    readPose(); requestRender();
  }

  function render(time) {
    frame = 0;
    if (!active || document.hidden || !inView) return;
    const snap = reducedMotion.matches || device.classList.contains('is-dragging');
    const delta = Math.min((time - previousTime) / 1000, .05);
    previousTime = time;
    if (snap) body.quaternion.copy(target);
    else body.quaternion.slerp(target, 1 - Math.exp(-12 * delta));
    body.scale.setScalar(pixelsPerUnit * userScale);
    screenObject.quaternion.copy(body.quaternion);
    screenObject.scale.setScalar(userScale);
    if (webglAvailable) renderer.render(scene, camera);
    cssRenderer.render(cssScene, camera);
    if (body.quaternion.angleTo(target) > .0005) requestRender();
  }
  function requestRender() {
    if (!frame && active && inView && !document.hidden) frame = requestAnimationFrame(render);
  }
  function poseChanged() { readPose(); requestRender(); }
  function visibilityChanged() { previousTime = performance.now(); requestRender(); }
  function fallback() {
    if (!webglAvailable) return;
    webglAvailable = false;
    // Keep the CSS3D DOM parent: reparenting a live iframe resets its state.
    canvas.remove();
    space.dataset.phone = 'fallback';
    device.dataset.modelStatus = 'fallback';
    renderer.dispose(); environment.dispose();
    gltf.scene.traverse(object => {
      object.geometry?.dispose();
      if (object.material) for (const mat of Array.isArray(object.material) ? object.material : [object.material]) mat.dispose();
    });
    requestRender();
  }
  const resizeObserver = new ResizeObserver(resize);
  const orientationObserver = new MutationObserver(resize);
  const intersection = new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting; requestRender();
  });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); fallback(); });
  document.addEventListener('phone-pose', poseChanged);
  document.addEventListener('visibilitychange', visibilityChanged);
  resizeObserver.observe(space);
  orientationObserver.observe(document.body, { attributes: true, attributeFilter: ['data-orientation'] });
  intersection.observe(space);
  // Activate only once the model exists and the DOM and WebGL layers are ready.
  space.dataset.phone = 'ready';
  device.dataset.modelStatus = 'ready';
  resize(); body.quaternion.copy(target); render(performance.now());
  return { fallback };
}
