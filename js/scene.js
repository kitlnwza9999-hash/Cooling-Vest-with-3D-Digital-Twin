/**
 * Smart Cooling Vest - Unified 3D Digital Twin Three.js Engine
 * Incorporates the refined, high-detail ergonomic vest apparel model:
 * - Sculpted Anatomical Mannequin (Torso, Neck, Head, Shoulders)
 * - Outer Vest Shell with 3M Scotchlite Retroreflective Stripes, YKK Zipper & Collar
 * - Dual Rear Waist High-Static Fans (70mm ×2) with Bellmouth & Finger Guards
 * - Dual Shoulder Hands-Free Turbofans (40mm ×2) angled to face/neck
 * - Center-Back Battery BTMS Pack with Aluminum Cooling Fins & 30mm Fan
 * - ESP32 Pod, Dual MOSFET Drivers, Buck Module, Sensors (SHT31, MPU6050, DS18B20, NTC, Haptic)
 * - 3D Wiring Harness with Traveling Current Pulses
 * - 3-Zone Airflow Particle Streams
 * - Raycasting Click-to-Inspect & Exploded View Lerp
 */

class VestDigitalTwinScene {
  constructor(canvasContainerId) {
    this.container = document.getElementById(canvasContainerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    // Component Groups for Layer Control & Exploded View
    this.groupRoot = new THREE.Group();
    this.groupTorso = new THREE.Group();
    this.groupInner = new THREE.Group();
    this.groupWiring = new THREE.Group();
    this.groupShell = new THREE.Group();

    // Animated References
    this.fans = [];
    this.shoulderFans = [];
    this.batteryFan = null;
    this.wirePulses = [];
    this.wires = [];
    this.airParticles1 = null;
    this.airParticles2 = null;
    this.airGeom1 = null;
    this.airGeom2 = null;
    this.airData1 = [];
    this.airData2 = [];
    this.batMesh = null;
    this.espLed = null;
    this.vibMotor = null;
    this.reflStripes = [];

    // Component database for Raycasting & Highlighting
    this.pickableObjects = [];
    this.keyMeshes = {};
    this.selectedKey = null;

    // View Mode & Layer States
    this.currentViewMode = 'NORMAL'; // NORMAL, XRAY, EXPLODED, AIRFLOW, THERMAL, NIGHT
    this.shellMode = 1; // 0: ทึบ, 1: โปร่งใส, 2: ซ่อน
    this.layerInner = true;
    this.layerWire = true;
    this.layerAir = true;
    this.nightMode = false;
    this.heatmapMode = false;

    this.explodedProgress = 0;
    this.targetExploded = 0;

    // Dynamic Chest Smart OLED Display HUD
    this.oledCanvas = document.createElement('canvas');
    this.oledCanvas.width = 512;
    this.oledCanvas.height = 360;
    this.oledCtx = this.oledCanvas.getContext('2d');
    this.oledTexture = new THREE.CanvasTexture(this.oledCanvas);
    this.oledTexture.minFilter = THREE.LinearFilter;
    this.oledTexture.magFilter = THREE.LinearFilter;
    this.oledMat = new THREE.MeshBasicMaterial({
      map: this.oledTexture
    });

    // Camera Focus Lerp States
    this.isCameraTweening = false;
    this.targetControlsLook = new THREE.Vector3(0, 0.06, 0);
    this.targetCameraPos = new THREE.Vector3(0, 0.45, -2.55);

    // Operational Simulation State
    this.state = {
      fanRPM: 2800,
      fanPWM: 60,
      shoulderFanRPM: 3200,
      shoulderFanPWM: 70,
      shoulderFanActive: true,
      batteryTemp: 31.8,
      batteryCoolingActive: true,
      batteryFanRPM: 0,
      peltierWatts: 18,
      peltierColdTemp: 23.5,
      skinTemp: 33.6,
      ambientTemp: 34.0,
      ambientHumidity: 60,
      heatIndex: 38.5,
      currentAmps: 2.15,
      batteryVolts: 7.8,
      batterySOC: 0.85,
      systemPower: true,
      alertActive: false,
      stallFanA: false
    };

    this.init();
  }

  init() {
    if (!this.container) return;

    // 1. Scene & Atmosphere
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1017);

    // 2. Camera Setup
    const width = this.container.clientWidth || window.innerWidth * 0.6;
    const height = this.container.clientHeight || 500;
    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    this.camera.position.set(0, 0.45, -2.55); // Start looking at the rear of the vest

    // 3. Renderer Setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0.06, 0);
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 5.5;

    // 5. Lighting
    this.setupLighting();

    // 6. Build High-Detail 3D Models
    this.buildMannequin();
    this.buildVestShell();
    this.buildWaistFans();
    this.buildShoulderFans();
    this.buildBatteryAndBTMS();
    this.buildAirDuctsAndElectronics();
    this.buildWiringHarness();
    this.build3ZoneAirflowParticles();
    this.buildPedestalGrid();

    // Assemble Hierarchy
    this.groupRoot.add(this.groupTorso);
    this.groupRoot.add(this.groupInner);
    this.groupRoot.add(this.groupWiring);
    this.groupRoot.add(this.groupShell);
    this.scene.add(this.groupRoot);

    // 7. Raycasting Component Click-to-Inspect
    this.setupRaycasting();

    // 8. Event Listeners
    window.addEventListener('resize', () => this.onWindowResize());

    // 9. Start Animation Loop
    this.clock = new THREE.Clock();
    this.animate();
  }

  setupLighting() {
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x445566, 0.95);
    this.scene.add(this.hemiLight);

    this.dirLight1 = new THREE.DirectionalLight(0xffffff, 0.85);
    this.dirLight1.position.set(2.2, 3.5, -3.2);
    this.scene.add(this.dirLight1);

    this.dirLight2 = new THREE.DirectionalLight(0xe0f4ff, 0.75);
    this.dirLight2.position.set(-2.2, 2.4, 3.2);
    this.scene.add(this.dirLight2);
  }

  buildPedestalGrid() {
    const grid = new THREE.GridHelper(6, 24, 0x00f0ff, 0x1e293b);
    grid.position.y = -0.65;
    grid.material.transparent = true;
    grid.material.opacity = 0.25;
    this.scene.add(grid);
  }

  /**
   * Helper to register meshes for click-to-inspect & highlighting
   */
  registerMesh(geo, mat, pos, key, parentGroup) {
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.userData = {
      key: key,
      baseEmissive: mesh.material.emissive ? mesh.material.emissive.getHex() : 0x000000
    };
    (parentGroup || this.groupInner).add(mesh);

    if (key) {
      this.pickableObjects.push(mesh);
      if (!this.keyMeshes[key]) this.keyMeshes[key] = [];
      this.keyMeshes[key].push(mesh);
    }
    return mesh;
  }

  /**
   * 1. Sculpted Anatomical Mannequin (Realistic 3D Human Male Athlete)
   */
  buildMannequin() {
    this.torsoMat = new THREE.MeshStandardMaterial({
      color: 0xcbb19b, // Warm anatomical athletic skin tone
      roughness: 0.62,
      metalness: 0.08
    });

    this.muscleMat = new THREE.MeshStandardMaterial({
      color: 0xc1a68f, // Subtle contour tone for muscle definition
      roughness: 0.60,
      metalness: 0.08
    });

    // 1. Torso Core: Athletic V-taper Ribcage & Pelvis
    // Thorax (upper torso) tapering to waist
    const thoraxGeo = new THREE.CylinderGeometry(0.31, 0.25, 0.58, 36);
    this.mannequinMesh = new THREE.Mesh(thoraxGeo, this.torsoMat);
    this.mannequinMesh.scale.set(1.20, 1.0, 0.68);
    this.mannequinMesh.position.set(0, 0.20, 0);
    this.mannequinMesh.userData = { key: 'mannequin', baseEmissive: 0x000000 };
    this.groupTorso.add(this.mannequinMesh);
    this.pickableObjects.push(this.mannequinMesh);
    if (!this.keyMeshes['mannequin']) this.keyMeshes['mannequin'] = [];
    this.keyMeshes['mannequin'].push(this.mannequinMesh);

    // Abdomen & Pelvis lower torso (tapering into athletic waist)
    const pelvisGeo = new THREE.CylinderGeometry(0.25, 0.265, 0.44, 36);
    const pelvisMesh = new THREE.Mesh(pelvisGeo, this.torsoMat);
    pelvisMesh.scale.set(1.15, 1.0, 0.66);
    pelvisMesh.position.set(0, -0.26, 0);
    pelvisMesh.userData = { key: 'mannequin', baseEmissive: 0x000000 };
    this.groupTorso.add(pelvisMesh);
    this.pickableObjects.push(pelvisMesh);
    this.keyMeshes['mannequin'].push(pelvisMesh);

    // 2. Sculpted Pectoral Muscles (Left & Right chest plates)
    [-1, 1].forEach(s => {
      const pecGeo = new THREE.BoxGeometry(0.145, 0.16, 0.045);
      const pecMesh = new THREE.Mesh(pecGeo, this.muscleMat);
      pecMesh.position.set(s * 0.125, 0.35, 0.14);
      pecMesh.rotation.set(0.08, -s * 0.12, s * 0.05);
      pecMesh.userData = { key: 'mannequin', baseEmissive: 0x000000 };
      this.groupTorso.add(pecMesh);
      this.pickableObjects.push(pecMesh);
      this.keyMeshes['mannequin'].push(pecMesh);
    });

    // 3. Clavicles (Collarbones)
    [-1, 1].forEach(s => {
      const clavGeo = new THREE.CylinderGeometry(0.012, 0.010, 0.22, 12);
      clavGeo.rotateZ(s * (Math.PI / 2 - 0.18));
      const clav = new THREE.Mesh(clavGeo, this.muscleMat);
      clav.position.set(s * 0.16, 0.47, 0.125);
      this.groupTorso.add(clav);
    });

    // 4. Six-Pack Abdominal Muscles Definition (3 pairs)
    const abLevels = [
      { y: 0.16, h: 0.09, w: 0.075 },
      { y: 0.06, h: 0.08, w: 0.070 },
      { y: -0.04, h: 0.08, w: 0.065 }
    ];
    abLevels.forEach(lvl => {
      [-1, 1].forEach(s => {
        const abMesh = new THREE.Mesh(
          new THREE.BoxGeometry(lvl.w, lvl.h, 0.022),
          this.muscleMat
        );
        abMesh.position.set(s * 0.058, lvl.y, 0.135);
        this.groupTorso.add(abMesh);
      });
    });

    // 5. Deltoids (Sculpted Athletic Shoulder Caps)
    [-1, 1].forEach(s => {
      const deltGeo = new THREE.SphereGeometry(0.115, 24, 18);
      deltGeo.scale(0.85, 1.25, 1.0);
      const delt = new THREE.Mesh(deltGeo, this.torsoMat);
      delt.position.set(s * 0.40, 0.42, 0.01);
      delt.userData = { key: 'mannequin', baseEmissive: 0x000000 };
      this.groupTorso.add(delt);
      this.pickableObjects.push(delt);
      this.keyMeshes['mannequin'].push(delt);

      // Upper Arms (Biceps / Triceps sleeveless cut)
      const armGeo = new THREE.CylinderGeometry(0.068, 0.058, 0.32, 20);
      const arm = new THREE.Mesh(armGeo, this.torsoMat);
      arm.position.set(s * 0.40, 0.23, 0.01);
      arm.userData = { key: 'mannequin', baseEmissive: 0x000000 };
      this.groupTorso.add(arm);
      this.pickableObjects.push(arm);
      this.keyMeshes['mannequin'].push(arm);
    });

    // 6. Upper Back: Scapulae (Shoulder Blades) & Trapezius
    [-1, 1].forEach(s => {
      const scapGeo = new THREE.BoxGeometry(0.12, 0.18, 0.025);
      const scap = new THREE.Mesh(scapGeo, this.muscleMat);
      scap.position.set(s * 0.15, 0.32, -0.13);
      scap.rotation.set(-0.08, -s * 0.10, s * 0.06);
      this.groupTorso.add(scap);
    });

    // 7. Anatomical Neck with Sternocleidomastoid
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.092, 0.17, 24), this.torsoMat);
    neck.position.set(0, 0.57, 0.01);
    neck.userData = { key: 'mannequin', baseEmissive: 0x000000 };
    this.groupTorso.add(neck);
    this.pickableObjects.push(neck);
    this.keyMeshes['mannequin'].push(neck);

    // Adam's Apple bump
    const adams = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 10), this.muscleMat);
    adams.position.set(0, 0.59, 0.085);
    this.groupTorso.add(adams);

    // 8. Sculpted Head with Athletic Jawline, Nose, and Ears
    // Cranium
    const headGeo = new THREE.SphereGeometry(0.135, 32, 24);
    headGeo.scale(0.88, 1.16, 1.02);
    const head = new THREE.Mesh(headGeo, this.torsoMat);
    head.position.set(0, 0.77, 0.02);
    head.userData = { key: 'mannequin', baseEmissive: 0x000000 };
    this.groupTorso.add(head);
    this.pickableObjects.push(head);
    this.keyMeshes['mannequin'].push(head);

    // Sculpted Chin & Jaw
    const jawGeo = new THREE.ConeGeometry(0.082, 0.15, 16);
    jawGeo.rotateX(Math.PI);
    const jaw = new THREE.Mesh(jawGeo, this.muscleMat);
    jaw.position.set(0, 0.67, 0.075);
    this.groupTorso.add(jaw);

    // Nose bridge
    const noseGeo = new THREE.ConeGeometry(0.018, 0.055, 6);
    noseGeo.rotateX(-0.4);
    const nose = new THREE.Mesh(noseGeo, this.muscleMat);
    nose.position.set(0, 0.76, 0.145);
    this.groupTorso.add(nose);

    // Ears
    [-1, 1].forEach(s => {
      const earGeo = new THREE.TorusGeometry(0.024, 0.008, 8, 16, Math.PI * 1.3);
      earGeo.rotateY(s * (Math.PI / 2));
      const ear = new THREE.Mesh(earGeo, this.muscleMat);
      ear.position.set(s * 0.124, 0.75, 0.02);
      this.groupTorso.add(ear);
    });

    // 9. Cybernetic Pedestal Stand
    const basePedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.06, 36), new THREE.MeshStandardMaterial({
      color: 0x1a2332,
      metalness: 0.8,
      roughness: 0.3
    }));
    basePedestal.position.set(0, -0.52, 0);
    this.groupTorso.add(basePedestal);
  }

  /**
   * 2. Smart Cooling Vest Outer Shell with Front Chest OLED HUD Screen & 3M Retroreflective Stripes
   */
  buildVestShell() {
    this.shellMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9, // Modern High-Tech Cyan/Teal
      roughness: 0.55,
      metalness: 0.12,
      transparent: true,
      opacity: 0.22, // Translucent by default so internal electronics are completely visible!
      side: THREE.DoubleSide
    });

    // Ergonomic tailored vest shell (Height 0.84m with open chest & wide armholes)
    const shellGeo = new THREE.CylinderGeometry(0.315, 0.280, 0.84, 52, 1, true, 0.44, Math.PI * 2 - 0.88);
    this.vestShellMesh = new THREE.Mesh(shellGeo, this.shellMat);
    this.vestShellMesh.scale.set(1.26, 1.0, 0.94);
    this.vestShellMesh.position.set(0, 0.04, 0);
    this.vestShellMesh.userData = { key: 'shell', baseEmissive: 0x000000 };
    this.groupShell.add(this.vestShellMesh);
    this.pickableObjects.push(this.vestShellMesh);
    if (!this.keyMeshes['shell']) this.keyMeshes['shell'] = [];
    this.keyMeshes['shell'].push(this.vestShellMesh);

    // Front Chest Smart OLED HUD Display Module (Mounted on Upper Left Chest)
    const oledGroup = new THREE.Group();
    oledGroup.position.set(0.14, 0.28, 0.245);
    oledGroup.rotation.set(-0.06, -0.15, -0.02); // Tilted naturally towards viewer

    // 1. CNC Anodized Titanium Bezel
    const oledBezel = new THREE.Mesh(
      new THREE.BoxGeometry(0.105, 0.075, 0.016),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.25 })
    );
    oledGroup.add(oledBezel);

    // Bezel chamfer border
    const oledBorder = new THREE.Mesh(
      new THREE.BoxGeometry(0.108, 0.078, 0.006),
      new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x004455, roughness: 0.2 })
    );
    oledBorder.position.z = 0.005;
    oledGroup.add(oledBorder);

    // 2. Active OLED Display Screen Surface
    const screenGeo = new THREE.PlaneGeometry(0.096, 0.066);
    this.oledScreenMesh = new THREE.Mesh(screenGeo, this.oledMat);
    this.oledScreenMesh.position.z = 0.009;
    this.oledScreenMesh.userData = { key: 'oled', baseEmissive: 0x000000 };
    oledGroup.add(this.oledScreenMesh);
    this.pickableObjects.push(this.oledScreenMesh);
    if (!this.keyMeshes['oled']) this.keyMeshes['oled'] = [];
    this.keyMeshes['oled'].push(this.oledScreenMesh);

    this.groupShell.add(oledGroup);

    // 3M Scotchlite Retroreflective Safety Stripes (Chest & Lower Back)
    this.reflMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.25,
      metalness: 0.85
    });

    // Upper Chest 3M Reflective Stripe
    const reflBand1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.320, 0.305, 0.040, 52, 1, true, 0.46, Math.PI * 2 - 0.92),
      this.reflMat
    );
    reflBand1.scale.set(1.27, 1.0, 0.95);
    reflBand1.position.set(0, 0.18, 0);
    reflBand1.userData = { key: 'stripes', baseEmissive: 0x000000 };
    this.groupShell.add(reflBand1);
    this.reflStripes.push(reflBand1);
    this.pickableObjects.push(reflBand1);
    if (!this.keyMeshes['stripes']) this.keyMeshes['stripes'] = [];
    this.keyMeshes['stripes'].push(reflBand1);

    // Lower Waist 3M Reflective Stripe
    const reflBand2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.292, 0.282, 0.040, 52, 1, true, 0.46, Math.PI * 2 - 0.92),
      this.reflMat
    );
    reflBand2.scale.set(1.27, 1.0, 0.95);
    reflBand2.position.set(0, -0.25, 0);
    reflBand2.userData = { key: 'stripes', baseEmissive: 0x000000 };
    this.groupShell.add(reflBand2);
    this.reflStripes.push(reflBand2);
    this.pickableObjects.push(reflBand2);
    this.keyMeshes['stripes'].push(reflBand2);

    // Front Zipper Seam & Collar Trim
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.142, 0.012, 10, 32, Math.PI * 1.35), trimMat);
    collar.rotation.set(Math.PI / 2, 0, -Math.PI * 0.18);
    collar.position.set(0, 0.46, -0.01);
    collar.userData = { key: 'zipper', baseEmissive: 0x000000 };
    this.groupShell.add(collar);
    this.pickableObjects.push(collar);
    if (!this.keyMeshes['zipper']) this.keyMeshes['zipper'] = [];
    this.keyMeshes['zipper'].push(collar);

    const zipLeft = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.84, 0.014), trimMat);
    zipLeft.position.set(-0.105, 0.04, 0.26);
    zipLeft.rotation.y = 0.36;
    zipLeft.userData = { key: 'zipper', baseEmissive: 0x000000 };
    this.groupShell.add(zipLeft);
    this.pickableObjects.push(zipLeft);
    this.keyMeshes['zipper'].push(zipLeft);

    const zipRight = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.84, 0.014), trimMat);
    zipRight.position.set(0.105, 0.04, 0.26);
    zipRight.rotation.y = -0.36;
    zipRight.userData = { key: 'zipper', baseEmissive: 0x000000 };
    this.groupShell.add(zipRight);
    this.pickableObjects.push(zipRight);
    this.keyMeshes['zipper'].push(zipRight);

    // Shoulder strap pads
    [-1, 1].forEach(s => {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.012, 0.34), this.shellMat);
      strap.position.set(s * 0.20, 0.465, 0);
      this.groupShell.add(strap);
    });
  }

  /**
   * 3. Rear Waist High-Static-Pressure Fans (70mm ×2: Fan A & Fan B)
   */
  buildWaistFans() {
    this.waistFanPositions = [[-0.16, -0.12], [0.16, -0.12]];

    this.waistFanPositions.forEach((p, idx) => {
      const fanGroup = new THREE.Group();
      fanGroup.position.set(p[0], p[1], -0.215);
      this.groupInner.add(fanGroup);

      // Frame & Bellmouth Shroud
      this.registerMesh(new THREE.BoxGeometry(0.182, 0.182, 0.036), new THREE.MeshStandardMaterial({ color: 0x252b33, roughness: 0.4 }), [0, 0, 0], 'fan', fanGroup);
      this.registerMesh(new THREE.TorusGeometry(0.083, 0.012, 12, 32), new THREE.MeshStandardMaterial({ color: 0x3a434e, metalness: 0.4 }), [0, 0, -0.02], 'fan', fanGroup);

      // Screws & Hub
      [[-0.072, -0.072], [0.072, -0.072], [-0.072, 0.072], [0.072, 0.072]].forEach(c => {
        this.registerMesh(new THREE.CylinderGeometry(0.006, 0.006, 0.04, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9aa5b1, metalness: 0.8 }), [c[0], c[1], 0], 'fan', fanGroup);
      });
      this.registerMesh(new THREE.CylinderGeometry(0.029, 0.029, 0.016, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd8dee4, metalness: 0.7 }), [0, 0, -0.02], 'fan', fanGroup);

      // 9-Blade Rotor (Animated)
      const rotorGroup = new THREE.Group();
      fanGroup.add(rotorGroup);
      for (let j = 0; j < 9; j++) {
        const angle = (j / 9) * Math.PI * 2;
        const blade = this.registerMesh(
          new THREE.BoxGeometry(0.052, 0.026, 0.004),
          new THREE.MeshStandardMaterial({ color: 0x4fc3e0, roughness: 0.3 }),
          [Math.cos(angle) * 0.05, Math.sin(angle) * 0.05, -0.02],
          'fan',
          rotorGroup
        );
        blade.rotation.z = angle + 0.52;
        blade.rotation.y = 0.28;
      }
      this.fans.push(rotorGroup);

      // Exterior Finger-Guard Rings on Shell
      const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.009, 10, 32), new THREE.MeshStandardMaterial({ color: 0x1f262e }));
      r1.position.set(p[0], p[1], -0.262);
      this.groupShell.add(r1);
      const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.005, 8, 24), new THREE.MeshStandardMaterial({ color: 0x1f262e }));
      r2.position.copy(r1.position);
      this.groupShell.add(r2);
    });
  }

  /**
   * 4. Shoulder Hands-Free Turbofans (40mm ×2) angled ~35°-45° to Face/Neck
   */
  buildShoulderFans() {
    const createShoulderFan = (x, y, z, aimVec) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      this.groupInner.add(g);
      if (aimVec) g.lookAt(g.position.clone().add(aimVec));

      // Housing
      this.registerMesh(new THREE.BoxGeometry(0.102, 0.102, 0.032), new THREE.MeshStandardMaterial({ color: 0x252b33, roughness: 0.4 }), [0, 0, 0], 'sfan', g);
      this.registerMesh(new THREE.TorusGeometry(0.046, 0.006, 10, 24), new THREE.MeshStandardMaterial({ color: 0x3a434e }), [0, 0, -0.016], 'sfan', g);

      // 7-Blade Rotor
      const rotor = new THREE.Group();
      g.add(rotor);
      for (let j = 0; j < 7; j++) {
        const a = (j / 7) * Math.PI * 2;
        const b = this.registerMesh(
          new THREE.BoxGeometry(0.030, 0.015, 0.004),
          new THREE.MeshStandardMaterial({ color: 0x59c2de, roughness: 0.3 }),
          [Math.cos(a) * 0.027, Math.sin(a) * 0.027, -0.018],
          'sfan',
          rotor
        );
        b.rotation.z = a + 0.5;
        b.rotation.y = 0.25;
      }
      this.registerMesh(new THREE.CylinderGeometry(0.015, 0.015, 0.014, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd8dee4, metalness: 0.7 }), [0, 0, -0.018], 'sfan', g);

      this.shoulderFans.push(rotor);
    };

    createShoulderFan(-0.20, 0.538, -0.10, new THREE.Vector3(0.30, 0.62, 0.55));
    createShoulderFan(0.20, 0.538, -0.10, new THREE.Vector3(-0.30, 0.62, 0.55));
  }

  /**
   * 5. Center-Back Battery BTMS Pack with Aluminum Cooling Fins & 30mm Fan
   */
  buildBatteryAndBTMS() {
    // Battery Pack
    this.batMesh = this.registerMesh(
      new THREE.BoxGeometry(0.15, 0.20, 0.042),
      new THREE.MeshStandardMaterial({ color: 0x2848c4, roughness: 0.4 }),
      [0, 0.04, -0.225],
      'bat',
      this.groupInner
    );

    // Aluminum Heat Spreader & Fins
    this.registerMesh(
      new THREE.BoxGeometry(0.174, 0.224, 0.005),
      new THREE.MeshStandardMaterial({ color: 0xc4cdd5, metalness: 0.88, roughness: 0.25 }),
      [0, 0.04, -0.20],
      'shield',
      this.groupInner
    );
    for (let f = -3; f <= 3; f++) {
      this.registerMesh(
        new THREE.BoxGeometry(0.005, 0.19, 0.012),
        new THREE.MeshStandardMaterial({ color: 0xd0d7de, metalness: 0.9, roughness: 0.2 }),
        [f * 0.022, 0.04, -0.25],
        'shield',
        this.groupInner
      );
    }

    // Aerogel Thermal Insulation Pocket
    const pocket = new THREE.Mesh(
      new THREE.BoxGeometry(0.194, 0.272, 0.082),
      new THREE.MeshStandardMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.18 })
    );
    pocket.position.set(0, 0.04, -0.235);
    this.groupInner.add(pocket);

    // NTC 10K Sensor Probe
    this.registerMesh(new THREE.BoxGeometry(0.016, 0.016, 0.008), new THREE.MeshStandardMaterial({ color: 0xff6600 }), [-0.052, 0.105, -0.248], 'ntc', this.groupInner);

    // 30mm Dedicated Battery Cooling Fan
    const bfanGroup = new THREE.Group();
    bfanGroup.position.set(0, 0.04, -0.268);
    this.groupInner.add(bfanGroup);

    this.registerMesh(new THREE.BoxGeometry(0.092, 0.092, 0.032), new THREE.MeshStandardMaterial({ color: 0x252b33, roughness: 0.4 }), [0, 0, 0], 'bfan', bfanGroup);
    this.registerMesh(new THREE.TorusGeometry(0.041, 0.006, 10, 24), new THREE.MeshStandardMaterial({ color: 0x3a434e }), [0, 0, -0.016], 'bfan', bfanGroup);

    const bRotor = new THREE.Group();
    bfanGroup.add(bRotor);
    for (let j = 0; j < 7; j++) {
      const a = (j / 7) * Math.PI * 2;
      const b = this.registerMesh(
        new THREE.BoxGeometry(0.027, 0.014, 0.004),
        new THREE.MeshStandardMaterial({ color: 0xff9f1c, roughness: 0.3 }),
        [Math.cos(a) * 0.025, Math.sin(a) * 0.025, -0.018],
        'bfan',
        bRotor
      );
      b.rotation.z = a + 0.5;
      b.rotation.y = 0.25;
    }
    this.batteryFan = bRotor;

    // Exterior Grille on Shell
    const rg = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.006, 8, 24), new THREE.MeshStandardMaterial({ color: 0x20262d }));
    rg.position.set(0, 0.04, -0.29);
    this.groupShell.add(rg);
  }

  /**
   * 6. Air Ducts, ESP32, MOSFETs, Buck, and Biometric Sensors
   */
  buildAirDuctsAndElectronics() {
    // 3D Spacer Mesh Airflow Channels (6 vertical channels)
    const ductMat = new THREE.MeshStandardMaterial({ color: 0x4dd0e1, transparent: true, opacity: 0.42, emissive: 0x0a4a55 });
    [-0.22, -0.16, -0.10, 0.10, 0.16, 0.22].forEach(x => {
      this.registerMesh(new THREE.BoxGeometry(0.044, 0.47, 0.009), ductMat, [x, 0.225, -0.20], 'duct', this.groupInner);
    });

    // Spine Thermoelectric Cooler (TEC1-12706) Module on Upper Back Spine
    // 1. Ceramic Cold Plate (Alumina ceramic 40x40mm)
    this.registerMesh(
      new THREE.BoxGeometry(0.082, 0.082, 0.008),
      new THREE.MeshStandardMaterial({ color: 0x9d4edd, emissive: 0x240636, roughness: 0.3 }),
      [0, 0.22, -0.210],
      'tec',
      this.groupInner
    );
    // 2. Heatpipe block (Dual sintered copper heatpipes)
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.85, roughness: 0.25 });
    [-0.02, 0.02].forEach(px => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.10, 12), pipeMat);
      p.position.set(px, 0.22, -0.218);
      this.groupInner.add(p);
    });
    // 3. Extruded Aluminum Anodized Heatsink
    this.registerMesh(
      new THREE.BoxGeometry(0.095, 0.085, 0.022),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.3 }),
      [0, 0.22, -0.230],
      'tec',
      this.groupInner
    );

    // ESP32 DevKit V1
    this.registerMesh(new THREE.BoxGeometry(0.145, 0.072, 0.016), new THREE.MeshStandardMaterial({ color: 0x111822, roughness: 0.4 }), [0, -0.38, -0.215], 'esp', this.groupInner);
    this.registerMesh(new THREE.BoxGeometry(0.052, 0.040, 0.006), new THREE.MeshStandardMaterial({ color: 0xd0d7de, metalness: 0.85, roughness: 0.2 }), [0.032, -0.38, -0.225], 'esp', this.groupInner);
    this.espLed = this.registerMesh(new THREE.SphereGeometry(0.0075, 12, 12), new THREE.MeshBasicMaterial({ color: 0x00ff80 }), [-0.052, -0.38, -0.226], 'esp', this.groupInner);

    // Dual MOSFET Driver Modules
    this.registerMesh(new THREE.BoxGeometry(0.092, 0.060, 0.014), new THREE.MeshStandardMaterial({ color: 0x8a2222 }), [0.17, -0.38, -0.215], 'mos', this.groupInner);
    this.registerMesh(new THREE.BoxGeometry(0.092, 0.052, 0.014), new THREE.MeshStandardMaterial({ color: 0x8a2222 }), [-0.17, -0.30, -0.215], 'mos', this.groupInner);

    // Buck Converter 7.4V -> 5V 3A with copper inductor
    this.registerMesh(new THREE.BoxGeometry(0.094, 0.052, 0.020), new THREE.MeshStandardMaterial({ color: 0x236b36 }), [0, 0.28, -0.215], 'buck', this.groupInner);
    this.registerMesh(new THREE.CylinderGeometry(0.016, 0.016, 0.014, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.7 }), [-0.02, 0.28, -0.226], 'buck', this.groupInner);

    // BMS 2S & Fuse
    this.registerMesh(new THREE.BoxGeometry(0.102, 0.042, 0.013), new THREE.MeshStandardMaterial({ color: 0x1b7a58 }), [0, -0.17, -0.215], 'bms', this.groupInner);
    this.registerMesh(new THREE.BoxGeometry(0.032, 0.018, 0.018), new THREE.MeshStandardMaterial({ color: 0xe9a100 }), [0.042, -0.24, -0.22], 'fuse', this.groupInner);

    // SHT31 Ambient Sensor (Exterior chest pocket)
    this.registerMesh(new THREE.BoxGeometry(0.038, 0.038, 0.016), new THREE.MeshStandardMaterial({ color: 0xf1f3f5 }), [-0.26, 0.42, -0.22], 'sht', this.groupShell);

    // DS18B20 Skin Sensor, MPU6050, Haptic Vibration Motor, Front Mode Button
    this.registerMesh(new THREE.BoxGeometry(0.042, 0.032, 0.009), new THREE.MeshStandardMaterial({ color: 0x1e5aa8 }), [-0.17, -0.38, -0.215], 'mpu', this.groupInner);
    this.registerMesh(new THREE.CylinderGeometry(0.013, 0.013, 0.032, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd0d7de, metalness: 0.85 }), [0.12, 0.18, 0.205], 'ds', this.groupTorso);
    this.vibMotor = this.registerMesh(new THREE.CylinderGeometry(0.019, 0.019, 0.032, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x888e96, metalness: 0.5 }), [-0.20, 0.40, 0.215], 'vib', this.groupTorso);
    this.registerMesh(new THREE.CylinderGeometry(0.022, 0.022, 0.014, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe5383b, emissive: 0x551111 }), [0.15, 0.10, 0.245], 'btn', this.groupTorso);
  }

  /**
   * 7. 3D Wiring Harness with Animated Current Pulses
   */
  buildWiringHarness() {
    const sph = new THREE.SphereGeometry(0.009, 8, 6);

    const createWire = (col, pts, currentFunc) => {
      const curve = new THREE.CatmullRomCurve3(
        pts.map(p => new THREE.Vector3(p[0], p[1], p[2] === undefined ? -0.238 : p[2])),
        false,
        'centripetal'
      );
      const wireMat = new THREE.MeshBasicMaterial({ color: col });
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 42, 0.0046, 6), wireMat);
      this.groupWiring.add(tube);

      const pulseMatColor = new THREE.Color(col).lerp(new THREE.Color(0xffffff), 0.65);
      const pulses = [];
      for (let i = 0; i < 5; i++) {
        const pulse = new THREE.Mesh(sph, new THREE.MeshBasicMaterial({ color: pulseMatColor }));
        this.groupWiring.add(pulse);
        pulses.push(pulse);
      }
      this.wires.push({ curve, wireMat, col, pulses, currentFunc, progress: Math.random() });
    };

    const ib = () => this.state.currentAmps / 2.5;
    const dA = () => this.state.fanPWM / 100;
    const dB = () => this.state.fanPWM / 100;
    const dN = () => this.state.shoulderFanActive ? (this.state.shoulderFanPWM / 100) : 0;
    const dT = () => this.state.batteryCoolingActive ? 0.6 : 0;

    createWire(0xe5383b, [[0.05, -0.17], [0.05, 0.04], [0.04, 0.28]], ib);
    createWire(0x888888, [[-0.075, 0.28], [-0.075, 0.04], [-0.075, -0.17], [-0.075, -0.38]], ib);
    createWire(0xff9f1c, [[-0.03, 0.28], [-0.03, -0.38]], () => 0.3);
    createWire(0xff9f1c, [[0.03, 0.28], [0.10, 0], [0.17, -0.35]], () => (dA() + dB()) / 2);
    createWire(0x3a86ff, [[0.17, -0.35], [0.16, -0.28], [0.16, -0.20]], dB);
    createWire(0x3a86ff, [[0.17, -0.35], [0, -0.30], [-0.16, -0.28], [-0.16, -0.20]], dA);
    createWire(0xb44cff, [[0.05, -0.38], [0.12, -0.38]], () => dB() > 0 ? 0.7 : 0);
    createWire(0xff9f1c, [[-0.03, -0.34], [-0.10, -0.30], [-0.15, -0.278]], () => (dN() + dT()) / 2);
    createWire(0x00b4d8, [[-0.17, -0.275], [-0.22, 0, -0.20], [-0.24, 0.30, -0.19], [-0.20, 0.53, -0.12]], dN);
    createWire(0x00b4d8, [[-0.17, -0.275], [0, -0.28], [0.22, 0, -0.20], [0.24, 0.30, -0.19], [0.20, 0.53, -0.12]], dN);
    createWire(0x00b4d8, [[-0.14, -0.275], [-0.10, -0.10], [-0.06, -0.02, -0.27], [0, 0.04, -0.27]], dT);
    createWire(0xb44cff, [[-0.05, -0.36], [-0.12, -0.31]], () => (dN() > 0 || dT() > 0) ? 0.7 : 0);
    createWire(0x80ed99, [[-0.05, 0.10, -0.25], [-0.10, 0, -0.25], [-0.10, -0.20], [-0.03, -0.34]], () => 0.3);
    createWire(0x2ec4b6, [[-0.05, -0.40], [-0.15, -0.40]], () => 0.5);
    createWire(0x2ec4b6, [[-0.08, -0.36], [-0.20, -0.10], [-0.26, 0.40], [-0.26, 0.42, -0.22]], () => 0.5);
    createWire(0xffd60a, [[0.02, -0.35], [0.25, -0.25], [0.372, -0.10, 0], [0.30, 0.12, 0.20], [0.12, 0.18, 0.20]], () => 0.4);
    createWire(0xffffff, [[0.03, -0.35], [0.27, -0.28], [0.372, -0.05, 0], [0.20, 0.08, 0.22], [0.15, 0.10, 0.235]], () => 0.15);
    createWire(0xff7ab8, [[-0.03, -0.35], [-0.25, -0.25], [-0.372, 0.10, 0], [-0.30, 0.35, 0.15], [-0.20, 0.40, 0.20]], () => this.state.alertActive ? 1 : 0);
  }

  /**
   * 8. 3-Zone Airflow Particle Systems
   */
  build3ZoneAirflowParticles() {
    // Zone 1: Rear waist intake -> back ducts
    const N1 = 165;
    const pa1 = new Float32Array(N1 * 3);
    for (let i = 0; i < N1; i++) {
      this.airData1.push({
        f: i % 2,
        p: Math.random(),
        o: (i % 3) - 1,
        d: i % 6 === 0,
        j: [Math.random() - 0.5, Math.random() - 0.5]
      });
    }
    this.airGeom1 = new THREE.BufferGeometry();
    this.airGeom1.setAttribute('position', new THREE.BufferAttribute(pa1, 3));
    this.airMat1 = new THREE.PointsMaterial({ size: 0.021, color: 0x66ccff, transparent: true, opacity: 0.88 });
    this.airParticles1 = new THREE.Points(this.airGeom1, this.airMat1);
    this.airParticles1.frustumCulled = false;
    this.groupInner.add(this.airParticles1);

    // Zone 2 (Shoulder Face/Neck) & Zone 3 (Battery Lateral Exhaust)
    const pa2 = new Float32Array(96 * 3);
    [-1, 1].forEach(s => {
      const d = new THREE.Vector3(-s * 0.30, 0.62, 0.55).normalize();
      for (let i = 0; i < 26; i++) {
        this.airData2.push({
          o: new THREE.Vector3(s * 0.20, 0.538, -0.10).addScaledVector(d, -0.10),
          d: d,
          len: 0.72,
          k: 'N',
          p: Math.random(),
          j: [Math.random() - 0.5, Math.random() - 0.5]
        });
      }
    });
    for (let i = 0; i < 44; i++) {
      this.airData2.push({
        k: 'T',
        s: i % 2 ? 1 : -1,
        p: Math.random(),
        j: [Math.random() - 0.5, Math.random() - 0.5]
      });
    }
    this.airGeom2 = new THREE.BufferGeometry();
    this.airGeom2.setAttribute('position', new THREE.BufferAttribute(pa2, 3));
    this.airMat2 = new THREE.PointsMaterial({ size: 0.019, color: 0x9be7ff, transparent: true, opacity: 0.88 });
    this.airParticles2 = new THREE.Points(this.airGeom2, this.airMat2);
    this.airParticles2.frustumCulled = false;
    this.groupInner.add(this.airParticles2);
  }

  /**
   * Raycasting Click-to-Inspect with Smart Occlusion Handling
   */
  setupRaycasting() {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    let downPos = { x: 0, y: 0 };

    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      downPos = { x: e.clientX, y: e.clientY };
    });

    this.renderer.domElement.addEventListener('pointerup', (e) => {
      // Ignore if user was dragging to orbit camera (> 6px movement)
      const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      if (dist > 6) return;

      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.pickableObjects, false);

      // Smart hit selection: Always prioritize internal electronic components over outer shell/stripes
      let hit = null;
      if (intersects.length > 0) {
        const innerHit = intersects.find(x => x.object.userData.key && x.object.userData.key !== 'shell' && x.object.userData.key !== 'stripes');
        hit = innerHit || intersects[0];
      }

      if (hit && hit.object && hit.object.userData && hit.object.userData.key) {
        this.highlightComponent(hit.object.userData.key);
      } else {
        this.highlightComponent(null);
      }
    });

    // Pointer cursor hover feedback
    this.renderer.domElement.addEventListener('pointermove', (e) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.pickableObjects, false);
      this.renderer.domElement.style.cursor = (intersects.length > 0) ? 'pointer' : 'default';
    });
  }

  highlightComponent(key) {
    this.selectedKey = key;
    Object.keys(this.keyMeshes).forEach(k => {
      this.keyMeshes[k].forEach(mesh => {
        if (!mesh.material || !mesh.material.emissive) return;
        if (k === key) {
          mesh.material.emissive.setHex(0x00f0ff);
          mesh.material.emissiveIntensity = 0.85;
        } else {
          mesh.material.emissive.setHex(mesh.userData.baseEmissive || 0x000000);
          mesh.material.emissiveIntensity = 0.2;
        }
      });
    });

    if (key && key !== 'shell' && key !== 'mannequin') {
      this.focusCameraOnKey(key);
    }

    // Notify external app / info box
    if (window.smartVestApp && window.smartVestApp.onComponentSelected) {
      window.smartVestApp.onComponentSelected(key);
    }
  }

  focusCameraOnKey(key) {
    if (!key || !this.keyMeshes[key] || this.keyMeshes[key].length === 0) return;
    const mesh = this.keyMeshes[key][0];
    const worldPos = new THREE.Vector3();
    mesh.getWorldPosition(worldPos);

    this.targetControlsLook = worldPos.clone();
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
    this.targetCameraPos = worldPos.clone().add(offset.multiplyScalar(1.5));
    this.isCameraTweening = true;
  }

  /**
   * Shell Display Mode Controls: 0 = Solid (95%), 1 = Translucent (22%), 2 = Hidden (0%)
   */
  setShellMode(mode) {
    this.shellMode = mode;
    if (mode === 2) {
      this.groupShell.visible = false;
    } else {
      this.groupShell.visible = true;
      if (mode === 0) {
        this.shellMat.opacity = 0.95;
      } else {
        this.shellMat.opacity = 0.22;
      }
    }
    console.log(`[3D Scene] Shell mode set to: ${mode}`);
  }

  cycleShellMode() {
    const next = (this.shellMode + 1) % 3;
    this.setShellMode(next);
    return next;
  }

  /**
   * Dynamic Chest Smart OLED Display HUD Render Function
   */
  renderOledDisplay(time) {
    if (!this.oledCtx) return;
    const ctx = this.oledCtx;
    const w = this.oledCanvas.width;
    const h = this.oledCanvas.height;

    // Dark cybernetic OLED background
    ctx.fillStyle = '#050a14';
    ctx.fillRect(0, 0, w, h);

    // Subtle blue HUD border
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, w - 12, h - 12);

    // Grid scanlines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let y = 14; y < h - 14; y += 12) {
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(w - 10, y);
      ctx.stroke();
    }

    // Top Status Header
    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('❄️ SMART VEST HUD', 24, 40);

    // Battery Indicator
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`🔋 ${(this.state.batterySOC * 100).toFixed(0)}%`, w - 130, 40);

    // Main Live Temperature Display (Center)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 74px sans-serif';
    const tempText = `${this.state.skinTemp.toFixed(1)}°C`;
    ctx.fillText(tempText, 24, 130);

    // Subtitle label
    ctx.fillStyle = '#8b9bb4';
    ctx.font = '18px sans-serif';
    ctx.fillText('SKIN SURFACE TEMP', 24, 160);

    // Live Heart Rate & ECG Line
    ctx.fillStyle = '#ff3366';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(`♥ ${this.state.heartRate || 95} BPM`, 24, 215);

    // Animated scrolling ECG pulse line
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const ecgY = 250;
    const ecgSpeed = time * 120;
    for (let x = 24; x < w - 24; x += 4) {
      const phase = (x + ecgSpeed) % 220;
      let dy = 0;
      if (phase > 80 && phase < 95) dy = -18;
      else if (phase >= 95 && phase < 110) dy = 32;
      else if (phase >= 110 && phase < 125) dy = -12;
      if (x === 24) ctx.moveTo(x, ecgY + dy);
      else ctx.lineTo(x, ecgY + dy);
    }
    ctx.stroke();

    // Bottom Bar: Fan Speed & Operating Mode
    ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.fillRect(20, 280, w - 40, 60);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.strokeRect(20, 280, w - 40, 60);

    // Spinning Fan Text
    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 22px monospace';
    const fanIcon = ['◐', '◓', '◑', '◒'][Math.floor(time * 8) % 4];
    ctx.fillText(`${fanIcon} FAN: ${this.state.fanRPM} RPM`, 36, 318);

    // Mode Pill
    ctx.fillStyle = '#ffb703';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`[ AUTO AI ]`, w - 170, 318);

    this.oledTexture.needsUpdate = true;
  }

  /**
   * View Modes: NORMAL, XRAY, EXPLODED, AIRFLOW, THERMAL, NIGHT
   */
  setViewMode(mode) {
    this.currentViewMode = mode;
    console.log(`[3D Scene] Setting view mode to: ${mode}`);

    switch (mode) {
      case 'NORMAL':
        this.targetExploded = 0;
        this.shellMode = 1; // Default Translucent (22%) so equipment is visible!
        this.shellMat.opacity = 0.22;
        this.shellMat.wireframe = false;
        this.groupShell.visible = true;
        this.groupTorso.visible = true;
        this.groupInner.visible = true;
        this.groupWiring.visible = true;
        this.nightMode = false;
        this.heatmapMode = false;
        this.restoreLighting();
        break;

      case 'XRAY':
        this.targetExploded = 0;
        this.shellMode = 1; // Translucent
        this.shellMat.opacity = 0.16;
        this.shellMat.wireframe = false;
        this.groupShell.visible = true;
        this.groupTorso.visible = true;
        this.groupInner.visible = true;
        this.groupWiring.visible = true;
        this.nightMode = false;
        this.heatmapMode = false;
        this.restoreLighting();
        break;

      case 'EXPLODED':
        this.targetExploded = 1.0;
        this.shellMode = 1; // Translucent in exploded view so it never blocks equipment!
        this.shellMat.opacity = 0.20;
        this.groupShell.visible = true;
        this.groupTorso.visible = true;
        this.groupInner.visible = true;
        this.groupWiring.visible = true;
        this.nightMode = false;
        this.heatmapMode = false;
        this.restoreLighting();
        break;

      case 'AIRFLOW':
        this.targetExploded = 0;
        this.shellMode = 1;
        this.shellMat.opacity = 0.12;
        this.groupShell.visible = true;
        this.groupInner.visible = true;
        this.groupWiring.visible = false;
        this.nightMode = false;
        this.heatmapMode = false;
        this.restoreLighting();
        break;

      case 'THERMAL':
        this.targetExploded = 0;
        this.shellMode = 1;
        this.shellMat.opacity = 0.15;
        this.heatmapMode = true;
        this.nightMode = false;
        this.restoreLighting();
        break;

      case 'NIGHT':
        this.nightMode = true;
        this.targetExploded = 0;
        this.shellMode = 0;
        this.shellMat.opacity = 0.95;
        this.applyNightLighting();
        break;
    }
  }

  restoreLighting() {
    this.scene.background.setHex(0x0a1017);
    this.hemiLight.intensity = 0.95;
    this.dirLight1.intensity = 0.85;
    this.dirLight2.intensity = 0.75;
    this.reflMat.emissive.setHex(0x000000);
    this.reflMat.emissiveIntensity = 0;
  }

  applyNightLighting() {
    this.scene.background.setHex(0x03060a);
    this.hemiLight.intensity = 0.3;
    this.dirLight1.intensity = 0.2;
    this.dirLight2.intensity = 0.15;
    this.reflMat.emissive.setHex(0xccff00);
    this.reflMat.emissiveIntensity = 0.95;
  }

  resetCamera(viewPreset = 'rear') {
    if (viewPreset === 'front') {
      this.camera.position.set(0, 0.45, 2.55);
    } else if (viewPreset === 'shoulder') {
      this.camera.position.set(-1.4, 1.2, -1.8);
    } else {
      // Rear standard view
      this.camera.position.set(0, 0.45, -2.55);
    }
    this.controls.target.set(0, 0.06, 0);
    this.controls.update();
  }

  /**
   * Update Simulation States from External Controller
   */
  updateSimulationState(newState) {
    Object.assign(this.state, newState);

    // Battery Pack Overheat Warning Glow
    if (this.batMesh && this.selectedKey !== 'bat') {
      if (this.state.batteryTemp >= 50.0) {
        this.batMesh.material.emissive.setHex(0xff3300);
        this.batMesh.material.emissiveIntensity = 0.7;
      } else if (this.state.batteryTemp >= 40.0) {
        this.batMesh.material.emissive.setHex(0xff8800);
        this.batMesh.material.emissiveIntensity = 0.4;
      } else if (this.state.batteryCoolingActive) {
        this.batMesh.material.emissive.setHex(0x00f0ff);
        this.batMesh.material.emissiveIntensity = 0.3;
      } else {
        this.batMesh.material.emissive.setHex(0x000000);
        this.batMesh.material.emissiveIntensity = 0;
      }
    }

    // Thermal Heatmap coloring on mannequin
    if (this.heatmapMode && this.mannequinMesh) {
      const normSkin = Math.min(Math.max((this.state.skinTemp - 30) / 7.5, 0), 1);
      this.torsoMat.color.setHSL(0.55 - normSkin * 0.55, 0.85, 0.45);
    } else if (this.mannequinMesh) {
      this.torsoMat.color.setHex(0xcbb19b);
    }
  }

  /**
   * Main Animation Loop
   */
  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // 1. Smooth Lerp for Exploded View
    // Inner equipment stays anchored; torso and shell explode forward so rear components are 100% unobstructed!
    if (Math.abs(this.explodedProgress - this.targetExploded) > 0.001) {
      this.explodedProgress += (this.targetExploded - this.explodedProgress) * 0.08;
      this.groupTorso.position.z = this.explodedProgress * 0.35;
      this.groupInner.position.z = 0;
      this.groupWiring.position.z = -this.explodedProgress * 0.12;
      this.groupShell.position.z = this.explodedProgress * 0.65;
    }

    // Camera Focus Smooth Lerp
    if (this.isCameraTweening) {
      this.controls.target.lerp(this.targetControlsLook, 0.08);
      this.camera.position.lerp(this.targetCameraPos, 0.08);
      if (this.camera.position.distanceTo(this.targetCameraPos) < 0.015) {
        this.isCameraTweening = false;
      }
    }

    // Live Smart OLED Screen HUD Render
    this.renderOledDisplay(time);

    // 2. Spin Fans
    const isPowered = this.state.systemPower;
    if (isPowered) {
      // Waist Fans (×2) - Lower cooling blowers
      if (this.state.waistFanActive !== false && this.state.fanRPM > 0) {
        const radPerSecWaist = (this.state.fanRPM / 60) * Math.PI * 2 * 0.04;
        this.fans.forEach((f, idx) => {
          if (!(idx === 0 && this.state.stallFanA)) {
            f.rotation.z -= radPerSecWaist * delta;
          }
        });
      }

      // Shoulder Fans (×2)
      if (this.state.shoulderFanActive) {
        const radPerSecShoulder = (this.state.shoulderFanRPM / 60) * Math.PI * 2 * 0.04;
        this.shoulderFans.forEach(f => {
          f.rotation.z -= radPerSecShoulder * delta;
        });
      }

      // Battery Cooling Fan (×1)
      if (this.state.batteryCoolingActive && this.batteryFan) {
        const radPerSecBattery = ((this.state.batteryTemp > 40 ? 4500 : 2500) / 60) * Math.PI * 2 * 0.04;
        this.batteryFan.rotation.z -= radPerSecBattery * delta;
      }
    }

    // 3. Animate Electrical Pulses through Wires
    this.wires.forEach(w => {
      const currentVal = isPowered ? w.currentFunc() : 0;
      w.progress = (w.progress + delta * (0.1 + currentVal * 0.8)) % 1.0;
      w.pulses.forEach((pulse, i) => {
        pulse.visible = isPowered && currentVal > 0.03;
        if (pulse.visible) {
          const u = (w.progress + i / 5) % 1.0;
          pulse.position.copy(w.curve.getPoint(u));
        }
      });
    });

    // 4. Animate 3-Zone Airflow Particles
    if (this.airParticles1 && this.airParticles1.visible && isPowered && this.state.fanPWM > 5) {
      const pos1 = this.airGeom1.attributes.position.array;
      const speed1 = 0.3 + 1.4 * (this.state.fanPWM / 100);

      this.airData1.forEach((q, i) => {
        q.p = (q.p + delta * speed1 * 0.5) % 1.0;
        const f = this.waistFanPositions[q.f];
        const s = f[0] < 0 ? -1 : 1;
        let x, y, z;

        if (q.p < 0.4) {
          const u = q.p / 0.4;
          x = f[0] + q.j[0] * 0.1;
          y = f[1] + q.j[1] * 0.1;
          z = -0.75 + (-0.27 - (-0.75)) * u;
        } else {
          const u = (q.p - 0.4) / 0.6;
          const e = u > 0.8 ? (u - 0.8) * 5 : 0;
          x = q.o ? f[0] + q.o * 0.06 + (q.d ? 0 : e * s * 0.12) : f[0] * (1 - e * 0.8);
          y = q.d ? (f[1] - 0.1) + (-0.5 - (f[1] - 0.1)) * u : (f[1] + 0.1) + (0.5 - (f[1] + 0.1)) * u;
          z = -0.20;
        }
        pos1[i * 3] = x;
        pos1[i * 3 + 1] = y;
        pos1[i * 3 + 2] = z;
      });
      this.airGeom1.attributes.position.needsUpdate = true;
    }

    if (this.airParticles2 && this.airParticles2.visible && isPowered) {
      const pos2 = this.airGeom2.attributes.position.array;
      const dN = this.state.shoulderFanActive ? (this.state.shoulderFanPWM / 100) : 0;
      const dT = this.state.batteryCoolingActive ? 0.6 : 0;

      this.airData2.forEach((q, i) => {
        const dd = q.k === 'N' ? dN : dT;
        let x = 99, y = 99, z = 99;

        if (dd >= 0.03) {
          q.p = (q.p + delta * (0.3 + 1.2 * dd) * 0.5) % 1.0;
          if (q.k === 'N') {
            const w = 0.01 + 0.1 * q.p;
            x = q.o.x + q.d.x * q.len * q.p + q.j[0] * w;
            y = q.o.y + q.d.y * q.len * q.p + q.j[1] * w;
            z = q.o.z + q.d.z * q.len * q.p;
          } else if (q.p < 0.45) {
            x = q.j[0] * 0.07;
            y = 0.04 + q.j[1] * 0.07;
            z = -0.70 + (-0.25 - (-0.70)) * (q.p / 0.45);
          } else {
            const u = (q.p - 0.45) / 0.55;
            x = q.s * u * 0.32 + q.j[0] * 0.01;
            y = 0.04 + q.j[1] * 0.10;
            z = -0.25;
          }
        }
        pos2[i * 3] = x;
        pos2[i * 3 + 1] = y;
        pos2[i * 3 + 2] = z;
      });
      this.airGeom2.attributes.position.needsUpdate = true;
    }

    // 5. ESP32 Status LED Blinking & Haptic Motor Vibration
    if (this.espLed) {
      if (!isPowered) {
        this.espLed.material.color.setHex(0x222222);
      } else if (this.state.alertActive) {
        this.espLed.material.color.setHex(Math.sin(time * 12) > 0 ? 0xff3b30 : 0x440000);
      } else {
        this.espLed.material.color.setHex(0x00ff80);
      }
    }

    if (this.vibMotor) {
      this.vibMotor.position.x = -0.20 + (this.state.alertActive ? Math.sin(time * 25) * 0.005 : 0);
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}

window.VestDigitalTwinScene = VestDigitalTwinScene;
