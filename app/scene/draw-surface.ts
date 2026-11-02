import type * as Three from "three";
import { DRAW_CONFIG as C } from "./draw-config";

/** Rounded, beveled paper core and independent coated faces (not an unlit box). */
export function createDrawSurface(T: typeof Three) {
  const shape = new T.Shape();
  const x = -C.cardWidth / 2,
    y = -C.cardHeight / 2,
    w = C.cardWidth,
    h = C.cardHeight,
    r = 0.085;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const core = new T.ExtrudeGeometry(shape, {
    depth: C.cardThickness,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 2,
    steps: 1,
    curveSegments: 8,
  });
  core.translate(0, 0, -C.cardThickness / 2);
  const face = new T.ShapeGeometry(shape, 8);
  const uv = face.getAttribute("uv");
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, uv.getX(i) / w + 0.5, uv.getY(i) / h + 0.5);
  uv.needsUpdate = true;
  const grain = new Uint8Array(64 * 64 * 4);
  for (let i = 0; i < 64 * 64; i++) {
    const value =
      120 + Math.round(((Math.sin(i * 12.9898) * 43758.5453) % 1) * 10);
    grain.set([value, value, value, 255], i * 4);
  }
  const texture = new T.DataTexture(grain, 64, 64);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(5, 7);
  texture.needsUpdate = true;
  const material = () =>
    new T.MeshPhysicalMaterial({
      roughness: 0.38,
      metalness: 0.025,
      clearcoat: 0.65,
      clearcoatRoughness: 0.28,
      envMapIntensity: 0.16,
      specularIntensity: 0.4,
      bumpMap: texture,
      bumpScale: 0.0015,
    });
  /**
   * A subtle, view-dependent varnish layer. Card art itself stays on an
   * unlit, toneMapped:false MeshBasicMaterial in CardStage.vue so lighting
   * cannot wash out the printed colours. The varnish never samples the art.
   *
   * Shared shader materials avoid allocating a new program for every card.
   * These parameters describe the peak strength of a narrow reflection band,
   * not a constant white overlay across the illustration.
   */
  const finishSettings = {
    frontStrength: 0.2,
    backStrength: 0.09,
    deckStrength: 0.055,
    bandWidth: 0.16,
    // Prevent z-fighting without changing the perceived card thickness.
    surfaceOffset: 0.0015,
  };
  function finishMaterial(strength: number) {
    return new T.ShaderMaterial({
      name: "draw-card-soft-varnish",
      transparent: true,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        uStrength: { value: strength },
        uFade: { value: 1 },
        uBandWidth: { value: finishSettings.bandWidth },
      },
      vertexShader: `
        varying vec2 vSurfaceUv;
        varying vec3 vSurfaceNormal;
        varying vec3 vViewDirection;
        void main() {
          vSurfaceUv = uv;
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          vSurfaceNormal = normalize(normalMatrix * normal);
          vViewDirection = normalize(-viewPosition.xyz);
          gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: `
        uniform float uStrength;
        uniform float uFade;
        uniform float uBandWidth;
        varying vec2 vSurfaceUv;
        varying vec3 vSurfaceNormal;
        varying vec3 vViewDirection;
        void main() {
          vec3 n = normalize(vSurfaceNormal);
          vec3 v = normalize(vViewDirection);
          float facing = max(dot(n, v), 0.0);
          if (facing <= 0.0) discard;

          // A soft studio strip reflected by the card surface. The reflection
          // slides across the printed face naturally as the card rotates.
          vec3 reflection = reflect(-v, n);
          float center = 0.52 + 0.68 * reflection.x + 0.22 * reflection.y;
          float coordinate = vSurfaceUv.x + 0.23 * (vSurfaceUv.y - 0.5);
          float distanceToBand = (coordinate - center) / uBandWidth;
          float broad = exp(-distanceToBand * distanceToBand);
          float narrow = exp(-distanceToBand * distanceToBand * 11.0);
          float band = 0.53 * broad + 0.47 * narrow;
          float grazing = pow(1.0 - facing, 4.0);
          float alpha = clamp(uStrength * uFade *
            (band + 0.30 * grazing), 0.0, 0.22);
          if (alpha < 0.001) discard;

          // Output linear RGB and use Three.js output colour-space conversion.
          // This layer is deliberately not affected by ACES or RoomEnvironment.
          gl_FragColor = vec4(vec3(0.76, 0.86, 1.0), alpha);
          #include <colorspace_fragment>
        }
      `,
    });
  }
  const frontFinish = finishMaterial(finishSettings.frontStrength);
  const backFinish = finishMaterial(finishSettings.backStrength);
  const deckFinish = finishMaterial(finishSettings.deckStrength);
  /** Keep the varnish attached to the deck in sync with GSAP's deck opacity. */
  function setDeckFinishOpacity(opacity: number) {
    deckFinish.uniforms.uFade!.value = Math.max(0, Math.min(1, opacity));
  }
  const shadowGeometry = new T.PlaneGeometry(w + 0.42, h + 0.42);
  const shadowMaterial = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { alpha: { value: 0.23 } },
    vertexShader:
      "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader:
      "varying vec2 vUv; uniform float alpha; void main(){vec2 q=abs(vUv-.5)-vec2(.36,.39);float d=length(max(q,0.))+min(max(q.x,q.y),0.);float a=1.-smoothstep(-.01,.095,d);gl_FragColor=vec4(.015,.02,.015,a*alpha);}",
  });
  function card(
    front: Three.Material,
    back: Three.Material,
    edge: Three.Material,
    shadow = false,
    isDeck = false,
  ) {
    const group = new T.Group();
    if (shadow) {
      const shade = new T.Mesh(shadowGeometry, shadowMaterial);
      shade.position.set(0.065, -0.08, -0.09);
      group.add(shade);
    }
    group.add(new T.Mesh(core, edge));
    const top = new T.Mesh(face, front);
    top.position.z = C.cardThickness / 2 + 0.007;
    group.add(top);
    const bottom = new T.Mesh(face, back);
    bottom.rotation.y = Math.PI;
    bottom.position.z = -C.cardThickness / 2 - 0.007;
    group.add(bottom);

    // These follow the same face geometry and card group as the artwork.
    // The base print renders first; transparent varnish renders on top.
    const frontCoat = new T.Mesh(face, isDeck ? deckFinish : frontFinish);
    frontCoat.position.z = top.position.z + finishSettings.surfaceOffset;
    frontCoat.renderOrder = 1;
    group.add(frontCoat);
    const backCoat = new T.Mesh(face, isDeck ? deckFinish : backFinish);
    backCoat.rotation.y = Math.PI;
    backCoat.position.z = bottom.position.z - finishSettings.surfaceOffset;
    backCoat.renderOrder = 1;
    group.add(backCoat);
    return group;
  }
  return {
    material, // Legacy physical-material factory; not used for printed faces.
    card,
    setDeckFinishOpacity,
    dispose() {
      core.dispose();
      face.dispose();
      texture.dispose();
      shadowGeometry.dispose();
      shadowMaterial.dispose();
      frontFinish.dispose();
      backFinish.dispose();
      deckFinish.dispose();
    },
  };
}
