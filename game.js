
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

function shoot() {

    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    const hits = raycaster.intersectObjects(scene.children, true);
    const hit = hits.find((intersection) => {
        return !viewModel.getObjectById(intersection.object.id);
    });

    muzzleFlashUntil = performance.now() + 70;

    if (!hit) {
        return;
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


//Mmap

const mapLoader = new THREE.GLTFLoader();

mapLoader.load(
    "./assets/maps/test_map.glb",

    (gltf) => {

        const map = gltf.scene;

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

scene.add(camera);


//player config
const player = {
    position: new THREE.Vector3(0, 0, 5),

    standingHeight: 1.7,
    crouchingHeight: 1.1,
    height: 1.7,

    radius: 0.3,

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
    deceleration: 30
};

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

const p2pRoom = new URLSearchParams(window.location.search).get("room") || "fps-room";
const p2pChannel = new BroadcastChannel(`fps-p2p-${p2pRoom}`);
const remotePlayers = new Map();

const p2p = {
    localId: window.crypto && crypto.randomUUID ? crypto.randomUUID() : `peer-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    room: p2pRoom,
    channel: p2pChannel
};

function ensureRemotePlayer(id) {
    if (remotePlayers.has(id)) {
        return remotePlayers.get(id);
    }

    const group = new THREE.Group();
    const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.3, 1.0, 4, 8),
        new THREE.MeshStandardMaterial({
            color: 0x7ec8ff,
            emissive: 0x13314d,
            roughness: 0.6,
            metalness: 0.2
        })
    );

    body.position.y = 0.9;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    scene.add(group);

    const remote = {
        id,
        group,
        body,
        position: new THREE.Vector3(),
        height: 1.7,
        crouching: false,
        sprinting: false,
        grounded: true,
        yaw: 0,
        pitch: 0,
        lastSeen: performance.now()
    };

    remotePlayers.set(id, remote);
    return remote;
}

function handleRemoteMessage(message) {
    if (!message || message.peerId === p2p.localId) {
        return;
    }

    if (message.room && message.room !== p2p.room) {
        return;
    }

    if (message.type === "PLAYER_STATE") {
        const remote = ensureRemotePlayer(message.peerId);
        remote.position.set(
            message.position.x,
            message.position.y,
            message.position.z
        );
        remote.height = message.height ?? 1.7;
        remote.yaw = message.yaw ?? 0;
        remote.pitch = message.pitch ?? 0;
        remote.crouching = !!message.crouching;
        remote.sprinting = !!message.sprinting;
        remote.grounded = !!message.grounded;
        remote.lastSeen = performance.now();
        remote.group.position.copy(remote.position);
        remote.group.rotation.y = remote.yaw;
        remote.body.position.y = remote.height * 0.52;

        return;
    }

    if (message.type === "ACTION") {
        const remote = ensureRemotePlayer(message.peerId);
        remote.lastSeen = performance.now();
    }
}

function send(message) {
    if (!message) {
        return;
    }

    const payload = {
        ...message,
        peerId: p2p.localId,
        room: p2p.room,
        sentAt: performance.now()
    };

    p2pChannel.postMessage(JSON.stringify(payload));
}

p2pChannel.onmessage = (event) => {
    try {
        const message = JSON.parse(event.data);
        handleRemoteMessage(message);
    } catch (error) {
        console.warn("P2P message ignored:", error);
    }
};

send({
    type: "PLAYER_STATE",
    position: { x: player.position.x, y: player.position.y, z: player.position.z },
    height: player.height,
    crouching: player.crouching,
    sprinting: player.sprinting,
    grounded: player.grounded
});

document.addEventListener("keydown", (event) => {
    keys[event.code] = true;
    if (event.code === "ControlLeft") {
        player.crouching = true;
        send({type: "ACTION", action: "CROUCH", state: true});
    }
    if (event.code === "ShiftLeft") {
        player.sprinting = true;
        send({type: "ACTION", action: "SPRINT", state: true});
    }
    if (event.code === "Space" && player.grounded && !player.crouching) {
        player.velocityY = player.jumpForce;
        player.grounded = false;
        send({ type: "ACTION", action: "JUMP" });
    }
});

document.addEventListener("keyup", (event) => {
    keys[event.code] = false;
    if (event.code === "ControlLeft") {
        if (canStand()) {
            player.crouching = false;
            send({type: "ACTION", action: "CROUCH", state: false});
        }
    }
    if (event.code === "ShiftLeft") {
        player.sprinting = false;
        send({type: "ACTION", action: "SPRINT", state: false});
    }
});

document.body.addEventListener("click", () => {

    if (document.pointerLockElement !== document.body) {
        document.body.requestPointerLock();
        return;
    }

    shoot();
    send({ type: "ACTION", action: "SHOOT" });

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

function collidesWithWall(position) {

    const radius = player.radius;

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

    } else if (player.sprinting) {

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

    updateFPS();

    updateCrosshair(delta);

    // follow player
    camera.position.set(
        player.position.x,
        player.position.y + player.height,
        player.position.z
    );

    const p2pState = {
        type: "PLAYER_STATE",
        position: {
            x: player.position.x,
            y: player.position.y,
            z: player.position.z
        },
        height: player.height,
        yaw,
        pitch,
        crouching: player.crouching,
        sprinting: player.sprinting,
        grounded: player.grounded
    };

    if (performance.now() - (p2p.lastStateSent || 0) > 80) {
        send(p2pState);
        p2p.lastStateSent = performance.now();
    }

    for (const [peerId, remote] of remotePlayers.entries()) {
        if (performance.now() - remote.lastSeen > 5000) {
            scene.remove(remote.group);
            remotePlayers.delete(peerId);
        }
    }

    renderer.render(
        scene,
        camera
    );

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
const p2pRoomInput = document.getElementById("p2p-room");
const p2pJoinButton = document.getElementById("p2p-join");

if (p2pRoomInput && p2pJoinButton) {
    p2pRoomInput.value = p2p.room;

    p2pJoinButton.addEventListener("click", () => {
        const nextRoom = (p2pRoomInput.value || "fps-room").trim();
        if (!nextRoom) {
            return;
        }

        p2p.room = nextRoom;
        p2p.channel.close();
        p2p.channel = new BroadcastChannel(`fps-p2p-${p2p.room}`);
        p2p.channel.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                handleRemoteMessage(message);
            } catch (error) {
                console.warn("P2P message ignored:", error);
            }
        };
        send({
            type: "PLAYER_STATE",
            position: {
                x: player.position.x,
                y: player.position.y,
                z: player.position.z
            },
            height: player.height,
            yaw,
            pitch,
            crouching: player.crouching,
            sprinting: player.sprinting,
            grounded: player.grounded
        });
    });
}

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
