import type * as Three from "three";
import type { gsap as Gsap } from "gsap";
import type { ShowcaseCard } from "../demo/collection";
import { cardTextureSource } from "#shared/domain/card-artwork";
import { scenePixelRatio } from "./render-budget";
import {
  HERO_MOTION_CONFIG as C,
  heroLayout,
  heroColor,
  heroOrbitPose,
  latestRequest,
  type HeroPhase,
} from "./hero-config";

type SceneOptions = {
  host: HTMLElement;
  phase: (state: HeroPhase, main?: string, reason?: "image" | "webgl") => void;
  activity: (active: boolean) => void;
};
type Request = { cards: ShowcaseCard[]; replay: boolean };

export function createHeroScene(
  T: typeof Three,
  gsap: typeof Gsap,
  options: SceneOptions,
) {
  const { host } = options;
  const renderer = new T.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.prepend(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(C.fov, 1, 0.1, 80);
  const rig = new T.Group();
  const parallax = new T.Group();
  scene.add(rig);
  rig.add(parallax);
  scene.add(new T.AmbientLight(0xffffff, 1.3));
  const key = new T.DirectionalLight(0xf2ffdb, 2.2);
  key.position.set(-3, 4, 6);
  scene.add(key);
  const rim = new T.DirectionalLight(0x91bde9, 1.6);
  rim.position.set(4, -1, 2);
  scene.add(rim);
  const geometries: Three.BufferGeometry[] = [];
  const materials: Three.Material[] = [];
  const keepGeometry = <G extends Three.BufferGeometry>(g: G) => {
    geometries.push(g);
    return g;
  };
  const keepMaterial = <M extends Three.Material>(m: M) => {
    materials.push(m);
    return m;
  };
  const cardGeometry = keepGeometry(
    new T.BoxGeometry(C.cardWidth, C.cardHeight, C.cardThickness),
  );
  const faceGeometry = keepGeometry(
    new T.PlaneGeometry(C.cardWidth - 0.025, C.cardHeight - 0.025),
  );
  const edgeGeometry = keepGeometry(new T.EdgesGeometry(cardGeometry));
  const vertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
  const sheenFragment = `
    varying vec2 vUv; uniform float sweep; uniform float impact; uniform float angle; uniform float alpha;
    void main(){
      float line=1.-smoothstep(.018,.15,abs(vUv.x+vUv.y*.33-sweep));
      float tilt=abs(angle)*.2;
      float edge=pow(abs(vUv.x-.5)*2.,5.);
      vec3 hue=mix(vec3(.56,.89,1.),vec3(1.,.79,.93),vUv.y);
      float amount=(line*impact*.19+edge*tilt*.16)*alpha;
      gl_FragColor=vec4(hue,amount);
      #include <colorspace_fragment>
    }`;
  function makeSlot() {
    const entry = new T.Group(),
      idle = new T.Group(),
      hover = new T.Group();
    entry.add(idle);
    idle.add(hover);
    const front = keepMaterial(
      new T.MeshBasicMaterial({ toneMapped: false, transparent: true }),
    );
    const back = keepMaterial(
      new T.MeshBasicMaterial({ toneMapped: false, transparent: true }),
    );
    const edge = keepMaterial(
      new T.MeshStandardMaterial({
        color: 0xd7dccf,
        metalness: 0.55,
        roughness: 0.36,
        transparent: true,
      }),
    );
    const card = new T.Mesh(cardGeometry, [
      edge,
      edge,
      edge,
      edge,
      front,
      back,
    ]);
    hover.add(card);
    const uniforms = {
      sweep: { value: -0.3 },
      impact: { value: 0 },
      angle: { value: 0 },
      alpha: { value: 1 },
    };
    const foil = keepMaterial(
      new T.ShaderMaterial({
        uniforms,
        vertexShader: vertex,
        fragmentShader: sheenFragment,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    );
    const sheen = new T.Mesh(faceGeometry, foil);
    sheen.position.z = C.cardThickness / 2 + 0.002;
    hover.add(sheen);
    const edgeLight = keepMaterial(
      new T.LineBasicMaterial({
        color: 0xe8f9c5,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      }),
    );
    hover.add(new T.LineSegments(edgeGeometry, edgeLight));
    return {
      entry,
      idle,
      hover,
      card,
      front,
      back,
      edge,
      uniforms,
      edgeLight,
      fade: { value: 1 },
    };
  }
  function makeBank() {
    const group = new T.Group();
    parallax.add(group);
    group.visible = false;
    const slots = Array.from({ length: 3 }, () => makeSlot());
    slots.forEach((slot) => group.add(slot.entry));
    return { group, slots, count: 0 };
  }
  // Two fixed three-card banks overlap during transitions; meshes/materials never grow per replay.
  const banks = [makeBank(), makeBank()];
  let active = 0;
  const atmosphere = {
    r: 0.72,
    g: 0.95,
    b: 0.42,
    intensity: C.glowIntensity as number,
    pulse: 0,
    ring: 0,
    radius: 0.22,
  };
  const auraUniforms = {
    tint: { value: new T.Color(heroColor()) },
    intensity: { value: C.glowIntensity as number },
    pulse: { value: 0 },
    ring: { value: 0 },
    radius: { value: 0.22 },
  };
  const auraMaterial = keepMaterial(
    new T.ShaderMaterial({
      uniforms: auraUniforms,
      vertexShader: vertex,
      fragmentShader: `varying vec2 vUv; uniform vec3 tint; uniform float intensity; uniform float pulse; uniform float ring; uniform float radius;
      void main(){vec2 p=(vUv-.5)*2.;float d=length(p);float glow=exp(-d*d*4.5)*(intensity+pulse);
      float band=(1.-smoothstep(.005,.025,abs(d-radius)))*ring;
      gl_FragColor=vec4(tint,glow+band);
      #include <colorspace_fragment>
      }`,
      transparent: true,
      depthWrite: false,
    }),
  );
  const aura = new T.Mesh(
    keepGeometry(new T.PlaneGeometry(8, 7)),
    auraMaterial,
  );
  aura.position.set(0.15, 0, -3);
  rig.add(aura);
  const textures = new Map<string, Promise<Three.Texture>>();
  const loadedTextures = new Set<Three.Texture>();
  const loader = new T.TextureLoader();
  let dead = false,
    failed = false,
    reduced = false,
    visible = true,
    blocked = false,
    ticking = false,
    compact = false;
  let phase: HeroPhase = "loading",
    current: ShowcaseCard[] = [],
    busy = false,
    generation = 0;
  let timeline: ReturnType<typeof gsap.timeline> | undefined;
  let textTimeline: ReturnType<typeof gsap.timeline> | undefined;
  let lastFrame = 0,
    clock = 0,
    frameCount = 0;
  const pointer = { x: 0, y: 0, hover: 0 };
  const eased = { x: 0, y: 0, hover: 0 };
  const raycaster = new T.Raycaster(),
    pointerVector = new T.Vector2();
  const queue = latestRequest<Request>();
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  let motionEnabled = true;
  const hero = host.closest<HTMLElement>(".a-hero");
  const textNodes = hero?.querySelectorAll<HTMLElement>(".a-identity > *");
  let lastRgb = '', lastPulse = '', lastResources = '', telemetryAt = 0;
  function state(next: HeroPhase, reason?: "image" | "webgl") {
    phase = next;
    host.dataset.phase = next;
    options.phase(next, current[0]?.code, reason);
  }
  function canRun() {
    return !dead && !failed && phase !== "fallback" && visible && !document.hidden && !blocked;
  }
  function render() {
    if (!canRun()) return;
    for (const bank of banks)
      for (const [i, slot] of bank.slots.entries()) {
        slot.front.opacity =
          slot.back.opacity =
          slot.edge.opacity =
            slot.fade.value;
        slot.front.color.setScalar(i === 0 ? 1 : 0.79 - eased.hover * 0.035);
        slot.uniforms.alpha.value = slot.fade.value;
        slot.uniforms.angle.value =
          slot.entry.rotation.y + parallax.rotation.y + slot.hover.rotation.y;
        slot.edgeLight.opacity =
          slot.fade.value *
          (i === 0
            ? 0.12 + slot.uniforms.impact.value * 0.24 + eased.hover * 0.15
            : 0.07);
      }
    auraUniforms.tint.value.setRGB(atmosphere.r, atmosphere.g, atmosphere.b);
    auraUniforms.intensity.value = atmosphere.intensity;
    auraUniforms.pulse.value = atmosphere.pulse;
    auraUniforms.ring.value = atmosphere.ring;
    auraUniforms.radius.value = atmosphere.radius;
    const rgb = `${Math.round(atmosphere.r * 255)}, ${Math.round(atmosphere.g * 255)}, ${Math.round(atmosphere.b * 255)}`;
    const pulse = atmosphere.pulse.toFixed(3);
    if (rgb !== lastRgb) { hero?.style.setProperty('--hero-rgb', rgb); lastRgb = rgb; }
    if (pulse !== lastPulse) { hero?.style.setProperty('--hero-pulse', pulse); lastPulse = pulse; }
    aura.position.x = 0.15 - eased.x * 0.09;
    renderer.render(scene, camera);
    frameCount++;
    const now = performance.now();
    if (now - telemetryAt >= 500) { host.dataset.frames = String(frameCount); telemetryAt = now; }
    const resources = `${renderer.info.memory.geometries},${renderer.info.memory.textures}`;
    if (resources !== lastResources) { host.dataset.resources = resources; lastResources = resources; }
  }
  function tick(time: number) {
    const interval = compact && !busy ? 1 / 30 : 1 / 60;
    if (time - lastFrame < interval - 0.001) return;
    const dt = Math.min(time - lastFrame || interval, 0.05);
    lastFrame = time;
    clock += dt;
    const damping = 1 - Math.exp(-C.damping * dt);
    const interactive = phase === "idle" && !reduced;
    eased.x += ((interactive ? pointer.x : 0) - eased.x) * damping;
    eased.y += ((interactive ? pointer.y : 0) - eased.y) * damping;
    eased.hover += ((interactive ? pointer.hover : 0) - eased.hover) * damping;
    parallax.rotation.set(-eased.y * C.parallaxX, eased.x * C.parallaxY, 0);
    for (const bank of banks)
      for (const [i, slot] of bank.slots.entries()) {
        slot.idle.position.y = reduced
          ? 0
          : Math.sin(
              (clock * Math.PI * 2) / (C.idlePeriod + i * 0.7) + i * 1.9,
            ) *
            C.idleAmplitude *
            (i ? 0.68 : 1);
        slot.idle.rotation.z = reduced ? 0 : Math.sin(clock * 0.65 + i) * 0.006;
        slot.hover.position.z = i ? 0 : eased.hover * C.hoverDepth;
        slot.hover.rotation.y = eased.x * (i ? 0.012 : 0.025);
      }
    render();
  }
  function syncActivity() {
    const running = canRun();
    timeline?.paused(!running);
    textTimeline?.paused(!running);
    const needsTick = running && !reduced;
    if (needsTick && !ticking) {
      lastFrame = 0;
      gsap.ticker.add(tick);
      ticking = true;
    } else if (!needsTick && ticking) {
      gsap.ticker.remove(tick);
      ticking = false;
    }
    host.dataset.active = String(running);
    options.activity(running);
    if (running) render();
  }
  async function texture(url: string) {
    if (!textures.has(url))
      textures.set(
        url,
        loader
          .loadAsync(cardTextureSource(url))
          .then((t) => {
            if (dead || failed) {
              t.dispose();
              throw new Error("scene disposed");
            }
            t.colorSpace = T.SRGBColorSpace;
            t.anisotropy = Math.min(
              4,
              renderer.capabilities.getMaxAnisotropy(),
            );
            loadedTextures.add(t);
            t.userData.sourceUrl = url;
            return t;
          })
          .catch((error) => {
            textures.delete(url);
            throw error;
          }),
      );
    return textures.get(url)!;
  }
  function settle(bank = banks[active]!) {
    const targets = heroLayout(bank.count, compact);
    bank.slots.forEach((slot, i) => {
      slot.entry.visible = i < bank.count;
      const target = targets[i];
      if (!target) return;
      slot.entry.position.set(target.x, target.y, target.z);
      slot.entry.rotation.set(target.rx, target.ry, target.rz);
      slot.entry.scale.setScalar(target.scale);
      slot.fade.value = 1;
      slot.uniforms.impact.value = 0;
      slot.uniforms.sweep.value = 1.6;
    });
    atmosphere.pulse = atmosphere.ring = 0;
    atmosphere.intensity = C.glowIntensity;
  }
  let bufferWidth = 0, bufferHeight = 0, bufferRatio = 0;
  function resize() {
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    compact = rect.width < 450;
    const w = Math.round(rect.width), h = Math.round(rect.height), ratio = scenePixelRatio(w, h, devicePixelRatio);
    if (w !== bufferWidth || h !== bufferHeight || ratio !== bufferRatio) {
      renderer.setDrawingBufferSize(w, h, ratio);
      bufferWidth = w; bufferHeight = h; bufferRatio = ratio;
    }
    camera.aspect = rect.width / Math.max(rect.height, 1);
    const halfWidth = compact ? 1.95 : 2.55;
    camera.position.set(
      0,
      0,
      Math.max(
        7.1,
        halfWidth / (Math.tan((C.fov * Math.PI) / 360) * camera.aspect) + 0.45,
      ),
    );
    camera.updateProjectionMatrix();
    if (phase === "idle") settle();
    render();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const intersection = new IntersectionObserver(
    ([entry]) => {
      visible = !!entry?.isIntersecting;
      syncActivity();
    },
    { threshold: 0.05 },
  );
  intersection.observe(host);
  const onVisibility = () => syncActivity();
  document.addEventListener("visibilitychange", onVisibility);
  function onPointer(event: PointerEvent) {
    if (
      !finePointer.matches ||
      event.pointerType === "touch" ||
      reduced ||
      !canRun()
    )
      return;
    const bounds = host.getBoundingClientRect();
    pointer.x = Math.max(
      -1,
      Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1),
    );
    pointer.y = Math.max(
      -1,
      Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1),
    );
    pointerVector.set(pointer.x, -pointer.y);
    raycaster.setFromCamera(pointerVector, camera);
    pointer.hover =
      phase === "idle" &&
      !!raycaster.intersectObject(banks[active]!.slots[0]!.card).length
        ? 1
        : 0;
    host.dataset.pointer = `${pointer.x.toFixed(2)},${pointer.y.toFixed(2)}`;
  }
  function leave() {
    pointer.x = pointer.y = pointer.hover = 0;
    host.dataset.pointer = "0,0";
  }
  host.addEventListener("pointermove", onPointer);
  host.addEventListener("pointerleave", leave);
  function fallback(reason: "image" | "webgl" = "webgl") {
    if (dead || failed) return;
    failed = reason === "webgl";
    generation++;
    busy = false;
    queue.clear();
    timeline?.kill();
    textTimeline?.kill();
    gsap.ticker.remove(tick);
    ticking = false;
    if (textNodes)
      gsap.set(textNodes, { clearProps: "opacity,transform,filter" });
    renderer.domElement.style.visibility = "hidden";
    state("fallback", reason);
    options.activity(false);
  }
  function lost(event: Event) {
    event.preventDefault();
    fallback();
  }
  renderer.domElement.addEventListener("webglcontextlost", lost);
  function finish() {
    if (dead || failed) return;
    busy = false;
    settle();
    banks[1 - active]!.group.visible = false;
    // A long display range must not retain thousands of GPU textures.
    if (loadedTextures.size > 12) {
      const retained = new Set(
        banks.flatMap((bank) =>
          bank.slots.flatMap((slot) => [slot.front.map, slot.back.map]),
        ),
      );
      for (const t of loadedTextures)
        if (!retained.has(t)) {
          textures.delete(t.userData.sourceUrl);
          loadedTextures.delete(t);
          t.dispose();
        }
    }
    state("idle");
    resize();
    syncActivity();
    const next = queue.take();
    if (next) void run(next);
  }
  async function run(request: Request) {
    if (dead || failed) return;
    if (busy) {
      queue.put(request);
      return;
    }
    busy = true;
    const token = ++generation;
    const old = banks[active]!,
      first = !old.count || phase === "fallback";
    state(first ? "loading" : "transitioning");
    let texturesReady = false;
    try {
      // Keep the previous bank visible until every required texture is ready.
      const [back, fronts] = await Promise.all([
        texture("/design/back.png"),
        Promise.all(request.cards.map((c) => texture(c.img))),
      ]);
      texturesReady = true;
      if (dead || failed || token !== generation) return;
      const newer = queue.take();
      if (newer) {
        busy = false;
        void run(newer);
        return;
      }
      renderer.domElement.style.visibility = "";
      const incoming = banks[1 - active]!;
      incoming.count = Math.max(1, request.cards.length);
      incoming.group.visible = true;
      incoming.slots.forEach((slot, i) => {
        slot.entry.visible = i < incoming.count;
        slot.front.map = fronts[i] || back;
        slot.back.map = back;
        slot.front.needsUpdate = slot.back.needsUpdate = true;
      });
      const previous = current;
      current = request.cards;
      const color = new T.Color(heroColor(current[0]?.attribute));
      timeline?.kill();
      if (reduced) {
        atmosphere.r = color.r;
        atmosphere.g = color.g;
        atmosphere.b = color.b;
        active = 1 - active;
        finish();
        return;
      }
      const targets = heroLayout(incoming.count, compact);
      const intro = first || request.replay;
      host.dataset.motion = intro ? "intro" : "orbit";
      host.dataset.officialBack = "/design/back.png";
      state(intro ? "intro" : "transitioning");
      if (!intro) {
        const previousLayout = heroLayout(old.count, compact);
        // Transfer each visible card's pose to the fixed incoming bank, then
        // carry it through depth. At the middle of the arc its official back faces us.
        old.group.visible = false;
        timeline = gsap.timeline({ paused: true, onComplete: finish });
        incoming.slots.slice(0, incoming.count).forEach((slot, i) => {
          const oldIndex = previous.findIndex(
            (c) => c.code === current[i]?.code,
          );
          const from = previousLayout[oldIndex] || {
            ...targets[i]!,
            z: -3.6,
            ry: Math.PI,
          };
          const target = targets[i]!;
          const progress = { value: 0 };
          slot.fade.value = 1;
          slot.uniforms.impact.value = 0;
          const update = () => {
            const pose = heroOrbitPose(from, target, progress.value);
            slot.entry.position.set(pose.x, pose.y, pose.z);
            slot.entry.rotation.set(pose.rx, pose.ry, pose.rz);
            slot.entry.scale.setScalar(pose.scale);
          };
          update();
          timeline!.to(
            progress,
            {
              value: 1,
              duration: C.orbitDuration,
              ease: "sine.inOut",
              onUpdate: update,
            },
            0,
          );
        });
        timeline.to(
          atmosphere,
          {
            r: color.r,
            g: color.g,
            b: color.b,
            duration: C.orbitDuration,
            ease: "sine.inOut",
          },
          0,
        );
        active = 1 - active;
        syncActivity();
        return;
      }
      // Replay resets to the same entry poses and timing as the first visit.
      old.group.visible = false;
      const duration = C.introDuration;
      timeline = gsap.timeline({ paused: true, onComplete: finish });
      const start = 0.3;
      timeline.to(
        atmosphere,
        {
          r: color.r,
          g: color.g,
          b: color.b,
          intensity: C.glowIntensity * 1.4,
          duration: 0.9,
          ease: "sine.inOut",
        },
        0.2,
      );
      incoming.slots.slice(0, incoming.count).forEach((slot, i) => {
        const target = targets[i]!;
        slot.entry.position.set(
          i === 1 ? -2.9 : i === 2 ? 2.7 : 0.5,
          i === 0 ? -0.25 : 0.55,
          -4.8 - i * 0.65,
        );
        // A brief glimpse of the official back, never a full 360-degree spin.
        slot.entry.rotation.set(
          0.12,
          i === 0 ? -1.9 : i === 1 ? 1.72 : -1.8,
          i === 1 ? 0.26 : -0.24,
        );
        slot.entry.scale.setScalar(target.scale * 0.91);
        slot.fade.value = 0;
        slot.uniforms.sweep.value = -0.3;
        slot.uniforms.impact.value = 0;
        const at = start + (i ? 0.13 + i * 0.06 : 0);
        timeline!.to(slot.fade, { value: 1, duration: 0.25 }, at);
        timeline!.to(
          slot.entry.position,
          {
            x: target.x,
            y: target.y,
            z: target.z + (i ? 0 : 0.12),
            duration: i ? 1.1 : 0.88,
            ease: "power3.out",
          },
          at,
        );
        timeline!.to(
          slot.entry.rotation,
          {
            x: target.rx,
            y: target.ry,
            z: target.rz,
            duration: 0.85,
            ease: "power3.out",
          },
          at,
        );
        timeline!.to(
          slot.entry.scale,
          {
            x: target.scale * (i ? 1 : C.impactScale),
            y: target.scale * (i ? 1 : C.impactScale),
            z: target.scale,
            duration: 0.85,
            ease: "power3.out",
          },
          at,
        );
        timeline!.to(
          slot.entry.scale,
          {
            x: target.scale,
            y: target.scale,
            duration: 0.46,
            ease: "sine.out",
          },
          at + 0.85,
        );
        timeline!.to(
          slot.entry.position,
          { z: target.z, duration: 0.5, ease: "sine.out" },
          at + 0.9,
        );
        if (!i) {
          timeline!.to(
            slot.uniforms.impact,
            { value: intro ? 1 : 0.72, duration: 0.1 },
            at + 0.68,
          );
          timeline!.to(
            slot.uniforms.sweep,
            { value: 1.55, duration: 0.52, ease: "sine.inOut" },
            at + 0.7,
          );
          timeline!.to(
            slot.uniforms.impact,
            { value: 0, duration: 0.38 },
            at + 0.95,
          );
        }
      });
      const impactAt = start + 0.75;
      timeline.set(atmosphere, { radius: 0.18 }, impactAt);
      timeline.to(
        atmosphere,
        {
          pulse: intro ? 0.14 : 0.085,
          ring: intro ? 0.18 : 0.1,
          duration: 0.1,
        },
        impactAt,
      );
      timeline.to(
        atmosphere,
        {
          radius: 0.79,
          pulse: 0,
          ring: 0,
          intensity: C.glowIntensity,
          duration: 0.5,
          ease: "power2.out",
        },
        impactAt + 0.1,
      );
      timeline.call(() => state("recovering"), [], duration - 0.7);
      timeline.to({}, { duration: 0.01 }, duration - 0.01);
      active = 1 - active;
      if (intro && textNodes) {
        textTimeline?.kill();
        textTimeline = gsap.timeline().fromTo(
          textNodes,
          { opacity: 0, y: 18 },
          {
            opacity: 1,
            y: 0,
            duration: 0.75,
            stagger: 0.16,
            ease: "power2.out",
            clearProps: "opacity,transform",
          },
          0.08,
        );
      }
      syncActivity();
    } catch {
      if (!dead && token === generation) {
        const newer = queue.take();
        if (newer) { busy = false; void run(newer); }
        else fallback(texturesReady ? "webgl" : "image");
      }
    }
  }
  function setMotion(enabled: boolean) {
    motionEnabled = enabled;
    reduced = !enabled || media.matches;
    leave();
    if (reduced) {
      timeline?.progress(1);
      textTimeline?.progress(1);
      parallax.rotation.set(0, 0, 0);
      eased.x = eased.y = eased.hover = 0;
      for (const bank of banks)
        for (const slot of bank.slots) {
          slot.idle.position.set(0, 0, 0);
          slot.idle.rotation.set(0, 0, 0);
          slot.hover.position.set(0, 0, 0);
          slot.hover.rotation.set(0, 0, 0);
        }
      if (!busy) settle();
    }
    syncActivity();
  }
  const mediaChange = () => setMotion(motionEnabled);
  media.addEventListener("change", mediaChange);
  resize();
  return {
    request(cards: ShowcaseCard[], replay = false) {
      void run({ cards: cards.slice(0, 3), replay });
    },
    setMotion,
    setBlocked(value: boolean) {
      blocked = value;
      leave();
      syncActivity();
    },
    dispose() {
      if (dead) return;
      dead = true;
      generation++;
      queue.clear();
      timeline?.kill();
      textTimeline?.kill();
      gsap.ticker.remove(tick);
      if (textNodes)
        gsap.set(textNodes, { clearProps: "opacity,transform,filter" });
      resizeObserver.disconnect();
      intersection.disconnect();
      media.removeEventListener("change", mediaChange);
      document.removeEventListener("visibilitychange", onVisibility);
      host.removeEventListener("pointermove", onPointer);
      host.removeEventListener("pointerleave", leave);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      loadedTextures.forEach((t) => t.dispose());
      textures.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      hero?.style.removeProperty("--hero-rgb");
      hero?.style.removeProperty("--hero-pulse");
    },
  };
}
