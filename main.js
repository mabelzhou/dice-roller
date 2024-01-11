import './style.css'
import 'bootstrap';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js'
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

document.addEventListener('DOMContentLoaded', () => {  
  createTable();
  let addDiceBtn = document.getElementById('add-dice-btn');
  let rollDiceBtn = document.getElementById('roll-dice-btn');
  let clearDiceBtn = document.getElementById('clear-dice-btn');

  addDiceBtn.addEventListener('click', addDice);
  rollDiceBtn.addEventListener('click', rollDice);
  clearDiceBtn.addEventListener('click', clearDice);

});

// create scene, camera and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#bg'),
});

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.set(50, 30, 50);
camera.lookAt(new THREE.Vector3(30, 0, 30)); 

// lighting
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 10, 0);
light.castShadow = true;
light.shadow.radius = 1; // softer shadows
light.shadow.mapSize.width = 1024; // increase shadowmap size
light.shadow.mapSize.height = 1024; 

// Increase the size of the shadow camera frustum
light.shadow.camera.left = -100;
light.shadow.camera.right = 100;
light.shadow.camera.top = 100;
light.shadow.camera.bottom = -100;

renderer.shadowMap.enabled = true;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(light, ambientLight);

// helpers
const lightHelper = new THREE.PointLightHelper(light);
const gridHelper = new THREE.GridHelper(200, 50);
scene.add(lightHelper, gridHelper);

// orbit controls
const controls = new OrbitControls(camera, renderer.domElement);

// physics
let physicsWorld = new CANNON.World({});
let lastTime;

function animate() {
    requestAnimationFrame(animate);

    // Get the time since the last frame
    const time = performance.now() / 1000; // Convert to seconds
    const deltaTime = lastTime !== undefined ? time - lastTime : 0;
    lastTime = time;

    // Step the physics simulation
    physicsWorld.step(deltaTime);

    // Sync the dice
    for (let die of dice) {
        die.position.copy(die.body.position);
        die.quaternion.copy(die.body.quaternion);
    }

    renderer.render(scene, camera);
}

initPhysics();
createFloor();

/* DICE VARIABLES */
const params = {
    edgeRadius: .07,
    radius : 1,
}

let dice = [];
let diceBox;
let diceBoxBody;
clearDice();
animate();

/* CREATE SCENE */

function createFloor() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200, 1, 1),
    new THREE.MeshStandardMaterial({
        color: "white",
    })
  );
  floor.receiveShadow = true;
  floor.position.y = -7;
  floor.quaternion.setFromAxisAngle(new THREE.Vector3(-1, 0, 0), Math.PI * .5);
  scene.add(floor);

  const floorShape = new CANNON.Plane();
  const floorBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
  });
  floorBody.addShape(floorShape);
  floorBody.position.copy(floor.position);
  floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  physicsWorld.addBody(floorBody);
}

/* DICE FUNCTIONS */

// adds a random die to the scene and world
function addDice() {
    const possibleSides = [4, 6, 8, 10, 12, 20];
    let newDie = createDie(possibleSides[Math.floor(Math.random() * possibleSides.length)]);

    dice.push(newDie);
    scene.add(newDie);
}

// function to remove diceBox and roll dice with impulse 
function rollDice() {
    // Check if diceBox is in the world
    if (diceBoxBody && physicsWorld.bodies.includes(diceBoxBody)) {
        physicsWorld.removeBody(diceBoxBody);
    }

    // Roll each die
    for (let die of dice) {
        die.body.applyImpulse(new CANNON.Vec3(Math.random() * 10, Math.random() * 10, Math.random() * 10), die.body.position);
    }

    // get total from dice - not working
    /* let total = 0;
    setTimeout(() => {
        for (let die of dice) {
            let num = getFacingNumber(die);
            console.log(num);
            total += num;
        }
        console.log(total);
    }, 10000); // delay of 7000 milliseconds, or 7 seconds */
}

// function for clearDice button - all dice from the world and scene then adds diceBox back to the world to catch new dice
function clearDice() {
    // remove dice
    for (let die of dice) {
        if (die && die.body && die.body.world) {
            scene.remove(die);
            physicsWorld.removeBody(die.body);
        }
    }

    // Check if diceBox is in the world
    if (diceBoxBody && physicsWorld.bodies.includes(diceBoxBody)) {
        physicsWorld.removeBody(diceBoxBody);
    }

    // add physics to dice box plane
    diceBoxBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Plane(),
    });
    diceBoxBody.position.y = 7;
    diceBoxBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);

    // collision groups
    /* diceBoxBody.collisionFilterGroup = envGroup;
    diceBoxBody.collisionFilterMask = diceGroup; */

    physicsWorld.addBody(diceBoxBody);
}

// function to create die based on number of sides - 4, 6, 8, 10, 12, 20
function createDie(sides) {
    let geometry;
    switch(sides) {
        case 4:
            geometry = new THREE.TetrahedronGeometry(params.radius, 0);
            break;
        case 6: // box geometry doesn't work with cannon so we have to make a cube
            const verticesOfCube = [
                -1,-1,-1,    1,-1,-1,    1, 1,-1,    -1, 1,-1,
                -1,-1, 1,    1,-1, 1,    1, 1, 1,    -1, 1, 1,
            ];
            const indicesOfFaces = [
                2,1,0,    0,3,2,
                0,4,7,    7,3,0,
                0,1,5,    5,4,0,
                1,2,6,    6,5,1,
                2,3,7,    7,6,2,
                4,5,6,    6,7,4
            ];
            geometry = new THREE.PolyhedronGeometry( verticesOfCube, indicesOfFaces, params.radius, 0 );
            break;
        case 8:
            geometry = new THREE.OctahedronGeometry(params.radius, 0);
            geometry.rotateY(Math.PI / 4); // rotate to match text
            break;
        case 10: // three does not have a d10 shape, so we have to make one
            const vertices = [
                [0, 0, 1],
                [0, 0, -1],
                ].flat();
        
            for (let i = 0; i < sides; ++i) {
            const b = (i * Math.PI * 2) / sides;
            vertices.push(-Math.cos(b), -Math.sin(b), 0.105 * (i % 2 ? 1 : -1));
            }
        
            const faces = [
                [0, 2, 3],
                [0, 3, 4],
                [0, 4, 5],
                [0, 5, 6],
                [0, 6, 7],
                [0, 7, 8],
                [0, 8, 9],
                [0, 9, 10],
                [0, 10, 11],
                [0, 11, 2],
                [1, 3, 2],
                [1, 4, 3],
                [1, 5, 4],
                [1, 6, 5],
                [1, 7, 6],
                [1, 8, 7],
                [1, 9, 8],
                [1, 10, 9],
                [1, 11, 10],
                [1, 2, 11],
                ].flat();
            const args = [vertices, faces, params.radius, 0];
            geometry = new THREE.PolyhedronGeometry(...args);
            geometry.rotateX(Math.PI / 2); // rotate to match text
            break;
        case 12:
            geometry = new THREE.DodecahedronGeometry(params.radius, 0);
            break;
        case 20:
            geometry = new THREE.IcosahedronGeometry(params.radius, 0);
            break;
        default:
            throw new Error(`Invalid number of sides: ${sides}`);
    }
    const materials = new THREE.MeshStandardMaterial({ color: 0xADD8E6});
    const die = new THREE.Mesh(geometry, materials);

    addText2(die, sides);
    
    // Use the function to convert the geometry to a shape
    //const shape = convertBufferGeometryToShape(geometry);
    //const shape = new CANNON.Box(new CANNON.Vec3(params.radius, params.radius, params.radius));
    const shape = getPolyhedronShape(die);

    // add physics
    let body = new CANNON.Body({
        mass: 3,
    });
    body.addShape(shape);
    body.position.set(0, 10, 0);

    // collision settings
    /* body.collisionFilterGroup = diceGroup;
    body.collisionFilterMask = envGroup;  */

    physicsWorld.addBody(body);
    die.body = body;
    die.castShadow = true;
    return die;
}

// NOT WORKING
function getFacingNumber(die) {
    let maxDot = -Infinity;
    let facingNumber = null;

    die.children.forEach((textMesh, i) => {
        let dot = textMesh.userData.faceNormal.dot(new THREE.Vector3(0, 1, 0));
        if (dot > maxDot) {
            maxDot = dot;
            facingNumber = i + 1; // assuming the text meshes are added in order
        }
    });

    return facingNumber;
}

// function to add text to die
function addText2(die, sides) {
    switch (sides) {
        case 4:
            d4Text(die);
            break;
        case 6:
            d6Text(die);
            break;
        case 8:
            d8Text(die);
            break;
        case 10:
            d10Text(die);
            break;
        case 12:
            d12Text(die);
            break;
        case 20:
            d20Text(die);
            break;
        default:
            throw new Error(`Invalid number of sides: ${sides}`);
    }
}

function d4Text(die) {
    let loader = new FontLoader();
    loader.load('helvetiker_bold.typeface.json', function(font) {
        let textMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

        let tetrahedronGeometry = new THREE.TetrahedronGeometry(params.radius);
        let positions = tetrahedronGeometry.attributes.position.array;

        let faceVertices = [];
        for (let i = 0; i < positions.length; i += 9) {
            let vertices = [
                new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]),
                new THREE.Vector3(positions[i + 3], positions[i + 4], positions[i + 5]),
                new THREE.Vector3(positions[i + 6], positions[i + 7], positions[i + 8])
            ];
            faceVertices.push(vertices);
        }

        // incorrect order - need to fix
        let faceNumbers = [
            [1, 2, 3],
            [1, 2, 4],
            [1, 4, 3],
            [2, 3, 4],
        ];

        faceVertices.forEach((vertices, i) => {
            faceNumbers[i].forEach((number, j) => {
                let textGeometry = new TextGeometry(String(number), {
                    font: font,
                    size: 0.4,
                    height: 0.01,
                });
                textGeometry.center();

                let textMesh = new THREE.Mesh(textGeometry, textMaterial);

                // calculate the centroid of the face
                let centroid = new THREE.Vector3();
                vertices.forEach(v => centroid.add(v));
                centroid.divideScalar(vertices.length);

                // calculate the position of the number by interpolating between the vertex and the centroid
                let numberPosition = new THREE.Vector3().lerpVectors(vertices[j], centroid, 0.3);

                // Position the text at the calculated position
                textMesh.position.copy(numberPosition);

                //  normal of the face
                let normal = new THREE.Vector3().crossVectors(
                    new THREE.Vector3().subVectors(vertices[1], vertices[0]),
                    new THREE.Vector3().subVectors(vertices[2], vertices[0])
                ).normalize();

                // orient the text to be perpendicular to the face
                textMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

                die.add(textMesh);
            });
        });
    });
}

// incorrect d4 text function - uses one number on each face, isn't useful except for show
function d4Text2(die) {
    let loader = new FontLoader();
    loader.load('helvetiker_bold.typeface.json', function(font) {
        let textMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

        let tetrahedronGeometry = new THREE.TetrahedronGeometry(params.radius);
        let positions = tetrahedronGeometry.attributes.position.array;

        let faceVertices = [];
        for (let i = 0; i < positions.length; i += 9) {
            let vertices = [
                new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]),
                new THREE.Vector3(positions[i + 3], positions[i + 4], positions[i + 5]),
                new THREE.Vector3(positions[i + 6], positions[i + 7], positions[i + 8])
            ];
            faceVertices.push(vertices);
        }

        let faceNumbers = [1, 2, 3, 4];

        faceVertices.forEach((vertices, i) => {
            let textGeometry = new TextGeometry(String(faceNumbers[i]), {
                font: font,
                size: 0.5,
                height: 0.01,
            });
            textGeometry.center();

            let textMesh = new THREE.Mesh(textGeometry, textMaterial);

            // Calculate the centroid of the face
            let centroid = new THREE.Vector3();
            vertices.forEach(v => centroid.add(v));
            centroid.divideScalar(vertices.length);

            // Position the text at the centroid of the face
            textMesh.position.copy(centroid);

            // Calculate the normal of the face
            let normal = new THREE.Vector3().crossVectors(
                new THREE.Vector3().subVectors(vertices[1], vertices[0]),
                new THREE.Vector3().subVectors(vertices[2], vertices[0])
            ).normalize();

            // Orient the text to be perpendicular to the face
            textMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

            die.add(textMesh);
        });
    });
}

function d6Text(die) {
    let loader = new FontLoader();
    loader.load('helvetiker_bold.typeface.json', function(font) {
        let textMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        let unit = 0.6;

        // Create and position the text on each face of the cube
        for (let i = 1; i <= 6; i++) {
            let textGeometry = new TextGeometry(String(i), {
                font: font,
                size: 0.6,
                height: 0.1,
            });
            textGeometry.center();
            
            let textMesh = new THREE.Mesh(textGeometry, textMaterial);
            let faceNormal; // not used currently

            switch(i) {
                case 1:
                    textMesh.position.set(0, unit, 0); // Top face
                    textMesh.rotation.x = -Math.PI / 2;
                    faceNormal = new THREE.Vector3(0, 1, 0);
                    break;
                case 2:
                    textMesh.position.set(0, -unit, 0); // Bottom face
                    textMesh.rotation.x = Math.PI / 2;
                    faceNormal = new THREE.Vector3(0, -1, 0);
                    break;
                case 3:
                    textMesh.position.set(unit, 0, 0); // Right face
                    textMesh.rotation.y = Math.PI / 2;
                    faceNormal = new THREE.Vector3(1, 0, 0);
                    break;
                case 4:
                    textMesh.position.set(-unit, 0, 0); // Left face
                    textMesh.rotation.y = -Math.PI / 2;
                    faceNormal = new THREE.Vector3(-1, 0, 0);
                    break;
                case 5:
                    textMesh.position.set(0, 0, unit); // Front face
                    faceNormal = new THREE.Vector3(0, 0, 1);
                    break;
                case 6:
                    textMesh.position.set(0, 0, -unit); // Back face
                    textMesh.rotation.y = Math.PI;
                    faceNormal = new THREE.Vector3(0, 0, -1);
                    break;
            }

            textMesh.userData = { faceNormal: faceNormal };
            die.add(textMesh);
        }
    });
}

function d8Text(die) {
    let loader = new FontLoader();
    loader.load('helvetiker_bold.typeface.json', function(font) {
        let textMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

        // position the text on each face 
        for (let i = 1; i <= 8; i++) {
            let textGeometry = new TextGeometry(String(i), {
                font: font,
                size: 0.5,
                height: 0.1,
            });
            textGeometry.center();
            let textMesh = new THREE.Mesh(textGeometry, textMaterial);
            let unit = 0.42;
            let faceNormal;

            switch(i) {
                case 1:
                    textMesh.position.set(0, unit, unit); // Top front face
                    faceNormal = new THREE.Vector3(0, 1, 1).normalize();
                    break;
                case 2:
                    textMesh.position.set(0, -unit, -unit); // Bottom back face
                    faceNormal = new THREE.Vector3(0, -1, -1).normalize();
                    break;
                case 3:
                    textMesh.position.set(unit, unit, 0); // Top right face
                    faceNormal = new THREE.Vector3(1, 1, 0).normalize();
                    break;
                case 4:
                    textMesh.position.set(-unit, -unit, 0); // Bottom left face
                    faceNormal = new THREE.Vector3(-1, -1, 0).normalize();
                    break;
                case 5:
                    textMesh.position.set(unit, -unit, 0); // Bottom right face
                    faceNormal = new THREE.Vector3(1, -1, 0).normalize();
                    break;
                case 6:
                    textMesh.position.set(-unit, unit, 0); // Top left face
                    faceNormal = new THREE.Vector3(-1, 1, 0).normalize();
                    break;
                case 7:
                    textMesh.position.set(0, unit, -unit); // Top back face
                    faceNormal = new THREE.Vector3(0, 1, -1).normalize();
                    break;
                case 8:
                    textMesh.position.set(0, -unit, unit); // Bottom front face
                    faceNormal = new THREE.Vector3(0, -1, 1).normalize();
                    break;
            }
            textMesh.lookAt(new THREE.Vector3(0, 0, 0));
            textMesh.rotateY(Math.PI);
            textMesh.userData = { faceNormal: faceNormal };

            die.add(textMesh);
        }
    });
}

function d10Text(die) {
    let loader = new FontLoader();
    loader.load('helvetiker_bold.typeface.json', function(font) {
        let textMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

        for (let i = 1; i <= 10; i++) {
            let textGeometry = new TextGeometry(String(i), {
                font: font,
                size: 0.5,
                height: 0.1,
            });
            textGeometry.center();
            let textMesh = new THREE.Mesh(textGeometry, textMaterial);
            //let unit = 0.52;
            let angle = 4 * Math.PI / 5; // 72 degrees, divide circle by 5
            //let offset = Math.PI / 10; 
            let radius = 0.55; 

            if (i <= 5) {
                // Top half
                textMesh.position.set(
                    radius * Math.sin((i - 1) * angle),
                    radius,
                    radius * Math.cos((i - 1) * angle)
                );
                textMesh.lookAt(new THREE.Vector3(0, 0, 0));
                textMesh.rotateY(Math.PI);
            } else {
                // Bottom half
                textMesh.position.set(
                    radius * Math.sin((i - 6) * angle),
                    -radius,
                    radius * Math.cos((i - 6) * angle)
                );
                textMesh.lookAt(new THREE.Vector3(0, 0, 0));
                textMesh.rotateX(Math.PI); 
            }

            die.add(textMesh);
        }
    });
}
    
function d12Text(die) {
    let loader = new FontLoader();
    loader.load('helvetiker_bold.typeface.json', function(font) {
        let textMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

        let dodecahedronGeometry = new THREE.DodecahedronGeometry(params.radius+0.05);
        let positions = dodecahedronGeometry.attributes.position.array;

        let faceCenters = [];
        for (let i = 0; i < positions.length; i += 27) {
            let vertices = [];
            for (let j = 0; j < 27; j += 3) {
                vertices.push(new THREE.Vector3(positions[i + j], positions[i + j + 1], positions[i + j + 2]));
            }
            let faceCenter = new THREE.Vector3();
            vertices.forEach(v => faceCenter.add(v));
            faceCenter.divideScalar(vertices.length);
            faceCenters.push(faceCenter);
        }

        for (let i = 0; i < faceCenters.length; i++) {
            let textGeometry = new TextGeometry(String(i + 1), {
                font: font,
                size: 0.5,
                height: 0.1,
            });
            textGeometry.center();
            let textMesh = new THREE.Mesh(textGeometry, textMaterial);

            textMesh.position.copy(faceCenters[i]);
            textMesh.lookAt(new THREE.Vector3(0, 0, 0));
            textMesh.rotateY(Math.PI); // Rotate the text mesh by 180 degrees to match geometry

            die.add(textMesh);
        }
    });
}

/* // function to add text to d12 using normal vectors - not tested
function d12Text(die) {
    let loader = new FontLoader();
    loader.load('helvetiker_bold.typeface.json', function(font) {
        let textMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

        let dodecahedronGeometry = new THREE.DodecahedronGeometry(params.radius+0.05);
        let positions = dodecahedronGeometry.attributes.position.array;

        let faceCenters = [];
        let faceNormals = [];
        for (let i = 0; i < positions.length; i += 27) {
            let vertices = [];
            for (let j = 0; j < 27; j += 3) {
                vertices.push(new THREE.Vector3(positions[i + j], positions[i + j + 1], positions[i + j + 2]));
            }
            let faceCenter = new THREE.Vector3();
            vertices.forEach(v => faceCenter.add(v));
            faceCenter.divideScalar(vertices.length );
            faceCenters.push(faceCenter);
        
            // Calculate the face normal
            let v1 = new THREE.Vector3().subVectors(faceCenter, vertices[0]);
            let faceNormal = v1.normalize();
            faceNormals.push(faceNormal);
        }

        for (let i = 0; i < faceCenters.length; i++) {
            let textGeometry = new TextGeometry(String(i + 1), {
                font: font,
                size: 0.5,
                height: 0.1,
            });
            textGeometry.center();
            let textMesh = new THREE.Mesh(textGeometry, textMaterial);

            textMesh.position.copy(faceCenters[i]);
            textMesh.position.addScaledVector(faceNormals[i], params.radius * 0.1); // Move the text mesh slightly along the face normal
            textMesh.lookAt(new THREE.Vector3(0, 0, 0)); // Make the text face the center of the die
            textMesh.rotateY(Math.PI); // Rotate the text mesh by 180 degrees
            textMesh.userData = { faceNormal: faceNormals[i] };

            die.add(textMesh);
        }
    });
} */

function d20Text(die) {
    let loader = new FontLoader();
    loader.load('helvetiker_bold.typeface.json', function(font) {
        let textMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

        let icosahedronGeometry = new THREE.IcosahedronGeometry(params.radius+0.05);
        let positions = icosahedronGeometry.attributes.position.array;

        let faceCenters = [];
        for (let i = 0; i < positions.length; i += 9) {
            let vertices = [
                new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]),
                new THREE.Vector3(positions[i + 3], positions[i + 4], positions[i + 5]),
                new THREE.Vector3(positions[i + 6], positions[i + 7], positions[i + 8])
            ];
            let faceCenter = new THREE.Vector3();
            vertices.forEach(v => faceCenter.add(v));
            faceCenter.divideScalar(vertices.length);
            faceCenters.push(faceCenter);
        }

        for (let i = 0; i < faceCenters.length; i++) {
            let textGeometry = new TextGeometry(String(i + 1), {
                font: font,
                size: 0.3,
                height: 0.1,
            });
            textGeometry.center();
            let textMesh = new THREE.Mesh(textGeometry, textMaterial);

            textMesh.position.copy(faceCenters[i]);
            textMesh.lookAt(new THREE.Vector3(0, 0, 0));
            textMesh.rotateY(Math.PI); 

            die.add(textMesh);
        }
    });
}


function createDice(sides, qty) {
    for (let i = 0; i < qty; i++) {
        let die = createDie(sides);
        scene.add(die);
        physicsWorld.addBody(die.body);
        dice.push(die);

    }
}

function initPhysics() {
    physicsWorld = new CANNON.World({
        allowSleep: true,
    })
    physicsWorld.gravity.set(0, -9.82, 0); // m/s²
    physicsWorld.defaultContactMaterial.restitution = .3;
}

// Convert the BufferGeometry to a ConvexPolyhedron for cannon - not used anymore as buffer geometry is deprecated
function convertBufferGeometryToShape(bufferGeometry) {
    const positionAttribute = bufferGeometry.getAttribute('position');
    const cannonVertices = [];
    for (let i = 0; i < positionAttribute.count; i++) {
        cannonVertices.push(new CANNON.Vec3(
            positionAttribute.getX(i),
            positionAttribute.getY(i),
            positionAttribute.getZ(i)
        ));
    }

    const indexAttribute = bufferGeometry.getIndex();
    const cannonFaces = [];
    if (indexAttribute) { // check because sometime it doesn't work - investigate
        for (let i = 0; i < indexAttribute.count; i += 3) {
            cannonFaces.push([i, i + 1, i + 2]);
        }
    } else { 
        for (let i = 0; i < positionAttribute.count; i += 3) {
            cannonFaces.push([i, i + 1, i + 2]);
        }
    }

    const convexPolyhedron = new CANNON.ConvexPolyhedron(cannonVertices, cannonFaces);

    return convexPolyhedron;
}

// Bug: known issue with convexPolyhedorn of CANNON, hull collision causes physics simulation to crash
// https://github.com/pmndrs/cannon-es/issues/103
// using this function to convert a three.js mesh to a cannon.js shape so that dice collisions do not break physics
function getPolyhedronShape(mesh) {
    let geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", mesh.geometry.getAttribute("position"));
  
    geometry = BufferGeometryUtils.mergeVertices(geometry, 1e-4);
  
    const position = geometry.attributes.position.array;
    const index = geometry.index.array;
  
    const points = [];
    for (let i = 0; i < position.length; i += 3) {
      points.push(new CANNON.Vec3(position[i], position[i + 1], position[i + 2]));
    }
    const faces = [];
    for (let i = 0; i < index.length; i += 3) {
      faces.push([index[i], index[i + 1], index[i + 2]]);
    }
  
    return new CANNON.ConvexPolyhedron({ vertices: points, faces });
  }

// function to create a box with physics and return it
function createBox(width, height, depth, x, y, z) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({color: 0x00ff00, transparent: true, opacity: 0.1});
    const box = new THREE.Mesh(geometry, material);

    box.position.set(x, y, z);

    const shape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, depth/2));
    const body = new CANNON.Body({ mass: 1, shape: shape });

    body.position.set(x, y, z);
    box.body = body;

    return box;
}

// create table of dice rolls in DOM
function createTable() {
    let table = document.getElementById('diceTable');
    let tableBody = document.createElement('tbody');
    let diceTypes = [4, 6, 8, 10, 12, 20];
    let qty = 11;

    for (let type of diceTypes) {
        let row = document.createElement('tr');
        let dieType = document.createElement('td');
        dieType.textContent = `d${type}`;
        dieType.onclick = function() {
            console.log(`clicked d${type}`)
            createDice(type, 1);
        }
        
        row.appendChild(dieType);

        for (let i = 2; i < qty; i++) {
            let diceQty = document.createElement('td');
            diceQty.textContent = i;
            diceQty.onclick = function() {
                console.log(`clicked ${i} d${type}`)
                createDice(type, i);
            };
            row.appendChild(diceQty);
        }
        tableBody.appendChild(row);
    }

    table.appendChild(tableBody);
}