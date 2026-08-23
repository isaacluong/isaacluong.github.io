
const wallBoxes = [];
const sphereColliders = [];

// crosshair canvas fix
const crosshairCanvas = document.createElement("canvas");
crosshairCanvas.id = "crosshair";
crosshairCanvas.style.position = "fixed";
crosshairCanvas.style.top = "0";
crosshairCanvas.style.left = "0";
crosshairCanvas.style.width = "100%";
crosshairCanvas.style.height = "100%";
crosshairCanvas.style.pointerEvents = "none";
crosshairCanvas.style.zIndex = "999";
document.body.appendChild(crosshairCanvas);
//end of fix


const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

const viewModel = new THREE.Group();



camera.add(viewModel);


const raycaster = new THREE.Raycaster();
const shootDirection = new THREE.Vector3();
let muzzleFlashUntil = 0;
let isAiming = false;
let selectedWeapon = "gun";
let meleeCooldown = 0;
let reloadCooldown = 0;
let meleeSwingTime = 0;
let pistolModel;
let meleeHandModel;
let knifeModel;
const toastProjectiles = [];
const meatDrops = [];
const pistolDrops = [];
const inventory = {
    pistolShots: 0,
    pistolDamage: 100,
    gunAmmo: 12,
    gunMaxAmmo: 12,
    toasterAmmo: 8,
    toasterMaxAmmo: 8
};

const knifeViewModel = new THREE.Group();
const knifeBlade = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.62, 0.16),
    new THREE.MeshLambertMaterial({ color: 0xd9e4e8, metalness: 0.9, roughness: 0.18 })
);
const knifeHandle = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.42, 0.2),
    new THREE.MeshLambertMaterial({ color: 0x252a30, roughness: 0.65 })
);
knifeBlade.position.set(0.35, -0.1, -0.78);
knifeBlade.rotation.z = -0.25;
knifeHandle.position.set(0.28, -0.58, -0.75);
knifeHandle.rotation.z = -0.25;
knifeViewModel.add(knifeBlade, knifeHandle);
knifeViewModel.visible = false;
viewModel.add(knifeViewModel);

const inventoryDisplay = document.createElement("div");
inventoryDisplay.id = "inventory-display";
inventoryDisplay.innerHTML = "<strong>INVENTORY</strong><br>1 GUN<br>2 TOASTER<br>3 PISTOL: 0";
document.body.appendChild(inventoryDisplay);

function updateInventoryDisplay() {
    const pistolCount = inventory.pistolShots > 0 ? 1 : 0;
    inventoryDisplay.innerHTML = `<strong>INVENTORY</strong><br>1 GUN${selectedWeapon === "gun" ? "  &lt;" : ""}<br>2 TOASTER${selectedWeapon === "toaster" ? "  &lt;" : ""}<br>3 PISTOL: ${pistolCount}${selectedWeapon === "pistol" ? "  &lt;" : ""}<br>4 KNIFE${selectedWeapon === "knife" ? "  &lt;" : ""}`;
}

function updateAmmoDisplay() {
    const ammo = selectedWeapon === "toaster"
        ? `${inventory.toasterAmmo}/${inventory.toasterMaxAmmo}`
        : selectedWeapon === "gun"
            ? `${inventory.gunAmmo}/${inventory.gunMaxAmmo}`
            : selectedWeapon === "knife"
                ? "melee"
                : "1 shot";
    ammoDisplay.textContent = `AMMO ${ammo}`;
}

function reloadWeapon() {
    if (reloadCooldown > 0 || selectedWeapon === "pistol") {
        return;
    }

    reloadCooldown = 1;
    ammoDisplay.textContent = "RELOADING...";

    if (selectedWeapon === "gun") {
        inventory.gunAmmo = inventory.gunMaxAmmo;
    } else if (selectedWeapon === "toaster") {
        inventory.toasterAmmo = inventory.toasterMaxAmmo;
    }
}

function meleeAttack() {
    if (meleeCooldown > 0) {
        return;
    }

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    let closestEnemy = null;
    let closestDistance = 2.2;

    for (const enemy of enemies) {
        if (!enemy.alive) {
            continue;
        }

        const offset = enemy.mesh.position.clone().sub(camera.position);
        const distance = offset.length();
        const facing = offset.normalize().dot(direction);

        if (distance < closestDistance && facing > 0.45) {
            closestEnemy = enemy;
            closestDistance = distance;
        }
    }

    if (closestEnemy) {
        damageEnemy(closestEnemy, selectedWeapon === "knife" ? 60 : 35);
    }

    meleeCooldown = 0.45;
    meleeSwingTime = 0.22;
    muzzleFlashUntil = performance.now() + 100;

    if (meleeHandModel) {
        meleeHandModel.visible = true;
    }
}

function updateMeleeAnimation(delta) {
    if (!meleeHandModel) {
        return;
    }

    meleeSwingTime = Math.max(0, meleeSwingTime - delta);
    meleeHandModel.visible = meleeSwingTime > 0;

    if (meleeSwingTime > 0) {
        const progress = 1 - meleeSwingTime / 0.22;
        const swing = Math.sin(progress * Math.PI);
        meleeHandModel.rotation.x = -0.35 - swing * 1.5;
        meleeHandModel.rotation.y = -0.15 + swing * 0.35;
        meleeHandModel.rotation.z = swing * 0.7;
        meleeHandModel.position.z = -0.75 - swing * 0.3;
    } else {
        meleeHandModel.rotation.set(0, 0, 0);
        meleeHandModel.position.z = -0.75;
    }
}

function createPistolDrop(position) {
    const pistol = new THREE.Group();
    const grip = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.42, 0.18),
        new THREE.MeshLambertMaterial({ color: 0x20252b })
    );
    const barrel = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.14, 0.16),
        new THREE.MeshLambertMaterial({ color: 0x69747b, metalness: 0.7, roughness: 0.3 })
    );
    grip.position.y = 0.16;
    barrel.position.set(0.22, 0.38, 0);
    pistol.add(grip, barrel);
    pistol.position.copy(position);
    pistol.position.y = 0.2;
    pistol.userData.life = 60;
    pistol.rotation.y = Math.PI / 4;
    scene.add(pistol);
    pistolDrops.push(pistol);
}

function createMeatDrop(position) {
    const meat = new THREE.Group();
    const steak = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.3, 0.7),
        new THREE.MeshLambertMaterial({ color: 0x9e2f2f })
    );
    const fat = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.1, 0.24),
        new THREE.MeshLambertMaterial({ color: 0xf0d39b })
    );
    steak.position.y = 0.25;
    fat.position.set(0.12, 0.42, 0.08);
    meat.add(steak, fat);
    meat.position.copy(position);
    meat.position.y = 0.15;
    meat.userData.life = 45;
    meat.userData.startY = meat.position.y;
    scene.add(meat);
    meatDrops.push(meat);
}

const toasterModel = new THREE.Group();
const toasterLoader = new THREE.GLTFLoader();
toasterLoader.load("assets/models/toaster.glb", (gltf) => {
    const model = gltf.scene;
    model.scale.set(0.32, 0.32, 0.32);
    model.position.set(0.3, -0.42, -0.7);
    model.traverse((object) => {
        if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
        }
    });
    toasterModel.add(model);
}, undefined, (error) => console.error("Toaster GLB failed to load:", error));
toasterModel.visible = false;
viewModel.add(toasterModel);

function selectWeapon(weapon) {
    if (weapon === "pistol" && inventory.pistolShots < 1) {
        return;
    }

    selectedWeapon = weapon;
    toasterModel.visible = weapon === "toaster";
    weaponDisplay.textContent = weapon === "toaster" ? "2  TOASTER" : weapon === "pistol" ? "3  PISTOL" : "1  GUN";
    updateInventoryDisplay();
    if (typeof gunModel !== "undefined" && gunModel) {
        gunModel.visible = weapon === "gun";
    }
    if (pistolModel) {
        pistolModel.visible = weapon === "pistol";
    }
    if (meleeHandModel) {
        meleeHandModel.visible = false;
    }

    for (const enemy of enemies) {
        if (enemy.alive) {
            setEnemyBaguetteMode(enemy, weapon === "toaster");
        }
    }
}

function updateAiming(delta) {
    const aimAmount = isAiming ? 1 : 0;
    const smoothing = 1 - Math.exp(-12 * delta);

    viewModel.position.lerp(
        new THREE.Vector3(-0.12 * aimAmount, 0.08 * aimAmount, 0),
        smoothing
    );

    camera.fov = THREE.MathUtils.lerp(
        camera.fov,
        isAiming ? 55 : 75,
        smoothing
    );
    camera.updateProjectionMatrix();
}

function shoot() {

    if (selectedWeapon === "toaster") {
        if (inventory.toasterAmmo <= 0) {
            return;
        }
        inventory.toasterAmmo -= 1;
        updateAmmoDisplay();
        shootToast();
        return;
    }

    if (selectedWeapon === "gun") {
        if (inventory.gunAmmo <= 0) {
            return;
        }
        inventory.gunAmmo -= 1;
        updateAmmoDisplay();
    }

    if (selectedWeapon === "pistol") {
        if (inventory.pistolShots < 1) {
            inventory.pistolShots = 1;
        }
    }

    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    const hits = raycaster.intersectObjects(scene.children, true);
    const hit = hits.find((intersection) => {
        return !viewModel.getObjectById(intersection.object.id);
    });

    muzzleFlashUntil = performance.now() + 70;

    if (!hit) {
        return;
    }

    const enemy = findEnemyFromObject(hit.object);

    if (enemy) {
        const damage = selectedWeapon === "pistol" ? inventory.pistolDamage : 35;
        const killed = damageEnemy(enemy, damage);

        if (killed) {
            console.log("Enemy eliminated");
        }
    }

    const impact = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xffd166 })
    );

    impact.position.copy(hit.point);
    scene.add(impact);

    setTimeout(() => {
        scene.remove(impact);
        impact.geometry.dispose();
        impact.material.dispose();
    }, 180);
}

function shootToast() {
    const toast = new THREE.Group();
    const crust = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.38, 0.09),
        new THREE.MeshLambertMaterial({ color: 0x9b4f20, emissive: 0x241006 })
    );
    const center = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.29, 0.1),
        new THREE.MeshLambertMaterial({ color: 0xf3bd68, emissive: 0x3a1800 })
    );
    center.position.z = 0.01;
    toast.add(crust, center);
    const direction = new THREE.Vector3();

    camera.getWorldDirection(direction);
    toast.position.copy(camera.position).addScaledVector(direction, 0.8);
    toast.userData.velocity = direction.multiplyScalar(12);
    toast.userData.damage = 35;
    toast.userData.life = 3;
    toast.rotation.set(Math.random(), Math.random(), Math.random());
    scene.add(toast);
    toastProjectiles.push(toast);
    muzzleFlashUntil = performance.now() + 120;
}

function disposeToast(toast) {
    scene.remove(toast);
    toast.traverse((object) => {
        if (object.isMesh) {
            object.geometry.dispose();
            object.material.dispose();
        }
    });
}

function updateToastProjectiles(delta) {
    for (let index = toastProjectiles.length - 1; index >= 0; index -= 1) {
        const toast = toastProjectiles[index];
        toast.position.addScaledVector(toast.userData.velocity, delta);
        toast.rotation.x += delta * 8;
        toast.rotation.z += delta * 5;
        toast.userData.life -= delta;

        const enemy = enemies.find((active) => {
            return active.alive && toast.position.distanceTo(active.mesh.position) < 1.4;
        });
        const toastHitWall = collidesWithWall(toast.position, 0.12);

        if (enemy) {
            damageEnemy(enemy, toast.userData.damage);
        }

        if (toastHitWall || toast.userData.life <= 0 || enemy) {
            disposeToast(toast);
            toastProjectiles.splice(index, 1);
        }
    }
}

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
);

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);



// shadows
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// better color
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

document.body.appendChild(renderer.domElement);


const fpsDisplay = document.createElement("div");

fpsDisplay.style.position = "fixed";
fpsDisplay.style.top = "10px";
fpsDisplay.style.right = "10px";
fpsDisplay.style.color = "#ffffff";
fpsDisplay.style.fontFamily = "Arial";
fpsDisplay.style.fontSize = "14px";
fpsDisplay.style.fontWeight = "bold";
fpsDisplay.style.padding = "5px 8px";
fpsDisplay.style.borderRadius = "4px";
fpsDisplay.style.zIndex = "9999";
fpsDisplay.style.pointerEvents = "none";

fpsDisplay.textContent = "FPS: --";

document.body.appendChild(fpsDisplay);

const scoreDisplay = document.createElement("div");
scoreDisplay.style.position = "fixed";
scoreDisplay.style.top = "35px";
scoreDisplay.style.right = "10px";
scoreDisplay.style.color = "#ffffff";
scoreDisplay.style.fontFamily = "Arial";
scoreDisplay.style.fontSize = "14px";
scoreDisplay.style.fontWeight = "bold";
scoreDisplay.style.padding = "5px 8px";
scoreDisplay.style.borderRadius = "4px";
scoreDisplay.style.zIndex = "9999";
scoreDisplay.style.pointerEvents = "none";
scoreDisplay.textContent = "Score: 0";
document.body.appendChild(scoreDisplay);

const scoreBackendUrl = "http://127.0.0.1:8000/score";

const waveDisplay = document.createElement("div");
waveDisplay.style.position = "fixed";
waveDisplay.style.top = "60px";
waveDisplay.style.right = "10px";
waveDisplay.style.color = "#ffd166";
waveDisplay.style.fontFamily = "Arial";
waveDisplay.style.fontSize = "14px";
waveDisplay.style.fontWeight = "bold";
waveDisplay.style.padding = "5px 8px";
waveDisplay.style.borderRadius = "4px";
waveDisplay.style.zIndex = "9999";
waveDisplay.style.pointerEvents = "none";
waveDisplay.textContent = "Wave: 0";
document.body.appendChild(waveDisplay);

const healthDisplay = document.createElement("div");
healthDisplay.id = "health-display";
healthDisplay.textContent = "HEALTH 100";
document.body.appendChild(healthDisplay);

const weaponDisplay = document.createElement("div");
weaponDisplay.id = "weapon-display";
weaponDisplay.textContent = "1  GUN";
document.body.appendChild(weaponDisplay);

const ammoDisplay = document.createElement("div");
ammoDisplay.id = "ammo-display";
ammoDisplay.textContent = "AMMO 12/12";
document.body.appendChild(ammoDisplay);

const eventLog = document.createElement("div");
eventLog.id = "event-log";
eventLog.innerHTML = "<strong>COMBAT LOG</strong>";
document.body.appendChild(eventLog);

function logEvent(message) {
    const entry = document.createElement("div");
    entry.textContent = `> ${message}`;
    eventLog.appendChild(entry);
    while (eventLog.children.length > 5) {
        eventLog.removeChild(eventLog.children[1]);
    }
}

const staminaDisplay = document.createElement("div");
staminaDisplay.id = "stamina-display";
staminaDisplay.textContent = "STAMINA 100";
document.body.appendChild(staminaDisplay);

const damageFlash = document.createElement("div");
damageFlash.id = "damage-flash";
document.body.appendChild(damageFlash);

// fps
let frames = 0;
let lastFPSUpdate = performance.now();

function updateFPS() {
    frames++;

    const now = performance.now();

    if (now - lastFPSUpdate >= 1000) {
        const fps = Math.round(
            frames / ((now - lastFPSUpdate) / 1000)
        );

        fpsDisplay.textContent = `FPS: ${fps}`;

        frames = 0;
        lastFPSUpdate = now;
    }
}
const gunLoader = new THREE.GLTFLoader();

function loadViewModel(path, position, scale, onLoad) {
    gunLoader.load(path, (gltf) => {
        const model = gltf.scene;
        model.position.copy(position);
        model.scale.set(scale, scale, scale);
        model.traverse((object) => {
            if (object.isMesh) {
                object.castShadow = true;
            }
        });
        viewModel.add(model);
        onLoad(model);
    }, undefined, (error) => console.error(`Failed to load ${path}:`, error));
}

loadViewModel(
    "assets/models/pistol.glb",
    new THREE.Vector3(-0.3, -0.3, -0.7),
    0.1,
    (model) => {
        pistolModel = model;
        pistolModel.rotation.y = Math.PI / 2;
        pistolModel.visible = false;
    }
);

loadViewModel(
    "assets/models/melee_hand.glb",
    new THREE.Vector3(0.25, -0.35, -0.75),
    0.14,
    (model) => {
        meleeHandModel = model;
        meleeHandModel.visible = false;
    }
);

gunLoader.load(
    "assets/models/gun.glb",

    function (gltf) {

        gunModel = gltf.scene;

        viewModel.add(gunModel);

        //position the gun in front of the camera
        gunModel.position.set(
            0.3,
            -0.3,
            -0.7
        );

        gunModel.rotation.y = Math.PI / 2; 

        //adjust if needed
        gunModel.scale.set(
            .1,
            .1,
            .1
        );

        console.log("Gun loaded!");
    },

    undefined,

    function (error) {

        console.error(
            "Gun failed to load:",
            error
        );

    }
);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const sun = new THREE.DirectionalLight(
    0xffffff,
    2.0
);

sun.position.set(
    10,
    20,
    10
);

sun.castShadow = true;


sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;

//sun
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 100;

sun.shadow.camera.left = -50;
sun.shadow.camera.right = 50;
sun.shadow.camera.top = 50;
sun.shadow.camera.bottom = -50;

sun.shadow.bias = -0.0001;
sun.shadow.normalBias = 0.02;

scene.add(sun);

const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(6, 24, 16),
    new THREE.MeshBasicMaterial({
        color: 0xffe28a
    })
);

sunMesh.position.set(35, 30, -45);
scene.add(sunMesh);

const hemiLight = new THREE.HemisphereLight(
    0xbfd8ff, // Sky
    0x332211, // Ground
    0.8
);

scene.add(hemiLight);

const fillLight = new THREE.DirectionalLight(
    0x9bbcff,
    0.35
);

fillLight.position.set(
    -10,
    8,
    -10
);

scene.add(fillLight);



window.addEventListener("resize", () => {
    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    if (camera) {
        camera.aspect =
            window.innerWidth /
            window.innerHeight;

        camera.updateProjectionMatrix();
    }
});




//function animate() {
//    requestAnimationFrame(animate);


//    renderer.render(
//        scene,
//        camera
//    );
//}

//animate();


// Map selector

const mapLoader = new THREE.GLTFLoader();
let activeMap = null;
const mapSelector = document.createElement("select");
mapSelector.id = "map-selector";
mapSelector.innerHTML = "<option value='test_map.glb'>TEST MAP</option><option value='scene_map.glb'>SCENE MAP</option>";
mapSelector.addEventListener("change", () => loadMap(mapSelector.value));
document.body.appendChild(mapSelector);

function loadMap(fileName) {
    if (activeMap) {
        scene.remove(activeMap);
        wallBoxes.length = 0;
        sphereColliders.length = 0;
    }

    mapLoader.load(
        `./assets/maps/${fileName}`,

        (gltf) => {

        const map = gltf.scene;
        activeMap = map;

        scene.add(map);

        map.traverse((object) => {

            if (object.isMesh) {

                object.castShadow = true;
                object.receiveShadow = true;

                if (object.geometry) {
                    object.geometry.computeVertexNormals();
                }

                const materials = Array.isArray(object.material)
                    ? object.material
                    : [object.material];

                for (const material of materials) {
                    if (material) {
                        material.flatShading = false;
                        material.needsUpdate = true;
                    }
                }

                object.updateWorldMatrix(true, true);
                const bounds = new THREE.Box3().setFromObject(object);
                const size = bounds.getSize(new THREE.Vector3());
                const largestDimension = Math.max(size.x, size.y, size.z);
                const smallestDimension = Math.min(size.x, size.y, size.z);
                const isSphere =
                    /sphere|ball|orb/i.test(object.name) ||
                    (object.geometry.attributes.position.count > 50 &&
                        smallestDimension > 0 &&
                        largestDimension / smallestDimension < 1.2);

                if (isSphere) {
                    sphereColliders.push({
                        center: bounds.getCenter(new THREE.Vector3()),
                        radius: largestDimension / 2
                    });
                } else {
                    wallBoxes.push(bounds);
                }
            }

        });


        console.log(
            "Map loaded:",
            wallBoxes.length + sphereColliders.length,
            "collision objects"
        );
        },

        undefined,

        (error) => {
            console.error(
                "Failed to load map:",
                error
            );
        }
    );
}

loadMap("test_map.glb");

scene.add(camera);


//player config
const player = {
    position: new THREE.Vector3(0, 0, 5),

    standingHeight: 1.35,
    crouchingHeight: 0.9,
    height: 1.35,

    radius: 0.45,

    standingSpeed: 5,
    crouchingSpeed: 2.5,

    sprinting: false,
    sprintingSpeed: 8,

    crouchSpeed: 10,

    jumpForce: 6,
    velocityY: 0,

    grounded: false,
    crouching: false,

    moveVelocity: new THREE.Vector3(),

    acceleration: 25,
    deceleration: 30,

    maxHealth: 100,
    health: 100,
    maxStamina: 100,
    stamina: 100,
    damageCooldown: 0,
    lastDamageFlash: 0
};

const enemies = [];
const enemyProjectiles = [];
let enemyCounter = 0;
const scoreState = {
    value: 0
};

const waveState = {
    current: 0,
    enemiesRemaining: 0,
    spawnDelay: 0,
    nextWaveDelay: 0
};

function updateScoreDisplay() {
    scoreDisplay.textContent = `Score: ${scoreState.value}`;
}

function saveScore() {
    fetch(scoreBackendUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            player: "Player",
            score: scoreState.value
        })
    }).catch(() => {
        console.warn("Score server is unavailable");
    });
}

function updateWaveDisplay() {
    waveDisplay.textContent = `Wave: ${waveState.current}`;
}

function getRandomSpawnPoint() {
    for (let attempt = 0; attempt < 40; attempt += 1) {
        const x = THREE.MathUtils.randFloat(-14, 14);
        const z = THREE.MathUtils.randFloat(-14, 14);
        const candidate = new THREE.Vector3(x, 0.1, z);
        const farFromPlayer = candidate.distanceTo(player.position) > 6;
        const farFromEnemies = enemies.every((enemy) => {
            return !enemy.alive || candidate.distanceTo(enemy.mesh.position) > 2;
        });

        if (farFromPlayer && farFromEnemies && !collidesWithWall(candidate, 0.5)) {
            return [x, z];
        }
    }

    return [
        THREE.MathUtils.randFloat(-14, 14),
        THREE.MathUtils.randFloat(-14, 14)
    ];
}

function spawnEnemy(x, z) {
    const group = new THREE.Group();

    const speech = document.createElement("div");
    speech.textContent = "Ich weiß nicht";
    speech.style.position = "fixed";
    speech.style.padding = "4px 7px";
    speech.style.background = "rgba(255, 255, 255, 0.9)";
    speech.style.color = "#222222";
    speech.style.borderRadius = "4px";
    speech.style.fontFamily = "Arial";
    speech.style.fontSize = "13px";
    speech.style.fontWeight = "bold";
    speech.style.pointerEvents = "none";
    speech.style.zIndex = "1000";
    speech.style.display = "none";
    document.body.appendChild(speech);

    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x8b1e1e });
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 1.2, 0.6),
        bodyMaterial
    );
    body.position.y = 0.9;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const armored = Math.random() < 0.05;
    const armor = new THREE.Mesh(
        new THREE.BoxGeometry(0.98, 0.82, 0.12),
        new THREE.MeshLambertMaterial({ color: 0x6f8790, metalness: 0.75, roughness: 0.3 })
    );
    armor.position.set(0, 0.95, 0.33);
    armor.castShadow = true;
    armor.visible = armored;
    group.add(armor);

    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 16, 16),
        new THREE.MeshLambertMaterial({ color: 0xd9d2c4 })
    );
    head.position.y = 1.8;
    head.castShadow = true;
    group.add(head);

    const enemy = {
        id: enemyCounter++,
        mesh: group,
        radius: 0.5,
        speed: 1.8,
        attackCooldown: 0,
        hitFlash: 0,
        health: 100,
        alive: true,
        body: body,
        armor: armor,
        armored: armored,
        head: head,
        speech: speech,
        speechTime: 0
    };

    const baguette = new THREE.Group();
    const bread = new THREE.Mesh(
        new THREE.CylinderGeometry(0.27, 0.2, 1.7, 16),
        new THREE.MeshLambertMaterial({ color: 0xc8782e })
    );
    bread.rotation.z = Math.PI / 2;
    bread.castShadow = true;
    baguette.add(bread);

    const breadEndMaterial = new THREE.MeshLambertMaterial({ color: 0xe5a04b });
    for (const x of [-0.88, 0.88]) {
        const end = new THREE.Mesh(
            new THREE.SphereGeometry(0.21, 12, 8),
            breadEndMaterial
        );
        end.position.x = x;
        end.castShadow = true;
        baguette.add(end);
    }

    const scoringMaterial = new THREE.MeshLambertMaterial({ color: 0x8f431b });
    for (const x of [-0.48, -0.16, 0.16, 0.48]) {
        const scoring = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.04, 0.34),
            scoringMaterial
        );
        scoring.position.set(x, 0.23, 0);
        scoring.rotation.z = -0.35;
        baguette.add(scoring);
    }

    baguette.position.y = 1.05;
    baguette.castShadow = true;
    baguette.visible = false;
    group.add(baguette);
    enemy.baguette = baguette;

    group.position.set(x, 0.1, z);
    group.userData.enemy = enemy;
    body.userData.enemy = enemy;
    armor.userData.enemy = enemy;
    head.userData.enemy = enemy;

    scene.add(group);
    enemies.push(enemy);
    setEnemyBaguetteMode(enemy, selectedWeapon === "toaster");

    return enemy;
}

function setEnemyBaguetteMode(enemy, enabled) {
    enemy.body.visible = !enabled;
    enemy.armor.visible = enemy.armored && !enabled;
    enemy.head.visible = !enabled;
    enemy.baguette.visible = enabled;
}

function beginWave(number) {
    waveState.current = number;
    waveState.enemiesRemaining = 3 + number * 2;
    waveState.spawnDelay = 0.5;
    waveState.nextWaveDelay = 0;
    updateWaveDisplay();
}

function updateWaves(delta) {
    if (waveState.current === 0) {
        beginWave(1);
        return;
    }

    if (waveState.enemiesRemaining > 0) {
        waveState.spawnDelay -= delta;

        if (waveState.spawnDelay <= 0) {
            const [x, z] = getRandomSpawnPoint();
            spawnEnemy(x, z);
            waveState.enemiesRemaining -= 1;
            waveState.spawnDelay = Math.max(0.35, 1.1 - waveState.current * 0.08);
        }

        return;
    }

    const aliveEnemies = enemies.filter((enemy) => enemy.alive).length;

    if (aliveEnemies === 0) {
        if (waveState.nextWaveDelay === 0) {
            waveState.nextWaveDelay = 1.5;
        }

        waveState.nextWaveDelay -= delta;

        if (waveState.nextWaveDelay <= 0) {
            beginWave(waveState.current + 1);
        }
    }
}

function spawnInitialEnemies() {
    beginWave(1);
}

function findEnemyFromObject(object) {
    let current = object;

    while (current) {
        if (current.userData && current.userData.enemy && current.userData.enemy.alive) {
            return current.userData.enemy;
        }
        current = current.parent;
    }

    return null;
}

function damageEnemy(enemy, amount) {
    if (!enemy || !enemy.alive) {
        return false;
    }

    enemy.health -= enemy.armored ? amount * 0.5 : amount;
    enemy.hitFlash = 0.14;

    if (enemy.health <= 0) {
        enemy.alive = false;
        createMeatDrop(enemy.mesh.position);
        if (enemy.armored) {
            createPistolDrop(enemy.mesh.position);
        }
        scene.remove(enemy.mesh);
        enemy.speech.remove();
        scoreState.value += 100;
        updateScoreDisplay();
        saveScore();

        if (waveState.enemiesRemaining === 0 && enemies.filter((active) => active.alive).length === 0) {
            waveState.nextWaveDelay = 1.5;
        }

        return true;
    }

    return false;
}

function updateMeatDrops(delta, time) {
    for (let index = meatDrops.length - 1; index >= 0; index -= 1) {
        const meat = meatDrops[index];
        meat.userData.life -= delta;
        meat.rotation.y += delta * 2;
        meat.position.y = meat.userData.startY + Math.sin(time * 0.004 + index) * 0.08;

        if (meat.position.distanceTo(player.position) < 1.35) {
            player.health += 25;
            disposeMeatDrop(meat);
            meatDrops.splice(index, 1);
        } else if (meat.userData.life <= 0) {
            disposeMeatDrop(meat);
            meatDrops.splice(index, 1);
        }
    }
}

function disposeMeatDrop(meat) {
    scene.remove(meat);
    meat.traverse((object) => {
        if (object.isMesh) {
            object.geometry.dispose();
            object.material.dispose();
        }
    });
}

function updatePistolDrops(delta, time) {
    for (let index = pistolDrops.length - 1; index >= 0; index -= 1) {
        const pistol = pistolDrops[index];
        pistol.userData.life -= delta;
        pistol.rotation.y += delta * 2;
        pistol.position.y = 0.2 + Math.sin(time * 0.004 + index) * 0.08;

        if (pistol.position.distanceTo(player.position) < 1.35) {
            inventory.pistolShots += 1;
            updateInventoryDisplay();
            disposePistolDrop(pistol);
            pistolDrops.splice(index, 1);
        } else if (pistol.userData.life <= 0) {
            disposePistolDrop(pistol);
            pistolDrops.splice(index, 1);
        }
    }
}

function disposePistolDrop(pistol) {
    scene.remove(pistol);
    pistol.traverse((object) => {
        if (object.isMesh) {
            object.geometry.dispose();
            object.material.dispose();
        }
    });
}

function takePlayerDamage(amount) {
    if (player.damageCooldown > 0) {
        return;
    }

    player.health = Math.max(0, player.health - amount);
    player.damageCooldown = 0.75;
    player.lastDamageFlash = 0.2;
    damageFlash.style.opacity = "0.5";

    if (player.health <= 0) {
        const savedPistolShots = inventory.pistolShots;
        player.position.set(0, 0.1, 5);
        player.velocityY = 0;
        player.health = player.maxHealth;
        inventory.pistolShots = savedPistolShots;
        updateInventoryDisplay();
        player.damageCooldown = 1.2;
    }
}

function shootEnemyProjectile(enemy) {
    const projectile = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xff3b30 })
    );
    const target = new THREE.Vector3(
        player.position.x,
        player.position.y + player.height * 0.5,
        player.position.z
    );

    projectile.position.set(
        enemy.mesh.position.x,
        enemy.mesh.position.y + 1.25,
        enemy.mesh.position.z
    );
    projectile.userData.velocity = target
        .sub(projectile.position)
        .normalize()
        .multiplyScalar(4);
    projectile.userData.life = 4;
    scene.add(projectile);
    enemyProjectiles.push(projectile);
}

function updateEnemyProjectiles(delta) {
    for (let index = enemyProjectiles.length - 1; index >= 0; index -= 1) {
        const projectile = enemyProjectiles[index];
        projectile.position.addScaledVector(projectile.userData.velocity, delta);
        projectile.userData.life -= delta;

        const distanceToPlayer = projectile.position.distanceTo(
            new THREE.Vector3(
                player.position.x,
                player.position.y + player.height * 0.5,
                player.position.z
            )
        );

        const hitWall = collidesWithWall(projectile.position, 0.12);

        if (hitWall) {
            scene.remove(projectile);
            projectile.geometry.dispose();
            projectile.material.dispose();
            enemyProjectiles.splice(index, 1);
        } else if (distanceToPlayer < player.radius + 0.15) {
            takePlayerDamage(15);
            scene.remove(projectile);
            projectile.geometry.dispose();
            projectile.material.dispose();
            enemyProjectiles.splice(index, 1);
        } else if (projectile.userData.life <= 0) {
            scene.remove(projectile);
            projectile.geometry.dispose();
            projectile.material.dispose();
            enemyProjectiles.splice(index, 1);
        }
    }
}

spawnInitialEnemies();
updateScoreDisplay();

camera.position.set(
    player.position.x,
    player.position.y + player.height,
    player.position.z
);



const floor = new THREE.Mesh(
    new THREE.BoxGeometry(30, 0.2, 30),
    new THREE.MeshLambertMaterial({
        color: 0x555555,
        transparent: true,
        opacity: 0
    })
);

floor.position.y = -0.1;

scene.add(floor);



function wall(x, y, z, width, height, depth, color = 0x888888) {

    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),

        new THREE.MeshLambertMaterial({
            color: color
        })
    );

    mesh.position.set(x, y, z);

    scene.add(mesh);

    wallBoxes.push(new THREE.Box3().setFromObject(mesh));
}


// old room

//wall(0, 2.5, -10, 20, 5, 1, 0x777777);
//wall(0, 2.5, 10, 20, 5, 1, 0x666666);
//wall(-10, 2.5, 0, 1, 5, 20, 0x888888);
//wall(10, 2.5, 0, 1, 5, 20, 0x777777);
//wall(5, 2.5, 0, 1, 1.75, 10, 0x666666);
//wall(-5, 0.5, 0, 1, .1, 4, 0x666666);
//wall(-3, 1, 0, 1, .1, 4, 0x666666);
//wall(-1, 1.6, 0, 1, .1, 3, 0x666666);


const keys = {};

document.addEventListener("keydown", (event) => {

    keys[event.code] = true;

    if (event.code === "Digit1") {
        selectWeapon("gun");
    }

    if (event.code === "Digit2") {
        selectWeapon("toaster");
    }

    if (event.code === "Digit3") {
        selectWeapon("pistol");
    }

    if (event.code === "KeyR") {
        reloadWeapon();
    }

    if (event.code === "KeyF") {
        meleeAttack();
    }

    //Crouch

    if (event.code === "ControlLeft") {
        player.crouching = true;
    }

    //SPRINT!

    if (event.code === "ShiftLeft") {
        player.sprinting = true;
    }

    //Jump

    if (
        event.code === "Space" &&
        player.grounded &&
        !player.crouching
    ) {

        player.velocityY = player.jumpForce;

        player.grounded = false;
    }
});


document.addEventListener("keyup", (event) => {

    keys[event.code] = false;

    if (event.code === "ControlLeft") {

        if (canStand()) {
            player.crouching = false;
        }

    }

    if (event.code === "ShiftLeft") {
        player.sprinting = false;
    }
});

document.body.addEventListener("click", () => {

    if (document.pointerLockElement !== document.body) {
        document.body.requestPointerLock();
        return;
    }

    shoot();

});

document.body.addEventListener("mousedown", (event) => {
    if (event.button === 2) {
        isAiming = true;
    }
});

document.body.addEventListener("mouseup", (event) => {
    if (event.button === 2) {
        isAiming = false;
    }
});

document.body.addEventListener("contextmenu", (event) => {
    event.preventDefault();
});


let yaw = 0;
let pitch = 0;

const mouseSensitivity = 0.002;

document.addEventListener("mousemove", (event) => {

    if (
        document.pointerLockElement !== document.body
    ) {
        return;
    }

    yaw -= event.movementX * mouseSensitivity;

    pitch -= event.movementY * mouseSensitivity;

    const maxPitch =
        Math.PI / 2 - 0.01;

    pitch = Math.max(
        -maxPitch,
        Math.min(maxPitch, pitch)
    );

    camera.rotation.order = "YXZ";

    camera.rotation.y = yaw;

    camera.rotation.x = pitch;

});

const playerCollider = {
    radius: 0.3
};

function collidesWithWall(position, radius = player.radius) {

    const playerBottom =
        position.y;

    const playerTop =
        position.y + player.height;

    for (const sphere of sphereColliders) {

        if (
            playerTop <= sphere.center.y - sphere.radius ||
            playerBottom >= sphere.center.y + sphere.radius
        ) {
            continue;
        }

        const dx = position.x - sphere.center.x;
        const dz = position.z - sphere.center.z;
        const combinedRadius = radius + sphere.radius;

        if (dx * dx + dz * dz < combinedRadius * combinedRadius) {
            return true;
        }
    }


    for (const box of wallBoxes) {

        //const box =
            //new THREE.Box3().setFromObject(wall);

        if (
            playerTop <= box.min.y ||
            playerBottom >= box.max.y
        ) {
            continue;
        }

        const closestX = Math.max(
            box.min.x,
            Math.min(position.x, box.max.x)
        );

        const closestZ = Math.max(
            box.min.z,
            Math.min(position.z, box.max.z)
        );

        const dx =
            position.x - closestX;

        const dz =
            position.z - closestZ;

        const distanceSquared =
            dx * dx + dz * dz;


        if (
            distanceSquared <
            radius * radius
        ) {
            return true;
        }
    }

    return false;
}

function overlapsPlayerXZ(position, box) {

    const radius = player.radius;

    const closestX = Math.max(
        box.min.x,
        Math.min(position.x, box.max.x)
    );

    const closestZ = Math.max(
        box.min.z,
        Math.min(position.z, box.max.z)
    );

    const dx =
        position.x - closestX;

    const dz =
        position.z - closestZ;

    return (
        dx * dx + dz * dz <
        radius * radius
    );
}

function overlapsPlayerSphereXZ(position, sphere) {

    const dx = position.x - sphere.center.x;
    const dz = position.z - sphere.center.z;
    const combinedRadius = player.radius + sphere.radius;

    return (
        dx * dx + dz * dz <
        combinedRadius * combinedRadius
    );
}

function canStand() {

    const feet = player.position.clone();

    //test players full standing height
    const oldHeight = player.height;

    player.height = player.standingHeight;

    const blocked =
        collidesWithWall(feet);

    player.height = oldHeight;

    return !blocked;
}

function smoothDamp(current, target, speed, delta) {

    return THREE.MathUtils.lerp(
        current,
        target,
        1 - Math.exp(-speed * delta)
    );
}

function updateMovement(delta) {

    const input = new THREE.Vector3();

//keybaord input
    if (keys["KeyW"]) input.z -= 1;
    if (keys["KeyS"]) input.z += 1;
    if (keys["KeyA"]) input.x -= 1;
    if (keys["KeyD"]) input.x += 1;

    const wantsToSprint = player.sprinting && !player.crouching && input.lengthSq() > 0;

    if (wantsToSprint && player.stamina > 0) {
        player.stamina = Math.max(0, player.stamina - 30 * delta);
    } else {
        player.stamina = Math.min(player.maxStamina, player.stamina + 20 * delta);
        if (player.stamina <= 0) {
            player.sprinting = false;
        }
    }



    if (input.lengthSq() > 0) {
        input.normalize();
    }


    input.applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        yaw
    );
    let speed;

    if (player.crouching) {
        player.sprinting = false;
    }

    if (player.crouching) {
        
        speed = player.crouchingSpeed;

    } else if (player.sprinting && player.stamina > 0) {

        speed = player.sprintingSpeed;

    } else {

        speed = player.standingSpeed;

    }

    const targetVelocity =
        input.multiplyScalar(speed);
    const acceleration =
        input.lengthSq() > 0
            ? player.acceleration
            : player.deceleration;


    player.moveVelocity.x = smoothDamp(
        player.moveVelocity.x,
        targetVelocity.x,
        acceleration,
        delta
    );

    player.moveVelocity.z = smoothDamp(
        player.moveVelocity.z,
        targetVelocity.z,
        acceleration,
        delta
    );

    const movement =
        player.moveVelocity.clone()
            .multiplyScalar(delta);

    const xPosition =
        player.position.clone();

    xPosition.x += movement.x;

    if (!collidesWithWall(xPosition)) {

        player.position.x =
            xPosition.x;

    } else {

        player.moveVelocity.x = 0;
    }
    const zPosition =
        player.position.clone();

    zPosition.z += movement.z;

    if (!collidesWithWall(zPosition)) {

        player.position.z =
            zPosition.z;

    } else {

        player.moveVelocity.z = 0;
    }
}
//
function updateEnemies(delta) {
    const enemyContactDistance = player.radius + 0.5 + 0.25;

    for (const enemy of enemies) {
        if (!enemy.alive) {
            continue;
        }

        const dx = player.position.x - enemy.mesh.position.x;
        const dz = player.position.z - enemy.mesh.position.z;
        const distance = Math.hypot(dx, dz);

        enemy.hitFlash = Math.max(0, enemy.hitFlash - delta);
        enemy.speechTime = Math.max(0, enemy.speechTime - delta);
        enemy.speech.style.display = enemy.speechTime > 0 ? "block" : "none";

        if (enemy.speechTime > 0) {
            const speechPosition = enemy.mesh.position.clone();
            speechPosition.y += 2.4;
            speechPosition.project(camera);
            enemy.speech.style.left = `${(speechPosition.x * 0.5 + 0.5) * window.innerWidth}px`;
            enemy.speech.style.top = `${(-speechPosition.y * 0.5 + 0.5) * window.innerHeight}px`;
            enemy.speech.style.transform = "translate(-50%, -100%)";
        }

        enemy.body.material.color.setHex(
            enemy.hitFlash > 0 ? 0xff5a5a : 0x8b1e1e
        );

        if (distance > enemyContactDistance) {
            const directionX = dx / distance;
            const directionZ = dz / distance;
            const step = Math.min(
                enemy.speed * delta,
                distance - enemyContactDistance
            );
            const nextPosition = new THREE.Vector3(
                enemy.mesh.position.x + directionX * step,
                enemy.mesh.position.y,
                enemy.mesh.position.z + directionZ * step
            );

            nextPosition.y = 0.1;

            if (!collidesWithWall(nextPosition, enemy.radius)) {
                enemy.mesh.position.x = nextPosition.x;
                enemy.mesh.position.z = nextPosition.z;
            } else {
                const sideStep = enemy.speed * delta;
                const leftPosition = new THREE.Vector3(
                    enemy.mesh.position.x - directionZ * sideStep,
                    0.1,
                    enemy.mesh.position.z + directionX * sideStep
                );
                const rightPosition = new THREE.Vector3(
                    enemy.mesh.position.x + directionZ * sideStep,
                    0.1,
                    enemy.mesh.position.z - directionX * sideStep
                );
                const leftOpen = !collidesWithWall(leftPosition, enemy.radius);
                const rightOpen = !collidesWithWall(rightPosition, enemy.radius);

                if (leftOpen || rightOpen) {
                    const leftDistance = leftPosition.distanceToSquared(player.position);
                    const rightDistance = rightPosition.distanceToSquared(player.position);
                    const chosenPosition = leftOpen && (!rightOpen || leftDistance < rightDistance)
                        ? leftPosition
                        : rightPosition;

                    enemy.mesh.position.x = chosenPosition.x;
                    enemy.mesh.position.z = chosenPosition.z;
                }
            }

            enemy.mesh.rotation.y = Math.atan2(directionX, directionZ);
        }

        enemy.attackCooldown = Math.max(0, enemy.attackCooldown - delta);

        if (distance <= enemyContactDistance + 0.2 && enemy.attackCooldown <= 0) {
            takePlayerDamage(10);
            enemy.speechTime = 1.2;
            enemy.attackCooldown = 1.2;
        } else if (distance < 18 && enemy.attackCooldown <= 0) {
            shootEnemyProjectile(enemy);
            enemy.attackCooldown = 1.5;
        }
    }
}

function updateGravity(delta) {

    const gravity = 18;

    const targetHeight = //crouch height
        player.crouching
            ? player.crouchingHeight
            : player.standingHeight;

    player.height = THREE.MathUtils.lerp(
        player.height,
        targetHeight,
        1 - Math.exp(
            -player.crouchSpeed * delta
        )
    );


    player.velocityY -= gravity * delta;

    const oldY = player.position.y;

    const newY =
        oldY +
        player.velocityY * delta;



// floor


    let landingY = 0.1;

//collision
    if (player.velocityY <= 0) {

        for (const sphere of sphereColliders) {

            if (
                !overlapsPlayerSphereXZ(
                    player.position,
                    sphere
                )
            ) {
                continue;
            }

            const sphereTop = sphere.center.y + sphere.radius;

            if (oldY >= sphereTop && newY <= sphereTop) {
                landingY = Math.max(landingY, sphereTop);
            }
        }

        for (const box of wallBoxes) {

            //const box =
            //    new THREE.Box3().setFromObject(wall);
            if (
                !overlapsPlayerXZ(
                    player.position,
                    box
                )
            ) {
                continue;
            }
            if (
                oldY >= box.max.y &&
                newY <= box.max.y
            ) {

                landingY = Math.max(
                    landingY,
                    box.max.y
                );
            }
        }
    }

    if (player.velocityY > 0) {

        for (const sphere of sphereColliders) {

            if (
                !overlapsPlayerSphereXZ(
                    player.position,
                    sphere
                )
            ) {
                continue;
            }

            const sphereBottom = sphere.center.y - sphere.radius;
            const oldTop = oldY + player.height;
            const newTop = newY + player.height;

            if (oldTop <= sphereBottom && newTop >= sphereBottom) {
                player.position.y = sphereBottom - player.height;
                player.velocityY = 0;
                return;
            }
        }

        for (const box of wallBoxes) {

            if (!overlapsPlayerXZ(player.position, box)) {
                continue;
            }

            const oldTop = oldY + player.height;
            const newTop = newY + player.height;

            if (oldTop <= box.min.y && newTop >= box.min.y) {
                player.position.y = box.min.y - player.height;
                player.velocityY = 0;
                return;
            }
        }
    }

    if (newY <= landingY) {

        player.position.y = landingY;

        player.velocityY = 0;

        player.grounded = true;

    } else {

        player.position.y = newY;

        player.grounded = false;
    }


    // uncrouch after walking out from underneath a part
    if (
        player.crouching &&
        !keys["ControlLeft"] &&
        canStand()
    ) {
        player.crouching = false;
    }
}

//CROSSHAIR
let crosshairGap = 5;

function updateCrosshair(delta) {

    const canvas =
        document.getElementById("crosshair");

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const width = window.innerWidth;
    const height = window.innerHeight;

    if (
        canvas.width !== width ||
        canvas.height !== height
    ) {
        canvas.width = width;
        canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    const horizontalSpeed =
        Math.sqrt(
            player.moveVelocity.x ** 2 +
            player.moveVelocity.z ** 2
        );

    const maxSpeed =
        player.sprintingSpeed ||
        player.standingSpeed;

    const speedAmount =
        Math.min(
            horizontalSpeed / maxSpeed,
            1
        );


    let targetGap = 5;

    targetGap += speedAmount * 5;

    if (player.crouching) {
        targetGap -= 1;
    }


    if (player.sprinting) {
        targetGap += 9;
    }

    if (!player.grounded) {
        targetGap += 14;
    }


    targetGap = Math.max(
        targetGap,
        2
    );
    const smoothing = 12;

    crosshairGap +=
        (targetGap - crosshairGap) *
        Math.min(smoothing * delta, 1);
    const centerX = width / 2;
    const centerY = height / 2;

    const armLength = 7;
    const thickness = 2;


    ctx.fillStyle = "white";

    ctx.shadowColor = "black";
    ctx.shadowBlur = 3;
    ctx.fillRect(
        centerX - thickness / 2,
        centerY - crosshairGap - armLength,
        thickness,
        armLength
    );
    ctx.fillRect(
        centerX - thickness / 2,
        centerY + crosshairGap,
        thickness,
        armLength
    );

    ctx.fillRect(
        centerX - crosshairGap - armLength,
        centerY - thickness / 2,
        armLength,
        thickness
    );
    ctx.fillRect(
        centerX + crosshairGap,
        centerY - thickness / 2,
        armLength,
        thickness
    );


    ctx.shadowBlur = 0;
}


//MAIN loop

let lastTime = performance.now();

function gameLoop(time) {

    const delta =
        Math.min(
            (time - lastTime) / 1000,
            0.05
        );

    lastTime = time;

    updateMovement(delta);

    updateGravity(delta);
    meleeCooldown = Math.max(0, meleeCooldown - delta);
    reloadCooldown = Math.max(0, reloadCooldown - delta);
    if (reloadCooldown === 0) {
        updateAmmoDisplay();
    }

    updateFPS();

    updateWaves(delta);
    updateEnemies(delta);
    updateEnemyProjectiles(delta);
    updateToastProjectiles(delta);
        updateMeatDrops(delta, time);
    updatePistolDrops(delta, time);
    updateMeleeAnimation(delta);
    updateAiming(delta);

    player.damageCooldown = Math.max(0, player.damageCooldown - delta);
    player.lastDamageFlash = Math.max(0, player.lastDamageFlash - delta);
    healthDisplay.textContent = `HEALTH ${Math.ceil(player.health)}`;
    staminaDisplay.textContent = `STAMINA ${Math.ceil(player.stamina)}`;
    damageFlash.style.opacity = String(player.lastDamageFlash * 2.5);

    updateCrosshair(delta);

    // follow player
    camera.position.set(
        player.position.x,
        player.position.y + player.height,
        player.position.z
    );

    renderer.render(
        scene,
        camera
    );

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
window.addEventListener("resize", () => {
    camera.aspect =
        window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
    renderer.setPixelRatio(
        window.devicePixelRatio
    );
});
